#!/usr/bin/env python3
"""Copilot PR review helper — three operations.

  trigger <PR_URL>   — kick off a fresh Copilot review (Safari session cookies)
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
COPILOT_BOT_LOGIN = "Copilot"
COPILOT_USER_ID = 175728472  # stable web-UI user ID for copilot-pull-request-reviewer


# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

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
        status = " POSTED" if body[:80] in posted_prefixes else " SUPPRESSED"
    return f"### [{ctype}/{sev}{fixed}]{status} `{loc}`\n\n{body}\n"


# ---------------------------------------------------------------------------
# The one signal that matters
# ---------------------------------------------------------------------------

def is_copilot_review_pending(owner: str, repo: str, pr_num: int) -> bool:
    """True iff Copilot is currently a requested reviewer (review in flight).

    GitHub adds Copilot to reviewRequests when a review is triggered and
    removes it when the review is submitted. This is the only authoritative
    signal — never event-stream stability, never stored-comment counts.
    """
    out = subprocess.check_output(
        ["gh", "pr", "view", str(pr_num), "--repo", f"{owner}/{repo}",
         "--json", "reviewRequests",
         "--jq", '[.reviewRequests[].login] | any(. == "Copilot")'],
        text=True,
    ).strip()
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
    """Dump the latest Copilot session's overview + comments.

    Useful when you want to see comments Copilot drafted but didn't post
    (suppressed under the inline-comment cap) or to read the 'generated N
    comments' overview phrase directly. Not required for the loop — the
    posted threads are visible via `gh api graphql`.
    """
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    token = gh_token()

    sessions = scrape_session_payloads(owner, repo, pr_num, token)
    if not sessions:
        print(f"No Copilot review sessions found on {owner}/{repo}#{pr_num}.", file=sys.stderr)
        sys.exit(2)

    latest = sessions[-1]
    sid = latest["session_id"]
    print(f"Latest session: {sid}", file=sys.stderr)

    data = fetch_session_logs(sid, token)
    events = parse_sse_events(data)
    stored = [sc for e in events if (sc := event_store_comment(e))]
    full = session_full_content(events)
    overview = session_pr_overview(events)
    count = parse_generated_comment_count(full)

    posted = fetch_posted_inline_comments(owner, repo, pr_num, token)
    posted_prefixes = {
        c.get("body", "")[:80]
        for c in posted
        if (c.get("user") or {}).get("login") == COPILOT_BOT_LOGIN
    }

    out: list[str] = []
    out.append(f"# Copilot Session — {owner}/{repo}#{pr_num}\n")
    out.append(f"Session: `{sid}`")
    if count is None:
        out.append("\n**Overview signal:** no 'generated N comments' phrase "
                   "(clean review OR review still in flight)\n")
    else:
        out.append(f"\n**Overview signal:** {count} comment(s) generated\n")

    if overview:
        out.append(overview)
        out.append("")

    out.append(f"\n## Stored comments ({len(stored)})\n")
    for sc in stored:
        out.append(format_comment_block(sc, posted_prefixes))

    text = "\n".join(out)
    if args.output:
        Path(args.output).write_text(text)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(text)


def main() -> None:
    p = argparse.ArgumentParser(prog="copilot-review", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    pt = sub.add_parser("trigger", help="kick off a fresh Copilot review")
    pt.add_argument("pr_url")
    pt.set_defaults(func=cmd_trigger)

    pw = sub.add_parser("wait", help="block until any in-flight Copilot review finishes")
    pw.add_argument("pr_url")
    pw.set_defaults(func=cmd_wait)

    pf = sub.add_parser("fetch", help="dump latest session's overview + comments")
    pf.add_argument("pr_url")
    pf.add_argument("-o", "--output", help="write to file instead of stdout")
    pf.set_defaults(func=cmd_fetch)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
