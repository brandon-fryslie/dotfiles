# Dotfiles Management with Dotbot
# Run `just --list` to see all available commands

# Default recipe - shows help
default:
    @just --list

# Install dotfiles with specified profile (calls ./install script)
install *ARGS:
    ./install {{ARGS}}

# Show current dotfiles status (which profile is active)
status:
    #!/usr/bin/env bash
    echo "Dotfiles Status"
    echo "==============="
    echo ""
    if [ -L ~/.zshrc ]; then
        zshrc_target=$(readlink ~/.zshrc)
        echo "Active .zshrc: $zshrc_target"
        if echo "$zshrc_target" | grep -q "dotfiles-home"; then
            echo "Profile: HOME"
        elif echo "$zshrc_target" | grep -q "dotfiles-work"; then
            echo "Profile: WORK"
        else
            echo "Profile: UNKNOWN"
        fi
    else
        echo "⚠ ~/.zshrc is not a symlink"
    fi

# Validate dotfiles installation and migrations
validate:
    ./bin/validate
    ./bin/validate-migrations

# Run pending migrations
migrate:
    #!/usr/bin/env bash
    export DOTFILES_DIR="${PWD}"
    source migrations/run-migrations.sh

# Show migration status for this machine
migrate-status:
    #!/usr/bin/env bash
    MARKERS_DIR="${HOME}/.local/state/dotfiles-migrations"
    MIGRATIONS_DIR="${PWD}/migrations"
    echo "Migration Status (this machine)"
    echo "================================"
    echo ""
    # Find all migrations in repo
    for migration in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]-*.sh' -type f 2>/dev/null | sort); do
        name=$(basename "$migration" .sh)
        marker="$MARKERS_DIR/$name.done"
        if [[ -f "$marker" ]]; then
            when=$(stat -f "%Sm" -t "%Y-%m-%d" "$marker" 2>/dev/null || stat -c "%y" "$marker" 2>/dev/null | cut -d' ' -f1)
            echo "  [done] $name (ran: $when)"
        else
            echo "  [pending] $name"
        fi
    done
    echo ""
    echo "Markers: $MARKERS_DIR"

# Create a new migration from template
migrate-new NAME:
    #!/usr/bin/env bash
    MIGRATIONS_DIR="${PWD}/migrations"
    # Find next number
    last=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]-*.sh' -type f 2>/dev/null | sort | tail -1 | xargs basename 2>/dev/null | cut -c1-4)
    if [[ -z "$last" ]]; then
        next="0001"
    else
        next=$(printf "%04d" $((10#$last + 1)))
    fi
    filename="${next}-{{NAME}}.sh"
    filepath="$MIGRATIONS_DIR/$filename"
    cp "$MIGRATIONS_DIR/template.sh" "$filepath"
    # Replace placeholders
    sed -i '' "s/MIGRATION_NAME/$filename/g" "$filepath"
    sed -i '' "s/AUTHOR/$(git config user.name)/g" "$filepath"
    sed -i '' "s/CREATED_DATE/$(date +%Y-%m-%d)/g" "$filepath"
    chmod +x "$filepath"
    echo "Created: $filepath"
    echo "Edit the file and fill in the TODOs"
