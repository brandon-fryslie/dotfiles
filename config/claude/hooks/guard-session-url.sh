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
import os
import subprocess
import sys
from pathlib import Path

from bash_command import commands, git_invocations, split_options

# [LAW:one-source-of-truth] the git hooks' definition of a session URL, read where it lives;
# grep reads it, because it is written as grep's pattern.
SESSION_URL_PATTERN = Path(__file__).resolve().parents[2] / "git" / "hooks" / "claude-session-url.pattern"

GIT_PUBLISHES = frozenset(("commit", "tag"))
GH_PUBLISHES = frozenset((noun, verb) for noun in ("pr", "issue", "release", "gist") for verb in ("create", "edit"))

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


def skips_hooks(invocation):
    # -n means --no-verify on commit, but --dry-run on push; only --no-verify is a bypass there.
    if invocation.verb == "commit":
        flags = split_options(invocation.arguments, COMMIT_TAKES_VALUE, COMMIT_TAKES_ATTACHED_VALUE).flags
        return any(flag == "-n" or names_no_verify(flag) for flag in flags)
    if invocation.verb == "push":
        return any(names_no_verify(flag) for flag in split_options(invocation.arguments, frozenset()).flags)
    return False


def publishes(words):
    return os.path.basename(words[0]) == "gh" and tuple(words[1:3]) in GH_PUBLISHES


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

    if (any(i.verb in GIT_PUBLISHES for i in invocations) or any(map(publishes, commands(command)))) \
            and carries_session_url(command):
        deny("BLOCKED: this command would publish a Claude session URL (a claude.ai link to a "
             "conversation). That link resolves "
             "to the entire private conversation for anyone holding it, and publishing it is not "
             "reversible -- a force-push unlinks the commit but the object stays served by its SHA. "
             "Write the commit, PR or issue without the session line. Nothing replaces it: no "
             "shortened link, no id prefix, no 'session available on request'.")

    if any(map(skips_hooks, invocations)):
        deny("BLOCKED: --no-verify skips the commit-msg hook that refuses Claude session URLs. That "
             "hook is the mechanical backstop for a leak that reached public repos ~1,700 times. Run "
             "the command without --no-verify; if the hook fires, remove the session link rather "
             "than bypassing the check.")

    sys.exit(0)


main()
