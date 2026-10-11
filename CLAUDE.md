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
- **Keep configs valid** - run `just validate` before committing YAML changes
- **Claude Code settings are split in two.** The stable baseline (permissions, hooks,
  statusLine, always-on plugins and their marketplaces, hand-set keys like attribution) is `config/claude/settings.managed.json`.
  `scripts/install-claude-managed-settings.sh` (run by `just install`) copies it,
  root-owned, to `/Library/Application Support/ClaudeCode/managed-settings.json`, which
  Claude Code loads with no flag and never writes. Copy, not symlink: Claude Code won't
  read a managed file through a link. Editing the baseline means re-running the install,
  which asks for sudo when the file changed. `~/.claude/settings.json` is untracked and
  belongs to Claude Code (model, effort, plugin toggles); leave it out of git. The
  install strips from it whatever the baseline already sets, so the baseline has one home. Never put
  `model` or `effortLevel` in the baseline - a managed value can't be overridden, so
  `/model` would stop working - and never a plugin set to `false`, which managed settings
  turn into an install block at every scope.

## Agent Skills

- **Claude skills** -> `config/claude/skills/`
- Other agent skills -> `config/agents/skills/<skill>/`

`~/.claude/skills/` and `~/.agents/skills/` have **different frontmatter requirements**.  Claude Code supports additional functionality that is non-standard.  The other agents only support the official 'skill' standard. DO NOT attempt to merge them to make a 'single source of truth'.  You will break things!

When authoring a new skill, write the SKILL.md directly under the correct `config/<name>/skills/` path. Never place files directly in `~/.claude/skills/` or `~/.agents/skills/` — they won't survive a fresh install.

All symlinks must be configured via dotbot, and NEVER symlinked directly.

<!-- BEGIN LIT INTEGRATION -->
## lit Agent-Native Workflow

This repository uses `lit` for agent-native issue tracking.

Start by running `lit quickstart` to load the workflow instructions. It prints how tickets are found, created, updated, and closed here, so running it first means the rest of your work follows the conventions this repo expects. It's a quick, read-only command — no need to check in before running it.

<!-- END LIT INTEGRATION -->

**Basic Git Skills**

DO NOT IGNORE THESE VERY BASIC GIT REQUIREMENTS:
- Always ensure you are doing work on a valid branch.  Here are the requirements:
  1. Branched off master
  2. Up-to-date with remote master when you start
  - Doing work on an old or invalid commit means you will need to reopen any tickets you've closed and redo the work from scratch. Failures of this type are gross negligence / incompetence, as the solution is both trivial and obvious.
- Commit your changes when you're done working.  Try to leave the working directory clean.