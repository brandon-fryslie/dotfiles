# Copilot CLI Instructions

## Session Start

On every new session, automatically run the Claude plugin sync to ensure all skills and agents are available:

```bash
python3 ~/.copilot/skills/claude-plugin-sync/sync.py
```

This syncs skills and agents from your active Claude Code plugins to Copilot CLI.

## Available Capabilities

After syncing, you have access to skills and agents from all installed Claude plugins. Check `~/.copilot/claude-sync-manifest.json` for the full list of synced capabilities.

## Skill Prefixes

All synced items use the `claude-` prefix:
- Skills: `claude-<plugin>-<skill-name>`
- Agents: `claude-<plugin>-<agent-name>.md`

## Refreshing

If skills or agents seem missing, re-run the sync:
```bash
python3 ~/.copilot/skills/claude-plugin-sync/sync.py
```
