#!/usr/bin/env python3
"""PreToolUse guard: `git reset --hard` may not discard .github/workflows/code-review.yml.

install.sh in the agent-code-review-setup skill renders that file. A hard reset throws away
an uncommitted render along with everything else, and the loss is silent: nothing errors, the
run stays green, and the repo keeps executing the stale workflow. So the reset is denied;
committing the file first is the fix.

[LAW:single-enforcer] one rule at one boundary: the reset is the only command this denies.
[LAW:no-silent-failure] a payload this cannot parse exits 1 - visible, non-blocking - so a
broken guard announces itself rather than quietly permitting everything.
"""

import json
import sys

from bash_command import git_invocations

TARGET = ".github/workflows/code-review.yml"
REGENERATE = "bash ~/.claude/skills/agent-code-review-setup/install.sh"


def deny(message):
    print(message, file=sys.stderr)
    sys.exit(2)


def commit_it_instead(lead):
    return (f"{lead}\n    git add {TARGET} && git commit\n"
            f"If it does not belong on this branch, commit it on one where it does - never "
            f"discard it. To re-render after a template change:\n    {REGENERATE}")


def main():
    try:
        hook = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError) as error:
        print(f"guard-generated-workflow: unreadable hook payload ({error})", file=sys.stderr)
        sys.exit(1)

    supplied = hook.get("tool_input") or {}

    # [LAW:parse-dont-validate] the command is read as the git invocations it runs (bash_command),
    # never scanned as text: a word in an argument such as a commit message is not a verb.
    for verb, arguments in git_invocations(str(supplied.get("command") or "")):
        if verb == "reset" and "--hard" in arguments:
            deny(commit_it_instead(
                f"BLOCKED: a hard reset discards {TARGET} along with everything else, and its "
                f"loss is silent. Commit it first:"))

    sys.exit(0)


main()
