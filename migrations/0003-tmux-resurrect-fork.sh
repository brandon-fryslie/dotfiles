#!/usr/bin/env bash
# Migration: 0003-tmux-resurrect-fork.sh
# Author: bmf
# Created: 2026-11-22
#
# Problem:
#   tmux.conf now loads tmux-resurrect from brandon-fryslie/tmux-resurrect, whose
#   @resurrect-save-command-strategy accepts a path - the save strategy that records
#   Claude sessions lives in this repo. tpm installs a plugin only when its directory
#   is missing, so a machine that already has the tmux-plugins clone keeps it, ignores
#   the path, and saves with the bundled ps strategy.
#
# Fix:
#   Point that clone's origin at the fork and check out the fork's master. A clone
#   with local changes is refused rather than overwritten.
#
# Safe to delete after:
#   Every machine has run it (`just migrate-status` on each). Fresh installs clone
#   the fork directly.

PLUGIN="${HOME}/.config/tmux/plugins/tmux-resurrect"
FORK="https://github.com/brandon-fryslie/tmux-resurrect"

migrate_check() {
    [[ -d "$PLUGIN/.git" ]] && [[ "$(git -C "$PLUGIN" remote get-url origin)" != "$FORK" ]]
}

migrate_apply() {
    # [LAW:no-silent-failure] the runner's `if migrate_apply` suspends set -e
    # inside this body, so every step must propagate failure explicitly.
    if [[ -n "$(git -C "$PLUGIN" status --porcelain)" ]]; then
        echo "[migrate] $PLUGIN has local changes; commit or discard them, then rerun" >&2
        return 1
    fi
    git -C "$PLUGIN" remote set-url origin "$FORK" || return 1
    git -C "$PLUGIN" fetch --quiet origin || return 1
    git -C "$PLUGIN" checkout --quiet -B master origin/master || return 1

    # [LAW:verifiable-goals] a fresh check finds nothing left to do.
    ! migrate_check
}
