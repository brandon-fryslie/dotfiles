#!/usr/bin/env bash
# Migration: 0001-restore-claude-plugins-config.sh
# Author: bmf
# Created: 2024-12-20
#
# Problem:
#   The file config/claude/plugins-config/config.json was removed from the
#   dotfiles repo (commit d6b0342), but some machines still have a broken
#   symlink at ~/.claude/plugins-config/config.json pointing to the old location.
#   Claude Code fails if this file is missing or a broken symlink.
#
# Fix:
#   1. Remove the broken symlink if it exists
#   2. Create a real file with the minimal required content
#
# Safe to delete after:
#   All machines have been updated (check with `just migrate-status` on each).
#   Fresh installs won't have the broken symlink since the config was removed.

TARGET_DIR="${HOME}/.claude/plugins-config"
TARGET_FILE="${TARGET_DIR}/config.json"

# The content that was in the repo (from git show d6b0342:config/claude/plugins-config/config.json)
CONFIG_CONTENT='{
  "repositories": {}
}'

migrate_check() {
    # Migration is needed if:
    # 1. Target is a broken symlink, OR
    # 2. Target doesn't exist at all

    if [[ -L "$TARGET_FILE" ]]; then
        # It's a symlink - check if broken
        if [[ ! -e "$TARGET_FILE" ]]; then
            return 0  # Broken symlink, need to fix
        fi
    fi

    if [[ ! -f "$TARGET_FILE" ]]; then
        return 0  # File doesn't exist, need to create
    fi

    return 1  # File exists and is not a broken symlink
}

migrate_apply() {
    # Remove broken symlink if exists
    if [[ -L "$TARGET_FILE" ]]; then
        rm "$TARGET_FILE"
    fi

    # Create directory if needed
    mkdir -p "$TARGET_DIR"

    # Write the config file
    echo "$CONFIG_CONTENT" > "$TARGET_FILE"

    return 0
}
