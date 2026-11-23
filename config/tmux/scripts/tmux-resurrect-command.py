#!/usr/bin/env python3
"""tmux-resurrect save-command strategy: prints the command a restore relaunches in one pane.

resurrect runs it once per pane with the pane's pid (@resurrect-save-command-strategy, a path
in tmux.conf). The pane's program is the leader of its terminal's foreground process group,
which is what the pane is showing. tmux's default shell there means nothing is running to
restart, and a Claude Code session is printed as the command that resumes it. The output is
one line: the save holds one record per line, and restore types the command into a shell.
"""

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

# The shared reader of how Claude was started, found through this file's symlink into the dotfiles repo.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "claude" / "lib"))
from claude_process import Process, claude_options, resumed, started_with  # noqa: E402

CONTROL = re.compile(r"[\x00-\x1f\x7f]")
ESCAPES = {"\\": "\\\\", "'": "\\'", "\n": "\\n", "\t": "\\t", "\r": "\\r"}


def at_prompt(program: Process, executable: str, shell: str) -> bool:
    """Whether the pane shows its own prompt: `program` (real path `executable`) is tmux's default
    shell (real path `shell`) given no command or script, only options (`-zsh`, `zsh -l`)."""
    return executable == shell and all(word.startswith("-") for word in program.argv[1:])


def restored(program: Process, sessions: list[tuple[str, list[str]]], resume) -> list[str]:
    """The argv a restore runs for a pane showing `program`.

    `sessions` are the Claude sessions running in the program's process tree, each as (session
    id, argv). The one whose argv ends the program's argv is the session the program runs: the
    program itself, or a wrapper that passes its command line through (`fritter ... -- claude`).
    That tail is replaced by `resume(argv, session)`; a program running no session is kept as is.
    """
    for session, argv in sessions:
        head = len(program.argv) - len(argv)
        if head >= 0 and program.argv[head:] == argv:
            return [*program.argv[:head], *resume(argv, session)]
    return program.argv


def shell_word(word: str) -> str:
    """`word` quoted for a POSIX shell on one line: ANSI-C $'...' when it holds a control character."""
    if not CONTROL.search(word):
        return shlex.quote(word)
    return "$'" + "".join(ESCAPES.get(c) or (f"\\x{ord(c):02x}" if CONTROL.match(c) else c) for c in word) + "'"


def run(*command: str) -> str:
    return subprocess.run(command, check=True, capture_output=True, text=True).stdout.strip()


def process_tree(root: int) -> list[int]:
    """`root` and its descendants, nearest first."""
    children = {}
    for line in run("ps", "-axo", "pid=,ppid=").splitlines():
        pid, ppid = map(int, line.split())
        children.setdefault(ppid, []).append(pid)
    tree = [root]
    for pid in tree:
        tree += children.get(pid, [])
    return tree


def main(pane_pid: str) -> None:
    pid = int(run("ps", "-o", "tpgid=", "-p", pane_pid))
    program = started_with(pid)
    if at_prompt(program, os.path.realpath(program.path), os.path.realpath(run("tmux", "show", "-gv", "default-shell"))):
        return print()  # nothing runs to restart
    agents = json.loads(run("claude", "agents", "--json"))
    running = {agent["pid"]: agent["sessionId"] for agent in agents if agent["kind"] == "interactive"}
    sessions = [(running[p], started_with(p).argv) for p in process_tree(pid) if p in running]
    argv = restored(program, sessions, lambda argv, session: resumed(argv, session, claude_options()))
    print(" ".join(map(shell_word, argv)))


if __name__ == "__main__":
    main(sys.argv[1])
