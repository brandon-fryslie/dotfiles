#!/usr/bin/env python3
"""tmux-resurrect save-command strategy: prints the command a restore relaunches in each pane.

resurrect runs it once per save with every pane's pid (@resurrect-save-command-strategy, a
path in tmux.conf) and reads one line per pid, in order. A pane's program is the leader of
its terminal's foreground process group, which is what the pane is showing. tmux's default
shell there means nothing is running to restart: an empty line. A Claude Code session the
program runs is printed as the command that resumes it. Each line is one shell command,
because restore types it into a shell.

A session is found in the agent list of the config dir it runs in (CLAUDE_CONFIG_DIR in its
environment, or Claude's default), and is resumed in that dir.

What a restore will not bring back is reported on stderr: a pane whose program cannot be read
(it gets an empty line; the other panes are still recorded), and a Claude session the line
does not resume - unless another Claude session started it, which makes it that session's.
A fact the whole save needs - the process table, an agent list, Claude's options - that
cannot be read fails the strategy, and resurrect then keeps the last save.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# [LAW:one-way-deps] the shared reader of how Claude was started, found through this file's symlink into the
# dotfiles repo. A missing module fails the strategy, and with it the save, loudly.
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "claude" / "lib"))
from claude_process import (CONFIG_DIR, Option, Process, Unreadable, Unresumable, claude_options, config_dir,  # noqa: E402
                            in_config_dir, launch, resumed, shell_line, started_with)

# The kinds `claude agents --json` reports. One it doesn't know fails the save: a renamed kind would
# otherwise drop every session from the save without a word.
AGENT_KINDS = {"interactive", "background"}


class Failed(Exception):
    """A fact the whole save needs could not be read."""


@dataclass(frozen=True)
class Listed:
    """A session as an agent list names it. Each config dir keeps its own list and its own transcripts, so a
    session is its id within its config dir."""
    id: str
    config_dir: str | None  # None for Claude's default


@dataclass(frozen=True)
class Session:
    listed: Listed
    pid: int
    process: Process


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
    sessions: dict[int, Listed]  # pid -> the interactive Claude session it is
    grammar: dict[str, Option]


def at_prompt(program: Process, executable: str, shell: str) -> bool:
    """Whether the pane shows its own prompt: `program` (real path `executable`) is tmux's default
    shell (real path `shell`) given no command or script, only options (`-zsh`, `zsh -l`)."""
    return executable == shell and all(word.startswith("-") for word in program.argv[1:])


def recorded(leader: int, program: Process, sessions: list[Session], grammar: dict[str, Option]) -> Record:
    """What a restore runs for a pane showing `program` (process `leader`), given the Claude sessions under it.

    The program runs a session in one of two ways, both read from the process rather than guessed from its
    words: it is the session's own process, or it passes a command line after `--` (`fritter ... -- claude ...`)
    that is the session's whole argv. Either way the session is resumed in its place. A program running no
    session is kept as it was launched.
    """
    for session in sessions:
        if session.pid == leader:
            return Record(in_config_dir(resumed(launch(program), session.listed.id, grammar), session.listed.config_dir), session)
    for session in sessions:
        given = len(session.process.argv)
        if program.argv[-given - 1:] == ["--", *session.process.argv]:
            command = [*program.argv[:-given], *resumed(launch(session.process), session.listed.id, grammar)]
            return Record(in_config_dir(command, session.listed.config_dir), session)
    return Record(program.argv, None)


def descendants(children: dict[int, list[int]], root: int) -> list[int]:
    """`root` and every process under it, nearest first."""
    tree = [root]
    for pid in tree:
        tree += children.get(pid, [])
    return tree


def runs_under(pid: int, ancestors: set[int], parent: dict[int, int], pane: int) -> bool:
    """Whether one of `ancestors` is `pid` or an ancestor of it, within the pane's process tree."""
    while pid not in ancestors and pid != pane:
        pid = parent[pid]
    return pid in ancestors


def pane_record(snapshot: Snapshot, pane: int) -> tuple[Record | Unrecorded, list[int]]:
    """What a restore runs for `pane`, and the pids of the Claude sessions in it that a restore does not bring back:
    every one the record does not resume, except those another Claude session started, which are that session's."""
    if pane not in snapshot.foreground:
        return Unrecorded("its process exited during the save"), []
    in_pane = [pid for pid in descendants(snapshot.children, pane) if pid in snapshot.sessions]
    # The pane's own process has no ancestor in the pane, so no session there can have started it.
    owned = [pid for pid in in_pane if pid != pane and runs_under(snapshot.parent[pid], set(in_pane), snapshot.parent, pane)]
    leader = snapshot.foreground[pane]
    try:
        program = started_with(leader)
        if at_prompt(program, os.path.realpath(program.path), snapshot.shell):
            record = Record([], None)
        else:
            under = [pid for pid in in_pane if runs_under(pid, {leader}, snapshot.parent, pane)]
            sessions = [Session(snapshot.sessions[pid], pid, started_with(pid)) for pid in under]
            record = recorded(leader, program, sessions, snapshot.grammar)
    except (Unreadable, Unresumable) as failure:
        return Unrecorded(str(failure)), [pid for pid in in_pane if pid not in owned]
    kept = {record.session.pid} if record.session else set()
    return record, [pid for pid in in_pane if pid not in kept and pid not in owned]


def run(*command: str, environment: dict[str, str] | None = None) -> str:
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True, env=environment).stdout.strip()
    except OSError as failure:
        raise Failed(f"cannot run {command[0]} from this tmux server's PATH: {failure}") from failure
    except subprocess.CalledProcessError as failure:
        raise Failed(f"{shlex.join(command)} exited {failure.returncode}: {failure.stderr.strip()}") from failure


def config_dirs(pids: list[int]) -> set[str | None]:
    """The config dirs the environments of `pids` name, and Claude's default. A process that cannot be read (it
    exited, or is another user's) names none; when it is a pane's program, that pane is reported unrecorded."""
    found: set[str | None] = {None}
    for pid in pids:
        try:
            found.add(config_dir(started_with(pid)))
        except Unreadable:
            continue
    return found


def listed_sessions(directory: str | None) -> dict[int, Listed]:
    """The interactive sessions config dir `directory` lists, by pid."""
    environment = {name: value for name, value in os.environ.items() if name != CONFIG_DIR}
    if directory is not None:
        environment[CONFIG_DIR] = directory
    agents = json.loads(run("claude", "agents", "--json", environment=environment))
    unknown = {agent["kind"] for agent in agents} - AGENT_KINDS
    if unknown:
        raise Failed(f"claude agents --json reports kinds this strategy does not know: {sorted(unknown)}")
    return {agent["pid"]: Listed(agent["sessionId"], directory) for agent in agents if agent["kind"] == "interactive"}


def snapshot(panes: list[int]) -> Snapshot:
    parent, children, foreground = {}, {}, {}
    for line in run("ps", "-axo", "pid=,ppid=,tpgid=").splitlines():
        pid, ppid, tpgid = map(int, line.split())
        children.setdefault(ppid, []).append(pid)
        parent[pid], foreground[pid] = ppid, tpgid
    in_panes = [pid for pane in panes for pid in descendants(children, pane) if pane in foreground]
    sessions = {pid: listed for directory in config_dirs(in_panes) for pid, listed in listed_sessions(directory).items()}
    return Snapshot(os.path.realpath(run("tmux", "show", "-gv", "default-shell")), parent, children, foreground,
                    sessions, claude_options())


def main(panes: list[int]) -> None:
    # An argv is bytes; the ones that are not UTF-8 go back out as the same bytes.
    sys.stdout.reconfigure(errors="surrogateescape")
    sys.stderr.reconfigure(errors="surrogateescape")
    save = snapshot(panes)
    for pane in panes:
        record, lost = pane_record(save, pane)
        if isinstance(record, Unrecorded):
            print(f"tmux-resurrect-command: pane {pane}: cannot record its program ({record.reason}); a restore"
                  " starts a shell there", file=sys.stderr)
        for pid in lost:
            listed = save.sessions[pid]
            where = "" if listed.config_dir is None else f" (in {listed.config_dir})"
            print(f"tmux-resurrect-command: pane {pane}: a restore does not bring back Claude session {listed.id}{where}",
                  file=sys.stderr)
        print(shell_line(record.argv) if isinstance(record, Record) else "")


if __name__ == "__main__":
    try:
        main([int(pid) for pid in sys.argv[1:]])
    except (Failed, Unreadable, Unresumable) as failure:
        sys.exit(f"tmux-resurrect-command: {failure}")
