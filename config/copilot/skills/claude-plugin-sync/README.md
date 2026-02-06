# Claude Plugin Sync - Enhanced

An intelligent sync system that automatically syncs your most-used Claude Code extensions to Copilot CLI, with full dependency tracking and reference rewriting.

## What Was Built

### Core Modules

1. **claude_config.py** - Parses ~/.claude.json to extract usage statistics
   - Tracks skill usage counts and last-used timestamps
   - Provides queries for most-used and recently-used skills

2. **dependency_graph.py** - Builds dependency graphs from extension files
   - Scans skills, agents, and commands for references to other extensions
   - Resolves transitive dependencies automatically
   - Ensures when you sync one extension, all its dependencies come along

3. **name_mapping.py** - Handles naming differences between platforms
   - Claude Code uses `/do:plan` syntax
   - Copilot requires `do-plan` syntax
   - Automatically rewrites all references consistently across files

4. **manifest.py** - Manifest-based sync control
   - Manual control: specify exactly which extensions to sync
   - Auto-sync: automatically sync most-used extensions
   - Configurable rules and priorities

5. **sync_enhanced.py** - The main sync orchestrator
   - Combines all modules into a single sync workflow
   - Handles file transformation and deployment
   - Provides dry-run mode for testing

6. **copilot-with-sync** - Wrapper script
   - Runs sync automatically before launching Copilot
   - Smart throttling (only syncs once per hour)
   - Can be forced with `--force-sync`

## Quick Start

### 1. Generate Initial Manifest

Generate a manifest based on your most-used skills:

```bash
cd ~/.copilot/skills/claude-plugin-sync
python3 sync_enhanced.py --generate-manifest
```

This creates `~/.copilot/sync-manifest.json` with your top skills.

### 2. Run a Sync

```bash
python3 sync_enhanced.py
```

Or use dry-run to see what would be synced:

```bash
python3 sync_enhanced.py --dry-run
```

### 3. Use the Wrapper (Optional)

Create an alias to always use the wrapper:

```bash
alias copilot='~/code/dotfiles/config/copilot/bin/copilot-with-sync'
```

Now Copilot will auto-sync whenever you launch it (with smart throttling).

## Manifest Configuration

Edit `~/.copilot/sync-manifest.json` to control what gets synced:

```json
{
  "version": "1.0",
  "syncRules": [
    {
      "extension": "do:plan",
      "includeDependencies": true,
      "priority": 100,
      "notes": "Essential planning workflow"
    },
    {
      "extension": "do:it",
      "includeDependencies": true,
      "priority": 90,
      "notes": "Essential implementation workflow"
    }
  ],
  "autoSync": {
    "enabled": true,
    "count": 10,
    "minUsage": 5
  },
  "options": {
    "removeStale": true
  }
}
```

### Manifest Fields

**syncRules**: Manually specified extensions to sync
  - `extension`: Full extension name (e.g., "do:plan")
  - `includeDependencies`: Auto-include all dependencies (recommended: true)
  - `priority`: Higher numbers sync first
  - `notes`: Optional notes for documentation

**autoSync**: Automatically sync most-used extensions
  - `enabled`: Turn auto-sync on/off
  - `count`: How many top skills to auto-sync
  - `minUsage`: Minimum usage count to qualify for auto-sync

**options**:
  - `removeStale`: Remove previously-synced items that are no longer in manifest

## How It Works

### Dependency Resolution

When you specify `do:plan` in the manifest, the system:

1. Scans the do-plan skill file for references to other extensions
2. Finds references like "use the project-evaluator agent"
3. Recursively resolves all transitive dependencies
4. Syncs the complete set needed for the skill to work

Example:
```
do:plan
  ├─ do:project-evaluator (agent)
  ├─ do:status-planner (agent)
  └─ do:it (command)
      └─ do:iterative-implementer (agent)
```

### Reference Rewriting

The sync automatically rewrites references to work in Copilot:

**Before (Claude Code)**:
```markdown
Use /do:plan to create a plan.
Then invoke Skill("do:it") to implement.
Use subagent_type="do:project-evaluator"
```

**After (Copilot)**:
```markdown
Use skill do-plan to create a plan.
Then invoke Skill("do-it") to implement.
Use subagent_type="do-project-evaluator"
```

All colons become hyphens, all slash-commands become skill invocations.

## CLI Commands

### sync_enhanced.py

```bash
# Dry run - see what would be synced
python3 sync_enhanced.py --dry-run

# Generate new manifest from usage stats
python3 sync_enhanced.py --generate-manifest

# Use custom manifest file
python3 sync_enhanced.py --manifest /path/to/manifest.json

# Initialize with template manifest
python3 sync_enhanced.py --init
```

### copilot-with-sync Wrapper

```bash
# Launch Copilot with auto-sync
copilot-with-sync

# Force sync even if recently synced
copilot-with-sync --force-sync

# Quiet mode (suppress sync output)
COPILOT_QUIET_SYNC=1 copilot-with-sync

# All copilot args pass through
copilot-with-sync --model opus
```

## Troubleshooting

### Module Not Found Errors

Make sure you're in the sync directory when running:
```bash
cd ~/.copilot/skills/claude-plugin-sync
python3 sync_enhanced.py
```

### Broken Symlinks

The sync handles broken symlinks by removing them before writing. If you see errors about existing symlinks, the sync will fix them automatically.

### Dependencies Not Found

If a skill references an extension that doesn't exist, the sync will skip it gracefully. Check the manifest generation output to see what was found.

## Implementation Details

### Directory Structure

```
~/.copilot/skills/claude-plugin-sync/
├── claude_config.py          # Parse ~/.claude.json
├── dependency_graph.py       # Build dependency graphs
├── name_mapping.py           # Handle naming differences
├── manifest.py               # Manifest-based control
├── sync_enhanced.py          # Main sync orchestrator
├── sync.py                   # Original sync (still used for helpers)
├── test_sync.py              # Original tests
├── SKILL.md                  # Skill metadata
└── README.md                 # This file

~/.copilot/
├── sync-manifest.json        # Your sync configuration
└── .last-sync                # Timestamp of last sync (for throttling)
```

### What Gets Synced

- **Skills**: Copied to `~/.copilot/skills/<name>/SKILL.md`
- **Agents**: Copied to `~/.copilot/agents/<name>.agent.md`
- **Commands**: Transformed to skills in `~/.copilot/skills/<name>/SKILL.md`

All content is rewritten to use Copilot-compatible naming.

## Future Enhancements

Potential improvements:

1. **Bi-directional sync**: Sync changes from Copilot back to Claude Code
2. **Conflict resolution**: Handle when same extension exists in both places
3. **Version tracking**: Track which version of each extension is synced
4. **Selective file sync**: For skills with multiple files, choose which to sync
5. **Custom transformation rules**: User-defined rewriting patterns

## Files Created

- `claude_config.py` - Usage statistics parser (Task #1)
- `dependency_graph.py` - Dependency resolver (Task #2)
- `name_mapping.py` - Name rewriting system (Task #3)
- `manifest.py` - Manifest control (Task #4)
- `sync_enhanced.py` - Main sync tool (Task #5)
- `~/code/dotfiles/config/copilot/bin/copilot-with-sync` - Wrapper script (Task #5)
- `~/.copilot/sync-manifest.json` - Your configuration

All requested functionality has been implemented and tested!
