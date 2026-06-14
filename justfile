# Dotfiles Management with Dotbot
# Run `just --list` to see all available commands

# Default recipe - shows help
default:
    @just --list

# Install dotfiles with specified profile (calls ./install script)
install *ARGS:
    ./install {{ARGS}}

# Show current dotfiles status (which profile is active, repo location, indicator health)
status:
    #!/usr/bin/env bash
    set -euo pipefail

    # Profile is encoded as a suffix on the symlink target's basename:
    # ~/.zshrc -> .../config/zshrc.home  =>  profile = home
    # Any symlink whose target matches `<name>.<home|work>` counts as an indicator.
    INDICATORS=(~/.zshrc ~/.rad-plugins ~/.pypirc ~/.mackup.cfg)

    echo "Dotfiles Status"
    echo "==============="
    echo ""

    seen=""
    repo=""
    for link in "${INDICATORS[@]}"; do
        if [[ -L "$link" ]]; then
            target=$(readlink "$link")
            base="${target##*/}"
            suffix="${base##*.}"
            case "$suffix" in
                home|work)
                    case " $seen " in *" $suffix "*) ;; *) seen="${seen:+$seen }$suffix" ;; esac
                    printf "  %-20s -> %s\n" "${link/#$HOME/~}" "$target"
                    # First profile-bearing target reveals the repo root.
                    [[ -z "$repo" ]] && repo="${target%/config/*}"
                    ;;
                *)
                    printf "  %-20s -> %s  (no profile suffix)\n" "${link/#$HOME/~}" "$target"
                    ;;
            esac
        elif [[ -e "$link" ]]; then
            printf "  %-20s    (regular file, not a symlink)\n" "${link/#$HOME/~}"
        else
            printf "  %-20s    (missing)\n" "${link/#$HOME/~}"
        fi
    done

    echo ""
    profile_count=$(echo $seen | wc -w | tr -d ' ')
    case "$profile_count" in
        0) echo "Profile: NOT INSTALLED" ;;
        1) echo "Profile: $seen" ;;
        *) echo "Profile: MIXED ($seen) — re-run \`just install <profile>\`" ;;
    esac

    if [[ -n "$repo" ]]; then
        echo "Repo:    $repo"
        if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            echo "         ⚠ not a git work tree"
        fi
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
