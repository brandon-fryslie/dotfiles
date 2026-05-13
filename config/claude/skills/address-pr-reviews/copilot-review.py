#!/usr/bin/env python3
"""GitHub Copilot PR review agent helper.

Subcommands:
  fetch    — dump all stored comments + reasoning from existing sessions
  trigger  — kick off a new Copilot review on a PR
  watch    — wait for a new review session, stream filtered output to a file
  step     — run one step of the address-pr-reviews loop state machine

Auth: uses `gh auth token`. No Copilot-specific token exchange needed.

Discovery path: scrape the PR page HTML for `data-hydro-click` attributes whose
event_type is `copilot.reviews.v0.ViewSession`. Each one carries a session_id
that survives long after the task disappears from the active task list.

Relevance filter for `watch`: write any event that
  (a) is a `store_comment` tool call, OR
  (b) contains assistant text matching one of: comment, noticing, considering, verify

Completion signal: `is_copilot_review_pending` is the SINGLE authoritative source
for "is the review still in flight?". Session-event-stream stability is NOT a
valid proxy — the session API can settle while the bot is still preparing its
review submission. Every wait in this script gates on `is_copilot_review_pending`,
not on event-stream stability. [LAW:one-source-of-truth] [LAW:single-enforcer]
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
COPILOT_BOT_LOGIN = "Copilot"
# Stable GitHub user ID for copilot-pull-request-reviewer (web UI only — not a REST collaborator).
COPILOT_USER_ID = 175728472

RELEVANCE_KEYWORDS = ("comment", "noticing", "considering", "verify")


def gh_token() -> str:
    return subprocess.check_output(["gh", "auth", "token"], text=True).strip()


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
        return e.code, e.read()


def http_with_resp_headers(
    method: str, url: str, headers: dict | None = None, body: bytes | str | None = None
) -> tuple[int, bytes, dict[str, str]]:
    """Like http() but also returns response headers (lowercase keys)."""
    req = urllib.request.Request(url, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if body is not None:
        req.data = body if isinstance(body, bytes) else body.encode()
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read(), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, e.read(), {}


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


def scrape_session_payloads(owner: str, repo: str, pr_num: int, token: str) -> list[dict]:
    """Return list of {session_id, pull_request_id, repository_id, ...} from PR HTML, oldest first."""
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


def event_is_relevant(event: dict) -> bool:
    if event_store_comment(event) is not None:
        return True
    c = event_content(event) or ""
    cl = c.lower()
    return any(kw in cl for kw in RELEVANCE_KEYWORDS)


def session_full_content(events: list[dict]) -> str:
    """Concatenate all assistant content deltas from a session into the full text.

    Individual SSE events carry tiny deltas (e.g., '## ', then 'Pull request',
    then ' overview\\n\\nCopilot reviewed...'). Any extraction that looks at
    one event at a time sees only fragments. Phrases like 'generated N comments'
    are typically split across deltas, so full reassembly is needed before regex.
    """
    return "".join((event_content(e) or "") for e in events)


def session_pr_overview(events: list[dict]) -> str | None:
    """Extract the final 'Pull request overview' block from a session.

    Strategy: reassemble the full content stream, then slice from the last
    top-level heading ('## ' at line start) to the end. Copilot emits its PR
    overview as the trailing markdown of the assistant stream, so this captures
    the whole block including the heading and body prose.

    Returns None if no heading-level block was emitted (review still in flight
    OR Copilot didn't reach the overview step).
    """
    full = session_full_content(events)
    matches = list(re.finditer(r'(?:^|\n)##\s+[^\n]+', full))
    if not matches:
        return None
    return full[matches[-1].start():].lstrip("\n")


def parse_generated_comment_count(content: str) -> int | None:
    """Parse Copilot's 'generated N comment(s)' overview phrase. Returns N, or None if absent.

    Copilot includes 'generated N comments' in the PR overview iff N >= 1.
    A clean review (zero findings) omits the phrase entirely. Callers that need
    to distinguish 'clean review' from 'review still in flight' must combine
    this with is_copilot_review_pending — this function only reports presence
    of the phrase, not whether the review is complete.

    [LAW:one-source-of-truth] this is the single parser for the overview phrase.
    """
    m = re.search(r'generated\s+(\d+)\s+comments?\b', content, re.IGNORECASE)
    return int(m.group(1)) if m else None


def fetch_posted_inline_comments(owner: str, repo: str, pr_num: int, token: str) -> list[dict]:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_num}/comments"
    status, body = http("GET", url, github_headers(token))
    if status != 200:
        return []
    return json.loads(body)


def format_comment_block(sc: dict, posted_prefixes: set[str] | None = None) -> str:
    body = sc.get("comment_content", "")
    file_loc = sc.get("file_location") or sc.get("file") or sc.get("path") or "?"
    start = sc.get("start_line") or sc.get("line") or "?"
    end = sc.get("end_line") or ""
    loc = f"{file_loc}:{start}" + (f"-{end}" if end and end != start else "")
    ctype = sc.get("comment_type") or ""
    sev = sc.get("severity") or ""
    fixed = " (fixed)" if sc.get("fixed") else ""
    status = ""
    if posted_prefixes is not None:
        status = " ✓ POSTED" if body[:80] in posted_prefixes else " ✗ SUPPRESSED"
    return f"### [{ctype}/{sev}{fixed}]{status} `{loc}`\n\n{body}\n"


def render_review_markdown(
    owner: str, repo: str, pr_num: int, token: str
) -> tuple[str | None, int, int | None]:
    """Build the markdown report for all Copilot sessions on a PR.

    Returns (rendered_markdown, num_sessions, latest_overview_count).

    `latest_overview_count` is N from Copilot's 'generated N comments' phrase
    in the LATEST session's PR overview, or None if the phrase is absent
    (clean review OR review hasn't reached the overview step). Combine with
    is_copilot_review_pending to disambiguate. [LAW:single-enforcer]

    Returns (None, 0, None) when no sessions exist.
    """
    sessions = scrape_session_payloads(owner, repo, pr_num, token)
    if not sessions:
        return None, 0, None

    posted = fetch_posted_inline_comments(owner, repo, pr_num, token)
    posted_prefixes = {
        c.get("body", "")[:80]
        for c in posted
        if (c.get("user") or {}).get("login") == COPILOT_BOT_LOGIN
    }

    out: list[str] = []
    out.append(f"# Copilot Review: {owner}/{repo}#{pr_num}\n")
    out.append(f"**Sessions found:** {len(sessions)}")
    for s in sessions:
        out.append(f"- `{s['session_id']}`")
    out.append("")

    total_stored = 0
    total_posted = 0
    total_suppressed = 0
    per_session_overview_count: list[int | None] = []

    for s in sessions:
        sid = s["session_id"]
        out.append(f"\n## Session `{sid}`\n")
        try:
            data = fetch_session_logs(sid, token)
        except Exception as e:
            out.append(f"_error: {e}_\n")
            per_session_overview_count.append(None)
            continue
        events = parse_sse_events(data)
        stored = [sc for e in events if (sc := event_store_comment(e))]

        overview_count = parse_generated_comment_count(session_full_content(events))
        per_session_overview_count.append(overview_count)
        if overview_count is None:
            count_str = "no 'generated N comments' phrase (clean review or in-flight)"
        else:
            count_str = f"{overview_count} comment(s) per overview"
        out.append(f"_{len(events)} events, {len(stored)} stored comments — {count_str}_\n")

        for sc in stored:
            block = format_comment_block(sc, posted_prefixes)
            out.append(block)
            total_stored += 1
            if sc.get("comment_content", "")[:80] in posted_prefixes:
                total_posted += 1
            else:
                total_suppressed += 1

        overview = session_pr_overview(events)
        if overview:
            out.append("\n### Agent's PR overview\n")
            out.append(overview)
            out.append("")

    latest_count = per_session_overview_count[-1] if per_session_overview_count else None
    if latest_count is None:
        latest_str = "**Latest overview:** _no 'generated N comments' phrase — clean review OR review not yet finished_"
    else:
        latest_str = f"**Latest overview:** **{latest_count}** comment(s) generated"
    out.insert(2, latest_str + "\n")
    out.insert(2, f"**Totals:** {total_stored} stored — {total_posted} posted, {total_suppressed} suppressed\n")
    return "\n".join(out), len(sessions), latest_count


def cmd_fetch(args: argparse.Namespace) -> None:
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    token = gh_token()
    rendered, _, latest_count = render_review_markdown(owner, repo, pr_num, token)
    if rendered is None:
        print(f"No Copilot review sessions found on {owner}/{repo}#{pr_num}.", file=sys.stderr)
        sys.exit(2)
    if args.output:
        Path(args.output).write_text(rendered)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(rendered)
    if latest_count is None:
        print("Latest session overview: no 'generated N comments' phrase "
              "(clean review OR review not yet finished).", file=sys.stderr)
    else:
        print(f"Latest session overview: {latest_count} comment(s) generated.", file=sys.stderr)


def read_safari_cookies(domain: str) -> dict[str, str]:
    """Parse Safari's Cookies.binarycookies and return {name: value} for domain.

    Checks both the sandboxed Safari container (macOS 10.15+) and the legacy
    ~/Library/Cookies path, preferring whichever has session cookies.
    """
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
            path_off = struct.unpack_from("<I", page, co + 24)[0]  # noqa: F841
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


def cmd_trigger(args: argparse.Namespace) -> None:
    """Trigger Copilot review via the GitHub web UI endpoint.

    Copilot's bot account (user ID 175728472) is not a REST-API collaborator,
    so the /requested_reviewers REST endpoint returns 422. The browser uses a
    multipart POST to /pull/{n}/review-requests with a CSRF token scraped from
    the PR page — we replicate that here using real browser session cookies from
    Safari's binary cookie store so CSRF validation passes.
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

    # 1. GET the PR page to scrape the CSRF token and x-fetch-nonce.
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

    # 2. Build multipart/form-data body matching the browser request exactly.
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

    # 3. POST with the same real browser cookies — CSRF validates because the
    # authenticity_token and _gh_sess are from the same browser session.
    post_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}/review-requests"
    status, resp, _ = _send("POST", post_url, post_headers, form_body)
    if status not in (200, 201):
        print(f"Trigger failed ({status}): {resp.decode('utf-8', 'ignore')[:300]}", file=sys.stderr)
        sys.exit(1)
    print(f"Triggered Copilot review on {owner}/{repo}#{pr_num}", file=sys.stderr)


def cmd_watch(args: argparse.Namespace) -> None:
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    token = gh_token()
    out_path = Path(args.output)

    # Snapshot existing session_ids; any session_id not in this set is "new".
    pre = scrape_session_payloads(owner, repo, pr_num, token)
    pre_ids = {s["session_id"] for s in pre}
    print(f"[watch] Pre-existing sessions: {len(pre_ids)}", file=sys.stderr)

    if args.trigger:
        cmd_trigger(argparse.Namespace(pr_url=args.pr_url))
        # GitHub processes the /review-requests POST asynchronously. Confirm
        # Copilot is now in reviewRequests so the wait-for-completion loop below
        # isn't fooled by the not-yet-registered state (which looks identical
        # to "review already finished"). [LAW:single-enforcer]
        print("[watch] Confirming Copilot is now a requested reviewer...", file=sys.stderr)
        if not wait_for_copilot_review_to_start(owner, repo, pr_num, timeout=120):
            print("[watch] Trigger did not register within 120s. Aborting.", file=sys.stderr)
            sys.exit(3)

    # Wait for a new session_id to appear in the PR HTML
    print("[watch] Waiting for new session to appear...", file=sys.stderr)
    deadline = time.time() + args.discover_timeout
    new_session_id: str | None = None
    while time.time() < deadline:
        try:
            sessions = scrape_session_payloads(owner, repo, pr_num, token)
        except Exception as e:
            print(f"[watch] HTML poll error: {e}", file=sys.stderr)
            time.sleep(5)
            continue
        new = [s for s in sessions if s["session_id"] not in pre_ids]
        if new:
            new_session_id = new[-1]["session_id"]
            print(f"[watch] New session: {new_session_id}", file=sys.stderr)
            break
        time.sleep(args.poll_interval)
    if not new_session_id:
        print("[watch] Timed out waiting for new session", file=sys.stderr)
        sys.exit(3)

    # Initialize output file
    started = time.strftime("%Y-%m-%dT%H:%M:%S")
    header = (
        f"# Copilot Review Stream — {owner}/{repo}#{pr_num}\n\n"
        f"Session: `{new_session_id}`\n"
        f"Started: {started}\n\n"
        f"_Filter: store_comment tool calls + content matching "
        f"{', '.join(RELEVANCE_KEYWORDS)}_\n\n---\n"
    )
    out_path.write_text(header)

    seen = 0
    stable = 0
    max_stable_polls = args.max_stable
    poll = args.poll_interval
    # Hard cap on total watch time. The authoritative completion signal below
    # may never trip if the bot hangs; this bounds the wait. Default = the same
    # 15-min cap used by the step loop.
    wait_deadline = time.time() + WAIT_CAP_SECONDS
    timed_out = False

    # Exit condition: events have been stable for max_stable_polls AND Copilot
    # has been removed from reviewRequests. Event-stream stability ALONE is not
    # sufficient — the session API can settle while the bot is still preparing
    # its review submission. Gating on is_copilot_review_pending ensures we
    # don't exit before the review is actually submitted and its threads are
    # visible via GraphQL. [LAW:single-enforcer] [LAW:one-source-of-truth]
    while True:
        if time.time() >= wait_deadline:
            print(f"[watch] WAIT_CAP ({WAIT_CAP_SECONDS // 60}min) exceeded — exiting.", file=sys.stderr)
            timed_out = True
            break

        try:
            data = fetch_session_logs(new_session_id, token)
        except Exception as e:
            print(f"[watch] Log fetch error: {e}", file=sys.stderr)
            time.sleep(poll)
            continue

        events = parse_sse_events(data)
        if len(events) > seen:
            with open(out_path, "a") as f:
                for e in events[seen:]:
                    if not event_is_relevant(e):
                        continue
                    sc = event_store_comment(e)
                    if sc:
                        f.write("\n" + format_comment_block(sc) + "\n")
                    else:
                        c = event_content(e) or ""
                        f.write(f"\n**reasoning:** {c.strip()}\n")
            seen = len(events)
            stable = 0
        else:
            stable += 1

        if stable >= max_stable_polls and not is_copilot_review_pending(owner, repo, pr_num):
            break

        time.sleep(poll)

    ended = time.strftime("%Y-%m-%dT%H:%M:%S")
    suffix = " (wait cap exceeded)" if timed_out else ""
    with open(out_path, "a") as f:
        f.write(f"\n---\n\n_Stream ended at {ended} — {seen} events processed{suffix}_\n")
    print(f"[watch] Done — {out_path}", file=sys.stderr)
    if timed_out:
        sys.exit(3)


# ---------------------------------------------------------------------------
# Loop state machine — the address-pr-reviews workflow as 5 atomic steps.
#
# Each step is one Bash-invocation: the agent runs `copilot-review.py step N URL`,
# the script does its mechanical work, then prints the agent's next instruction
# (which step to run, or what judgment work to perform first). State persists
# across invocations in /tmp/address-pr-<NUM>.state.json so the loop survives
# context compaction.
# ---------------------------------------------------------------------------

STATE_DIR = Path("/tmp")
ITER_CAP = 3  # consecutive iterations that produce code changes; over this = surface to user
WAIT_CAP_SECONDS = 15 * 60
WAIT_POLL_SECONDS = 30


def _slug(owner: str, repo: str, pr_num: int) -> str:
    """Filesystem-safe identifier for an (owner, repo, PR) tuple."""
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", f"{owner}-{repo}")
    return f"{safe}-{pr_num}"


def state_path(owner: str, repo: str, pr_num: int) -> Path:
    return STATE_DIR / f"address-pr-{_slug(owner, repo, pr_num)}.state.json"


def threads_path(owner: str, repo: str, pr_num: int, iter_n: int) -> Path:
    return STATE_DIR / f"address-pr-{_slug(owner, repo, pr_num)}-iter-{iter_n}-threads.json"


def suppressed_path(owner: str, repo: str, pr_num: int, iter_n: int) -> Path:
    return STATE_DIR / f"address-pr-{_slug(owner, repo, pr_num)}-iter-{iter_n}-suppressed.md"


def decisions_path(owner: str, repo: str, pr_num: int, iter_n: int) -> Path:
    return STATE_DIR / f"address-pr-{_slug(owner, repo, pr_num)}-iter-{iter_n}-decisions.json"


def resolutions_path(owner: str, repo: str, pr_num: int, iter_n: int) -> Path:
    return STATE_DIR / f"address-pr-{_slug(owner, repo, pr_num)}-iter-{iter_n}-resolutions.json"


def load_state(owner: str, repo: str, pr_num: int) -> dict:
    p = state_path(owner, repo, pr_num)
    if p.exists():
        return json.loads(p.read_text())
    return {
        "owner": owner,
        "repo": repo,
        "pr_num": pr_num,
        "iteration": 1,
        "next_step": 1,
        "head_at_iter_start": None,
        "last_changes_required": None,
        "history": [],
        "final_state": None,
    }


def save_state(owner: str, repo: str, pr_num: int, state: dict) -> None:
    state_path(owner, repo, pr_num).write_text(json.dumps(state, indent=2))


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def gh(*args: str) -> str:
    """Run gh and return stripped stdout, raising on non-zero with the error inline."""
    try:
        return subprocess.check_output(["gh", *args], text=True, stderr=subprocess.PIPE).strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"gh {' '.join(args)} failed: {e.stderr.strip()}") from e


def git_head() -> str | None:
    """Return HEAD SHA, or None if cwd isn't a git repo."""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except subprocess.CalledProcessError:
        return None


def is_copilot_review_pending(owner: str, repo: str, pr_num: int) -> bool:
    """True iff Copilot is currently a requested reviewer (review in flight).

    This is THE authoritative signal for review state. When Copilot is processing
    a review, the bot is listed in reviewRequests. When the review is submitted,
    GitHub removes the bot from reviewRequests. Every wait in this module gates
    on this — never on session-event-stream stability, which can settle while
    the bot is still preparing its submission. [LAW:one-source-of-truth]
    """
    out = gh("pr", "view", str(pr_num), "--repo", f"{owner}/{repo}",
            "--json", "reviewRequests",
            "--jq", "[.reviewRequests[].login] | join(\",\")")
    return "Copilot" in out


def wait_for_copilot_review_to_start(
    owner: str, repo: str, pr_num: int, *, timeout: int = 120
) -> bool:
    """Block until Copilot has demonstrably picked up the trigger.

    The robust signal is "a new Copilot session_id appears in the PR page HTML
    that was not present pre-trigger." The previously-used signal ("Copilot in
    reviewRequests") is unreliable because Copilot now accepts and starts
    processing the review-request fast enough that it can be off the
    reviewRequests list before any post-trigger poll catches it — yielding
    false-negative "trigger did not register" failures.

    Snapshot the set of existing session_ids at the start of the wait, then
    poll the PR HTML until a new session_id appears. The new session is the
    durable outcome of the trigger; observing it confirms the trigger landed
    regardless of how quickly Copilot transitions through reviewRequests.

    Returns True once a new session_id appears, False on timeout.
    [LAW:types-are-the-program] observe the outcome (new session created), not
    transient state (review-request membership) the bot is racing through.
    """
    try:
        token = gh_token()
        pre = scrape_session_payloads(owner, repo, pr_num, token)
        pre_ids = {s["session_id"] for s in pre}
    except Exception as e:
        log(f"[wait_for_copilot_review_to_start] HTML snapshot failed: {e} — falling back to reviewRequests poll.")
        pre_ids = None

    deadline = time.time() + timeout
    while time.time() < deadline:
        # Primary signal: new session_id appeared in PR HTML.
        if pre_ids is not None:
            try:
                sessions = scrape_session_payloads(owner, repo, pr_num, token)
                if any(s["session_id"] not in pre_ids for s in sessions):
                    return True
            except Exception as e:
                log(f"[wait_for_copilot_review_to_start] HTML poll error: {e}")
        # Fallback signal: Copilot in reviewRequests (covers the slow-trigger
        # case where the new session hasn't been written to HTML yet).
        if is_copilot_review_pending(owner, repo, pr_num):
            return True
        time.sleep(5)
    return False


def wait_for_copilot_review_to_complete(
    owner: str,
    repo: str,
    pr_num: int,
    *,
    timeout: int = 15 * 60,
    poll_interval: int = 30,
    on_progress=None,
) -> bool:
    """Block until Copilot leaves reviewRequests. Returns True on completion, False on timeout.

    Uses `is_copilot_review_pending` as the authoritative signal — event-stream
    stability on the session API is NOT a reliable proxy for "review submitted",
    because session events can stop arriving before the bot actually posts its
    review. [LAW:single-enforcer]
    """
    if not is_copilot_review_pending(owner, repo, pr_num):
        return True
    start = time.time()
    deadline = start + timeout
    while time.time() < deadline:
        time.sleep(poll_interval)
        if not is_copilot_review_pending(owner, repo, pr_num):
            return True
        if on_progress:
            on_progress(int(time.time() - start))
    return False


def emit_next(label: str, lines: list[str]) -> None:
    """Print the agent's next-action block to stdout in a consistent shape."""
    print()
    print(f"=== {label} ===")
    for line in lines:
        print(line)


def step_1(owner: str, repo: str, pr_num: int, state: dict) -> None:
    """Wait for any in-progress Copilot review. Snapshot HEAD at iteration start."""
    iter_n = state["iteration"]
    log(f"[step 1 / iter {iter_n}] Checking for in-progress Copilot review...")

    if not is_copilot_review_pending(owner, repo, pr_num):
        log("[step 1] No review currently in flight — proceeding immediately.")
    else:
        log(f"[step 1] Copilot review in flight. Polling every {WAIT_POLL_SECONDS}s for up to {WAIT_CAP_SECONDS // 60}min.")

        def _progress(elapsed: int) -> None:
            log(f"[step 1] Still reviewing... ({elapsed}s elapsed)")

        completed = wait_for_copilot_review_to_complete(
            owner, repo, pr_num,
            timeout=WAIT_CAP_SECONDS,
            poll_interval=WAIT_POLL_SECONDS,
            on_progress=_progress,
        )
        if not completed:
            log(f"[step 1] WAIT CAP ({WAIT_CAP_SECONDS // 60}min) exceeded — surfacing to user.")
            state["next_step"] = "blocked"
            state["final_state"] = "wait_cap_exceeded"
            save_state(owner, repo, pr_num, state)
            sys.exit(2)
        log("[step 1] Review completed.")

    head = git_head()
    if head is None:
        log("[step 1] WARNING: not in a git repo. HEAD snapshot skipped — step 5 won't be able to detect code changes.")
    state["head_at_iter_start"] = head
    state["next_step"] = 2
    save_state(owner, repo, pr_num, state)

    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"
    emit_next("NEXT: run step 2", [
        f"~/.claude/skills/address-pr-reviews/copilot-review.py step 2 {pr_url}",
    ])


def step_2(owner: str, repo: str, pr_num: int, state: dict) -> None:
    """Fetch unresolved threads + Copilot's suppressed reasoning. Write to /tmp."""
    iter_n = state["iteration"]
    token = gh_token()
    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"

    log(f"[step 2 / iter {iter_n}] Fetching unresolved review threads via GraphQL...")
    query = (
        "query($owner:String!, $repo:String!, $num:Int!) {"
        "  repository(owner:$owner, name:$repo) {"
        "    pullRequest(number:$num) {"
        "      reviewThreads(first:100) {"
        "        nodes {"
        "          id isResolved isOutdated path line"
        "          comments(first:20) { nodes { author{login} body createdAt } }"
        "        }"
        "      }"
        "    }"
        "  }"
        "}"
    )
    raw = gh("api", "graphql", "-f", f"query={query}",
             "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"num={pr_num}")
    data = json.loads(raw)
    all_threads = data["data"]["repository"]["pullRequest"]["reviewThreads"]["nodes"]
    unresolved = [t for t in all_threads if not t["isResolved"]]
    tfile = threads_path(owner, repo, pr_num, iter_n)
    tfile.write_text(json.dumps(unresolved, indent=2))
    log(f"[step 2] {len(unresolved)} unresolved thread(s) — wrote {tfile}")

    log(f"[step 2] Fetching Copilot's session logs (suppressed comments + reasoning)...")
    sfile = suppressed_path(owner, repo, pr_num, iter_n)
    rendered, n_sessions, latest_count = render_review_markdown(owner, repo, pr_num, token)
    if rendered is None:
        sfile.write_text(f"# Copilot Review: {owner}/{repo}#{pr_num}\n\n_(no Copilot sessions found on PR)_\n")
        log("[step 2] No Copilot sessions found — wrote stub to suppressed file.")
    else:
        sfile.write_text(rendered)
        log(f"[step 2] {n_sessions} session(s) — wrote {sfile}")

    # Surface the authoritative "are there comments?" signal: the 'generated N
    # comments' phrase from Copilot's PR overview. Absent => clean review.
    # Present => N comments, which should match the unresolved-thread count
    # (modulo earlier already_fixed resolutions). [LAW:single-enforcer] this
    # signal — not stored-comment counts or event-stream stability — is what
    # the agent should believe about how many findings the latest review produced.
    if latest_count is None:
        log("[step 2] Latest overview: no 'generated N comments' phrase (clean review).")
    else:
        log(f"[step 2] Latest overview: {latest_count} comment(s) generated.")
        if latest_count != len(unresolved):
            log(f"[step 2] NOTE: overview says {latest_count} but GraphQL shows "
                f"{len(unresolved)} unresolved — likely earlier already_fixed resolutions.")

    state["next_step"] = 3
    save_state(owner, repo, pr_num, state)

    dfile = decisions_path(owner, repo, pr_num, iter_n)
    overview_signal = (
        "Latest Copilot overview: no 'generated N comments' phrase (clean review)."
        if latest_count is None
        else f"Latest Copilot overview: {latest_count} comment(s) generated."
    )
    if len(unresolved) == 0:
        emit_next("NEXT: agent work, then step 3", [
            f"No unresolved threads on this iteration.",
            f"{overview_signal}",
            f"Read suppressed reasoning at: {sfile}",
            f"If anything suppressed warrants code changes, apply them as commits.",
            f"Write an empty decisions file at: {dfile}",
            f"  Content: []",
            f"Then run:",
            f"  ~/.claude/skills/address-pr-reviews/copilot-review.py step 3 {pr_url}",
        ])
        return

    emit_next("NEXT: agent work, then step 3", [
        f"{overview_signal}",
        f"1. Read threads: {tfile}",
        f"2. Read suppressed reasoning: {sfile}",
        f"3. For each thread, read code at thread.path:thread.line and classify:",
        f"     - valid          (reviewer right; the change strengthens architecture/aligns with goals)",
        f"     - different_fix  (reviewer found a real problem but proposed the wrong solution)",
        f"     - invalid        (reviewer wrong, or violates architectural laws — cite the law in proposal)",
        f"     - already_fixed  (resolved by a later commit)",
        f"4. Write decisions to: {dfile}",
        f'     Format: [{{"thread_id":"...","decision":"valid|different_fix|invalid|already_fixed","proposal":"..."}}]',
        f"5. Then run:",
        f"     ~/.claude/skills/address-pr-reviews/copilot-review.py step 3 {pr_url}",
    ])


def _post_reply(thread_id: str, body: str) -> None:
    mutation = (
        "mutation($threadId:ID!, $body:String!) {"
        "  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) {"
        "    comment { id }"
        "  }"
        "}"
    )
    gh("api", "graphql", "-f", f"query={mutation}",
       "-F", f"threadId={thread_id}", "-F", f"body={body}")


def _resolve_thread(thread_id: str) -> None:
    mutation = (
        "mutation($threadId:ID!) {"
        "  resolveReviewThread(input:{threadId:$threadId}) { thread { isResolved } }"
        "}"
    )
    gh("api", "graphql", "-f", f"query={mutation}", "-F", f"threadId={thread_id}")


def step_3(owner: str, repo: str, pr_num: int, state: dict) -> None:
    """Post proposal comments from decisions file."""
    iter_n = state["iteration"]
    dfile = decisions_path(owner, repo, pr_num, iter_n)
    if not dfile.exists():
        log(f"[step 3] ERROR: decisions file not found: {dfile}")
        log("[step 3] Run step 2 first, or write the decisions file (use [] for an empty pass).")
        sys.exit(2)

    decisions = json.loads(dfile.read_text())
    log(f"[step 3 / iter {iter_n}] Posting {len(decisions)} proposal comment(s)...")

    for d in decisions:
        thread_id = d["thread_id"]
        try:
            _post_reply(thread_id, d["proposal"])
            log(f"[step 3] Posted on {thread_id[:14]}… ({d['decision']})")
        except RuntimeError as e:
            log(f"[step 3] FAILED on {thread_id}: {e}")
            sys.exit(2)

    state["next_step"] = 4
    save_state(owner, repo, pr_num, state)

    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"
    needs_fix = [d for d in decisions if d["decision"] in ("valid", "different_fix")]
    rfile = resolutions_path(owner, repo, pr_num, iter_n)

    lines = []
    if needs_fix:
        lines.append(f"1. Apply code fixes for {len(needs_fix)} thread(s) classified valid/different_fix.")
        lines.append("2. Stage and commit. Batch related concerns; separate unrelated.")
        lines.append("   Commit message describes the WHY — not 'address review comment'.")
    else:
        lines.append("1. No code fixes required from posted threads this iteration.")
    lines.append("2. Address any worthwhile suppressed-comment findings in your fix commits.")
    lines.append(f"3. Write resolutions for every addressed thread to: {rfile}")
    lines.append('     Format: [{"thread_id":"...","resolution":"..."}]')
    lines.append("4. Then run:")
    lines.append(f"     ~/.claude/skills/address-pr-reviews/copilot-review.py step 4 {pr_url}")
    emit_next("NEXT: agent work, then step 4", lines)


def step_4(owner: str, repo: str, pr_num: int, state: dict) -> None:
    """Post resolution comments, resolve threads, record the iteration summary."""
    iter_n = state["iteration"]
    rfile = resolutions_path(owner, repo, pr_num, iter_n)
    if not rfile.exists():
        log(f"[step 4] ERROR: resolutions file not found: {rfile}")
        sys.exit(2)

    resolutions = json.loads(rfile.read_text())
    dfile = decisions_path(owner, repo, pr_num, iter_n)
    decisions = json.loads(dfile.read_text()) if dfile.exists() else []
    decision_map = {d["thread_id"]: d for d in decisions}

    log(f"[step 4 / iter {iter_n}] Posting {len(resolutions)} resolution(s) and resolving threads...")
    for r in resolutions:
        thread_id = r["thread_id"]
        try:
            _post_reply(thread_id, r["resolution"])
            _resolve_thread(thread_id)
            d = decision_map.get(thread_id, {})
            log(f"[step 4] Resolved {thread_id[:14]}… ({d.get('decision', '?')})")
        except RuntimeError as e:
            log(f"[step 4] FAILED on {thread_id}: {e}")
            sys.exit(2)

    decision_counts = {}
    for d in decisions:
        decision_counts[d["decision"]] = decision_counts.get(d["decision"], 0) + 1

    state["history"].append({
        "iteration": iter_n,
        "threads_addressed": len(resolutions),
        "decision_counts": decision_counts,
    })
    state["next_step"] = 5
    save_state(owner, repo, pr_num, state)

    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"
    emit_next("NEXT: run step 5", [
        f"~/.claude/skills/address-pr-reviews/copilot-review.py step 5 {pr_url}",
    ])


def step_5(owner: str, repo: str, pr_num: int, state: dict) -> None:
    """Branch on HEAD diff: code changed → push + trigger + loop; unchanged → merge."""
    iter_n = state["iteration"]
    head_was = state.get("head_at_iter_start")
    head_now = git_head()
    pr_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"

    code_changed = (head_was is not None) and (head_now != head_was)
    # Record the change verdict in the most recent history entry.
    if state["history"]:
        state["history"][-1]["code_changed"] = code_changed
        state["history"][-1]["head_was"] = head_was
        state["history"][-1]["head_now"] = head_now

    if not code_changed:
        log(f"[step 5 / iter {iter_n}] HEAD unchanged ({head_now}). Loop converged — merging PR.")
        try:
            merge_out = subprocess.check_output(
                ["gh", "pr", "merge", str(pr_num), "--repo", f"{owner}/{repo}",
                 "--squash", "--delete-branch"],
                text=True, stderr=subprocess.STDOUT,
            )
        except subprocess.CalledProcessError as e:
            err = (e.output or "").strip()
            log(f"[step 5] Merge failed: {err}")
            log("[step 5] Most likely: branch protection (required approvals / status checks). Surface to user.")
            state["next_step"] = "blocked"
            state["final_state"] = f"merge_blocked: {err[:200]}"
            save_state(owner, repo, pr_num, state)
            sys.exit(2)
        log(f"[step 5] Merged: {merge_out.strip()}")
        state["next_step"] = "done"
        state["final_state"] = "merged"
        save_state(owner, repo, pr_num, state)

        lines = ["Loop complete.", "", "Iteration summary:"]
        for h in state["history"]:
            decisions_str = ", ".join(f"{k}={v}" for k, v in (h.get("decision_counts") or {}).items()) or "(none)"
            cc = "code_changed" if h.get("code_changed") else "no_code_change"
            lines.append(f"  iter {h['iteration']}: threads={h['threads_addressed']} {cc}  decisions=[{decisions_str}]")
        lines.append("")
        lines.append("Final state: merged.")
        lines.append("Report iteration totals, threads addressed, law citations on pushbacks, and merge result to the user.")
        emit_next("DONE", lines)
        return

    log(f"[step 5 / iter {iter_n}] HEAD moved ({head_was} → {head_now}). Pushing + triggering re-review.")

    if iter_n >= ITER_CAP:
        log(f"[step 5] Iteration cap ({ITER_CAP}) reached without convergence — surfacing to user.")
        state["next_step"] = "blocked"
        state["final_state"] = f"iteration_cap_reached_at_{iter_n}"
        save_state(owner, repo, pr_num, state)
        sys.exit(2)

    try:
        push_out = subprocess.check_output(
            ["git", "push"], text=True, stderr=subprocess.STDOUT,
        )
        log(f"[step 5] git push: {push_out.strip()}")
    except subprocess.CalledProcessError as e:
        log(f"[step 5] git push failed: {(e.output or '').strip()}")
        sys.exit(2)

    cmd_trigger(argparse.Namespace(pr_url=pr_url))

    # Confirm Copilot is now a requested reviewer before transitioning to the
    # next iteration. The /review-requests POST is processed asynchronously by
    # GitHub — without this confirmation, step 1 of the next iteration may run
    # before Copilot appears in reviewRequests, see "no review pending", proceed
    # immediately, fetch zero new threads, and falsely converge to merge.
    # [LAW:single-enforcer] is_copilot_review_pending owns review-state truth.
    log("[step 5] Confirming Copilot review has started...")
    if not wait_for_copilot_review_to_start(owner, repo, pr_num, timeout=120):
        log("[step 5] Copilot did not appear in reviewRequests within 120s after trigger.")
        log("[step 5] Trigger likely failed silently — surfacing to user.")
        state["next_step"] = "blocked"
        state["final_state"] = "trigger_did_not_register"
        save_state(owner, repo, pr_num, state)
        sys.exit(2)
    log("[step 5] Copilot review is in flight.")

    state["iteration"] = iter_n + 1
    state["next_step"] = 1
    state["head_at_iter_start"] = None
    save_state(owner, repo, pr_num, state)

    emit_next(f"NEXT: loop continues at iteration {iter_n + 1} — run step 1", [
        f"~/.claude/skills/address-pr-reviews/copilot-review.py step 1 {pr_url}",
    ])


STEP_HANDLERS = {1: step_1, 2: step_2, 3: step_3, 4: step_4, 5: step_5}


def cmd_step(args: argparse.Namespace) -> None:
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    state = load_state(owner, repo, pr_num)

    # Terminal-state guard: once done or blocked, refuse to act so the agent reports cleanly.
    terminal = state.get("next_step")
    if terminal == "done":
        log(f"[step] Loop already completed for {owner}/{repo}#{pr_num}. Final state: {state.get('final_state')}.")
        log(f"[step] To restart: rm {state_path(owner, repo, pr_num)}")
        for h in state.get("history", []):
            log(f"  iter {h['iteration']}: threads={h['threads_addressed']} decisions={h.get('decision_counts')}")
        return
    if terminal == "blocked":
        log(f"[step] Loop is blocked for {owner}/{repo}#{pr_num}. Reason: {state.get('final_state')}.")
        log(f"[step] Resolve the blocker, then either delete {state_path(owner, repo, pr_num)} to restart")
        log(f"[step] or fix the underlying condition and re-run the appropriate step.")
        return

    handler = STEP_HANDLERS.get(args.step)
    if handler is None:
        log(f"[step] Unknown step: {args.step}")
        sys.exit(2)
    try:
        handler(owner, repo, pr_num, state)
    except RuntimeError as e:
        log(f"[step {args.step}] ERROR: {e}")
        sys.exit(2)


def main() -> None:
    p = argparse.ArgumentParser(prog="copilot-review", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    pf = sub.add_parser("fetch", help="dump all stored comments from existing sessions")
    pf.add_argument("pr_url")
    pf.add_argument("-o", "--output", help="write to file instead of stdout")
    pf.set_defaults(func=cmd_fetch)

    pt = sub.add_parser("trigger", help="kick off a new Copilot review")
    pt.add_argument("pr_url")
    pt.set_defaults(func=cmd_trigger)

    pw = sub.add_parser("watch", help="wait for new session, stream filtered output to file")
    pw.add_argument("pr_url")
    pw.add_argument("-o", "--output", required=True, help="output file path")
    pw.add_argument("--trigger", action="store_true",
                    help="trigger a new review before watching (one-shot kickoff)")
    pw.add_argument("--poll-interval", type=int, default=5,
                    help="seconds between polls (default 5)")
    pw.add_argument("--discover-timeout", type=int, default=300,
                    help="seconds to wait for a new session to appear (default 300)")
    pw.add_argument("--max-stable", type=int, default=6,
                    help="consecutive polls with no new events before declaring done (default 6)")
    pw.set_defaults(func=cmd_watch)

    ps = sub.add_parser("step", help="execute one step of the address-pr-reviews workflow loop")
    ps.add_argument("step", type=int, choices=[1, 2, 3, 4, 5],
                    help="step number (1=wait, 2=fetch, 3=propose, 4=resolve, 5=branch)")
    ps.add_argument("pr_url")
    ps.set_defaults(func=cmd_step)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
