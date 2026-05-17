#!/usr/bin/env python3
"""Copilot PR review helper — four operations.

  ensure <PR_URL>    — bootstrap: trigger iff no review exists or is in flight
  trigger <PR_URL>   — force a fresh Copilot review (Safari session cookies)
  wait <PR_URL>      — block until the in-flight Copilot review finishes
  fetch <PR_URL>     — dump the latest session's comments + overview

Everything else (reading threads, replying, resolving) the agent does with
`gh api graphql` directly. The web-UI trigger is the only thing that genuinely
needs a helper, because Copilot's bot user can't be requested through the REST
collaborator endpoint.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://api.individual.githubcopilot.com"
GITHUB_API = "https://api.github.com"
# GitHub exposes Copilot under two distinct logins depending on the API:
# REST `/pulls/{n}/comments` returns "Copilot" (Bot display name); GraphQL
# `reviewThreads.comments.author` returns "copilot-pull-request-reviewer"
# (the stable bot login). Match both — they refer to the same actor.
# [LAW:one-source-of-truth] one set, used everywhere we identify the bot.
COPILOT_LOGINS = frozenset({"Copilot", "copilot-pull-request-reviewer"})
COPILOT_USER_ID = 175728472  # stable web-UI user ID for copilot-pull-request-reviewer


# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

def _gh(*args: str) -> str:
    """Run `gh` with stderr captured so CalledProcessError.stderr is populated.

    [LAW:single-enforcer] every shell-out goes through here so main()'s error
    handler can surface gh's own stderr as the one-line error — never to the
    terminal as a separate stream that breaks the "one error line" contract.
    """
    return subprocess.check_output(
        ["gh", *args], text=True, stderr=subprocess.PIPE
    ).strip()


def gh_token() -> str:
    return _gh("auth", "token")


def parse_pr_url(url: str) -> tuple[str, str, int]:
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    if not m:
        raise ValueError(f"Not a PR URL: {url}")
    return m.group(1), m.group(2), int(m.group(3))


def http(method: str, url: str, headers: dict | None = None, body: bytes | str | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if body is not None:
        req.data = body if isinstance(body, bytes) else body.encode()
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        # HTTPError is a URLError subclass that carries a response body;
        # treat it as a returned status, not a connection failure.
        return e.code, e.read()
    except urllib.error.URLError as e:
        raise RuntimeError(f"HTTP {method} to {url} failed: {e.reason}") from e


def copilot_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "copilot-integration-id": "copilot-developer",
        "Accept": "*/*",
        "Origin": "https://github.com",
    }


def github_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }


# ---------------------------------------------------------------------------
# Copilot session discovery + parsing
# ---------------------------------------------------------------------------

def scrape_session_payloads(owner: str, repo: str, pr_num: int, token: str) -> list[dict]:
    """Return Copilot session payloads from the PR HTML, oldest-first."""
    url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"
    status, body = http("GET", url, {"Authorization": f"token {token}", "Accept": "text/html"})
    if status != 200:
        raise RuntimeError(f"Failed to fetch PR page ({status})")
    html = body.decode("utf-8", errors="ignore")
    seen: set[str] = set()
    out: list[dict] = []
    for match in re.finditer(r'data-hydro-click="([^"]+)"', html):
        raw = match.group(1).replace("&quot;", '"')
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if data.get("event_type") != "copilot.reviews.v0.ViewSession":
            continue
        payload = data.get("payload") or {}
        sid = payload.get("session_id")
        if not sid or sid in seen:
            continue
        seen.add(sid)
        out.append(payload)
    return out


def fetch_session_logs(session_id: str, token: str) -> bytes:
    url = f"{API_BASE}/agents/sessions/{session_id}/logs"
    status, body = http("GET", url, copilot_headers(token))
    if status != 200:
        raise RuntimeError(f"Session logs fetch failed ({status}): {body[:200]!r}")
    return body


def parse_sse_events(data: bytes) -> list[dict]:
    events = []
    for line in data.decode("utf-8", errors="ignore").split("\n"):
        line = line.strip()
        if not line.startswith("data: "):
            continue
        try:
            events.append(json.loads(line[6:]))
        except json.JSONDecodeError:
            continue
    return events


def event_store_comment(event: dict) -> dict | None:
    if "choices" not in event:
        return None
    for choice in event["choices"]:
        for call in (choice.get("delta", {}).get("tool_calls") or []):
            fn = call.get("function") or {}
            if fn.get("name") == "store_comment":
                try:
                    return json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    return None
    return None


def event_content(event: dict) -> str | None:
    if "choices" not in event:
        return None
    for choice in event["choices"]:
        c = choice.get("delta", {}).get("content")
        if c:
            return c
    return None


def session_full_content(events: list[dict]) -> str:
    """Concatenate all assistant content deltas. SSE chunks are small (e.g. '## ',
    'Pull request', ' overview'); the 'generated N comments' phrase is normally
    split across multiple deltas, so full reassembly is required before regex."""
    return "".join((event_content(e) or "") for e in events)


def session_pr_overview(events: list[dict]) -> str | None:
    """Slice from the last top-level heading ('## ...' at line start) to the end."""
    full = session_full_content(events)
    matches = list(re.finditer(r'(?:^|\n)##\s+[^\n]+', full))
    if not matches:
        return None
    return full[matches[-1].start():].lstrip("\n")


def parse_generated_comment_count(content: str) -> int | None:
    """Parse 'generated N comment(s)'. Returns N, or None if the phrase is absent.

    Copilot includes this phrase iff N >= 1. A clean review (zero findings)
    omits it. Distinguishing 'clean' from 'still-in-flight' requires
    is_copilot_review_pending — this only reports presence of the phrase.
    """
    m = re.search(r'generated\s+(\d+)\s+comments?\b', content, re.IGNORECASE)
    return int(m.group(1)) if m else None


def fetch_review_threads(owner: str, repo: str, pr_num: int) -> list[dict]:
    """Return all review threads with their comments. Thread metadata (id,
    isResolved) is joined to Copilot's session findings to produce the
    canonical findings list. [LAW:one-source-of-truth] threads are a join
    key for reasoning-derived findings, never a parallel primary source.
    """
    query = (
        "query($owner:String!,$repo:String!,$num:Int!){"
        "  repository(owner:$owner,name:$repo){"
        "    pullRequest(number:$num){"
        "      reviewThreads(first:100){"
        "        nodes{ id isResolved path line"
        "          comments(first:20){ nodes{ author{login} body } } } } } } }"
    )
    out = _gh(
        "api", "graphql",
        "-f", f"query={query}",
        "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"num={pr_num}",
        "--jq", ".data.repository.pullRequest.reviewThreads.nodes",
    )
    return json.loads(out) if out else []


def match_thread(sc: dict, threads: list[dict]) -> dict | None:
    """Match a Copilot stored_comment to its inline thread, or None if suppressed.

    Match by exact body of the Copilot-authored first comment in the thread.
    Line numbers in the stored_comment record the file state at review time;
    GitHub re-anchors thread positions as later commits land, so (path, line)
    is not a stable join key. Body text IS stable — Copilot posts the same
    text it stored. [LAW:single-enforcer] one join key, used everywhere.
    """
    body = (sc.get("comment_content") or "").strip()
    if not body:
        return None
    for t in threads:
        for c in (t.get("comments", {}).get("nodes") or []):
            if (c.get("author") or {}).get("login") in COPILOT_LOGINS and (c.get("body") or "").strip() == body:
                return t
            break  # only the first comment is Copilot's; replies are not
    return None


def _thread_chain(t: dict) -> list[dict]:
    return [
        {"author": (c.get("author") or {}).get("login"), "body": c.get("body", "")}
        for c in (t.get("comments", {}).get("nodes") or [])
    ]


def _thread_first(t: dict) -> dict | None:
    nodes = t.get("comments", {}).get("nodes") or []
    return nodes[0] if nodes else None


def build_findings(stored: list[dict], threads: list[dict]) -> list[dict]:
    """Union of Copilot session findings + every open review thread, deduped.

    Two upstream streams of pending review work feed this function:
      1. Copilot's session reasoning (`stored`) — some posted as inline
         threads, some suppressed under the inline-comment cap.
      2. Every review thread on the PR (`threads`) — Copilot-authored OR
         human-authored. Real PR reviews have both; the loop must address
         both kinds.

    They overlap on Copilot threads that match a session stored_comment.
    Dedupe by thread_id: a matched Copilot thread emits once (as
    source=copilot_session), and unmatched threads emit standalone as
    source=review_thread.

    [LAW:one-source-of-truth] this function is the single source of pending
    findings for downstream consumers. Callers read this list and never
    query the threads API or the session logs themselves.
    """
    matched_ids: set[str] = set()
    findings: list[dict] = []

    for sc in stored:
        thread = match_thread(sc, threads)
        if thread is not None:
            matched_ids.add(thread["id"])
        findings.append({
            "source": "copilot_session",
            "file": sc.get("file_location") or sc.get("file") or sc.get("path"),
            "line_start": sc.get("start_line") or sc.get("line"),
            "line_end": sc.get("end_line") or sc.get("start_line") or sc.get("line"),
            "body": sc.get("comment_content", ""),
            "author": "copilot-pull-request-reviewer",
            "comment_type": sc.get("comment_type"),
            "severity": sc.get("severity"),
            "fixed": bool(sc.get("fixed")),
            "thread_id": thread["id"] if thread else None,
            "is_resolved": thread["isResolved"] if thread else None,
            "thread_comments": _thread_chain(thread) if thread else None,
        })

    for t in threads:
        if t["id"] in matched_ids:
            continue
        first = _thread_first(t) or {}
        findings.append({
            "source": "review_thread",
            "file": t.get("path"),
            "line_start": t.get("line"),
            "line_end": t.get("line"),
            "body": first.get("body", ""),
            "author": (first.get("author") or {}).get("login"),
            "comment_type": None,
            "severity": None,
            "fixed": False,
            "thread_id": t["id"],
            "is_resolved": t.get("isResolved", False),
            "thread_comments": _thread_chain(t),
        })

    return findings


# ---------------------------------------------------------------------------
# The one signal that matters
# ---------------------------------------------------------------------------

def is_copilot_review_pending(owner: str, repo: str, pr_num: int) -> bool:
    """True iff Copilot is currently a requested reviewer (review in flight).

    GitHub adds Copilot to reviewRequests when a review is triggered and
    removes it when the review is submitted. This is the only authoritative
    signal — never event-stream stability, never stored-comment counts.

    Must use GraphQL: `gh pr view --json reviewRequests` does NOT surface
    Bot reviewers (returns []), so REST-based detection silently misses
    Copilot. The GraphQL `requestedReviewer` field with a User/Bot type
    spread returns the bot under login "copilot-pull-request-reviewer".
    """
    query = (
        "query($owner:String!,$repo:String!,$num:Int!){"
        "  repository(owner:$owner,name:$repo){"
        "    pullRequest(number:$num){"
        "      reviewRequests(first:50){"
        "        nodes{requestedReviewer{... on User{login} ... on Bot{login}}} } } } }"
    )
    out = _gh(
        "api", "graphql",
        "-f", f"query={query}",
        "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"num={pr_num}",
        "--jq", '[.data.repository.pullRequest.reviewRequests.nodes[].requestedReviewer.login] '
                '| any(. == "copilot-pull-request-reviewer" or . == "Copilot")',
    )
    return out == "true"


def has_copilot_reviewed_pr(owner: str, repo: str, pr_num: int) -> bool:
    """True iff at least one submitted Copilot review exists on this PR.

    Indicates "a review has happened at some point," regardless of whether
    the agent has addressed its findings yet. Distinct from
    is_copilot_review_pending, which indicates "a review is currently in
    flight." Together they answer the bootstrap question — "should we kick
    off a review on this PR" — without conflating the two states.

    Uses the same Bot type spread as the pending check, queried against
    `reviews` instead of `reviewRequests`. [LAW:one-source-of-truth] one
    GraphQL view defines "Copilot has reviewed"; callers don't reimplement.
    """
    query = (
        "query($owner:String!,$repo:String!,$num:Int!){"
        "  repository(owner:$owner,name:$repo){"
        "    pullRequest(number:$num){"
        "      reviews(first:100){"
        "        nodes{author{... on User{login} ... on Bot{login}}} } } } }"
    )
    out = _gh(
        "api", "graphql",
        "-f", f"query={query}",
        "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"num={pr_num}",
        "--jq", '[.data.repository.pullRequest.reviews.nodes[].author.login] '
                '| any(. == "copilot-pull-request-reviewer" or . == "Copilot")',
    )
    return out == "true"


# ---------------------------------------------------------------------------
# Safari cookies + CSRF dance (the reason this helper exists)
# ---------------------------------------------------------------------------

def read_safari_cookies(domain: str) -> dict[str, str]:
    """Parse Safari's Cookies.binarycookies and return {name: value} for domain."""
    import struct

    candidates = [
        Path.home() / "Library" / "Containers" / "com.apple.Safari" / "Data" / "Library" / "Cookies" / "Cookies.binarycookies",
        Path.home() / "Library" / "Cookies" / "Cookies.binarycookies",
    ]
    path = next((p for p in candidates if p.exists()), None)
    if path is None:
        return {}
    data = path.read_bytes()
    if data[:4] != b"cook":
        return {}
    num_pages = struct.unpack_from(">I", data, 4)[0]
    page_sizes = [struct.unpack_from(">I", data, 8 + i * 4)[0] for i in range(num_pages)]
    offset = 8 + num_pages * 4
    result: dict[str, str] = {}
    for page_size in page_sizes:
        page = data[offset: offset + page_size]
        offset += page_size
        if len(page) < 8:
            continue
        num_cookies = struct.unpack_from("<I", page, 4)[0]
        cookie_offsets = [struct.unpack_from("<I", page, 8 + i * 4)[0] for i in range(num_cookies)]
        for co in cookie_offsets:
            if co + 48 > len(page):
                continue
            domain_off = struct.unpack_from("<I", page, co + 16)[0]
            name_off = struct.unpack_from("<I", page, co + 20)[0]
            value_off = struct.unpack_from("<I", page, co + 28)[0]
            def cstr(base: int) -> str:
                end = page.index(b"\x00", co + base)
                return page[co + base: end].decode("utf-8", errors="ignore")
            try:
                cookie_domain = cstr(domain_off)
                cookie_name = cstr(name_off)
                cookie_value = cstr(value_off)
            except (ValueError, IndexError):
                continue
            if domain in cookie_domain or cookie_domain.lstrip(".") in domain:
                result[cookie_name] = cookie_value
    return result


def github_browser_cookie_header() -> str:
    """Build a Cookie header string from Safari's stored GitHub session cookies."""
    cookies = read_safari_cookies("github.com")
    needed = {"_gh_sess", "user_session", "__Host-user_session_same_site", "logged_in", "dotcom_user", "saved_user_sessions"}
    selected = {k: v for k, v in cookies.items() if k in needed}
    if not selected:
        return ""
    return "; ".join(f"{k}={v}" for k, v in selected.items())


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_trigger(args: argparse.Namespace) -> None:
    """Trigger Copilot review via the web-UI endpoint with real Safari cookies.

    Copilot's bot user (175728472) is not a REST-API collaborator, so
    /requested_reviewers returns 422. The browser uses a multipart POST to
    /pull/{n}/review-requests with a CSRF token scraped from the PR page;
    we replicate that using Safari's session cookies so CSRF validates.
    """
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15"

    cookie_header = github_browser_cookie_header()
    if not cookie_header:
        print(
            "Trigger: could not find GitHub session cookies in Safari's cookie store.\n"
            "Make sure you are logged into GitHub in Safari and try again.",
            file=sys.stderr,
        )
        sys.exit(1)

    def _send(method: str, url: str, extra_headers: dict, body: bytes | None = None):
        req = urllib.request.Request(url, method=method, data=body)
        req.add_header("Cookie", cookie_header)
        req.add_header("User-Agent", ua)
        for k, v in extra_headers.items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read(), {k.lower(): v for k, v in r.headers.items()}
        except urllib.error.HTTPError as e:
            return e.code, e.read(), {}
        except urllib.error.URLError as e:
            raise RuntimeError(f"HTTP {method} to {url} failed: {e.reason}") from e

    status, body, resp_headers = _send("GET", pr_url, {"Accept": "text/html"})
    if status != 200:
        print(f"Trigger: failed to fetch PR page ({status})", file=sys.stderr)
        sys.exit(1)

    html = body.decode("utf-8", errors="ignore")
    nonce = resp_headers.get("x-fetch-nonce") or next(
        iter(re.findall(r'<meta[^>]+content="(v2:[^"]+)"', html)), ""
    )

    auth_match = re.search(
        r'action="[^"]*review-requests[^"]*".*?name="authenticity_token"[^>]*value="([^"]+)"',
        html, re.DOTALL,
    ) or re.search(r'name="authenticity_token"[^>]*value="([^"]+)"', html)
    if not auth_match:
        print("Trigger: could not find authenticity_token in PR page HTML", file=sys.stderr)
        sys.exit(1)
    authenticity_token = auth_match.group(1)

    ts_match = re.search(r'name="partial_last_updated"[^>]*value="([^"]+)"', html)
    partial_last_updated = ts_match.group(1) if ts_match else str(int(time.time()))

    boundary = "----WebKitFormBoundaryTalVtKpV6LFadmAf"
    fields = [
        ("re_request_reviewer_id", str(COPILOT_USER_ID)),
        ("authenticity_token", authenticity_token),
        ("partial_last_updated", partial_last_updated),
        ("dummy-field-just-to-avoid-empty-submit", "foo"),
    ]
    form_body = b"".join(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        for name, value in fields
    ) + f"--{boundary}--\r\n".encode()

    post_headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "text/html",
        "Origin": "https://github.com",
        "Referer": pr_url,
        "x-requested-with": "XMLHttpRequest",
    }
    if nonce:
        post_headers["x-fetch-nonce"] = nonce

    post_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}/review-requests"
    status, resp, _ = _send("POST", post_url, post_headers, form_body)
    if status not in (200, 201):
        print(f"Trigger failed ({status}): {resp.decode('utf-8', 'ignore')[:300]}", file=sys.stderr)
        sys.exit(1)
    print(f"Triggered Copilot review on {owner}/{repo}#{pr_num}", file=sys.stderr)

    # GitHub processes /review-requests asynchronously. Block until Copilot
    # appears in reviewRequests so the next `wait` call has unambiguous state:
    # "Copilot in reviewRequests" = review in flight, "not in" = done. Without
    # this, a wait call immediately after trigger could race the registration
    # window and see "not pending" before the request lands. [LAW:single-enforcer]
    print("Waiting up to 2min for Copilot to register as requested reviewer...", file=sys.stderr)
    deadline = time.time() + 120
    while not is_copilot_review_pending(owner, repo, pr_num):
        if time.time() >= deadline:
            print("Trigger fired but Copilot did not appear in reviewRequests within 2min.",
                  file=sys.stderr)
            print("This is unusual — the trigger probably failed silently. Exiting nonzero.",
                  file=sys.stderr)
            sys.exit(1)
        time.sleep(5)
    print("Copilot is now a requested reviewer.", file=sys.stderr)


def cmd_ensure(args: argparse.Namespace) -> None:
    """Bootstrap: trigger a Copilot review iff none exists or is in flight.

    Background. GitHub auto-triggers a Copilot review when a PR is opened by
    an account with an active Copilot subscription. PRs opened by accounts
    *without* a subscription get no auto-trigger — the address-pr-reviews
    loop then reads "nothing in flight, no findings" and exits silently,
    leaving the PR unreviewed. `ensure` closes that gap.

    Decision matrix (pending × has-reviewed):
      pending=true   any   → no-op (a review is happening; let it finish)
      pending=false  true  → no-op (a past review exists; no bootstrap needed)
      pending=false  false → trigger (true bootstrap case)

    Idempotent: safe to call before the loop on any PR. For subscription-holder
    PRs the auto-trigger has typically already fired by the time the agent
    runs this command, so the pending-check or has-reviewed-check no-ops.

    Race window analysis. Between the pending check and the has-reviewed
    check (~200 ms of GraphQL), a subscriber's auto-trigger could fire and
    register Copilot. Sequence outcomes:

      1. pending check sees auto-trigger     → no-op, correct
      2. pending check misses auto-trigger,
         has-reviewed sees nothing,
         we POST while auto-trigger also POSTs → /review-requests SETS state
         (does not append), so both calls converge on "Copilot is requested
         once". Cost is one wasted HTTP POST; state is correct.
      3. pending check misses auto-trigger,
         auto-trigger completes before
         has-reviewed runs, has-reviewed=true → no-op, correct

    No state-corruption case exists. The duplicate-POST cost in case 2 is
    accepted; mitigation (e.g. a third pending re-check) would only narrow
    the window, not close it, and isn't worth the latency.
    """
    owner, repo, pr_num = parse_pr_url(args.pr_url)

    if is_copilot_review_pending(owner, repo, pr_num):
        print("Copilot review already in flight. Nothing to bootstrap.", file=sys.stderr)
        return
    if has_copilot_reviewed_pr(owner, repo, pr_num):
        print("Copilot has already reviewed this PR. Nothing to bootstrap.", file=sys.stderr)
        return

    print("No Copilot review on this PR; bootstrapping.", file=sys.stderr)
    cmd_trigger(args)


def cmd_wait(args: argparse.Namespace) -> None:
    """Block until any in-flight Copilot review finishes — idempotent.

    Pure "wait for completion": if Copilot is not currently in reviewRequests,
    exit immediately (nothing to wait for). If Copilot IS in reviewRequests,
    poll every 30s until it's gone, capped at 15min.

    Idempotency means the loop can call this at the start of every iteration
    without worrying about whether a trigger fired. The registration-window
    wait lives inside `trigger` itself, so by the time `trigger` returns,
    Copilot is guaranteed to be in reviewRequests if a review was actually
    queued. [LAW:single-enforcer] one signal — reviewRequests membership —
    owns review-state truth.
    """
    owner, repo, pr_num = parse_pr_url(args.pr_url)

    if not is_copilot_review_pending(owner, repo, pr_num):
        print("No Copilot review in flight. Nothing to wait for.", file=sys.stderr)
        return

    print("Copilot review in flight. Polling until complete...", file=sys.stderr)
    start = time.time()
    last_log = 0
    while is_copilot_review_pending(owner, repo, pr_num):
        elapsed = int(time.time() - start)
        if elapsed >= 15 * 60:
            print(f"Wait cap (15min) exceeded — review still pending. Exiting nonzero.", file=sys.stderr)
            sys.exit(2)
        if elapsed - last_log >= 60:
            print(f"Still reviewing... ({elapsed}s elapsed)", file=sys.stderr)
            last_log = elapsed
        time.sleep(30)

    print(f"Copilot review complete after {int(time.time() - start)}s.", file=sys.stderr)


def cmd_fetch(args: argparse.Namespace) -> None:
    """Emit Copilot's review findings as canonical JSON.

    [LAW:one-source-of-truth] Copilot's session reasoning is the single
    source of review findings. Posted inline threads are a projection of
    that source — this command joins them in by (path, line) so each
    finding carries its thread_id (or null, for suppressed findings that
    didn't make Copilot's inline-comment cap).

    [LAW:single-enforcer] one place owns "what did Copilot find" — here.
    Callers consume the JSON; they don't query the threads API separately.

    Output schema:
      {
        "session_id": str | null,        # null if Copilot hasn't reviewed yet
        "overview": {
          "phrase_present": bool,        # whether 'generated N comments' appeared
          "comment_count": int | null,   # parsed N (null if absent)
          "raw": str | null              # the markdown overview Copilot emitted
        },
        "findings": [
          {
            "source": "copilot_session" | "review_thread",
            "file": str,
            "line_start": int | null,
            "line_end": int | null,
            "body": str,
            "author": str | null,        # login of the finding author
            "comment_type": str | null,  # only set for copilot_session findings
            "severity": str | null,      # only set for copilot_session findings
            "fixed": bool,               # Copilot self-marked as already fixed
            "thread_id": str | null,     # non-null = posted as inline thread
            "is_resolved": bool | null,  # non-null iff thread_id is non-null
            "thread_comments": [         # full reply chain; null iff thread_id null
              {"author": str | null, "body": str}, ...
            ] | null
          }, ...
        ]
      }

    Unresolved findings are findings the agent must address: every finding
    whose thread is not already resolved (thread_id null OR is_resolved
    false). The loop's exit condition is "no unresolved findings".
    """
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    token = gh_token()

    # Always fetch threads — they're a primary source of pending work,
    # independent of whether Copilot has reviewed yet. A PR with only
    # human review threads is a valid case the loop must handle.
    threads = fetch_review_threads(owner, repo, pr_num)
    sessions = scrape_session_payloads(owner, repo, pr_num, token)

    if sessions:
        sid = sessions[-1]["session_id"]
        events = parse_sse_events(fetch_session_logs(sid, token))
        stored = [sc for e in events if (sc := event_store_comment(e))]
        full = session_full_content(events)
        overview_raw = session_pr_overview(events)
        count = parse_generated_comment_count(full)
    else:
        sid = None
        stored = []
        overview_raw = None
        count = None

    result = {
        "session_id": sid,
        "overview": {
            "phrase_present": count is not None,
            "comment_count": count,
            "raw": overview_raw,
        },
        "findings": build_findings(stored, threads),
    }
    sys.stdout.write(json.dumps(result, indent=2) + "\n")


def main() -> None:
    p = argparse.ArgumentParser(prog="copilot-review", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    pe = sub.add_parser("ensure", help="trigger a Copilot review iff none exists or is in flight (bootstrap)")
    pe.add_argument("pr_url")
    pe.set_defaults(func=cmd_ensure)

    pt = sub.add_parser("trigger", help="force a fresh Copilot review")
    pt.add_argument("pr_url")
    pt.set_defaults(func=cmd_trigger)

    pw = sub.add_parser("wait", help="block until any in-flight Copilot review finishes")
    pw.add_argument("pr_url")
    pw.set_defaults(func=cmd_wait)

    pf = sub.add_parser("fetch", help="emit Copilot's review findings as JSON")
    pf.add_argument("pr_url")
    pf.set_defaults(func=cmd_fetch)

    args = p.parse_args()
    # [LAW:single-enforcer] one place owns "convert internal failures to clean
    # user-facing errors". gh shell-outs raise CalledProcessError; HTTP helpers
    # raise RuntimeError on non-2xx. Both surface here as a one-line message
    # plus the original error text, then nonzero exit — no Python traceback
    # for predictable boundary failures (auth lapse, rate limit, network).
    try:
        args.func(args)
    except subprocess.CalledProcessError as e:
        cmd = " ".join(e.cmd) if isinstance(e.cmd, list) else str(e.cmd)
        stderr = (e.stderr or b"").decode("utf-8", "ignore").strip() if isinstance(e.stderr, bytes) else (e.stderr or "").strip()
        print(f"error: `{cmd}` failed (exit {e.returncode}){': ' + stderr if stderr else ''}", file=sys.stderr)
        sys.exit(e.returncode or 1)
    except (RuntimeError, ValueError) as e:
        # ValueError catches malformed-input failures like parse_pr_url's
        # "Not a PR URL" — without it those surface as a Python traceback,
        # breaking the one-line-error contract for user-input mistakes too.
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
