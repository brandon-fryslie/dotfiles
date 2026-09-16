"""The commands a Bash command string runs, read the way the shell reads them.

The PreToolUse guards in this directory decide from what a Bash call RUNS, never from its
text. A word inside a quoted argument, a commit message or a heredoc body is not a command,
and a flag belonging to one command says nothing about its neighbour. Scanning the raw text
got both wrong: it refused a `sed -n` chained before a `git commit` as a hook bypass, and
refused a ticket whose quoted body merely described one.

The reader errs one way only. Where it cannot tell whether text runs, it reads it as a
command: over-reading costs at most a spurious deny, under-reading lets a command through.

[LAW:single-enforcer] every guard reads commands through this one reader, so "what runs"
cannot mean one thing to one guard and something else to the next.
"""

import os
import re
from typing import Iterator, NamedTuple

# A shell handed a script runs it: `bash -c '<script>'`, or a heredoc fed to `bash`.
SHELLS = frozenset(("bash", "sh", "zsh", "dash", "ksh"))
# Commands that run a command named among their own arguments.
WRAPPERS = frozenset(("env", "command", "exec", "nohup", "nice", "timeout", "xargs", "sudo", "time", "watch"))
# Words that open a command position without being the command.
RESERVED = frozenset(("!", "{", "}", "if", "then", "else", "elif", "do", "while", "until"))
ASSIGNMENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")
GIT_GLOBAL_OPTIONS_WITH_VALUE = frozenset(("-C", "-c", "--git-dir", "--work-tree", "--namespace"))
DOUBLE_QUOTE_ESCAPES = ('"', "\\", "$", "`")


class Command(NamedTuple):
    words: list  # the command word first, then its arguments
    stdin: list  # heredoc bodies and here-strings the command reads
    upstream: "Command | None"  # the command piped into this one


def program(words):
    """The program a command runs. macOS filesystems ignore case, so `GIT` runs git."""
    return os.path.basename(words[0]).casefold()


def piped_input(command):
    """Every text that can reach a command's stdin: its heredocs and here-strings, and whatever
    the commands piped into it carry - their arguments (`echo '<script>' | sh`) and their own
    input (`cat <<EOF | bash`)."""
    upstream = command.upstream
    return command.stdin + ([] if upstream is None else upstream.words[1:] + piped_input(upstream))


class GitInvocation(NamedTuple):
    verb: str
    arguments: list


class Options(NamedTuple):
    flags: list  # every option as written, clusters expanded (-qn -> -q, -n), values dropped
    operands: list  # every non-option word, and everything after --


class _Reader:
    """One pass over a script, collecting every command it runs into `commands` - shared with
    the readers of the substitutions nested inside it. Never raises: text bash itself rejects,
    such as an unclosed quote, runs nothing at all, so no reading of it lets a command through."""

    def __init__(self, script, at, commands):
        self.script = script
        self.at = at
        self.commands = commands
        self.words, self.stdin = [], []
        self.upstream = None  # the last command, while a pipe connects it to the next
        self.word = None  # characters of the word being read; None between words
        self.quoted = False  # whether any of the word being read was quoted
        self.redirection = None  # the operator whose operand the next word is
        self.heredocs = []  # (delimiter, strip_tabs, expands, stdin) read after the next newline
        self.depth = 0  # open parentheses, so a substitution ends only at its own `)`

    def read(self, closer=None):
        """Read commands up to the end of the script, or up to and past `closer` - the `)` or
        backtick that ends the substitution this reader was opened for."""
        script = self.script
        while self.at < len(script):
            char = script[self.at]
            if char == closer and (closer == "`" or self.depth == 0):
                self.at += 1
                break
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
                if not script.startswith("\n", self.at + 1):
                    self.take(script[self.at + 1:self.at + 2])
                    self.quoted = True
                self.at += 2
            elif char == "'":
                close = script.find("'", self.at + 1)
                close = len(script) if close < 0 else close
                self.take(script[self.at + 1:close])
                self.quoted = True
                self.at = close + 1
            elif script.startswith("$'", self.at):
                self.read_ansi_c_quoted()
            elif char == '"':
                self.at += 1
                self.take("")
                self.quoted = True
                self.read_expanding('"')
                self.at += 1
            elif script.startswith("$(", self.at) or char == "`":
                self.read_substitution()
            elif char in "<>" or script.startswith("&>", self.at):
                self.read_redirection()
            elif script.startswith("||", self.at):
                self.end_command()
                self.at += 2
            elif char in "();&|":
                self.depth += {"(": 1, ")": -1}.get(char, 0)
                self.end_command(piped=char == "|")
                self.at += 1
            else:
                self.take(char)
                self.at += 1
        self.end_command()
        return self.commands

    def take(self, text):
        if self.word is None:
            self.word = []
        self.word.append(text)

    def read_expanding(self, closer):
        """Text in which only substitutions run: a double-quoted string up to its closing quote,
        or (closer None) an unquoted heredoc body."""
        script = self.script
        while self.at < len(script) and script[self.at] != closer:
            if script.startswith("$(", self.at) or script[self.at] == "`":
                self.read_substitution()
            elif script[self.at] == "\\" and script[self.at + 1:self.at + 2] in DOUBLE_QUOTE_ESCAPES:
                self.take(script[self.at + 1])
                self.at += 2
            elif script.startswith("\\\n", self.at):
                self.at += 2
            else:
                self.take(script[self.at])
                self.at += 1

    def read_ansi_c_quoted(self):
        # $'...' honours backslash escapes, so \' does not close it.
        script, at = self.script, self.at + 2
        self.take("")
        self.quoted = True
        while at < len(script) and script[at] != "'":
            step = 2 if script[at] == "\\" else 1
            self.take(script[at:at + step])
            at += step
        self.at = at + 1

    def read_substitution(self):
        """$(...) or `...`: its commands run, so a nested reader collects them. The word keeps
        the raw text, so a value built from command output still reads as shell-expanded."""
        start, backtick = self.at, self.script[self.at] == "`"
        inner = _Reader(self.script, start + (1 if backtick else 2), self.commands)
        inner.read("`" if backtick else ")")
        self.take(self.script[start:inner.at])
        self.at = inner.at

    def read_redirection(self):
        # 2>&1: the digits before the operator name a descriptor, not an argument.
        if self.word is not None and not self.quoted and "".join(self.word).isdigit():
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
        text, quoted = "".join(self.word), self.quoted
        self.word, self.quoted = None, False
        operator, self.redirection = self.redirection, None
        if operator is None:
            self.words.append(text)
        elif operator.startswith("<<<"):
            self.stdin.append(text)
        elif operator.startswith("<<"):
            # A quoted delimiter makes the body literal; an unquoted one leaves its substitutions live.
            self.heredocs.append((text, operator.endswith("-"), not quoted, self.stdin))
        # Any other redirection's operand is a file name: data, not an argument.

    def end_command(self, piped=False):
        self.end_word()
        self.redirection = None
        words = self.words
        while words and (words[0] in RESERVED or ASSIGNMENT.match(words[0])):
            words = words[1:]
        # A pipe continues across a line break (`a |` newline `b`), so only a command that
        # actually ended moves the pipeline on.
        if words:
            command = Command(words, self.stdin, self.upstream)
            self.commands.append(command)
            self.upstream = command if piped else None
        self.words, self.stdin = [], []

    def read_heredoc_bodies(self):
        script = self.script
        for delimiter, strip_tabs, expands, stdin in self.heredocs:
            body = []
            while self.at < len(script):
                newline = script.find("\n", self.at)
                newline = len(script) if newline < 0 else newline
                line, self.at = script[self.at:newline], newline + 1
                if (line.lstrip("\t") if strip_tabs else line) == delimiter:
                    break
                body.append(line)
            stdin.append("\n".join(body))
            if expands:
                _Reader(stdin[-1], 0, self.commands).read_expanding(None)
        self.heredocs = []


def commands(script) -> Iterator[list]:
    """Every simple command the script runs, as its words - including the command a wrapper
    runs and the commands of any script handed to a shell."""
    for command in _Reader(script, 0, []).read():
        words = command.words
        runs = [words]
        # Which argument starts a wrapper's command depends on that wrapper's own options, so
        # every word that could start one is read as a command.
        if program(words) in WRAPPERS:
            runs += [words[start:] for start in range(1, len(words))
                     if not words[start].startswith("-") and not ASSIGNMENT.match(words[start])]
        for run in runs:
            yield run
            if program(run) not in SHELLS:
                continue
            arguments = run[1:]
            runs_operands = any(a.startswith("-") and not a.startswith("--") and "c" in a for a in arguments)
            # With -c, every operand is read as a script: over-reading an option's value costs
            # nothing, and under-reading the script would let its commands through.
            scripts = [a for a in arguments if not a.startswith("-")] if runs_operands else []
            for script_text in scripts + piped_input(command):
                yield from commands(script_text)


def git_invocations(script) -> Iterator[GitInvocation]:
    """Every git call the script runs, as its subcommand and that subcommand's own arguments."""
    for words in commands(script):
        if program(words) != "git":
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
