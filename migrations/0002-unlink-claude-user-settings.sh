#!/usr/bin/env bash
# Migration: 0002-unlink-claude-user-settings.sh
# Author: bmf
# Created: 2026-10-11
#
# Problem:
#   ~/.claude/settings.json used to be a dotbot symlink to the tracked
#   config/claude/settings.json. That file is gone: the stable baseline now
#   deploys as managed settings, and the user file is Claude Code's own
#   untracked scratch file. A machine that still has the symlink has it
#   dangling, or pointing at a leftover file git no longer tracks.
#
# Fix:
#   Replace the symlink with a regular file. A leftover target is moved into
#   place, not copied, so it leaves the repo instead of sitting there untracked.
#   With no leftover, the file is restored from the commit before the tracked
#   file was deleted - the committed baseline, not this machine's live edits.
#
# `git pull` aborts with "would be overwritten" on config/claude/settings.json?
#   That machine still has the old skip-worktree flag. Do this migration's work
#   by hand first, so the live edits survive the pull deleting the file:
#     rm ~/.claude/settings.json && cp config/claude/settings.json ~/.claude/settings.json
#     git update-index --no-skip-worktree config/claude/settings.json
#     git checkout -- config/claude/settings.json && git pull --rebase
#
# Safe to delete after:
#   Every machine has run it (`just migrate-status` on each). Fresh installs
#   never create the symlink.

TARGET_FILE="${HOME}/.claude/settings.json"
REPO="${DOTFILES_DIR:-$HOME/code/dotfiles}"
TRACKED="config/claude/settings.json"

migrate_check() {
    [[ -L "$TARGET_FILE" ]]
}

migrate_apply() {
    # [LAW:no-silent-failure] the runner's `if migrate_apply` suspends set -e
    # inside this body, so every step must propagate failure explicitly.
    # `command` bypasses interactive rm/mv aliases in the sourcing shell.
    local leftover="$REPO/$TRACKED" content deleted_in
    if [[ -e "$leftover" ]]; then
        command rm -f "$TARGET_FILE" || return 1
        command mv -f "$leftover" "$TARGET_FILE" || return 1
    else
        deleted_in=$(git -C "$REPO" log -1 --format=%H --diff-filter=D -- "$TRACKED") || return 1
        [[ -n "$deleted_in" ]] || { echo "[migrate] no commit deletes $TRACKED in $REPO" >&2; return 1; }
        content=$(git -C "$REPO" show "${deleted_in}^:$TRACKED") || return 1
        command rm -f "$TARGET_FILE" || return 1
        printf '%s\n' "$content" > "$TARGET_FILE" || return 1
    fi

    # [LAW:verifiable-goals] a fresh check finds nothing left to do.
    ! migrate_check
}
