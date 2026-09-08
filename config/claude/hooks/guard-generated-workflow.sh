#!/usr/bin/env python3
"""PreToolUse guard: .github/workflows/code-review.yml has exactly one writer.

install.sh in the agent-code-review-setup skill renders this file from its embedded
template. Two ways an agent destroys that, both of which fail silently - nothing errors,
the run stays green, and the repo keeps executing a stale workflow until someone reads it:

  1. Hand-editing it. The next install.sh run overwrites the edit, so the change was
     never real - it only looked real until then.
  2. Discarding install.sh's own write to keep a branch "focused". On 2026-09-08 that is
     what happened here, across many repos, and it cost close to a thousand transcripts
     that were meant to be analyzed.

Neither is a judgment call worth re-making per session, so it is not left to judgment.
[LAW:single-enforcer] one rule at one boundary. Committing what the installer wrote is the
entire point, so add/commit/diff/status/show on this path stay permitted.
[LAW:no-silent-failure] a payload this cannot parse exits 1 - visible, non-blocking - so a
broken guard announces itself rather than quietly permitting everything.
"""

import json
import os
import re
import shlex
import sys

TARGET = ".github/workflows/code-review.yml"
BASENAME = "code-review.yml"
REGENERATE = "bash ~/.claude/skills/agent-code-review-setup/install.sh"

# [LAW:parse-dont-validate] the command is parsed into git invocations and their arguments,
# never scanned as text. Scanning text was the first version, and it refused a `commit`
# whose MESSAGE merely contained these words: a word in an argument is not a verb, and only
# a parse tells the difference. That version blocked its own commit within a minute.
DESTROYS_WORKTREE = frozenset(("checkout", "restore", "clean"))
STASH_TAKES_NOTHING_AWAY = frozenset(("list", "show", "pop", "apply", "drop", "branch", "clear"))
GLOBAL_OPERANDS_WITH_VALUE = frozenset(("-C", "-c", "--git-dir", "--work-tree", "--namespace"))
SWEEPING_PATHSPECS = frozenset((".", "*", "./"))

EDIT_TOOLS = ("Write", "Edit", "NotebookEdit")


def git_invocations(command):
    """Every git call in the command, as (subcommand, arguments). A part that will not parse
    yields nothing rather than a guess - deciding from a half-read command is exactly how the
    text-scanning version got it wrong."""
    for part in re.split(r"[;&|\n]+", command):
        try:
            words = shlex.split(part)
        except ValueError:
            continue
        if not words or os.path.basename(words[0]) != "git":
            continue
        index = 1
        while index < len(words) and words[index].startswith("-"):
            index += 2 if words[index] in GLOBAL_OPERANDS_WITH_VALUE else 1
        if index < len(words):
            yield words[index], words[index + 1:]


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

    tool = hook.get("tool_name") or ""
    supplied = hook.get("tool_input") or {}

    if tool in EDIT_TOOLS and str(supplied.get("file_path") or "").endswith(TARGET):
        deny(f"BLOCKED: {TARGET} is generated, not hand-maintained. install.sh renders it from "
             f"the template in the agent-code-review-setup skill, and its next run overwrites "
             f"anything you write here - so this edit would look applied and then vanish. "
             f"Change the template in the skill, then run:\n    {REGENERATE}")

    if tool != "Bash":
        sys.exit(0)

    for verb, arguments in git_invocations(str(supplied.get("command") or "")):
        paths = [a for a in arguments if not a.startswith("-")]
        names_it = any(a.endswith(TARGET) or a.endswith(BASENAME) for a in paths)
        sweeps = any(a in SWEEPING_PATHSPECS for a in paths)
        forced = any(a.startswith("-") and not a.startswith("--") and "f" in a for a in arguments)

        if verb in DESTROYS_WORKTREE and names_it:
            deny(commit_it_instead(
                f"BLOCKED: `git {verb}` here discards {TARGET}, which install.sh renders. "
                f"Undoing that write is invisible - nothing fails, and the repo silently keeps "
                f"running the stale workflow. Commit it instead:"))

        # clean takes the tree with no pathspec at all; checkout and restore need one.
        if verb in DESTROYS_WORKTREE and (sweeps or (verb == "clean" and forced)):
            deny(commit_it_instead(
                f"BLOCKED: `git {verb}` sweeps the working tree and takes {TARGET} with it - a "
                f"generated file whose loss is silent. Name the paths you actually mean to "
                f"discard, and commit the workflow rather than dropping it:"))

        if verb == "reset" and "--hard" in arguments:
            deny(commit_it_instead(
                f"BLOCKED: a hard reset discards {TARGET} along with everything else, and its "
                f"loss is silent. Commit it first:"))

        if verb == "stash" and not (arguments and arguments[0] in STASH_TAKES_NOTHING_AWAY):
            deny(commit_it_instead(
                f"BLOCKED: a save-type stash takes the whole tree, so the worktree silently "
                f"reverts to a stale {TARGET}. The read and restore subcommands are permitted. "
                f"Commit it instead:"))

    sys.exit(0)


main()
