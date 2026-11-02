#!/usr/bin/env python3
"""Keeps Claude from shutting down the shared tmux server, which every session on this
machine runs inside.
  PreToolUse(Bash): denies a command that runs it.
  PostToolUse(Write|Edit|NotebookEdit): flags a file that now carries it, because a script
  written today runs outside this guard's sight later.

Other tmux servers are fair game: `-L`/`-S` name a socket, which is how tests isolate tmux.

[LAW:parse-dont-validate] the Bash path reads the commands a call runs (bash_command), so
searching for the word, or quoting it in a message, is not running it. A file can be in any
language, so that path is a line match and may flag prose; it only reports, never stops.
[LAW:no-silent-failure] an unreadable payload exits 1 - visible, non-blocking.
"""

import json
import re
import sys
from pathlib import Path

from bash_command import commands, program, split_options

VERB = "kill-" + "server"  # assembled: this file must not trip the file check it defines
# tmux accepts any unambiguous prefix of a command name; `kill-se` could be kill-session.
SHORTEST_PREFIX = len("kill-ser")
GLOBAL_OPTIONS_WITH_VALUE = frozenset(("-c", "-f", "-L", "-S", "-T"))
SOCKET_OPTIONS = frozenset(("-L", "-S"))
FILE_LINE = re.compile(rf"\btmux\b.*\b{VERB[:SHORTEST_PREFIX]}", re.IGNORECASE)

ADVICE = "Use `tmux kill-session -t <name>`, or an isolated `tmux -L <socket>` server."
DENIAL = f"Blocked: this stops the shared tmux server and every session in it. {ADVICE}"


def names_verb(word):
    return len(word) >= SHORTEST_PREFIX and VERB.startswith(word)


def tmux_commands(operands):
    """The first word of each tmux command in a `;`-separated sequence."""
    expects_command = True
    for word in operands:
        if expects_command:
            yield word.rstrip(";")
        expects_command = word.endswith(";")


def stops_shared_server(command):
    words = command.words
    if program(words) != "tmux":
        return False
    options = split_options(words[1:], GLOBAL_OPTIONS_WITH_VALUE)
    return not SOCKET_OPTIONS.intersection(options.flags) and any(map(names_verb, tmux_commands(options.operands)))


def check_command(tool_input):
    if any(map(stops_shared_server, commands(str(tool_input.get("command") or "")))):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": DENIAL}}))


def check_file(tool_input):
    path = Path(tool_input.get("file_path") or tool_input.get("notebook_path"))
    if any(map(FILE_LINE.search, path.read_text(errors="replace").splitlines())):
        print(json.dumps({"decision": "block", "reason":
                          f"{path} appears to stop the shared tmux server. {ADVICE}"}))


def main():
    try:
        hook = json.load(sys.stdin)
    except ValueError as error:
        print(f"guard-tmux-server: unreadable hook payload ({error})", file=sys.stderr)
        sys.exit(1)

    check = check_command if hook["hook_event_name"] == "PreToolUse" else check_file
    check(hook["tool_input"])


main()
