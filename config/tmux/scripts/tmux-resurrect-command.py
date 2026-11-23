#!/usr/bin/env python3
"""tmux-resurrect save-command strategy: prints the command a restore relaunches in each pane.

resurrect runs it once per save with every pane's pid (@resurrect-save-command-strategy, a
path in tmux.conf) and reads one line per pid, in order. A pane's program is the leader of
its terminal's foreground process group, which is what the pane is showing. tmux's default
shell there means nothing is running to restart: an empty line. A Claude Code session the
program runs is printed as the command that resumes it. Each line is one shell command,
because restore types it into a shell.

What a restore will not bring back is reported on stderr: a pane whose program cannot be read
(it gets an empty line; the other panes are still recorded), and a Claude session outside the
program its pane shows (a suspended job, say). A fact the whole save needs - the process
table, the agent list, Claude's options - that cannot be read fails the strategy, and
resurrect then keeps the last save.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# [LAW:one-way-deps] the shared reader of how Claude was started, found through this file's symlink into the
# dotfiles repo. A missing module fails the strategy, and with it the save, loudly.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "claude" / "lib"))
from claude_process import Launch, Option, Process, Unreadable, Unresumable, claude_options, launch, resumed, started_with  # noqa: E402

# The kinds `claude agents --json` reports. One it doesn't know fails the save: a renamed kind would
# otherwise drop every session from the save without a word.
AGENT_KINDS = {"interactive", "background"}
# Characters a shell word cannot carry on one line as they are, nor inside $'...' unescaped.
UNSAFE = re.compile(r"[\\'\x00-\x1f\x7f]")


class Failed(Exception):
    """A fact the whole save needs could not be read."""


@dataclass(frozen=True)
class Session:
    id: str
    pid: int
    started: Launch


@dataclass(frozen=True)
class Record:
    argv: list[str]  # empty when the pane runs nothing to restart
    session: Session | None  # the Claude session the argv resumes


@dataclass(frozen=True)
class Unrecorded:
    reason: str  # why the pane's program could not be read; a restore starts a shell there


@dataclass(frozen=True)
class Snapshot:
    """What every pane of one save is recorded from, read once."""
    shell: str  # real path of tmux's default shell
    parent: dict[int, int]
    children: dict[int, list[int]]
    foreground: dict[int, int]  # pid -> its terminal's foreground process group
    sessions: dict[int, str]  # pid -> id of the interactive Claude session it is
    grammar: dict[str, Option]


def at_prompt(program: Process, executable: str, shell: str) -> bool:
    """Whether the pane shows its own prompt: `program` (real path `executable`) is tmux's default
    shell (real path `shell`) given no command or script, only options (`-zsh`, `zsh -l`)."""
    return executable == shell and all(word.startswith("-") for word in program.argv[1:])


def recorded(program: Process, sessions: list[Session], grammar: dict[str, Option]) -> Record:
    """What a restore runs for a pane showing `program`, given the Claude sessions running under it, nearest first.

    The nearest whose words end the program's argv is the session the program runs: the program itself, or a
    wrapper that passes Claude's command line through (`fritter ... -- claude`, `npx claude`). It is replaced by
    its resume. The others the program started itself (remote-control's conversations, a session's own
    `claude -p`), and they come back with it. A program running no session is kept as it was launched.
    """
    for session in sessions:
        head = len(program.argv) - len(session.started.words)
        if head >= 0 and program.argv[head:] == session.started.words:
            return Record(resumed(Launch(program.argv[:head], session.started.words), session.id, grammar), session)
    return Record(program.argv, None)


def runs_under(pid: int, ancestor: int, parent: dict[int, int], pane: int) -> bool:
    """Whether `ancestor` is `pid` or one of its ancestors, within the pane's process tree."""
    while pid != ancestor and pid != pane:
        pid = parent[pid]
    return pid == ancestor


def pane_record(snapshot: Snapshot, pane: int) -> tuple[Record | Unrecorded, list[int]]:
    """What a restore runs for `pane`, and the pids of the Claude sessions in it that a restore does not bring back."""
    if pane not in snapshot.foreground:
        return Unrecorded("its process exited during the save"), []
    tree = [pane]
    for pid in tree:
        tree += snapshot.children.get(pid, [])
    in_pane = [pid for pid in tree if pid in snapshot.sessions]
    leader = snapshot.foreground[pane]
    try:
        program = started_with(leader)
        if at_prompt(program, os.path.realpath(program.path), snapshot.shell):
            return Record([], None), in_pane
        # [LAW:one-source-of-truth] ancestry alone says which sessions belong to the program the pane shows.
        under = [pid for pid in in_pane if runs_under(pid, leader, snapshot.parent, pane)]
        sessions = [Session(snapshot.sessions[pid], pid, launch(started_with(pid))) for pid in under]
        record = recorded(program, sessions, snapshot.grammar)
    except (Unreadable, Unresumable) as failure:
        return Unrecorded(str(failure)), in_pane
    return record, [pid for pid in in_pane if pid not in under]


def shell_word(word: str) -> str:
    """`word` quoted for a POSIX shell on one line: ANSI-C $'...' with \\xHH escapes when plain quoting can't."""
    if not re.search(r"[\x00-\x1f\x7f]", word):
        return shlex.quote(word)
    return "$'" + UNSAFE.sub(lambda match: f"\\x{ord(match[0]):02x}", word) + "'"


def run(*command: str) -> str:
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True).stdout.strip()
    except OSError as failure:
        raise Failed(f"cannot run {command[0]} from this tmux server's PATH: {failure}") from failure
    except subprocess.CalledProcessError as failure:
        raise Failed(f"{shlex.join(command)} exited {failure.returncode}: {failure.stderr.strip()}") from failure


def listed_sessions(agents: list[dict]) -> dict[int, str]:
    unknown = {agent["kind"] for agent in agents} - AGENT_KINDS
    if unknown:
        raise Failed(f"claude agents --json reports kinds this strategy does not know: {sorted(unknown)}")
    return {agent["pid"]: agent["sessionId"] for agent in agents if agent["kind"] == "interactive"}


def snapshot() -> Snapshot:
    parent, children, foreground = {}, {}, {}
    for line in run("ps", "-axo", "pid=,ppid=,tpgid=").splitlines():
        pid, ppid, tpgid = map(int, line.split())
        children.setdefault(ppid, []).append(pid)
        parent[pid], foreground[pid] = ppid, tpgid
    return Snapshot(os.path.realpath(run("tmux", "show", "-gv", "default-shell")), parent, children, foreground,
                    listed_sessions(json.loads(run("claude", "agents", "--json"))), claude_options())


def main(panes: list[int]) -> None:
    # An argv is bytes; the ones that are not UTF-8 go back out as the same bytes.
    sys.stdout.reconfigure(errors="surrogateescape")
    sys.stderr.reconfigure(errors="surrogateescape")
    save = snapshot()
    for pane in panes:
        record, lost = pane_record(save, pane)
        if isinstance(record, Unrecorded):
            print(f"tmux-resurrect-command: pane {pane}: cannot record its program ({record.reason}); a restore"
                  " starts a shell there", file=sys.stderr)
        for pid in lost:
            print(f"tmux-resurrect-command: pane {pane}: Claude session {save.sessions[pid]} runs outside what the"
                  " pane shows; a restore does not bring it back", file=sys.stderr)
        print(" ".join(map(shell_word, record.argv)) if isinstance(record, Record) else "")


if __name__ == "__main__":
    try:
        main([int(pid) for pid in sys.argv[1:]])
    except (Failed, Unreadable, Unresumable) as failure:
        sys.exit(f"tmux-resurrect-command: {failure}")
