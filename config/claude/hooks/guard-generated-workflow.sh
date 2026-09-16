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

import fnmatch
import json
import sys

from bash_command import git_invocations, split_options

TARGET = ".github/workflows/code-review.yml"
BASENAME = "code-review.yml"
REGENERATE = "bash ~/.claude/skills/agent-code-review-setup/install.sh"

# [LAW:parse-dont-validate] the command is read as the git invocations it runs (bash_command),
# never scanned as text. Scanning text was the first version, and it refused a `commit` whose
# MESSAGE merely contained these words: a word in an argument is not a verb, and only a parse
# tells the difference. That version blocked its own commit within a minute.
DESTROYS_WORKTREE = frozenset(("checkout", "restore", "clean"))
STASH_TAKES_NOTHING_AWAY = frozenset(("list", "show", "pop", "apply", "drop", "branch", "clear"))
STASH_PUSH_TAKES_VALUE = frozenset(("-m", "--message", "--pathspec-from-file"))
SWEEPING_PATHSPECS = frozenset((".", "*", "./"))
WHOLE_TREE = ":/"

TARGET_PARTS = TARGET.split("/")
# What a pathspec must name to cover TARGET from some directory on the way down to it: TARGET
# or a directory holding it, spelled from the repo root, from .github, or from workflows.
TARGET_FROM_ANY_DIRECTORY = frozenset(
    "/".join(TARGET_PARTS[start:end]).casefold()
    for start in range(len(TARGET_PARTS)) for end in range(start + 1, len(TARGET_PARTS) + 1))

EDIT_TOOLS = ("Write", "Edit", "NotebookEdit")


def stash_pathspecs(arguments):
    """What a stash carries out of the worktree, as pathspecs: none for the read and restore
    subcommands, WHOLE_TREE for a stash no pathspec limits."""
    subcommand = arguments[0] if arguments else "push"
    if subcommand in STASH_TAKES_NOTHING_AWAY:
        return []
    # `git stash -k -- path` is push with the subcommand omitted. save, create and store take
    # the whole tree; save reads its words as a message, never as pathspecs.
    if subcommand.startswith("-"):
        subcommand, arguments = "push", ["push", *arguments]
    if subcommand != "push":
        return [WHOLE_TREE]
    options = split_options(arguments[1:], STASH_PUSH_TAKES_VALUE)
    # Paths read from a file are paths this hook cannot see.
    if any(flag.startswith("--pathspec-fr") for flag in options.flags):
        return [WHOLE_TREE]
    return options.operands or [WHOLE_TREE]


def reaches_target(pathspec):
    """Whether a pathspec can cover TARGET. The directory it is read from is unknown - cd and -C
    move it - so it reaches when, read from any directory on the way down to TARGET, it names
    TARGET or a directory holding it. A magic (:), absolute, home-relative, parent-relative or
    shell-expanded pathspec cannot be placed at all, so it reaches."""
    if pathspec.startswith((":", "/", "~")) or "$" in pathspec or "`" in pathspec:
        return True
    parts = [part for part in pathspec.split("/") if part not in ("", ".")]
    if not parts or ".." in parts:
        return True
    pattern = "/".join(parts).casefold()
    return any(fnmatch.fnmatchcase(path, pattern) for path in TARGET_FROM_ANY_DIRECTORY)


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

        if verb == "stash" and any(map(reaches_target, stash_pathspecs(arguments))):
            deny(commit_it_instead(
                f"BLOCKED: this stash can take {TARGET} with it - it saves the whole tree, or a "
                f"pathspec that reaches the workflow - so the worktree silently reverts to a stale "
                f"copy. The read and restore subcommands are permitted, and so is a stash limited "
                f"to paths that cannot reach it (git stash push -- <path>...). Commit it instead:"))

    sys.exit(0)


main()
