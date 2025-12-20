# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Personal dotfiles managed with [Dotbot](https://github.com/anishathalye/dotbot) using configuration composition for multiple profiles (home/work).

## Common Commands

```bash
# Install dotfiles (choose profile)
just install home    # Personal environment
just install work    # Work environment
just install base    # Base only

# Initialize after clone
just init            # Sets up dotbot submodule

# Check current state
just status          # Show active profile
just validate        # Validate YAML configs

# Testing
just test            # Run all bats tests
just test-verbose    # With verbose output
just test-filter <name>  # Run specific test
bats tests/functional/   # Direct bats invocation
```

## Architecture

### Configuration Composition

Dotbot runs sequentially through config files. Later configs override earlier ones:

```
install-base.conf.yaml    →  Core configs (git, tmux, nvim, aider)
install-home.conf.yaml    →  Profile overrides (zshrc, rad-plugins, mackup)
install-rad.conf.yaml     →  rad-shell plugin system
install-claude.conf.yaml  →  Claude Code settings
```

The `./install <profile>` script orchestrates this sequence.

### Directory Structure

- `config/` - All configuration files organized by tool (zshrc, tmux, nvim, etc.)
- `install-*.conf.yaml` - Dotbot configurations defining symlink mappings
- `tests/` - Bats functional tests
- `scripts/` - Helper scripts (merge-json.sh, etc.)
- `bin/` - Utility scripts (validate)

### Profile Files

Each tool may have multiple variants:
- `*.global.*` - Shared across all profiles (linked by install-base)
- `*.home.*` - Home profile specific (linked by install-home)
- `*.work.*` - Work profile specific (linked by install-work)

## Critical Rules

- **Never remove files** - only remove symlinks, and document with timestamp
- **Backup before deleting** - move regular files/directories to timestamped backup location
- **Test after changes** - run `just test` to validate
- **Keep configs valid** - run `just validate` before committing YAML changes

## Testing Philosophy

Tests are designed to be "un-gameable" - they validate actual outcomes, not implementation details. See `TESTING.md` for the full philosophy.
