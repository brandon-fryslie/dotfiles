"""A running Claude Code process: how it was started, and the command that resumes its session.

Imported by path by its callers (excise, the tmux-resurrect save strategy), each of which
resolves its own symlink back into the dotfiles repo to find this directory.
"""

import ctypes
import enum
import os
import re
import struct
import subprocess
from dataclasses import dataclass

# Options that choose which conversation Claude opens; a resume replaces them with its own.
SESSION_OPTIONS = {"--resume", "--continue", "--session-id", "--fork-session", "--from-pr"}


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
        raise OSError(ctypes.get_errno(), f"cannot read the kernel's argument limit: {os.strerror(ctypes.get_errno())}")
    buffer = ctypes.create_string_buffer(argmax.value)
    size = ctypes.c_size_t(argmax.value)
    if libc.sysctl((ctypes.c_int * 3)(1, 49, pid), 3, buffer, ctypes.byref(size), None, 0) != 0:
        raise OSError(ctypes.get_errno(), f"cannot read how process {pid} was started: {os.strerror(ctypes.get_errno())}")
    raw = buffer.raw[: size.value]
    (argc,) = struct.unpack_from("i", raw)
    # After argc: the exec path, NUL padding, then argc arguments and the environment, each NUL-terminated.
    path, _, rest = raw[4:].partition(b"\0")
    strings = rest.lstrip(b"\0").split(b"\0")
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


@dataclass(frozen=True)
class Option:
    name: str  # the long name, which its short alias is folded into
    arity: Arity


# An option line of `claude --help`: "  -r, --resume [value]   Resume ...".
HELP_OPTION = re.compile(r"^  ((?:-[\w-]+, )*-[\w-]+)(?: (<[^>]*>|\[[^\]]*\]))?(?: |$)")


def options(help_text: str) -> dict[str, Option]:
    """Every spelling of every option `claude --help` lists, with how many values it takes."""
    table = {}
    for line in help_text.splitlines():
        if not (match := HELP_OPTION.match(line)):
            continue
        spellings, placeholder = match.group(1).split(", "), match.group(2) or ""
        arity = (Arity.NONE if not placeholder else Arity.VARIADIC if placeholder.endswith("...>") or placeholder.endswith("...]")
                 else Arity.REQUIRED if placeholder.startswith("<") else Arity.OPTIONAL)
        option = Option(spellings[-1], arity)
        table.update((spelling, option) for spelling in spellings)
    return table


def claude_options() -> dict[str, Option]:
    return options(subprocess.run(["claude", "--help"], check=True, capture_output=True, text=True).stdout)


def given_options(argv: list[str], table: dict[str, Option]) -> list[tuple[Option, list[str]]]:
    """argv's options as Claude's parser (commander) reads them, each with the words it took.

    A required value is the next word; an optional one is the next word unless that is an
    option; a variadic one is every word up to the next option. A word no option takes is
    the prompt, which is not an option and is left out.
    """
    given, words, i = [], argv[1:], 0
    while i < len(words):
        word = words[i]
        i += 1
        if not word.startswith("-"):
            continue
        spelling, has_value, _ = word.partition("=")
        option, taken = table[spelling], [word]
        if option.arity is Arity.REQUIRED and not has_value:
            taken.append(words[i])
            i += 1
        elif option.arity in (Arity.OPTIONAL, Arity.VARIADIC) and not has_value:
            while i < len(words) and not words[i].startswith("-") and (option.arity is Arity.VARIADIC or len(taken) == 1):
                taken.append(words[i])
                i += 1
        given.append((option, taken))
    return given


def resumed(argv: list[str], session: str, table: dict[str, Option]) -> list[str]:
    """The command that reopens `session` as `argv` was started: its options, except those that
    chose a conversation, then `--resume session`. The prompt it was started with is not sent again."""
    kept = [word for option, taken in given_options(argv, table) if option.name not in SESSION_OPTIONS for word in taken]
    return [argv[0], *kept, "--resume", session]
