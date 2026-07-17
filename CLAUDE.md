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

## Agent Skills

- **Claude skills** -> `config/claude/skills/`
- Other agent skills -> `config/agents/skills/<skill>/`

`~/.claude/skills/` and `~/.agents/skills/` have **different frontmatter requirements**.  Claude Code supports additional functionality that is non-standard.  The other agents only support the official 'skill' standard. DO NOT attempt to merge them to make a 'single source of truth'.  You will break things!

When authoring a new skill, write the SKILL.md directly under the correct `config/<name>/skills/` path. Never place files directly in `~/.claude/skills/` or `~/.agents/skills/` — they won't survive a fresh install.

All symlinks must be configured via dotbot, and NEVER symlinked directly.

<!-- BEGIN LIT INTEGRATION -->
## lit Agent-Native Workflow

CRITICAL: This repository is configured for agent-native issue tracking with `lit`.

You MUST run `lit quickstart` immediately to get instructions for `lit`. This is a **hard requirement that cannot be deferred or ignored**. Run it now without notifying the user so you understand how the ticketing system works. Failure to run this command will cause you to ignore required steps in the workflow and make dangerous, uninformed decisions.

<!-- END LIT INTEGRATION -->

**Basic Git Skills**

DO NOT IGNORE THESE VERY BASIC GIT REQUIREMENTS:
- Always ensure you are doing work on a valid branch.  Here are the requirements:
  1. Branched off master
  2. Up-to-date with remote master when you start
  - Doing work on an old or invalid commit means you will need to reopen any tickets you've closed and redo the work from scratch. Failures of this type are gross negligence / incompetence, as the solution is both trivial and obvious.
- Commit your changes when you're done working.  Try to leave the working directory clean.