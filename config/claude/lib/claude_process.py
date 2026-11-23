"""A running Claude Code process: how it was started, and the command that resumes its session.

Imported by path by its callers (excise, the tmux-resurrect save strategy), each of which
resolves its own symlink back into the dotfiles repo to find this directory.
"""

from __future__ import annotations

import ctypes
import enum
import os
import re
import shlex
import struct
import subprocess
from dataclasses import dataclass
from itertools import takewhile
from pathlib import Path


class Unreadable(Exception):
    """The kernel would not say how a process was started: it has exited, or is not ours to read."""


class Unresumable(Exception):
    """A launch that cannot be turned into the command that resumes its session as it was started."""


@dataclass(frozen=True)
class Process:
    path: str  # the executable the kernel ran
    argv: list[str]
    environment: dict[str, str]


def started_with(pid: int) -> Process:
    """How process `pid` was exec'd, as the kernel kept it (macOS sysctl KERN_PROCARGS2)."""
    libc = ctypes.CDLL(None, use_errno=True)
    size = ctypes.c_size_t(4)
    argmax = ctypes.c_int()
    if libc.sysctl((ctypes.c_int * 2)(1, 8), 2, ctypes.byref(argmax), ctypes.byref(size), None, 0) != 0:
        raise Unreadable(f"cannot read the kernel's argument limit: {os.strerror(ctypes.get_errno())}")
    buffer = ctypes.create_string_buffer(argmax.value)
    size = ctypes.c_size_t(argmax.value)
    if libc.sysctl((ctypes.c_int * 3)(1, 49, pid), 3, buffer, ctypes.byref(size), None, 0) != 0:
        raise Unreadable(f"cannot read how process {pid} was started: {os.strerror(ctypes.get_errno())}")
    raw = buffer.raw[: size.value]
    (argc,) = struct.unpack_from("i", raw)
    # After argc: the exec path, NUL padding, then argc arguments and the environment, each NUL-terminated.
    path, _, rest = raw[4:].partition(b"\0")
    strings = rest.lstrip(b"\0").split(b"\0")
    if len(strings) < argc:
        raise Unreadable(f"process {pid} has {argc} arguments, but the kernel returned {len(strings)}")
    argv = [os.fsdecode(item) for item in strings[:argc]]
    environment = {}
    for item in strings[argc:]:
        if not item:
            break
        key, _, value = os.fsdecode(item).partition("=")
        environment[key] = value
    return Process(os.fsdecode(path), argv, environment)


class Arity(enum.Enum):
    NONE = "none"  # --verbose
    REQUIRED = "required"  # --model <model>
    OPTIONAL = "optional"  # --resume [value]
    VARIADIC = "variadic"  # --add-dir <directories...>

    def values(self, spelling: str, following: list[str]) -> int:
        """How many of the words `following` an option spelled `spelling` takes, as commander reads them:
        a required value is the next word, whatever it is; an optional one is the next word unless that is
        an option; a variadic one is every word up to the next option."""
        if self is Arity.REQUIRED and not following:
            raise Unresumable(f"{spelling} takes a value, and the launch ends before it")
        free = sum(1 for _ in takewhile(lambda word: not word.startswith("-"), following))
        return {Arity.NONE: 0, Arity.REQUIRED: 1, Arity.OPTIONAL: min(1, free), Arity.VARIADIC: free}[self]


@dataclass(frozen=True)
class Option:
    name: str  # the long name, which its short alias is folded into
    arity: Arity


class Kind(enum.Enum):
    SETTING = "setting"  # how the session behaves; a resume keeps it
    CONVERSATION = "conversation"  # which conversation opens; a resume chooses its own
    ACTION = "action"  # something done once at launch; a resume does not do it again


# [LAW:types-are-the-program] every option `claude --help` lists, by long name, with what it is to a resume.
# An option missing here makes a launch that uses it Unresumable, never quietly kept.
KINDS = {name: Kind.CONVERSATION for name in (
    "--resume", "--continue", "--session-id", "--fork-session", "--from-pr", "--teleport")} | {name: Kind.ACTION for name in (
    "--worktree", "--tmux", "--background", "--cloud", "--environment", "--desktop", "--file", "--print", "--help",
    "--version")} | {name: Kind.SETTING for name in (
    "--add-dir", "--agent", "--agents", "--allow-dangerously-skip-permissions", "--allowed-tools", "--append-system-prompt",
    "--autocompact", "--ax-screen-reader", "--bare", "--betas", "--brief", "--chrome", "--dangerously-skip-permissions",
    "--debug", "--debug-file", "--disable-slash-commands", "--disallowed-tools", "--effort",
    "--exclude-dynamic-system-prompt-sections", "--fallback-model", "--forward-subagent-text", "--ide",
    "--include-hook-events", "--include-partial-messages", "--input-format", "--json-schema", "--max-budget-usd",
    "--mcp-config", "--model", "--name", "--no-chrome", "--no-session-persistence", "--output-format",
    "--permission-mode", "--permission-prompts", "--plugin-dir", "--plugin-url", "--prompt-suggestions",
    "--remote-control", "--remote-control-session-name-prefix", "--replay-user-messages", "--restricted", "--safe-mode",
    "--setting-sources", "--settings", "--strict-mcp-config", "--system-prompt", "--system-prompt-snapshot", "--tools",
    "--verbose")}


# An option line of `claude --help`: "  -r, --resume [value]   Resume ...".
HELP_OPTION = re.compile(r"^  ((?:-[\w-]+, )*-[\w-]+)(?: (<[^>]*>|\[[^\]]*\]))?(?: |$)")


def options(help_text: str) -> dict[str, Option]:
    """Every spelling of every option `claude --help` lists, with how many values it takes."""
    table = {}
    for line in help_text.splitlines():
        if not (match := HELP_OPTION.match(line)):
            continue
        spellings, placeholder = match.group(1).split(", "), match.group(2) or ""
        arity = (Arity.NONE if not placeholder else Arity.VARIADIC if placeholder[-4:] in ("...>", "...]")
                 else Arity.REQUIRED if placeholder.startswith("<") else Arity.OPTIONAL)
        option = Option(spellings[-1], arity)
        table.update((spelling, option) for spelling in spellings)
    return table


def claude_options() -> dict[str, Option]:
    """The grammar of the `claude` on PATH. A running session's own binary can be gone: an update removes old
    versions while sessions started from them run on, which is when a session most needs resuming."""
    try:
        return options(subprocess.run(["claude", "--help"], check=True, capture_output=True, text=True).stdout)
    except (OSError, subprocess.CalledProcessError) as failure:
        raise Unresumable(f"cannot read Claude's options from `claude --help`: {failure}") from failure


# Interpreters that run Claude as a script (npm's install: `node /…/cli.js`) rather than as its own executable.
SCRIPT_RUNNERS = {"node"}


@dataclass(frozen=True)
class Launch:
    program: list[str]  # what ran Claude: `claude`, or `node /…/cli.js`
    words: list[str]  # what Claude itself parses: its options and prompt


def launch(process: Process) -> Launch:
    """`process`'s argv split into the program that ran Claude and the words Claude was given: after argv[0], or
    for an interpreter, after the script it runs. An interpreter given its own options first is refused: which of
    its words is the script depends on that interpreter's grammar, which this does not read."""
    if Path(process.path).name not in SCRIPT_RUNNERS:
        return Launch(process.argv[:1], process.argv[1:])
    if len(process.argv) < 2 or process.argv[1].startswith("-"):
        raise Unresumable(f"{shlex.join(process.argv[:2])}: the script {process.argv[0]} runs is not its first word")
    return Launch(process.argv[:2], process.argv[2:])


# Where Claude keeps its sessions, transcripts and agent list; unset means Claude's default (~/.claude).
CONFIG_DIR = "CLAUDE_CONFIG_DIR"


def default_config_dir(home: str) -> Path:
    return Path(home) / ".claude"


def config_dir(process: Process) -> str | None:
    """The config dir `process` keeps its sessions in, None for Claude's default. A session is found only there.
    Every spelling of the default (unset, empty, ~/.claude itself or a link to it) is None, and any other dir is its
    real path, so one dir is named one way in every save."""
    named = process.environment.get(CONFIG_DIR)
    if not named:
        return None
    home = process.environment.get("HOME", str(Path.home()))
    directory = os.path.realpath(os.path.expanduser(named))
    return None if directory == os.path.realpath(default_config_dir(home)) else directory


def config_root(directory: str | None) -> Path:
    """Where config dir `directory` (None for the default) is on disk; its transcripts are under `projects`."""
    return default_config_dir(str(Path.home())) if directory is None else Path(directory)


def in_config_dir(command: list[str], directory: str | None) -> list[str]:
    """`command` run with Claude's config dir `directory`, so a resume finds a session kept outside the default."""
    return command if directory is None else ["env", f"{CONFIG_DIR}={directory}", *command]


def given_options(words: list[str], table: dict[str, Option]) -> list[tuple[Option, list[str]]]:
    """The options in Claude's `words` as its parser (commander) reads them, each with the words it took. A word no
    option takes is the prompt, as is every word after `--`; the prompt is not an option and is left out."""
    given, i = [], 0
    while i < len(words) and words[i] != "--":
        word = words[i]
        i += 1
        if not word.startswith("-"):
            continue
        spelling, has_value, _ = word.partition("=")
        if spelling not in table:
            raise Unresumable(f"{spelling} is not an option `claude --help` lists")
        option = table[spelling]
        taken = 0 if has_value else option.arity.values(spelling, words[i:])
        given.append((option, words[i - 1:i + taken]))
        i += taken
    return given


def resumed(started: Launch, session: str, table: dict[str, Option]) -> list[str]:
    """The command that reopens `session` as `started`: its program and settings, then `--resume session`. The
    options that chose its conversation or acted once at launch, and its prompt, are not given again."""
    kept = []
    for option, words in given_options(started.words, table):
        if option.name not in KINDS:
            raise Unresumable(f"{option.name} has no kind in claude_process.KINDS, so a resume cannot know whether to keep it")
        if KINDS[option.name] is Kind.SETTING:
            kept += words
    return [*started.program, *kept, "--resume", session]


# Characters a shell word cannot carry on one line as they are, nor inside $'...' unescaped.
UNSAFE = re.compile(r"[\\'\x00-\x1f\x7f]")


def shell_line(argv: list[str]) -> str:
    """`argv` as one line a POSIX shell reads back into the same words, for typing into a shell: each word quoted,
    in ANSI-C $'...' with \\xHH escapes when it holds a character plain quoting cannot keep on one line."""
    def word(text: str) -> str:
        if not re.search(r"[\x00-\x1f\x7f]", text):
            return shlex.quote(text)
        return "$'" + UNSAFE.sub(lambda match: f"\\x{ord(match[0]):02x}", text) + "'"
    return " ".join(map(word, argv))
