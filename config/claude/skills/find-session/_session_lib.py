"""Shared helpers for the find-session skill.

Pure functions over Claude Code transcript JSONL. Both `find_session.py`
(search across many sessions) and `show_session.py` (probe one session)
build on this module.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Iterator
from pathlib import Path

TEXT_TYPES = {"ai-title", "user", "assistant"}
# Subset of TEXT_TYPES that represents navigable conversation messages.
# ai-title is metadata: it has no uuid or timestamp, so it can't anchor a
# context window or be drilled into individually.
MESSAGE_TYPES = {"user", "assistant"}


def slug_for(cwd: Path) -> str:
    """Mirror of Claude Code's own project-directory encoder.

    Every character outside [A-Za-z0-9] collapses to '-', so '_' and '/' and '.'
    are all indistinguishable in a slug. Verified against the `cwd` field
    recorded inside the transcripts themselves — the encoder's output and its
    input sit side by side on disk, so this copy stays checkable against the
    original it duplicates.
    """
    return re.sub(r"[^A-Za-z0-9]", "-", str(cwd))


def projects_root() -> Path:
    """Where Claude Code keeps every project's transcripts.

    The config dir is the executing session's own, so a transcript reader run
    from inside a session reads the transcripts that session's Claude Code wrote.
    """
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude") / "projects"


def session_dirs(slug: str, all_projects: bool) -> list[Path]:
    root = projects_root()
    if not root.is_dir():
        return []
    if all_projects:
        return [p for p in root.iterdir() if p.is_dir()]
    d = root / slug
    return [d] if d.is_dir() else []


def locate_session_file(project: str, session_id: str) -> Path:
    """Resolve <project>/<session_id>.jsonl under the projects root.

    Raises FileNotFoundError naming the path tried.
    """
    candidate = projects_root() / project / f"{session_id}.jsonl"
    if not candidate.is_file():
        raise FileNotFoundError(f"session file not found: {candidate}")
    return candidate


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


def regex_arg(s: str) -> re.Pattern:
    """argparse type= for a case-insensitive regex CLI argument.

    Validation lives at the CLI boundary so cmd_* bodies receive an already-
    compiled pattern — no callsite ever sees a malformed-regex string.
    """
    try:
        return re.compile(s, re.IGNORECASE)
    except re.error as e:
        raise argparse.ArgumentTypeError(f"invalid regex {s!r}: {e}")


def nonneg_int(s: str) -> int:
    n = int(s)
    if n < 0:
        raise argparse.ArgumentTypeError(f"must be >= 0, got {n}")
    return n


def positive_int(s: str) -> int:
    n = int(s)
    if n < 1:
        raise argparse.ArgumentTypeError(f"must be >= 1, got {n}")
    return n


def safe_path_component(s: str) -> str:
    """argparse type= for a single path component — no separators, no .. / .

    Ensures the value can be combined with a trusted root via `root / s` without
    escaping the root. Rejects '/' and '\\\\' (Path treats either as a separator;
    a leading '/' even *replaces* the root since `Path('/a') / '/b' == Path('/b')`).
    """
    if not s or s in (".", "..") or "/" in s or "\\" in s:
        raise argparse.ArgumentTypeError(
            f"path component must not contain separators or be '.'/'..' (got {s!r})"
        )
    return s


def iter_rows(path: Path, *needles: bytes) -> Iterator[tuple[int, dict]]:
    """Yield (line number, event) for every line of a transcript containing any needle.

    Needles are matched against the raw bytes before any JSON is parsed, which
    is what keeps a scan across gigabytes of transcripts fast; with no needles
    every line matches. Transcripts are append-only logs, and a torn final line
    from a crash or a live writer is a known shape, so a line that is not a JSON
    object does not fail the scan. It is reported on stderr with its location
    instead, because a skip nobody can see reads as a transcript that never said
    anything. [LAW:no-silent-failure]
    """
    with path.open("rb") as f:
        for number, raw in enumerate(f, 1):
            if needles and not any(n in raw for n in needles):
                continue
            try:
                ev = json.loads(raw)
            except ValueError as e:  # JSONDecodeError, or UnicodeDecodeError from invalid UTF-8
                print(f"{path}:{number}: skipped a malformed transcript line ({e})", file=sys.stderr)
                continue
            if not isinstance(ev, dict):
                print(f"{path}:{number}: skipped a transcript line that is not an object", file=sys.stderr)
                continue
            yield number, ev


def iter_events(path: Path) -> Iterator[dict]:
    """Every event of a transcript, in order; `iter_rows` without the line numbers."""
    return (ev for _, ev in iter_rows(path))
