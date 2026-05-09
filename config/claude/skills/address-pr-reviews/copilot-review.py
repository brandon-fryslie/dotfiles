#!/usr/bin/env python3
"""GitHub Copilot PR review agent helper.

Subcommands:
  fetch    — dump all stored comments + reasoning from existing sessions
  trigger  — kick off a new Copilot review on a PR
  watch    — wait for a new review session, stream filtered output to a file

Auth: uses `gh auth token`. No Copilot-specific token exchange needed.

Discovery path: scrape the PR page HTML for `data-hydro-click` attributes whose
event_type is `copilot.reviews.v0.ViewSession`. Each one carries a session_id
that survives long after the task disappears from the active task list.

Relevance filter for `watch`: write any event that
  (a) is a `store_comment` tool call, OR
  (b) contains assistant text matching one of: comment, noticing, considering, verify
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


def cmd_fetch(args: argparse.Namespace) -> None:
    owner, repo, pr_num = parse_pr_url(args.pr_url)
    token = gh_token()

    sessions = scrape_session_payloads(owner, repo, pr_num, token)
    if not sessions:
        print(f"No Copilot review sessions found on {owner}/{repo}#{pr_num}.", file=sys.stderr)
        sys.exit(2)

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

    for s in sessions:
        sid = s["session_id"]
        out.append(f"\n## Session `{sid}`\n")
        try:
            data = fetch_session_logs(sid, token)
        except Exception as e:
            out.append(f"_error: {e}_\n")
            continue
        events = parse_sse_events(data)
        stored = [sc for e in events if (sc := event_store_comment(e))]
        out.append(f"_{len(events)} events, {len(stored)} stored comments_\n")
        for sc in stored:
            block = format_comment_block(sc, posted_prefixes)
            out.append(block)
            total_stored += 1
            if sc.get("comment_content", "")[:80] in posted_prefixes:
                total_posted += 1
            else:
                total_suppressed += 1

        # Optional: include the agent's PR overview (last assistant content event)
        overview = None
        for e in reversed(events):
            c = event_content(e) or ""
            if c.lstrip().startswith("## "):
                overview = c
                break
        if overview:
            out.append("\n### Agent's PR overview\n")
            out.append(overview)
            out.append("")

    out.insert(2, f"**Totals:** {total_stored} stored — {total_posted} posted, {total_suppressed} suppressed\n")

    rendered = "\n".join(out)
    if args.output:
        Path(args.output).write_text(rendered)
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(rendered)


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

    while True:
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
            if stable >= max_stable_polls:
                break

        time.sleep(poll)

    ended = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(out_path, "a") as f:
        f.write(f"\n---\n\n_Stream ended at {ended} — {seen} events processed_\n")
    print(f"[watch] Done — {out_path}", file=sys.stderr)


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

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
