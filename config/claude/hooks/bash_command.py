"""The commands a Bash command string runs, read the way the shell reads them.

The PreToolUse guards in this directory decide from what a Bash call RUNS, never from its
text. A word inside a quoted argument, a commit message or a heredoc body is not a command,
and a flag belonging to one command says nothing about its neighbour. Scanning the raw text
got both wrong: it refused a `sed -n` chained before a `git commit` as a hook bypass, and
refused a ticket whose quoted body merely described one.

[LAW:single-enforcer] every guard reads commands through this one reader, so "what runs"
cannot mean one thing to one guard and something else to the next.
"""

import os
import re
from typing import Iterator, NamedTuple

SEPARATORS = ";&|()`"
# A shell handed a script runs it: `bash -c '<script>'`, or a heredoc fed to `bash`.
SHELLS = frozenset(("bash", "sh", "zsh", "dash", "ksh"))
# Words that open a command position without being the command.
RESERVED = frozenset(("!", "{", "}", "if", "then", "else", "elif", "do", "while", "until", "time"))
ASSIGNMENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")
GIT_GLOBAL_OPTIONS_WITH_VALUE = frozenset(("-C", "-c", "--git-dir", "--work-tree", "--namespace"))


class Command(NamedTuple):
    words: list  # the command word first, then its arguments
    stdin: list  # heredoc bodies and here-strings the command reads


class GitInvocation(NamedTuple):
    verb: str
    arguments: list


class Options(NamedTuple):
    flags: list  # every option as written, clusters expanded (-qn -> -q, -n), values dropped
    operands: list  # every non-option word, and everything after --


class _Reader:
    """One pass over a script. Never raises: text bash itself rejects, such as an unclosed
    quote, runs nothing at all, so no reading of it can let a command through."""

    def __init__(self, script):
        self.script = script
        self.at = 0
        self.commands = []
        self.words, self.stdin = [], []
        self.word = None  # characters of the word being read; None between words
        self.redirection = None  # the operator whose operand the next word is
        self.heredocs = []  # (delimiter, strip_tabs, stdin) whose bodies follow the next newline

    def read(self):
        script = self.script
        while self.at < len(script):
            char = script[self.at]
            if char in " \t\r":
                self.end_word()
                self.at += 1
            elif char == "\n":
                self.end_command()
                self.at += 1
                self.read_heredoc_bodies()
            elif char == "#" and self.word is None:
                newline = script.find("\n", self.at)
                self.at = len(script) if newline < 0 else newline
            elif char == "\\":
                if script.startswith("\n", self.at + 1):
                    self.at += 2
                else:
                    self.take(script[self.at + 1:self.at + 2])
                    self.at += 2
            elif char == "'":
                close = script.find("'", self.at + 1)
                close = len(script) if close < 0 else close
                self.take(script[self.at + 1:close])
                self.at = close + 1
            elif char == '"':
                self.read_double_quoted()
            elif char in "<>" or script.startswith("&>", self.at):
                self.read_redirection()
            elif char in SEPARATORS or script.startswith("$(", self.at):
                self.end_command()
                self.at += 2 if char == "$" else 1
            else:
                self.take(char)
                self.at += 1
        self.end_command()
        return self.commands

    def take(self, text):
        if self.word is None:
            self.word = []
        self.word.append(text)

    def read_double_quoted(self):
        script, at = self.script, self.at + 1
        self.take("")
        while at < len(script) and script[at] != '"':
            if script[at] == "\\" and script[at + 1:at + 2] in ('"', "\\", "$", "`"):
                self.take(script[at + 1])
                at += 2
            elif script.startswith("\\\n", at):
                at += 2
            else:
                self.take(script[at])
                at += 1
        self.at = at + 1

    def read_redirection(self):
        # 2>&1: the digits before the operator name a descriptor, not an argument.
        if self.word is not None and "".join(self.word).isdigit():
            self.word = None
        self.end_word()
        end = self.at
        while end < len(self.script) and self.script[end] in "<>&|-":
            end += 1
        self.redirection = self.script[self.at:end]
        self.at = end

    def end_word(self):
        if self.word is None:
            return
        text, self.word = "".join(self.word), None
        operator, self.redirection = self.redirection, None
        if operator is None:
            self.words.append(text)
        elif operator.startswith("<<<"):
            self.stdin.append(text)
        elif operator.startswith("<<"):
            self.heredocs.append((text, operator.endswith("-"), self.stdin))
        # Any other redirection's operand is a file name: data, not an argument.

    def end_command(self):
        self.end_word()
        self.redirection = None
        words = self.words
        while words and (words[0] in RESERVED or ASSIGNMENT.match(words[0])):
            words = words[1:]
        if words:
            self.commands.append(Command(words, self.stdin))
        self.words, self.stdin = [], []

    def read_heredoc_bodies(self):
        script = self.script
        for delimiter, strip_tabs, stdin in self.heredocs:
            body = []
            while self.at < len(script):
                newline = script.find("\n", self.at)
                newline = len(script) if newline < 0 else newline
                line, self.at = script[self.at:newline], newline + 1
                if (line.lstrip("\t") if strip_tabs else line) == delimiter:
                    break
                body.append(line)
            stdin.append("\n".join(body))
        self.heredocs = []


def commands(script) -> Iterator[list]:
    """Every simple command the script runs, as its words - including the commands of any
    script it hands to a shell."""
    for command in _Reader(script).read():
        yield command.words
        if os.path.basename(command.words[0]) not in SHELLS:
            continue
        arguments = command.words[1:]
        runs_operands = any(a.startswith("-") and not a.startswith("--") and "c" in a for a in arguments)
        # With -c, every operand is read as a script: over-reading an option's value costs
        # nothing, and under-reading the script would let its commands through.
        scripts = [a for a in arguments if not a.startswith("-")] if runs_operands else []
        for script_text in scripts + command.stdin:
            yield from commands(script_text)


def git_invocations(script) -> Iterator[GitInvocation]:
    """Every git call the script runs, as its subcommand and that subcommand's own arguments."""
    for words in commands(script):
        if os.path.basename(words[0]) != "git":
            continue
        index = 1
        while index < len(words) and words[index].startswith("-"):
            index += 2 if words[index] in GIT_GLOBAL_OPTIONS_WITH_VALUE else 1
        if index < len(words):
            yield GitInvocation(words[index], words[index + 1:])


def split_options(arguments, takes_value, takes_attached_value=frozenset()) -> Options:
    """A subcommand's arguments as git's option parser reads them.

    takes_value: options whose value is the rest of a short cluster, the `=` part of a long
    option, or else the next word (-m, --message). takes_attached_value: short options whose
    optional value can only be attached, so `-uno` is -u with the value "no", not -u -n -o."""
    flags, operands = [], []
    words = iter(arguments)
    for word in words:
        if word == "--":
            operands.extend(words)
        elif word.startswith("--"):
            name = word.split("=", 1)[0]
            flags.append(name)
            if name in takes_value and "=" not in word:
                next(words, None)
        elif word.startswith("-") and word != "-":
            for position, letter in enumerate(word[1:], start=2):
                flag = "-" + letter
                flags.append(flag)
                if flag in takes_attached_value:
                    break
                if flag in takes_value:
                    if position == len(word):
                        next(words, None)
                    break
        else:
            operands.append(word)
    return Options(flags, operands)
