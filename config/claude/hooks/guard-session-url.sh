#!/usr/bin/env python3
"""PreToolUse(Bash) guard. Two refusals, both about publishing:
  1. a command that would PUBLISH a Claude session URL - in its text, or in a file it takes
     its text from (--body-file, -F, --input, a `cat` in a substitution)
  2. a command that would SKIP the git hooks which catch #1

Deliberately scoped to publishing verbs. Denying every command that merely mentions a
session URL would block reading, grepping and auditing for the leak -- which is the work of
cleaning it up.

[LAW:parse-dont-validate] both refusals read the commands the call runs (bash_command), not
its text. A verb counts only as a command, and a flag only among its own command's options:
scanning text refused `sed -n ... && git commit` as a bypass, and refused a ticket whose
quoted body described one.
[LAW:no-silent-failure] a payload this cannot parse, or a URL scan that fails, exits 1 -
visible, non-blocking - so a broken guard announces itself rather than quietly permitting.
A publication whose text the guard cannot read is denied, not exited on: exit 1 lets the
command run, and the text would be published unscanned.

Reach: the text of a publishing command is its script text, the files it names, and what its
substitutions and standard input carry. A file is read as it stands before the command runs, from
the call's working directory; after a `cd`, `git -C` or `env -C` a relative path is denied, not
guessed, and so is a file another command of the same call also names. Whatever is not in plain
sight is denied. Out of reach: shell state (`b=$(cat f); gh ... --body "$b"`, `--body "$BODY"`);
commands assembled while the command runs; and the effects of the call's other commands on a
file they do not name by a path the guard can match (`dd of=` is matched, but `curl -ofile`, a
glob or brace destination, or a program that rewrites the body file are not). The guards are a
backstop for commands written plainly, as bash_command's docstring says.
"""

import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

from bash_command import Command, commands, git_invocations, program, split_options

# [LAW:one-source-of-truth] the git hooks' definition of a session URL, read where it lives;
# grep reads it, because it is written as grep's pattern.
SESSION_URL_PATTERN = Path(__file__).resolve().parents[2] / "git" / "hooks" / "claude-session-url.pattern"

HOOKS_PATH = "core.hookspath"  # casefolded, as bash_command reports config keys
# What each gh command group does that puts text a reader can fetch: its body, comment, review or
# closing note. `gh api` is decided apart, by its method.
GH_VERBS_THAT_PUBLISH = {  # `new` is gh's alias of `create`
    "pr": ("create", "new", "revert", "edit", "comment", "review", "merge", "close", "reopen"),
    "issue": ("create", "new", "edit", "comment", "close", "reopen"),
    "release": ("create", "new", "edit"),
    "gist": ("create", "new", "edit"),
    "repo": ("create", "new", "edit"),  # --description
    "label": ("create", "edit"),  # --description
    "workflow": ("run",),  # -f inputs, shown on the run
    "agent-task": ("create",),  # the prompt, from --from-file
    "discussion": ("create", "comment", "edit"),
}
GH_PUBLISHES = frozenset((noun, verb) for noun, verbs in GH_VERBS_THAT_PUBLISH.items() for verb in verbs)
# `gh api` sends GET unless it is given a method, or fields/a body - which make it POST.
GH_API_TAKES_VALUE = frozenset((
    "-X", "--method", "-f", "--raw-field", "-F", "--field", "--input", "-H", "--header", "-q", "--jq",
    "-t", "--template", "--hostname", "--cache", "-p", "--preview", "-R", "--repo"))
GH_API_METHOD = frozenset(("-X", "--method"))
GH_API_BODY = frozenset(("-f", "--raw-field", "-F", "--field", "--input"))
READ_METHODS = frozenset(("GET", "HEAD"))
GH_REPO_OPTIONS = frozenset(("-R", "--repo"))

# How an option names a file whose text the command publishes: its value is the path, or is
# `key=@path` (gh api's field syntax, where @- is standard input).
PATH, FIELD = "path", "field"
# Per publishing command: the other options that consume a value (so a value is never read as a flag),
# and the options that name a file. A file option missing here is a read the guard never makes, so
# test_guards.py checks the table against every gh command's own help. Not listed, on purpose: gh's
# --attach (media, not text) and pr create --template (starting text for the interactive prompt).
TEXT_FILE_OPTIONS = {
    ("git", "tag"): (frozenset(("-m", "-u", "--message", "--local-user", "--cleanup")), {"-F": PATH, "--file": PATH}),
    ("gh", "api"): (GH_API_TAKES_VALUE, {"--input": PATH, "-F": FIELD, "--field": FIELD}),
    ("gh", "workflow", "run"): (GH_API_TAKES_VALUE, {"-F": FIELD, "--field": FIELD}),
    ("gh", "agent-task", "create"): (GH_REPO_OPTIONS, {"-F": PATH, "--from-file": PATH}),
    # every publishing pr, issue, release and discussion verb that takes a body or notes
    **{("gh", noun, verb): (GH_REPO_OPTIONS, {"-F": PATH, "--body-file": PATH, "--notes-file": PATH})
       for noun, verb in GH_PUBLISHES
       if noun in ("pr", "issue", "release", "discussion") and verb not in ("close", "reopen")},
}

# Options of `git commit` that consume a value, so a value is never read as a flag: -mnew is
# a message, and -uno is untracked-files=no.
COMMIT_TAKES_VALUE = frozenset((
    "-m", "-F", "-c", "-C", "-t", "--message", "--file", "--reuse-message", "--reedit-message",
    "--template", "--author", "--date", "--cleanup", "--fixup", "--squash", "--trailer",
    "--pathspec-from-file"))
COMMIT_TAKES_ATTACHED_VALUE = frozenset(("-u", "-S"))


def names_no_verify(flag):
    """git accepts any unambiguous abbreviation of a long option: --no-veri is --no-verify."""
    return flag.startswith("--no-v") and "--no-verify".startswith(flag)


# `git config` modes. The key is the first operand whatever the mode, with the exception of the
# section edits, whose operands are sections; a bare `<key> <value>` is a write.
CONFIG_WRITE_MODES = frozenset(("--add", "--replace-all", "--unset", "--unset-all"))
CONFIG_SECTION_EDITS = frozenset(("--remove-section", "--rename-section"))
CONFIG_READ_MODES = frozenset((
    "-l", "--list", "--get", "--get-all", "--get-regexp", "--get-urlmatch", "--get-color", "--get-colorbool"))
# An option missing here has its value read as the key; test_guards.py checks this against git's help.
CONFIG_TAKES_VALUE = frozenset((
    "-f", "--file", "--blob", "-t", "--type", "--default", "--comment", "--value", "--url"))
# git 2.46 subcommands, each the mode its legacy flag names. Only the first word is one (a flag
# before it makes the call legacy), and a key always has a dot, so no key is ever read as one.
CONFIG_SUBCOMMAND_MODES = {
    "get": "--get", "set": "--replace-all", "unset": "--unset",
    "remove-section": "--remove-section", "rename-section": "--rename-section"}
# Every long option of `git config`, which is what an abbreviation is resolved against.
CONFIG_LONG_OPTIONS = (CONFIG_WRITE_MODES | CONFIG_SECTION_EDITS | CONFIG_READ_MODES | CONFIG_TAKES_VALUE | frozenset((
    "--global", "--system", "--local", "--worktree", "--fixed-value", "--bool", "--int", "--bool-or-int",
    "--path", "--expiry-date", "--null", "--name-only", "--includes", "--no-includes", "--show-origin",
    "--show-scope", "--edit", "--no-type")))


def spell_out(arguments, long_options):
    """git accepts any unambiguous abbreviation of a long option: --unset-a is --unset-all. Given
    only some of a command's options, a prefix that git would call ambiguous is spelled as one of
    them too; git rejects that call, so nothing is published by it."""
    spelled = []
    for word in arguments:
        name, equals, value = word.partition("=")
        matches = [option for option in long_options if len(name) > 2 and name.startswith("--") and option.startswith(name)]
        spelled.append(matches[0] + equals + value if len(matches) == 1 and name not in matches else word)
    return spelled


def config_writes_hooks_path(arguments):
    """A `git config` call that sets, adds to or unsets core.hooksPath, or that removes or renames
    the core section it lives in. Reads (`git config core.hooksPath`, --get, --list) are not one."""
    first = arguments[0] if arguments else ""
    legacy = [CONFIG_SUBCOMMAND_MODES[first], *arguments[1:]] if first in CONFIG_SUBCOMMAND_MODES else arguments
    options = split_options(spell_out(legacy, CONFIG_LONG_OPTIONS), CONFIG_TAKES_VALUE)
    flags, operands = set(options.flags), [operand.casefold() for operand in options.operands]
    if flags & CONFIG_SECTION_EDITS:  # rename-section's second operand is the section renamed into
        return "core" in operands[:2]
    writes = flags & CONFIG_WRITE_MODES or (len(operands) >= 2 and not flags & CONFIG_READ_MODES)
    return bool(writes) and operands[:1] == [HOOKS_PATH]


SKIPS_HOOKS = (
    "BLOCKED: --no-verify, or a core.hooksPath override (git -c, --config-env, GIT_CONFIG_*, "
    "git config writing or unsetting it), skips the commit-msg hook that refuses Claude session URLs. That "
    "hook is the mechanical backstop for a leak that reached public repos ~1,700 times. Run "
    "the command without the bypass; if the hook fires, remove the session link rather "
    "than bypassing the check.")


def relocates_config(variables):
    return (f"BLOCKED: {', '.join(variables)} is set for a git call. core.hooksPath is installed in the "
            "user-level git config, which git finds through that variable, so setting it points git at a "
            "config without the hooks that refuse Claude session URLs. Run the git command without it.")


def hooks_skipped(invocation):
    """The reason text of the rule this git call breaks, or None when it breaks none."""
    # Pointing core.hooksPath anywhere else displaces the hooks as completely as --no-verify, and
    # on any verb that runs them, so the verb is not asked; the value is not either.
    if HOOKS_PATH in invocation.config_keys:
        return SKIPS_HOOKS
    # Moving the config that holds core.hooksPath displaces it just the same, and is decided the
    # same way: any verb or alias can run the hooks, so the verb is not asked.
    if invocation.relocated_by:
        return relocates_config(invocation.relocated_by)
    # The persistent form of the same override: it displaces the hooks for every later commit, and
    # with --global in every repo.
    if invocation.verb == "config":
        return SKIPS_HOOKS if config_writes_hooks_path(invocation.arguments) else None
    # -n means --no-verify on commit, but --dry-run on push; only --no-verify is a bypass there.
    if invocation.verb == "commit":
        flags = split_options(invocation.arguments, COMMIT_TAKES_VALUE, COMMIT_TAKES_ATTACHED_VALUE).flags
        return SKIPS_HOOKS if any(flag == "-n" or names_no_verify(flag) for flag in flags) else None
    if invocation.verb == "push":
        flags = split_options(invocation.arguments, frozenset()).flags
        return SKIPS_HOOKS if any(names_no_verify(flag) for flag in flags) else None
    return None


def api_writes(arguments):
    options = split_options(arguments, GH_API_TAKES_VALUE)
    methods = [value for flag, value in options.values if flag in GH_API_METHOD]
    if methods:
        return methods[-1].upper() not in READ_METHODS
    return any(flag in GH_API_BODY for flag in options.flags)


class Publication(NamedTuple):
    """A command that puts text where a reader can fetch it, and the files its text comes from."""
    command: Command
    paths: list  # path words as written; "-" is standard input


def text_files(key, arguments):
    """The path words of the files the publishing command `key` takes its text from."""
    takes_value, files = TEXT_FILE_OPTIONS.get(key, (frozenset(), {}))
    paths = []
    for flag, value in split_options(arguments, takes_value | files.keys()).values:
        field = value.partition("=")[2]
        if files.get(flag) == PATH:
            paths.append(value)
        elif files.get(flag) == FIELD and field.startswith("@"):
            paths.append(field[1:])
    return paths


def tag_publication(invocation):
    long_options = frozenset(option for option in TEXT_FILE_OPTIONS[("git", "tag")][1] if option.startswith("--"))
    return Publication(invocation.command, text_files(("git", "tag"), spell_out(invocation.arguments, long_options)))


def gh_publication(command):
    """The Publication a gh command is, or None when it only reads."""
    if program(command.words) != "gh":
        return None
    arguments = command.words[1:]
    # gh takes -R/--repo before its subcommand: `gh -R o/r pr create`.
    subcommand = split_options(arguments, GH_REPO_OPTIONS).operands
    api = subcommand[:1] == ["api"]
    if not (api_writes(arguments) if api else tuple(subcommand[:2]) in GH_PUBLISHES):
        return None
    return Publication(command, text_files(("gh", *subcommand[:1 if api else 2]), arguments))


def carries_session_url(text):
    pattern = SESSION_URL_PATTERN.read_text().replace("\n", "")
    scan = subprocess.run(["grep", "-qiE", "-e", pattern], input=text, text=True)
    if scan.returncode > 1:
        print(f"guard-session-url: session URL scan failed (grep exit {scan.returncode})", file=sys.stderr)
        sys.exit(1)
    return scan.returncode == 0


PUBLISHES_SESSION_URL = (
    "BLOCKED: this command would publish a Claude session URL (a claude.ai link to a "
    "conversation). That link resolves to the entire private conversation for anyone "
    "holding it, and publishing it is not reversible -- a force-push unlinks the commit "
    "but the object stays served by its SHA. "
    "Write the commit, PR or issue without the session line. Nothing replaces it: no "
    "shortened link, no id prefix, no 'session available on request'.")


class Unreadable(Exception):
    """Text the guard cannot clear. Its message is the refusal."""

    def __init__(self, source, why):
        super().__init__(
            f"BLOCKED: this command would publish text from {source}, which the guard cannot read ({why}). "
            "The guard reads the files a publishing command takes its text from and refuses a Claude session "
            "URL in them; text it cannot read is text it cannot clear. Write the text to a file in an earlier "
            "call and name that file by its literal path, or give the text inline or in a heredoc.")


# Where a path is made by the shell - a variable, substitution, glob, brace list or ~user - the
# file is only known once the command runs.
BUILT_BY_SHELL = re.compile(r"[$`*?\[{]|^~[^/]")
# What writes its arguments to a pipe, so the text going in is in the command.
TEXT_PRODUCERS = frozenset(("echo", "printf"))
# bash_command does not follow a change of directory, so a relative path after one is not known.
DIRECTORY_CHANGES = frozenset(("cd", "chdir", "pushd", "popd"))  # chdir is zsh's cd
DIRECTORY_OPTIONS = {"git": ("-C",), "env": ("-C", "--chdir")}  # run the next command elsewhere


def moves_directory(command):
    name = program(command.words)
    return name in DIRECTORY_CHANGES or any(
        word.partition("=")[0] in DIRECTORY_OPTIONS.get(name, ()) for word in command.words[1:])


def working_directory(script_commands, cwd):
    """The directory a relative path is read from: the call's own, unless the command moves it."""
    return None if cwd is None or any(map(moves_directory, script_commands)) else Path(cwd)


def reads(command):
    """The files a command's standard input is redirected from."""
    return [word for operator, word in command.redirects if operator in ("<", "<>")]


def reads_descriptor(command):
    """Whether its standard input is redirected from another descriptor (`<&3`), whose file the command text does not name."""
    return any(operator == "<&" for operator, _ in command.redirects)


def stdin_carriers(command):
    """The commands whose own text becomes this command's standard input: itself, when a heredoc or
    here-string feeds it, and an echo or printf piped into it. The whole-command scan reads them."""
    upstream = command.upstream
    return [*([command] if command.stdin else []),
            *([upstream] if upstream is not None and program(upstream.words) in TEXT_PRODUCERS else [])]


def substituted_files(substituted):
    """The files named by the commands a publication's text is substituted from. Only `cat` of named
    files, and of text the command carries, has text the guard can clear; any other command's output
    exists only when the command runs."""
    files = []
    for command in substituted:
        name = program(command.words)
        if name in TEXT_PRODUCERS:
            continue
        if name != "cat":
            raise Unreadable("a command substitution", f"{name} computes its text when the command runs")
        operands = split_options(command.words[1:], frozenset()).operands
        if (not operands or "-" in operands) and not (reads(command) or stdin_carriers(command)):
            raise Unreadable("a command substitution", "it reads input from outside the command")
        files += [operand for operand in operands if operand != "-"] + reads(command)
    return files


def text_sources(publication):
    """The files a publication's text is read from, standard input resolved to everything that can
    feed it: bash lets the last redirection win, so every one is read."""
    command = publication.command
    substituted, files = list(command.substituted), []
    for word in publication.paths:
        carriers = stdin_carriers(command)
        if word != "-":
            files.append(word)
        elif reads_descriptor(command):
            raise Unreadable("standard input", "it is redirected from another file descriptor")
        elif carriers or reads(command):
            files += reads(command)
            substituted += [s for carrier in carriers if carrier is not command for s in carrier.substituted]
        else:
            raise Unreadable("standard input", "its text is not in the command")
    return files + substituted_files(substituted)


def locate(word, cwd):
    """The path a word names, as far as it is known before the command runs."""
    if not word:
        raise Unreadable("an empty path", "a missing value, or a process substitution")
    if BUILT_BY_SHELL.search(word):
        raise Unreadable(word, "its path is built by the shell")
    path = Path(word).expanduser()
    if path.is_absolute():
        return path
    if cwd is None:
        raise Unreadable(word, "the directory it is relative to is not known here")
    return cwd / path


def read_text(path, word):
    """The text of the regular file at `path`, as it stands before the command runs."""
    try:
        # /dev/stdin and /proc/self/fd/N name this process's own descriptors, not the command's;
        # a device, FIFO or directory is not a file's text.
        if path.parts[1:2] in (("dev",), ("proc",)) or not stat.S_ISREG(path.stat().st_mode):
            raise Unreadable(word, "not a regular file")
        return path.read_text(errors="replace")
    except OSError as error:
        raise Unreadable(word, error.strerror) from error


def named_by(command, path, cwd):
    """Whether a command of the call names `path` - as an argument, or as a file it writes. A
    copy, redirect, tee or editor can rewrite the file between the guard's read and the publication."""
    words = [*command.words[1:], *(word for operator, word in command.redirects if not operator.startswith("<"))]
    for word in words:
        for candidate in (word, word.partition("=")[2]):  # `dd of=file`
            try:
                if os.path.realpath(locate(candidate, cwd)) == os.path.realpath(path):
                    return True
            except Unreadable:
                continue  # a word that is no knowable path names no file
    return False


def unseen_text_refusal(publication, script_commands, cwd):
    """The refusal for a publication whose text comes from outside the command, or None."""
    command = publication.command
    # What feeds the publication is not "another command": its substitutions, and the readings of
    # it - the wrapper that runs it (`env A=1 gh ...`), and the tails bash_command reads as commands.
    fed = [*command.substituted, *(s for c in stdin_carriers(command) for s in c.substituted)]
    others = [c for c in script_commands
              if c not in fed and c.words[-len(command.words):] != command.words
              and command.words[-len(c.words):] != c.words]
    try:
        for word in text_sources(publication):
            path = locate(word, cwd)
            text = read_text(path, word)
            if carries_session_url(text):
                return f"{PUBLISHES_SESSION_URL} It is in {word}."
            if any(named_by(other, path, cwd) for other in others):
                raise Unreadable(word, "another command of this call names it too, so it may not hold "
                                       "what the guard read when the command runs")
    except Unreadable as unreadable:
        return str(unreadable)
    return None


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}))
    sys.exit(0)


def main():
    try:
        hook = json.load(sys.stdin)
    except ValueError as error:
        print(f"guard-session-url: unreadable hook payload ({error})", file=sys.stderr)
        sys.exit(1)

    command = str((hook.get("tool_input") or {}).get("command") or "")
    script_commands = list(commands(command))
    invocations = list(git_invocations(command))
    # git commit is read by its inline text only: the commit-msg hook scans the message file however
    # it was supplied (-m, -F, the editor), so it is the one enforcer for a commit's files.
    published = [*(tag_publication(i) for i in invocations if i.verb == "tag"),
                 *filter(None, map(gh_publication, script_commands))]

    if (published or any(i.verb == "commit" for i in invocations)) and carries_session_url(command):
        deny(PUBLISHES_SESSION_URL)

    cwd = working_directory(script_commands, hook.get("cwd"))
    for publication in published:
        refusal = unseen_text_refusal(publication, script_commands, cwd)
        if refusal:
            deny(refusal)

    for reason in map(hooks_skipped, invocations):
        if reason:
            deny(reason)

    sys.exit(0)


main()
