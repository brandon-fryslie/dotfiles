#!/usr/bin/env python3
"""Find Claude Code sessions in the current project matching a topic.

Searches ~/.claude/projects/<slug>/*.jsonl and ~/.claude.zai/projects/<slug>/*.jsonl
where <slug> is $PWD with `/` and `.` replaced by `-` (matches Claude Code's
own project-dir encoding).

Only meaningful text fields are searched (ai-title, user prompts, assistant
text/thinking). Attachments, hook outputs, and metadata events are skipped to
keep matches signal-rich and output compact.

The session ID set in CLAUDE_CODE_SESSION_ID (if any) is excluded from results
so the agent never matches the session it's currently being run from.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from _session_lib import (
    TEXT_TYPES,
    extract_text,
    iter_events,
    regex_arg,
    session_dirs,
    slug_for,
)


@dataclass
class SessionHit:
    session_id: str
    project: str
    root_label: str
    title: str = ""
    matches: int = 0
    first_snippet: str = ""
    last_ts: str = ""
    mtime: float = 0.0
    first_user_prompt: str = ""


def scan_file(path: Path, pat: re.Pattern, project: str, root_label: str) -> SessionHit | None:
    try:
        hit = SessionHit(
            session_id=path.stem,
            project=project,
            root_label=root_label,
            mtime=path.stat().st_mtime,
        )
        for ev in iter_events(path):
            if ev.get("type") == "ai-title" and not hit.title:
                hit.title = ev.get("aiTitle", "") or ""

            if ev.get("type") == "user" and not hit.first_user_prompt:
                hit.first_user_prompt = extract_text(ev)[:200]

            ts = ev.get("timestamp")
            if ts and ts > hit.last_ts:
                hit.last_ts = ts

            if ev.get("type") not in TEXT_TYPES:
                continue
            text = extract_text(ev)
            if not text:
                continue
            found = pat.findall(text)
            if not found:
                continue
            hit.matches += len(found)
            if not hit.first_snippet:
                m = pat.search(text)
                if m:
                    start = max(0, m.start() - 40)
                    end = min(len(text), m.end() + 80)
                    hit.first_snippet = text[start:end].replace("\n", " ").strip()
    except OSError as e:
        print(f"warning: skipping {path}: {e}", file=sys.stderr)
        return None

    return hit if hit.matches else None


def fmt_date(iso: str, mtime: float) -> str:
    if iso:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            pass
    return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("query", type=regex_arg,
                    help="Topic to search (case-insensitive regex)")
    ap.add_argument("--limit", type=int, default=20, help="Max sessions to print (default: 20)")
    ap.add_argument("--all", action="store_true",
                    help="Search every project, not just $PWD's")
    ap.add_argument("--snippet-len", type=int, default=120,
                    help="Truncate snippet to N chars (default: 120)")
    ap.add_argument("--cwd", default=os.getcwd(),
                    help="Override working directory used for slug (default: $PWD)")
    args = ap.parse_args()

    pat = args.query
    slug = slug_for(Path(args.cwd))
    dirs = session_dirs(slug, args.all)

    if not dirs:
        scope = "anywhere" if args.all else f"for project slug {slug!r}"
        print(f"no session directories found {scope}", file=sys.stderr)
        return 2

    current_id = os.environ.get("CLAUDE_CODE_SESSION_ID", "")

    hits: list[SessionHit] = []
    for d in dirs:
        root_label = ".claude.zai" if ".claude.zai" in str(d) else ".claude"
        for f in d.glob("*.jsonl"):
            if f.stem == current_id:
                continue
            h = scan_file(f, pat, project=d.name, root_label=root_label)
            if h:
                hits.append(h)

    hits.sort(key=lambda h: (h.last_ts or "", h.mtime), reverse=True)

    shown = hits[:args.limit]

    if not shown:
        print(f"no sessions matching {args.query!r} in {len(dirs)} project dir(s)")
        return 1

    for h in shown:
        date = fmt_date(h.last_ts, h.mtime)
        title = h.title or h.first_user_prompt[:60] or "(untitled)"
        line = (f"{h.session_id}  {date}  hits={h.matches:<3}  "
                f"[{h.root_label}]  {h.project}  {title}")
        print(line)
        snip = h.first_snippet[:args.snippet_len]
        if snip:
            print(f"  ↳ {snip}")

    total = len(hits)
    if total > len(shown):
        print(f"... ({total - len(shown)} more — pass --limit {total} to see all)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
