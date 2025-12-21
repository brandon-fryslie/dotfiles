#!/usr/bin/env bash
# run-migrations.sh - Lightweight migration runner for dotfiles
# Runs each migration script once per machine, tracked via marker files
#
# Usage: source this from zshrc or run directly
#   source "${DOTFILES_DIR}/migrations/run-migrations.sh"
#
# Migrations are shell scripts in the migrations/ directory named:
#   NNNN-description.sh (e.g., 0001-fix-claude-plugins.sh)
#
# Each migration must define:
#   migrate_check()  - return 0 if migration is needed, 1 if already done
#   migrate_apply()  - perform the migration

# Run in a subshell to avoid polluting the parent shell environment
(
    set -euo pipefail

    MIGRATIONS_DIR="${DOTFILES_DIR:-$HOME/code/dotfiles}/migrations"
    MARKERS_DIR="${HOME}/.local/state/dotfiles-migrations"

    # Ensure markers directory exists
    mkdir -p "$MARKERS_DIR"

    migration_files=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]-*.sh' -type f 2>/dev/null | sort)

    [[ -z "$migration_files" ]] && exit 0

    for migration in $migration_files; do
        name=$(basename "$migration" .sh)
        marker="$MARKERS_DIR/$name.done"

        # Skip if already completed on this machine
        [[ -f "$marker" ]] && continue

        # Source the migration to get its functions
        source "$migration"

        # Check if migration is needed
        if migrate_check; then
            echo "[migrate] Running: $name"
            if migrate_apply; then
                echo "[migrate] ✓ $name completed"
                touch "$marker"
            else
                echo "[migrate] ✗ $name failed" >&2
            fi
        else
            # Already in correct state, mark as done
            touch "$marker"
        fi
    done
)
