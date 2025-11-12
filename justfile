# Dotfiles Management with Dotbot
# Run `just --list` to see all available commands

# Dotbot binary path
DOTBOT := "./dotbot/bin/dotbot"
DOTBOT_FLAGS := "-d . -v"

# Default recipe - shows help
default:
    @just --list

# Install global dotfiles only
install-global:
    @echo "Installing global dotfiles..."
    {{DOTBOT}} {{DOTBOT_FLAGS}} -c install.conf.yaml

# Install dotfiles with home profile
install-home:
    @echo "Installing dotfiles with home profile..."
    {{DOTBOT}} {{DOTBOT_FLAGS}} -c install.conf.yaml
    {{DOTBOT}} {{DOTBOT_FLAGS}} -c install-home.conf.yaml

# Install dotfiles with work profile
install-work:
    @echo "Installing dotfiles with work profile..."
    {{DOTBOT}} {{DOTBOT_FLAGS}} -c install.conf.yaml
    {{DOTBOT}} {{DOTBOT_FLAGS}} -c install-work.conf.yaml

# Dry run - see what would be installed for home profile
dry-run-home:
    @echo "Dry run for home profile..."
    {{DOTBOT}} {{DOTBOT_FLAGS}} --dry-run -c install.conf.yaml
    {{DOTBOT}} {{DOTBOT_FLAGS}} --dry-run -c install-home.conf.yaml

# Dry run - see what would be installed for work profile
dry-run-work:
    @echo "Dry run for work profile..."
    {{DOTBOT}} {{DOTBOT_FLAGS}} --dry-run -c install.conf.yaml
    {{DOTBOT}} {{DOTBOT_FLAGS}} --dry-run -c install-work.conf.yaml

# Backup current dotfiles before making changes
backup:
    #!/usr/bin/env bash
    set -euo pipefail
    BACKUP_DIR=~/dotfiles_backup_$(date +%Y%m%d_%H%M%S)
    echo "Creating backup at ${BACKUP_DIR}..."
    mkdir -p "${BACKUP_DIR}"

    # List of files to backup (common dotfiles)
    files=(.zshrc .rad-plugins .aider.conf.yml .p10k.zsh .gitignore_global .mackup.cfg .gemrc .rvmrc .pypirc)

    for file in "${files[@]}"; do
        if [[ -e "${HOME}/${file}" ]]; then
            echo "  Backing up ~/${file}"
            cp -L "${HOME}/${file}" "${BACKUP_DIR}/${file}" 2>/dev/null || true
        fi
    done
    echo "Backup complete at ${BACKUP_DIR}"

# Check for files in dotfiles_global/ that aren't in install.conf.yaml
check-missing-global:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Checking for files in dotfiles_global/ not listed in install.conf.yaml..."

    missing=0
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        # Skip README files
        [[ "$filename" =~ \.md$ ]] && continue

        if ! grep -q "$filename" install.conf.yaml; then
            echo "  Missing: $filename"
            missing=$((missing + 1))
        fi
    done < <(find dotfiles_global -type f -print0)

    if [[ $missing -eq 0 ]]; then
        echo "✓ All files are listed in install.conf.yaml"
    else
        echo "⚠ Found $missing files not listed in config"
    fi

# Check for files in dotfiles-home/ that aren't in install-home.conf.yaml
check-missing-home:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Checking for files in dotfiles-home/ not listed in install-home.conf.yaml..."

    missing=0
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        # Skip README files
        [[ "$filename" =~ \.md$ ]] && continue

        if ! grep -q "$filename" install-home.conf.yaml; then
            echo "  Missing: $filename"
            missing=$((missing + 1))
        fi
    done < <(find dotfiles-home -type f -print0)

    if [[ $missing -eq 0 ]]; then
        echo "✓ All files are listed in install-home.conf.yaml"
    else
        echo "⚠ Found $missing files not listed in config"
    fi

# Check for files in dotfiles-work/ that aren't in install-work.conf.yaml
check-missing-work:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Checking for files in dotfiles-work/ not listed in install-work.conf.yaml..."

    missing=0
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        # Skip README files
        [[ "$filename" =~ \.md$ ]] && continue

        if ! grep -q "$filename" install-work.conf.yaml; then
            echo "  Missing: $filename"
            missing=$((missing + 1))
        fi
    done < <(find dotfiles-work -type f -print0)

    if [[ $missing -eq 0 ]]; then
        echo "✓ All files are listed in install-work.conf.yaml"
    else
        echo "⚠ Found $missing files not listed in config"
    fi

# Check all profiles for missing files
check-missing: check-missing-global check-missing-home check-missing-work

# Show what files would be linked for home profile
show-links-home:
    @echo "Files that will be linked with home profile:"
    @echo ""
    @echo "=== Global files ==="
    @grep "~/\." install.conf.yaml | sed 's/^[[:space:]]*/  /' || true
    @echo ""
    @echo "=== Home-specific files (overrides) ==="
    @grep "~/\." install-home.conf.yaml | sed 's/^[[:space:]]*/  /' || true

# Show what files would be linked for work profile
show-links-work:
    @echo "Files that will be linked with work profile:"
    @echo ""
    @echo "=== Global files ==="
    @grep "~/\." install.conf.yaml | sed 's/^[[:space:]]*/  /' || true
    @echo ""
    @echo "=== Work-specific files (overrides) ==="
    @grep "~/\." install-work.conf.yaml | sed 's/^[[:space:]]*/  /' || true

# Verify home profile symlinks are correct
verify-home:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Verifying home profile symlinks..."

    broken=0
    correct=0
    missing=0

    # Use associative array to track which target we expect for each file
    # Later configs override earlier ones
    declare -A expected_sources

    # First pass: collect all target->source mappings (profile configs override global)
    for config in install.conf.yaml install-home.conf.yaml; do
        while IFS= read -r line; do
            target=$(echo "$line" | awk '{print $1}' | tr -d ':')
            source=$(echo "$line" | awk '{print $2}')
            [[ -z "$source" ]] && continue
            # Store the mapping (later configs will overwrite)
            expected_sources["$target"]="$source"
        done < <(grep -E "^\s+~/\." "$config" 2>/dev/null || true)
    done

    # Second pass: verify each unique target
    for target in "${!expected_sources[@]}"; do
        source="${expected_sources[$target]}"
        # Expand tilde
        expanded_target="${target/#\~/$HOME}"

        if [[ ! -L "$expanded_target" ]]; then
            echo "  ✗ Missing symlink: $expanded_target"
            missing=$((missing + 1))
        else
            actual_target=$(readlink "$expanded_target")
            # Check if target ends with the expected source path
            if [[ "$actual_target" == *"$source" ]]; then
                correct=$((correct + 1))
            else
                echo "  ✗ Incorrect: $expanded_target -> $actual_target"
                echo "             Expected to end with: $source"
                broken=$((broken + 1))
            fi
        fi
    done

    echo ""
    echo "Results: $correct correct, $missing missing, $broken incorrect"

    if [[ $missing -gt 0 ]] || [[ $broken -gt 0 ]]; then
        echo "⚠ Some symlinks need attention. Run 'just install-home' to fix."
        exit 1
    else
        echo "✓ All symlinks are correct!"
    fi

# Verify work profile symlinks are correct
verify-work:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Verifying work profile symlinks..."

    broken=0
    correct=0
    missing=0

    # Use associative array to track which target we expect for each file
    declare -A expected_sources

    # First pass: collect all target->source mappings (profile configs override global)
    for config in install.conf.yaml install-work.conf.yaml; do
        while IFS= read -r line; do
            target=$(echo "$line" | awk '{print $1}' | tr -d ':')
            source=$(echo "$line" | awk '{print $2}')
            [[ -z "$source" ]] && continue
            expected_sources["$target"]="$source"
        done < <(grep -E "^\s+~/\." "$config" 2>/dev/null || true)
    done

    # Second pass: verify each unique target
    for target in "${!expected_sources[@]}"; do
        source="${expected_sources[$target]}"
        expanded_target="${target/#\~/$HOME}"

        if [[ ! -L "$expanded_target" ]]; then
            echo "  ✗ Missing symlink: $expanded_target"
            missing=$((missing + 1))
        else
            actual_target=$(readlink "$expanded_target")
            if [[ "$actual_target" == *"$source" ]]; then
                correct=$((correct + 1))
            else
                echo "  ✗ Incorrect: $expanded_target -> $actual_target"
                echo "             Expected to end with: $source"
                broken=$((broken + 1))
            fi
        fi
    done

    echo ""
    echo "Results: $correct correct, $missing missing, $broken incorrect"

    if [[ $missing -gt 0 ]] || [[ $broken -gt 0 ]]; then
        echo "⚠ Some symlinks need attention. Run 'just install-work' to fix."
        exit 1
    else
        echo "✓ All symlinks are correct!"
    fi

# Show current dotfiles status (which profile is active)
status:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Dotfiles Status"
    echo "==============="
    echo ""

    # Check which profile appears to be active based on PROJECTS_DIR in .zshrc
    if [[ -L ~/.zshrc ]]; then
        zshrc_target=$(readlink ~/.zshrc)
        echo "Active .zshrc: $zshrc_target"

        if [[ $zshrc_target == *"dotfiles-home"* ]]; then
            echo "Profile: HOME"
        elif [[ $zshrc_target == *"dotfiles-work"* ]]; then
            echo "Profile: WORK"
        else
            echo "Profile: UNKNOWN"
        fi
    else
        echo "⚠ ~/.zshrc is not a symlink"
    fi

    echo ""
    echo "Key dotfiles:"
    for file in .zshrc .rad-plugins .aider.conf.yml .p10k.zsh; do
        if [[ -L ~/$file ]]; then
            printf "  %-20s -> %s\n" "$file" "$(readlink ~/$file)"
        elif [[ -e ~/$file ]]; then
            echo "  $file (not a symlink)"
        else
            echo "  $file (missing)"
        fi
    done

# Clean broken symlinks in home directory
clean-broken:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Finding broken symlinks in home directory..."

    count=0
    while IFS= read -r -d '' link; do
        if [[ ! -e "$link" ]]; then
            echo "  Removing broken symlink: $link"
            rm "$link"
            count=$((count + 1))
        fi
    done < <(find ~ -maxdepth 1 -type l -print0 2>/dev/null)

    if [[ $count -eq 0 ]]; then
        echo "✓ No broken symlinks found"
    else
        echo "✓ Removed $count broken symlinks"
    fi

# Update dotbot submodule to latest version
update-dotbot:
    @echo "Updating dotbot submodule..."
    git submodule update --remote dotbot
    @echo "✓ Dotbot updated"

# Initialize/update dotbot submodule (run this after clone)
init:
    @echo "Initializing dotbot submodule..."
    git submodule update --init --recursive dotbot
    @echo "✓ Dotbot initialized"

# Validate YAML syntax in all config files
validate:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Validating YAML configuration files..."

    for config in install.conf.yaml install-home.conf.yaml install-work.conf.yaml install-watchers.conf.yaml; do
        if command -v python3 &> /dev/null; then
            if python3 -c "import yaml; yaml.safe_load(open('$config'))" 2>/dev/null; then
                echo "  ✓ $config is valid"
            else
                echo "  ✗ $config has syntax errors"
                python3 -c "import yaml; yaml.safe_load(open('$config'))"
            fi
        else
            echo "  ? Cannot validate $config (python3 not available)"
        fi
    done

# Setup file watchers using launchd
setup-watchers:
    @echo "Setting up launchd file watchers..."
    {{DOTBOT}} {{DOTBOT_FLAGS}} -c install-watchers.conf.yaml

# List active file watchers
list-watchers:
    @echo "Active file watchers:"
    @launchctl list | grep com.user || echo "No watchers found"

# Stop and remove all file watchers
remove-watchers:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Removing file watchers..."
    for plist in ~/Library/LaunchAgents/com.user.*.plist; do
        if [[ -f "$plist" ]]; then
            label=$(basename "$plist" .plist)
            echo "  Unloading $label"
            launchctl unload "$plist" 2>/dev/null || true
            rm "$plist"
        fi
    done
    echo "✓ All watchers removed"

# View logs for a specific watcher
watch-logs LABEL:
    @echo "Tailing logs for {{LABEL}}..."
    @tail -f ~/Library/Logs/{{LABEL}}.log ~/Library/Logs/{{LABEL}}.error.log

# Manually trigger a merge (example)
merge-example SOURCE1 SOURCE2 OUTPUT:
    @echo "Merging {{SOURCE1}} + {{SOURCE2}} -> {{OUTPUT}}"
    ./scripts/merge-json.sh "{{OUTPUT}}" "{{SOURCE1}}" "{{SOURCE2}}"

# Run functional tests
test:
    @./run-tests.sh

# Run tests with verbose output
test-verbose:
    @./run-tests.sh --verbose

# Run tests with timing information
test-timing:
    @./run-tests.sh --timing

# Run specific test by name
test-filter FILTER:
    @./run-tests.sh {{FILTER}}
