#!/usr/bin/env bash
# Migration: 0003-tmux-resurrect-fork.sh
# Author: bmf
# Created: 2026-11-22
#
# Problem:
#   tmux.conf now loads tmux-resurrect from brandon-fryslie/tmux-resurrect, whose save
#   runs @resurrect-save-command-strategy from a path, once per save - the strategy that
#   records Claude sessions lives in this repo. tpm installs a plugin only when its
#   directory is missing, so a machine that already has the tmux-plugins clone keeps it
#   and never runs the strategy.
#
# Fix:
#   Point that clone's origin at the fork and check out the fork's master. A clone with
#   uncommitted changes, or a branch with commits on no remote, is refused rather than reset.
#
# Safe to delete after:
#   Every machine has run it (`just migrate-status` on each). Fresh installs clone
#   the fork directly.

PLUGIN="${HOME}/.config/tmux/plugins/tmux-resurrect"
FORK="https://github.com/brandon-fryslie/tmux-resurrect"
# The fork commit after which a save runs a strategy given by path, once with every pane. It
# reached the fork's master through a merge commit, which keeps it; a squash would not.
CAPABILITY="becc48ec3e722e5667be2280e98b63e774852a05"

has_capability() {
    # `rev-parse -q --verify` is silent only about the commit being absent, which is what an
    # unmigrated clone looks like; any other git failure still prints.
    git -C "$PLUGIN" rev-parse -q --verify "$CAPABILITY^{commit}" >/dev/null &&
        git -C "$PLUGIN" merge-base --is-ancestor "$CAPABILITY" HEAD
}

migrate_check() {
    # No plugin directory is a machine tpm has not installed it on yet; it clones the fork.
    [[ -e "$PLUGIN" ]] && ! has_capability
}

migrate_apply() {
    # [LAW:no-silent-failure] the runner's `if migrate_apply` suspends set -e
    # inside this body, so every step must propagate failure explicitly.
    local changes unpushed
    changes=$(git -C "$PLUGIN" status --porcelain) || return 1
    # Every local branch, not just HEAD: `checkout -B master` below moves master wherever HEAD is.
    unpushed=$(git -C "$PLUGIN" rev-list --branches --not --remotes) || return 1
    if [[ -n "$changes" || -n "$unpushed" ]]; then
        echo "[migrate] $PLUGIN has uncommitted changes or a branch with commits on no remote; push or discard them, then rerun" >&2
        return 1
    fi
    # Fetched before origin moves, so a failure leaves the clone as it was.
    git -C "$PLUGIN" fetch --quiet "$FORK" master || return 1
    if ! git -C "$PLUGIN" merge-base --is-ancestor "$CAPABILITY" FETCH_HEAD; then
        echo "[migrate] $FORK master does not have $CAPABILITY yet; merge its PR #1 first" >&2
        return 1
    fi
    git -C "$PLUGIN" remote set-url origin "$FORK" || return 1
    git -C "$PLUGIN" fetch --quiet origin || return 1
    git -C "$PLUGIN" checkout --quiet -B master origin/master || return 1

    # [LAW:verifiable-goals] a fresh check finds nothing left to do: the checkout has the capability.
    ! migrate_check
}
