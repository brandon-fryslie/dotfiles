# Dotfiles Management with Dotbot
# Run `just --list` to see all available commands

# Default recipe - shows help
default:
    @just --list

# Install dotfiles with specified profile (calls ./install script)
[positional-arguments]
install *ARGS:
    ./install "$@"

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

# Validate dotbot YAML configs
validate:
    ./bin/validate

# Assert an install backs up a real file or directory at a managed path instead of deleting it (throwaway HOME, real dotbot)
test-install-backup:
    ./tests/install-backup.sh

# Assert each install profile runs its dotbot configs in order and an unknown profile runs none (stub uvx)
test-install-profile:
    ./tests/install-profile.sh

# Assert the prompt's git segment shows packed and worktree stashes, and a user.name only when the repo sets one (throwaway repos, real zsh -f)
test-git-taculous:
    ./tests/git-taculous-prompt.sh

# Assert the codex screenshot skill's permission check reports a failing swift helper as an error, never as "not granted" (stub swift)
test-screenshot-permissions:
    ./tests/screenshot-permissions.sh

# Assert share-slop finds the session transcript under $CLAUDE_CONFIG_DIR, ~/.claude only when unset (stub curl, temp dirs)
test-share-slop:
    ./tests/share-slop.sh

# Assert the codex skill-creator validator rejects an empty, whitespace-only, or bare-key name or description, naming the field (PyYAML via uv)
test-skill-creator:
    uv run --with pyyaml python -m unittest tests/test_skill_creator_quick_validate.py

# Assert the codex skill-installer fails with its own errors offline, falls back to git, and installs all-or-nothing
test-skill-installer:
    python3 -m unittest tests/test_skill_installer.py

# Assert the codex imagegen batch retries a rate-limited job within --max-attempts, honoring the server's delay
test-image-gen:
    uv run --with openai python -m unittest tests/test_image_gen_retries.py

# Test the Claude Code PreToolUse guard hooks
test-hooks:
    python3 -m unittest discover -s config/claude/hooks -p 'test_*.py'

# Test which certs regen-ca-bundle.py admits to the CA bundle (macOS: runs the real openssl and security verify-cert on generated certs)
test-certs:
    python3 -m unittest discover -s config/certs -p 'test_*.py'

# Assert the git pre-commit session-URL scan exempts the guard's own files in the main checkout and a worktree, and nowhere else
test-session-url-hook:
    ./config/claude/tests/session-url-hook.sh

# Assert the git hooks chain to the repo's own .git/hooks pre-commit from the main checkout and a linked worktree
test-chain-to-local-hook:
    ./config/claude/tests/chain-to-local-hook.sh

# Assert the installed global git config points git at the session-URL hooks, so a session-URL commit message is refused in a plain repo
test-global-hooks-path:
    ./config/claude/tests/global-hooks-path.sh

# Report whether git here (or in <dir>) runs the session-URL hooks; exits 1 and names the value in effect when it does not
check-hooks-path dir=".":
    ./bin/check-hooks-path "{{dir}}"

# Assert the managed settings decide Claude's Bash-tool shell (runs a claude -p)
test-claude-shell:
    ./config/claude/tests/tool-shell.sh

# Assert repo-session lands claude in the named or derived tmux session (one claude boots)
test-repo-session:
    ./config/claude/tests/repo-session.sh

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
