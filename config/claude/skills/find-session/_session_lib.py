"""Shared helpers for the find-session skill.

Pure functions over Claude Code transcript JSONL. Both `find_session.py`
(search across many sessions) and `show_session.py` (probe one session)
build on this module.
"""
from __future__ import annotations

import json
import re
from collections.abc import Iterator
from pathlib import Path

ROOTS = [Path.home() / ".claude" / "projects",
         Path.home() / ".claude.zai" / "projects"]

TEXT_TYPES = {"ai-title", "user", "assistant"}
# Subset of TEXT_TYPES that represents navigable conversation messages.
# ai-title is metadata: it has no uuid or timestamp, so it can't anchor a
# context window or be drilled into individually.
MESSAGE_TYPES = {"user", "assistant"}


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


def locate_session_file(project: str, session_id: str) -> Path:
    """Resolve <project>/<session_id>.jsonl under either root.

    Raises FileNotFoundError listing both attempted paths if neither exists.
    """
    attempted: list[Path] = []
    for root in ROOTS:
        candidate = root / project / f"{session_id}.jsonl"
        attempted.append(candidate)
        if candidate.is_file():
            return candidate
    paths = "\n  ".join(str(p) for p in attempted)
    raise FileNotFoundError(f"session file not found; tried:\n  {paths}")


def extract_text(event: dict) -> str:
    """Searchable text from one JSONL event. Empty string for noise types."""
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


def iter_events(path: Path) -> Iterator[dict]:
    """Yield parsed JSONL events; malformed or non-object lines are skipped.

    Malformed-line tolerance is intentional: transcripts are append-only logs
    and a torn final line during a crash is a known shape — failing the whole
    scan on one bad line would be worse than skipping it. Non-object JSON
    (a bare null, list, or string) is treated the same — the declared return
    type is the contract; callers should be able to trust ev.get(...) works.
    """
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(ev, dict):
                yield ev
