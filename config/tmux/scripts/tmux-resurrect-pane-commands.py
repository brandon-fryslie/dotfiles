#!/usr/bin/env python3
"""tmux-resurrect post-save-layout hook: records the command each pane should restart.

Resurrect's own record of a pane's command is every `ps` line whose ppid *starts
with* the pane pid: children of the pane's process, matched by string prefix. A pane
whose process is the program itself (how Claude Code panes are launched) is recorded
as one of its MCP servers, a pid that prefixes another pane's pid pulls that pane's
processes in, and several matches put stray lines into the save file. So this hook
owns the save's full-command column: it rewrites it, for every pane, from the
pane's foreground process group leader - the program the pane is showing - and a
Claude Code session as a `claude --resume <session id>` that reopens that
conversation. The session ids come from `claude agents --json`.

Usage (tmux.conf): set -g @resurrect-hook-post-save-layout '<this file>'
resurrect passes the save file path as the only argument.
"""

import ctypes
import json
import os
import shlex
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

# Line types resurrect writes; anything else in a save is a fragment of a
# multi-line command resurrect recorded, which this hook replaces.
SAVE_LINE_TYPES = {"grouped_session", "pane", "window", "state"}
# Flags that pick which conversation `claude` opens; the resume replaces them.
SESSION_FLAGS = {"--resume", "-r", "--continue", "-c", "--session-id", "--fork-session"}
SESSION_FLAGS_WITH_VALUE = {"--resume", "-r", "--session-id"}
RUN_LOG = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state")) / "tmux/resurrect-pane-commands.jsonl"


@dataclass(frozen=True)
class Pane:
    # (session name, window index, pane index): how a save's pane line names its pane.
    key: tuple[str, str, str]
    pid: int


def restore_command(argv: list[str], session_id: str | None) -> list[str]:
    """The command that brings the program back; a Claude session resumes its conversation."""
    if session_id is None:
        return argv
    args, rest = [], iter(argv[1:])
    for arg in rest:
        flag = arg.split("=", 1)[0]
        if flag not in SESSION_FLAGS:
            args.append(arg)
        elif flag == arg and flag in SESSION_FLAGS_WITH_VALUE:
            next(rest, None)
    return ["claude", *args, "--resume", session_id]


def rewrite_save(save: str, commands: dict[tuple[str, str, str], list[str]]) -> str:
    """The save with each pane line's full-command field set from `commands`.

    A pane missing from `commands` closed while resurrect was saving: nothing runs in it.
    """
    out = []
    for line in save.splitlines():
        fields = line.split("\t")
        if fields[0] not in SAVE_LINE_TYPES:
            continue
        if fields[0] == "pane":
            fields[10:] = [":" + shlex.join(commands.get((fields[1], fields[2], fields[5]), []))]
        out.append("\t".join(fields))
    return "\n".join(out) + "\n"


def run(*cmd: str) -> str:
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def list_panes() -> list[Pane]:
    fmt = "#{session_name}\t#{window_index}\t#{pane_index}\t#{pane_pid}"
    panes = []
    for line in run("tmux", "list-panes", "-a", "-F", fmt).splitlines():
        session, window, index, pid = line.split("\t")
        panes.append(Pane((session, window, index), int(pid)))
    return panes


def foreground_pgids() -> dict[int, int]:
    """pid -> the foreground process group of its controlling terminal (ps tpgid)."""
    return {int(pid): int(tpgid) for pid, tpgid in (l.split() for l in run("ps", "-axo", "pid=,tpgid=").splitlines())}


_libc = ctypes.CDLL(None, use_errno=True)


def sysctl(mib, buf, size: ctypes.c_size_t, pid: int) -> None:
    """sysctl(3) into buf; with buf None, sets size to the bytes it needs."""
    if _libc.sysctl(mib, 3, buf, ctypes.byref(size), None, 0) != 0:
        raise OSError(ctypes.get_errno(), f"sysctl KERN_PROCARGS2 failed for pid {pid}")


def process_argv(pid: int) -> list[str]:
    """A process's exact argv, read with sysctl KERN_PROCARGS2 (ps joins it with spaces)."""
    mib = (ctypes.c_int * 3)(1, 49, pid)  # CTL_KERN, KERN_PROCARGS2
    size = ctypes.c_size_t(0)
    sysctl(mib, None, size, pid)
    buf = ctypes.create_string_buffer(size.value)
    sysctl(mib, buf, size, pid)
    # Layout: argc (int32), exec path, NUL padding, then argc NUL-terminated args.
    raw = buf.raw[: size.value]
    argc = int.from_bytes(raw[:4], sys.byteorder)
    after_path = raw[4:][raw[4:].index(b"\0") :].lstrip(b"\0")
    return [a.decode() for a in after_path.split(b"\0")[:argc]]


def claude_sessions() -> dict[int, str]:
    """pid -> session id for every interactive Claude Code session running."""
    agents = json.loads(run("claude", "agents", "--json"))
    return {a["pid"]: a["sessionId"] for a in agents if a["kind"] == "interactive"}


def main(save_path: str) -> None:
    started = time.monotonic()
    panes, pgids, sessions = list_panes(), foreground_pgids(), claude_sessions()
    # An idle pane's foreground program is its shell; @resurrect-processes decides
    # what restarts, and no shell is on it.
    programs = {p.key: pgids[p.pid] for p in panes}
    commands = {key: restore_command(process_argv(pid), sessions.get(pid)) for key, pid in programs.items()}

    path = Path(save_path)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as tmp:
        tmp.write(rewrite_save(path.read_text(), commands))
    os.replace(tmp.name, path)

    # [LAW:nothing-unseen] one record per save; stdout would land in a tmux pane via run-shell.
    RUN_LOG.parent.mkdir(parents=True, exist_ok=True)
    with RUN_LOG.open("a") as log:
        log.write(json.dumps({
            "event": "resurrect-pane-commands", "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "save": str(path), "duration_ms": round((time.monotonic() - started) * 1000),
            "counts": {"panes": len(panes), "programs": len(programs),
                       "claude_sessions": sum(pid in sessions for pid in programs.values())},
        }) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
