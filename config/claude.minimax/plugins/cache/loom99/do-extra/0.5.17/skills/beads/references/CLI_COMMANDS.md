# bd CLI Command Reference

Complete reference for all bd commands. Use `--json` flag for programmatic output.

## Discovery & Planning

### Find Ready Work
```bash
bd ready --json                    # Unblocked issues
bd ready --priority 1 --json       # Filter by priority
bd ready --assignee alice --json   # Filter by assignee
bd ready --limit 10 --json         # Limit results
```

### Find Stale Issues
```bash
bd stale --days 30 --json                    # Not updated in 30 days
bd stale --days 90 --status in_progress --json  # Filter by status
```

### List Issues
```bash
bd list --json                              # All issues
bd list --status open --json                # By status
bd list --priority 1 --json                 # By priority
bd list --type bug --json                   # By type
bd list --assignee alice --json             # By assignee
bd list --id bd-123,bd-456 --json           # Specific IDs

# Label filters
bd list --label bug,critical --json         # Has ALL labels (AND)
bd list --label-any frontend,backend --json # Has ANY label (OR)

# Text search
bd list --title-contains "auth" --json      # Title substring
bd list --desc-contains "implement" --json  # Description substring
bd list --notes-contains "TODO" --json      # Notes substring

# Date filters
bd list --created-after 2024-01-01 --json
bd list --updated-after 2024-06-01 --json
bd list --closed-after 2024-01-01 --json

# Empty/null checks
bd list --empty-description --json          # No description
bd list --no-assignee --json                # Unassigned
bd list --no-labels --json                  # No labels

# Priority ranges
bd list --priority-min 0 --priority-max 1 --json  # P0 and P1 only

# Combine filters
bd list --status open --priority 1 --label-any urgent,critical --no-assignee --json
```

### Show Issue Details
```bash
bd show <id> --json                # Single issue
bd show <id1> <id2> --json         # Multiple issues
```

### Statistics
```bash
bd stats --json                    # Project health metrics
bd blocked --json                  # Show blocked issues
```

## Issue Creation

### Basic Creation
```bash
bd create "Title" --json
bd create "Title" -t bug -p 1 --json
bd create "Title" --description="Details" -t feature -p 2 --json
```

**Always include `--description`** - issues without context create debt.

### With Labels
```bash
bd create "Title" -l bug,critical --json
bd create "Title" --label backend,urgent --json
```

### With Dependencies (One Command)
```bash
bd create "Found bug" -t bug -p 1 --deps discovered-from:<parent-id> --json
bd create "Subtask" -p 1 --deps blocks:<blocker-id> --json
```

### Create Epic with Children
```bash
# Create parent epic
bd create "Auth System" -t epic -p 1 --json  # Returns: bd-a3f8e9

# Children auto-numbered under parent
bd create "Login UI" -p 1 --json              # bd-a3f8e9.1
bd create "Backend" -p 1 --json               # bd-a3f8e9.2
```

### From Markdown File
```bash
bd create -f feature-plan.md --json
```

### With Explicit ID
```bash
bd create "Title" --id worker1-100 -p 1 --json  # For parallel workers
```

## Issue Updates

### Status Changes
```bash
bd update <id> --status in_progress --json
bd update <id> --status blocked --json
bd update <id1> <id2> --status in_progress --json  # Multiple
```

### Field Updates
```bash
bd update <id> --priority 0 --json
bd update <id> --assignee bob --json
bd update <id> --notes "COMPLETED: X. NEXT: Y" --json
bd update <id> --design "Using JWT with RS256" --json
```

### Close/Reopen
```bash
bd close <id> --reason "Done" --json
bd close <id1> <id2> <id3> --reason "Batch complete" --json
bd reopen <id> --reason "Issue persists" --json
```

## Dependencies

### Add Dependencies
```bash
# blocks (hard prerequisite)
bd dep add <prerequisite> <blocked> --type blocks

# discovered-from (found during work)
bd dep add <original-work> <discovered> --type discovered-from

# parent-child (epic/subtask)
bd dep add <parent> <child> --type parent-child

# related (soft link)
bd dep add <issue1> <issue2> --type related
```

### Remove Dependencies
```bash
bd dep remove <from-id> <to-id>
```

### Visualize
```bash
bd dep tree <id>      # Show dependency tree
bd dep cycles         # Check for circular deps
```

## Labels

```bash
bd label add <id> urgent --json
bd label add <id1> <id2> critical --json    # Multiple issues
bd label remove <id> urgent --json
bd label list <id> --json                   # Labels on issue
bd label list-all --json                    # All labels with counts
```

## Sync & Database

### Sync (CRITICAL)
```bash
bd sync  # Force immediate export/commit/push
```

**Always run at session end** - bypasses 30s debounce.

### Import/Export
```bash
bd export -o issues.jsonl          # Manual export
bd import -i issues.jsonl          # Manual import
bd import -i issues.jsonl --dry-run  # Preview changes
bd import -i issues.jsonl --dedupe-after  # Import + detect dupes
```

### Orphan Handling During Import
```bash
bd import -i issues.jsonl --orphan-handling allow      # Default
bd import -i issues.jsonl --orphan-handling resurrect  # Recreate deleted parents
bd import -i issues.jsonl --orphan-handling skip       # Skip orphans
bd import -i issues.jsonl --orphan-handling strict     # Fail on missing parent
```

## Daemon Management

```bash
bd daemons list --json          # List all running
bd daemons health --json        # Check version mismatches
bd daemons killall --json       # Restart all (after upgrade)
bd daemons logs . -n 100        # View logs
```

## Cleanup & Maintenance

### Delete Issues
```bash
bd delete <id> --force --json
bd delete <id1> <id2> --force --json
bd delete <id> --cascade --force --json  # Delete dependents too
```

### Cleanup Closed Issues
```bash
bd cleanup --force --json               # All closed
bd cleanup --older-than 30 --force --json  # Closed >30 days
bd cleanup --dry-run --json             # Preview
```

### Duplicate Detection
```bash
bd duplicates --json           # Find duplicates
bd duplicates --auto-merge     # Auto-merge all
bd duplicates --dry-run        # Preview

bd merge <source> --into <target> --json
bd merge <s1> <s2> --into <target> --dry-run --json
```

### Compaction (Memory Decay)
```bash
bd compact --analyze --json              # Get candidates
bd compact --apply --id <id> --summary summary.txt  # Apply
bd compact --stats --json                # Show statistics
```

## Global Flags

```bash
--json              # Machine-readable output
--no-daemon         # Direct mode (for git worktrees)
--no-auto-flush     # Disable auto-export
--no-auto-import    # Disable auto-import
--sandbox           # Auto-detect sandboxed environments
--allow-stale       # Skip staleness check (emergency)
--db /path/to/db    # Custom database path
--actor alice       # Custom actor for audit trail
```

## Info & Diagnostics

```bash
bd info --json              # Database path, daemon status
bd info --whats-new --json  # Recent changes (after upgrade)
bd info --schema --json     # Schema and config
bd doctor                   # Health check
bd version                  # CLI version
```
