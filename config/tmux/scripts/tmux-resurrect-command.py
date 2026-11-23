#!/usr/bin/env python3
"""tmux-resurrect save-command strategy: prints the command a restore relaunches in each pane.

resurrect runs it once per save with every pane's pid (@resurrect-save-command-strategy, a
path in tmux.conf) and reads one line per pid, in order. A pane's program is the leader of
its terminal's foreground process group, which is what the pane is showing. tmux's default
shell there means nothing is running to restart: an empty line. A Claude Code session is
printed as the command that resumes it. Each line is one shell command, because restore types
it into a shell.

A Claude session in a pane that is outside the program the pane shows (a suspended job, say)
comes back with nothing, and is reported on stderr. One under that program comes back with it. Anything the strategy cannot
decide fails it, and resurrect then keeps the last save.
"""

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
from claude_process import Option, Process, Unreadable, Unresumable, claude_options, resumed, started_with  # noqa: E402

# Characters a shell word cannot carry on one line as they are, nor inside $'...' unescaped.
UNSAFE = re.compile(r"[\\'\x00-\x1f\x7f]")


@dataclass(frozen=True)
class Session:
    id: str
    pid: int
    argv: list[str]


@dataclass(frozen=True)
class Record:
    argv: list[str]  # empty when the pane runs nothing to restart
    session: Session | None  # the Claude session the argv resumes


def at_prompt(program: Process, executable: str, shell: str) -> bool:
    """Whether the pane shows its own prompt: `program` (real path `executable`) is tmux's default
    shell (real path `shell`) given no command or script, only options (`-zsh`, `zsh -l`)."""
    return executable == shell and all(word.startswith("-") for word in program.argv[1:])


def recorded(program: Process, executable: str, shell: str, sessions: list[Session], grammar: dict[str, Option]) -> Record:
    """What a restore runs for a pane showing `program`, given the Claude sessions in the pane's process tree.

    The session whose argv ends the program's argv is the one the program runs: the program itself, or
    a wrapper that passes its command line through (`fritter ... -- claude`). That tail is replaced by
    its resume. A program running no session is kept as it was launched.
    """
    if at_prompt(program, executable, shell):
        return Record([], None)
    for session in sessions:
        head = len(program.argv) - len(session.argv)
        if head >= 0 and program.argv[head:] == session.argv:
            return Record([*program.argv[:head], *resumed(session.argv, session.id, grammar)], session)
    return Record(program.argv, None)


def runs_under(pid: int, ancestor: int, parent: dict[int, int], pane: int) -> bool:
    """Whether `ancestor` is `pid` or one of its ancestors, within the pane's process tree."""
    while pid != ancestor and pid != pane:
        pid = parent[pid]
    return pid == ancestor


def shell_word(word: str) -> str:
    """`word` quoted for a POSIX shell on one line: ANSI-C $'...' with \\xHH escapes when plain quoting can't."""
    if not re.search(r"[\x00-\x1f\x7f]", word):
        return shlex.quote(word)
    return "$'" + UNSAFE.sub(lambda match: f"\\x{ord(match[0]):02x}", word) + "'"


def run(*command: str) -> str:
    return subprocess.run(command, check=True, capture_output=True, text=True).stdout.strip()


def main(pane_pids: list[int]) -> None:
    shell = os.path.realpath(run("tmux", "show", "-gv", "default-shell"))
    children, parent, foreground = {}, {}, {}
    for line in run("ps", "-axo", "pid=,ppid=,tpgid=").splitlines():
        pid, ppid, tpgid = map(int, line.split())
        children.setdefault(ppid, []).append(pid)
        parent[pid], foreground[pid] = ppid, tpgid
    agents = json.loads(run("claude", "agents", "--json"))
    session_ids = {agent["pid"]: agent["sessionId"] for agent in agents if agent["kind"] == "interactive"}
    grammar = claude_options()
    for pane in pane_pids:
        tree = [pane]
        for pid in tree:
            tree += children.get(pid, [])
        sessions = [Session(session_ids[pid], pid, started_with(pid).argv) for pid in tree if pid in session_ids]
        program = started_with(foreground[pane])
        record = recorded(program, os.path.realpath(program.path), shell, sessions, grammar)
        for session in sessions:
            if not record.argv or not runs_under(session.pid, foreground[pane], parent, pane):
                print(f"tmux-resurrect-command: pane {pane}: Claude session {session.id} runs outside what the pane"
                      " shows, so a restore does not bring it back", file=sys.stderr)
        print(" ".join(map(shell_word, record.argv)))


if __name__ == "__main__":
    try:
        main([int(pid) for pid in sys.argv[1:]])
    except (Unreadable, Unresumable) as failure:
        sys.exit(f"tmux-resurrect-command: {failure}")
    except subprocess.CalledProcessError as failure:
        sys.exit(f"tmux-resurrect-command: {shlex.join(failure.cmd)} exited {failure.returncode}: {failure.stderr.strip()}")
