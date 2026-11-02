#!/usr/bin/env python3
"""PreToolUse(Bash) guard. Two refusals, both about publishing:
  1. a command that would PUBLISH a Claude session URL
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
"""

import json
import subprocess
import sys
from pathlib import Path

from bash_command import commands, git_invocations, program, split_options

# [LAW:one-source-of-truth] the git hooks' definition of a session URL, read where it lives;
# grep reads it, because it is written as grep's pattern.
SESSION_URL_PATTERN = Path(__file__).resolve().parents[2] / "git" / "hooks" / "claude-session-url.pattern"

GIT_PUBLISHES = frozenset(("commit", "tag"))
HOOKS_PATH = "core.hookspath"  # casefolded, as bash_command reports config keys
# What each gh command group does that puts text a reader can fetch: its body, comment, review or
# closing note. `gh api` is decided apart, by its method.
GH_VERBS_THAT_PUBLISH = {
    "pr": ("create", "edit", "comment", "review", "merge", "close", "reopen"),
    "issue": ("create", "edit", "comment", "close", "reopen"),
    "release": ("create", "edit"),
    "gist": ("create", "edit"),
    "repo": ("create", "edit"),  # --description
    "label": ("create", "edit"),  # --description
    "workflow": ("run",),  # -f inputs, shown on the run
}
GH_PUBLISHES = frozenset((noun, verb) for noun, verbs in GH_VERBS_THAT_PUBLISH.items() for verb in verbs)
# `gh api` sends GET unless it is given a method, or fields/a body - which make it POST.
GH_API_TAKES_VALUE = frozenset((
    "-X", "--method", "-f", "--raw-field", "-F", "--field", "--input", "-H", "--header", "-q", "--jq",
    "-t", "--template", "--hostname", "--cache", "-p", "--preview", "-R", "--repo"))
GH_API_METHOD = frozenset(("-X", "--method"))
GH_API_BODY = frozenset(("-f", "--raw-field", "-F", "--field", "--input"))
READ_METHODS = frozenset(("GET", "HEAD"))

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
# section edits, whose first operand is a section; a bare `<key> <value>` is a write.
CONFIG_WRITE_MODES = frozenset(("--add", "--replace-all", "--unset", "--unset-all"))
CONFIG_SECTION_EDITS = frozenset(("--remove-section", "--rename-section"))
CONFIG_READ_MODES = frozenset((
    "-l", "--list", "--get", "--get-all", "--get-regexp", "--get-urlmatch", "--get-color", "--get-colorbool"))
CONFIG_TAKES_VALUE = frozenset(("-f", "--file", "--blob", "--type", "--default", "--comment"))
# Every long option of `git config`, which is what an abbreviation is resolved against.
CONFIG_LONG_OPTIONS = (CONFIG_WRITE_MODES | CONFIG_SECTION_EDITS | CONFIG_READ_MODES | CONFIG_TAKES_VALUE | frozenset((
    "--global", "--system", "--local", "--worktree", "--fixed-value", "--bool", "--int", "--bool-or-int",
    "--path", "--expiry-date", "--null", "--name-only", "--includes", "--no-includes", "--show-origin",
    "--show-scope", "--edit", "--no-type")))


def spell_out(arguments):
    """git accepts any unambiguous abbreviation of a long option: --unset-a is --unset-all."""
    spelled = []
    for word in arguments:
        name, equals, value = word.partition("=")
        matches = [option for option in CONFIG_LONG_OPTIONS if name.startswith("--") and option.startswith(name)]
        spelled.append(matches[0] + equals + value if len(matches) == 1 and name not in matches else word)
    return spelled


def config_writes_hooks_path(arguments):
    """A `git config` call that sets, adds to or unsets core.hooksPath, or that removes or renames
    the core section it lives in. Reads (`git config core.hooksPath`, --get, --list) are not one."""
    options = split_options(spell_out(arguments), CONFIG_TAKES_VALUE)
    flags, operands = set(options.flags), options.operands
    if flags & CONFIG_SECTION_EDITS:
        return [operand.casefold() for operand in operands[:1]] == ["core"]
    if operands[:1] in (["set"], ["unset"]):  # git 2.46: `git config set|unset <key> ...`
        writes, operands = True, operands[1:]
    else:
        writes = bool(flags & CONFIG_WRITE_MODES) or (len(operands) >= 2 and not flags & CONFIG_READ_MODES)
    return writes and [operand.casefold() for operand in operands[:1]] == [HOOKS_PATH]


def skips_hooks(invocation):
    # Pointing core.hooksPath anywhere else displaces the hooks as completely as --no-verify, and
    # on any verb that runs them, so the verb is not asked; the value is not either.
    if HOOKS_PATH in invocation.config_keys:
        return True
    # The persistent form of the same override: it displaces the hooks for every later commit, and
    # with --global in every repo.
    if invocation.verb == "config":
        return config_writes_hooks_path(invocation.arguments)
    # -n means --no-verify on commit, but --dry-run on push; only --no-verify is a bypass there.
    if invocation.verb == "commit":
        flags = split_options(invocation.arguments, COMMIT_TAKES_VALUE, COMMIT_TAKES_ATTACHED_VALUE).flags
        return any(flag == "-n" or names_no_verify(flag) for flag in flags)
    if invocation.verb == "push":
        return any(names_no_verify(flag) for flag in split_options(invocation.arguments, frozenset()).flags)
    return False


def api_writes(arguments):
    options = split_options(arguments, GH_API_TAKES_VALUE)
    methods = [value for flag, value in options.values if flag in GH_API_METHOD]
    if methods:
        return methods[-1].upper() not in READ_METHODS
    return any(flag in GH_API_BODY for flag in options.flags)


def publishes(words):
    if program(words) != "gh":
        return False
    # gh takes -R/--repo before its subcommand: `gh -R o/r pr create`.
    subcommand = split_options(words[1:], frozenset(("-R", "--repo"))).operands
    if subcommand[:1] == ["api"]:
        return api_writes(words[1:])
    return tuple(subcommand[:2]) in GH_PUBLISHES


def carries_session_url(command):
    pattern = SESSION_URL_PATTERN.read_text().replace("\n", "")
    scan = subprocess.run(["grep", "-qiE", "-e", pattern], input=command, text=True)
    if scan.returncode > 1:
        print(f"guard-session-url: session URL scan failed (grep exit {scan.returncode})", file=sys.stderr)
        sys.exit(1)
    return scan.returncode == 0


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
    invocations = list(git_invocations(command))

    if (any(i.verb in GIT_PUBLISHES for i in invocations) or any(publishes(c.words) for c in commands(command))) \
            and carries_session_url(command):
        deny("BLOCKED: this command would publish a Claude session URL (a claude.ai link to a "
             "conversation). That link resolves to the entire private conversation for anyone "
             "holding it, and publishing it is not reversible -- a force-push unlinks the commit "
             "but the object stays served by its SHA. "
             "Write the commit, PR or issue without the session line. Nothing replaces it: no "
             "shortened link, no id prefix, no 'session available on request'.")

    if any(map(skips_hooks, invocations)):
        deny("BLOCKED: --no-verify, or a core.hooksPath override (git -c, --config-env, GIT_CONFIG_*, "
             "git config writing or unsetting it), skips the commit-msg hook that refuses Claude session URLs. That "
             "hook is the mechanical backstop for a leak that reached public repos ~1,700 times. Run "
             "the command without the bypass; if the hook fires, remove the session link rather "
             "than bypassing the check.")

    sys.exit(0)


main()
