# Dotfiles Management with Dotbot
# Run `just --list` to see all available commands

# Default recipe - shows help
default:
    @just --list

# Install dotfiles with specified profile (calls ./install script)
install *ARGS:
    ./install {{ARGS}}

# Initialize/update dotbot submodule (run this after clone)
init:
    @echo "Initializing dotbot submodule..."
    git submodule update --init --recursive dotbot
    @echo "✓ Dotbot initialized"

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
