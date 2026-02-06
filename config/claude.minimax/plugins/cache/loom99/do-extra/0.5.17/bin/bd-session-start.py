#!/usr/bin/env python3
"""
bd-session-start.py - Initialize bd and inject workflow context at session start

Self-healing: Automatically cleans up stale daemon locks, syncs out-of-date
databases, and gracefully handles all failure modes.

Auto-initializes bd if:
  - bd is installed
  - .beads/ doesn't exist
  - Current directory is a git repo

Then outputs workflow context from skills/beads/context/session-start.md
and shows current ready work from bd.
"""

import json
import os
import shutil
import subprocess
from typing import List, Optional

BD_TIMEOUT = 5

STALE_FILES = ("daemon.lock", "beads.db-shm", "beads.db-wal")


# --- Pure functions ---

def parse_json(text):
    # type: (str) -> Optional[List]
    """Parse JSON text into a list, returning None on failure or empty input."""
    if not text:
        return None
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def format_ready_items(items):
    # type: (Optional[List]) -> List[str]
    """Format ready work items into output lines."""
    if not items:
        return ["*No ready work - all issues are blocked or completed*"]
    lines = []
    for item in items:
        try:
            id_ = item.get("id", "?")
            title = item.get("title", "untitled")
            priority = item.get("priority", "?")
            type_ = item.get("type", "task")
            lines.append("- **[{}]** {} (P{}, {})".format(id_, title, priority, type_))
        except (AttributeError, TypeError):
            continue
    return lines or ["*No ready work - all issues are blocked or completed*"]


def format_in_progress_items(items):
    # type: (Optional[List]) -> List[str]
    """Format in-progress work items into output lines (with header)."""
    if not items:
        return []
    lines = ["## In Progress", ""]
    for item in items:
        try:
            id_ = item.get("id", "?")
            title = item.get("title", "untitled")
            lines.append("- **[{}]** {}".format(id_, title))
        except (AttributeError, TypeError):
            continue
    if len(lines) == 2:  # only header, no items survived
        return []
    lines.append("")
    return lines


def format_ready_section(raw_json):
    # type: (str) -> List[str]
    """Build the ready-work section from raw bd output."""
    lines = ["## Current Ready Work", ""]
    if raw_json:
        lines.extend(format_ready_items(parse_json(raw_json)))
    else:
        lines.append("*bd unavailable - check beads status*")
    lines.append("")
    return lines


def read_context_file(plugin_root):
    # type: (str) -> List[str]
    """Read the session-start context file, returning its lines or empty."""
    path = os.path.join(plugin_root, "skills/beads/context/session-start.md")
    if not os.path.isfile(path):
        return []
    try:
        with open(path) as f:
            return [f.read()]
    except OSError:
        return []


def daemon_pid(lock_path):
    # type: (str) -> Optional[int]
    """Extract pid from a daemon lock file, or None if unreadable."""
    try:
        with open(lock_path) as f:
            return json.load(f).get("pid")
    except (json.JSONDecodeError, OSError, TypeError):
        return None


def is_process_alive(pid):
    # type: (int) -> bool
    """Check whether a process is running."""
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ValueError):
        return False


def needs_sync(stats_output):
    # type: (str) -> bool
    """Determine if db needs sync based on stats output."""
    return "out of sync" in stats_output or "import-only" in stats_output


# --- Side-effecting functions (isolated) ---

def run_bd(*args):
    # type: (*str) -> str
    """Run bd in sandbox mode with timeout. Returns stdout or empty string."""
    try:
        result = subprocess.run(
            ["bd", "--sandbox"] + list(args),
            capture_output=True, text=True, timeout=BD_TIMEOUT
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except (subprocess.TimeoutExpired, OSError):
        return ""


def run_bd_write(*args):
    # type: (*str) -> None
    """Run bd in regular mode (for writes). Fire-and-forget."""
    try:
        subprocess.run(
            ["bd"] + list(args),
            capture_output=True, text=True, timeout=BD_TIMEOUT
        )
    except (subprocess.TimeoutExpired, OSError):
        pass


def cleanup_stale_daemon():
    # type: () -> None
    """Remove stale daemon lock and WAL files if the owning process is dead."""
    lock_path = ".beads/daemon.lock"
    if not os.path.isfile(lock_path):
        return
    pid = daemon_pid(lock_path)
    if pid is None or is_process_alive(int(pid)):
        return
    for name in STALE_FILES:
        try:
            os.remove(os.path.join(".beads", name))
        except OSError:
            pass


def ensure_db_synced():
    # type: () -> None
    """Sync the database if it's out of date."""
    try:
        result = subprocess.run(
            ["bd", "--sandbox", "stats", "--json"],
            capture_output=True, text=True, timeout=BD_TIMEOUT
        )
        output = result.stdout + result.stderr
    except (subprocess.TimeoutExpired, OSError):
        return
    if needs_sync(output):
        run_bd_write("sync", "--import-only")


def auto_init():
    # type: () -> None
    """Initialize bd if not present and we're in a git repo."""
    if not os.path.isdir(".beads") and os.path.isdir(".git"):
        run_bd_write("init", "--quiet")
        run_bd_write("hooks", "install")


def heal():
    # type: () -> None
    """Run self-healing: stale daemon cleanup and db sync."""
    cleanup_stale_daemon()
    ensure_db_synced()


# --- Composition ---

def build_output():
    # type: () -> List[str]
    """Collect all output lines (pure data assembly after side effects are done)."""
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT", "")
    lines = read_context_file(plugin_root)
    lines.extend(format_ready_section(run_bd("ready", "--json")))
    lines.extend(format_in_progress_items(
        parse_json(run_bd("list", "--status", "in_progress", "--json"))
    ))
    return lines


def main():
    # type: () -> None
    if not shutil.which("bd"):
        return

    auto_init()

    if not os.path.isdir(".beads"):
        return

    heal()
    lines = build_output()
    try:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": "\n".join(lines)
            }
        }))
    except (TypeError, ValueError) as e:
        print("bd-session-start: failed to serialize output: {}".format(e))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # Never crash the session
