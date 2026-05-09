#!/usr/bin/env python3
"""Find Claude Code sessions in the current project matching a topic.

Searches ~/.claude/projects/<slug>/*.jsonl and ~/.claude.zai/projects/<slug>/*.jsonl
where <slug> is $PWD with `/` and `.` replaced by `-` (matches Claude Code's
own project-dir encoding).

Only meaningful text fields are searched (ai-title, user prompts, assistant
text/thinking). Attachments, hook outputs, and metadata events are skipped to
keep matches signal-rich and output compact.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOTS = [Path.home() / ".claude" / "projects",
         Path.home() / ".claude.zai" / "projects"]

# Message types whose text content is worth searching.
TEXT_TYPES = {"ai-title", "user", "assistant"}


def slug_for(cwd: Path) -> str:
    return re.sub(r"[/.]", "-", str(cwd))


def session_dirs(slug: str, all_projects: bool) -> list[Path]:
    dirs: list[Path] = []
    for root in ROOTS:
        if not root.is_dir():
            continue
        if all_projects:
            dirs.extend(p for p in root.iterdir() if p.is_dir())
        else:
            d = root / slug
            if d.is_dir():
                dirs.append(d)
    return dirs


def extract_text(event: dict) -> str:
    """Pull searchable text from one JSONL event. Empty string for noise types."""
    t = event.get("type")
    if t == "ai-title":
        return event.get("aiTitle", "") or ""
    if t == "user":
        msg = event.get("message", {}) or {}
        c = msg.get("content")
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            return "\n".join(b.get("text", "") for b in c
                             if isinstance(b, dict) and b.get("type") == "text")
        return ""
    if t == "assistant":
        msg = event.get("message", {}) or {}
        c = msg.get("content")
        if isinstance(c, list):
            return "\n".join(
                b.get("text", "") if b.get("type") == "text"
                else b.get("thinking", "") if b.get("type") == "thinking"
                else ""
                for b in c if isinstance(b, dict)
            )
        return ""
    return ""


@dataclass
class SessionHit:
    session_id: str
    project: str        # encoded project-dir name
    root_label: str     # ".claude" or ".claude.zai"
    title: str = ""
    matches: int = 0
    first_snippet: str = ""
    last_ts: str = ""   # ISO timestamp of latest event
    mtime: float = 0.0
    first_user_prompt: str = ""


def scan_file(path: Path, pat: re.Pattern, project: str, root_label: str) -> SessionHit | None:
    hit = SessionHit(
        session_id=path.stem,
        project=project,
        root_label=root_label,
        mtime=path.stat().st_mtime,
    )
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue

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
                        snippet = text[start:end].replace("\n", " ").strip()
                        hit.first_snippet = snippet
    except OSError:
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
    ap.add_argument("query", help="Topic substring to search (case-insensitive regex)")
    ap.add_argument("--limit", type=int, default=20, help="Max sessions to print (default: 20)")
    ap.add_argument("--all", action="store_true",
                    help="Search every project, not just $PWD's")
    ap.add_argument("--snippet-len", type=int, default=120,
                    help="Truncate snippet to N chars (default: 120)")
    ap.add_argument("--cwd", default=os.getcwd(),
                    help="Override working directory used for slug (default: $PWD)")
    args = ap.parse_args()

    pat = re.compile(args.query, re.IGNORECASE)
    slug = slug_for(Path(args.cwd))
    dirs = session_dirs(slug, args.all)

    if not dirs:
        scope = "anywhere" if args.all else f"for project slug {slug!r}"
        print(f"no session directories found {scope}", file=sys.stderr)
        return 2

    hits: list[SessionHit] = []
    for d in dirs:
        root_label = ".claude.zai" if ".claude.zai" in str(d) else ".claude"
        for f in d.glob("*.jsonl"):
            h = scan_file(f, pat, project=d.name, root_label=root_label)
            if h:
                hits.append(h)

    hits.sort(key=lambda h: (h.last_ts or "", h.mtime), reverse=True)

    total = len(hits)
    shown = hits[:args.limit]

    if not shown:
        print(f"no sessions matching {args.query!r} in {len(dirs)} project dir(s)")
        return 1

    for h in shown:
        date = fmt_date(h.last_ts, h.mtime)
        title = h.title or h.first_user_prompt[:60] or "(untitled)"
        line = f"{h.session_id}  {date}  hits={h.matches:<3}  [{h.root_label}]  {title}"
        print(line)
        snip = h.first_snippet[:args.snippet_len]
        if snip:
            print(f"  ↳ {snip}")

    if total > len(shown):
        print(f"... ({total - len(shown)} more — pass --limit {total} to see all)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
