---
name: claude-plugin-sync
description: Syncs active Claude Code plugins (skills and agents) to Copilot CLI. Use this skill at session start, when user mentions Claude plugins, when skills or agents seem missing, when user asks about available capabilities, or when troubleshooting why a skill isn't working.
---

# Claude Plugin Sync

This skill synchronizes your active Claude Code plugins to Copilot CLI, making all skills and agents available in both environments.

## When to Use

- **Session start**: Run automatically when starting a new Copilot CLI session
- **Plugin changes**: After installing, removing, or updating Claude plugins
- **Missing capabilities**: When skills or agents that should exist aren't found
- **Capability discovery**: When user asks "what can you do" or "what skills do you have"
- **Troubleshooting**: When a skill isn't working as expected
- **Manual refresh**: When user explicitly asks to sync or refresh plugins

## Usage

To sync plugins, run the sync script:

```bash
python3 ~/.copilot/skills/claude-plugin-sync/sync.py
```

Or simply ask: "Sync my Claude plugins"

## What Gets Synced

1. **Skills**: All `SKILL.md` files from active plugins → `~/.copilot/skills/`
2. **Agents**: All agent definitions from active plugins → `~/.copilot/agents/`

## Source of Truth

- Active plugins: `~/.claude/plugins/installed_plugins.json`
- Plugin cache: `~/.claude/plugins/cache/`

## Sync Behavior

- Creates symlinks (not copies) to keep everything in sync
- Cleans up stale symlinks from deactivated plugins
- Preserves any manually-created Copilot skills/agents
- Generates a manifest file listing all synced content

## Manifest

The sync maintains a manifest at `~/.copilot/claude-sync-manifest.json` that tracks:
- **Active entries**: Currently synced skills/agents with `status: "active"`
- **Removed entries**: Previously synced items with `status: "removed"`

This allows the sync to:
1. Only clean up symlinks it previously created (not manually added ones)
2. Preserve history of what was synced over time
