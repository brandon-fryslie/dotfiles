---
name: "do-bd-cli"
description: "Use the bd (beads) CLI for persistent issue tracking across sessions. Invoke when work spans multiple sessions, has complex dependencies, or requires context preservation across compaction cycles. Provides git-backed memory that survives context window resets."
---

# bd CLI - Persistent Agent Memory

## What bd Solves

bd gives you **institutional memory** that survives:
- Context window resets / compaction events
- Session boundaries
- Multi-agent coordination

**Key insight**: If work will need context in 2+ weeks, or could span multiple sessions, use bd. Otherwise TodoWrite is sufficient.

## When to Use bd vs TodoWrite

| Use bd when | Use TodoWrite when |
|-------------|-------------------|
| Multi-session work | Single-session tasks |
| Complex dependencies | Linear execution |
| Need context after compaction | Immediate context sufficient |
| Knowledge work with fuzzy scope | Simple checklist tracking |

**Rule of thumb**: If resuming after 2 weeks would be difficult without notes, use bd.

## Session Lifecycle

### Start
```bash
bd ready --json       # Find unblocked work
bd stale --days 30    # Find forgotten issues
bd list --status in_progress --json  # Check active work
```

### During Work
```bash
# Claim work
bd update <id> --status in_progress --json

# Create discovered work (link back to parent)
bd create "Found bug" --description="Details..." -t bug -p 1 --deps discovered-from:<parent-id> --json

# Update progress
bd update <id> --notes "COMPLETED: X. IN PROGRESS: Y. NEXT: Z"
```

### End (MANDATORY)
```bash
bd sync  # Force immediate export/commit/push - DO NOT SKIP
```

**CRITICAL**: Always run `bd sync` at session end. Without it, changes sit in debounce window and never reach git.

## Essential Commands

### Create Issues (ALWAYS include description)
```bash
bd create "Title" --description="Why this exists and what needs doing" -t bug|feature|task -p 0-4 --json
```

**Bad**: `bd create "Fix bug" -t bug --json` (no context!)
**Good**: `bd create "Fix auth race condition" --description="Login fails intermittently when two requests hit auth/login.go:45 simultaneously. Discovered during load testing." -t bug -p 1 --json`

### Manage Work
```bash
bd update <id> --status in_progress --json   # Claim
bd close <id> --reason "Implemented" --json  # Complete
bd show <id> --json                          # View details
bd list --status open --priority 1 --json    # Filter
```

### Dependencies
```bash
# Create and link in one command (preferred)
bd create "Found issue" -t bug -p 1 --deps discovered-from:<parent> --json

# Or link separately
bd dep add <new-id> <parent-id> --type discovered-from
```

## The Dependency Inversion Gotcha

**CRITICAL**: Temporal language INVERTS dependency direction!

**WRONG** (temporal thinking):
```bash
# "Phase 1 before Phase 2" → your brain says phase1 blocks phase2
bd dep add phase1 phase2  # BACKWARDS! Says phase1 depends on phase2
```

**RIGHT** (requirement thinking):
```bash
# "Task B needs Task A" → B depends on A
bd dep add task-b task-a  # Correct! B depends on A
```

**Mnemonic**: `bd dep add <dependent> <prerequisite>` - the thing that NEEDS goes first.

**Verify**: Run `bd blocked` - tasks should be blocked BY their prerequisites.

## Four Dependency Types

| Type | Purpose | Affects ready? |
|------|---------|----------------|
| `blocks` | Hard prerequisite | Yes |
| `related` | Soft connection | No |
| `parent-child` | Epic/subtask hierarchy | No |
| `discovered-from` | Found during work | No |

Only `blocks` affects `bd ready`. Use `discovered-from` to link work you find during implementation.

**For deep dive**: See [references/DEPENDENCIES.md](references/DEPENDENCIES.md)

## Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default)
- `3` - Low (polish)
- `4` - Backlog (future ideas)

## Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - General work item
- `epic` - Large feature with subtasks
- `chore` - Maintenance

## Writing Good Notes

Notes should enable recovery after compaction (zero conversation history):

**Good**:
```
COMPLETED: JWT auth with RS256 (1hr access, 7d refresh)
KEY DECISION: RS256 over HS256 per security review
IN PROGRESS: Password reset flow - email working
NEXT: Add rate limiting (5 attempts/15min)
BLOCKER: Waiting on user decision for token expiry
```

**Bad**:
```
Working on auth. Made progress. More to do.
```

## Discovered Work Pattern

While working on bd-100, you find a bug:

```bash
bd create "Race condition in session manager" \
  --description="Found while implementing bd-100. Two goroutines write to channel without sync." \
  -t bug -p 1 --deps discovered-from:bd-100 --json
```

This:
1. Creates the issue with full context
2. Links it to the parent work
3. Automatically inherits parent's `source_repo`

## Epic Work Breakdown

```bash
# Create epic
bd create "Auth System" -t epic -p 1 --json
# Returns: bd-a3f8e9

# Create child tasks (auto-numbered)
bd create "Design login UI" -p 1 --json       # bd-a3f8e9.1
bd create "Backend validation" -p 1 --json    # bd-a3f8e9.2
bd create "Integration tests" -p 1 --json     # bd-a3f8e9.3
```

## Duplicate Detection

Before creating, check for existing similar issues:
```bash
bd list --title-contains "auth" --json
bd duplicates --json        # Find content duplicates
bd merge <source> --into <target> --json  # Consolidate
```

## Context & Maintenance

### bd prime - Context Injection

Outputs bd workflow context for hooks. Prevents forgetting bd after compaction.

```bash
bd prime        # Auto-detects mode, outputs workflow reminders
bd prime --full # Force full CLI reference (~1-2k tokens)
```

Use in SessionStart or PreCompact hooks.

### bd compact - Memory Decay (Chores)

Summarize old closed issues to reduce database size:

```bash
bd compact --analyze --json                          # Get candidates
bd compact --apply --id bd-42 --summary summary.txt  # Apply your summary
bd compact --stats --json                            # Statistics
```

### bd stale - Find Forgotten Work

```bash
bd stale --days 30 --json  # Issues not updated in 30 days
```

## Multi-Agent Coordination (Agent Mail)

Optional real-time coordination for multiple agents on same repo.

**Check if enabled**: `bd info --json | grep agent_mail`

**Benefits** (when configured):
- <100ms latency vs 2-5s git sync
- Collision prevention via reservations

**Without Agent Mail**: Uses git-based eventual consistency. Works fine for single-agent workflows.

**For setup**: See [references/OPERATIONS.md](references/OPERATIONS.md)

## Reference Files

| Topic | File |
|-------|------|
| Complete CLI reference | [references/CLI_COMMANDS.md](references/CLI_COMMANDS.md) |
| Dependency types deep dive | [references/DEPENDENCIES.md](references/DEPENDENCIES.md) |
| Session workflows | [references/SESSION_LIFECYCLE.md](references/SESSION_LIFECYCLE.md) |
| Best practices & anti-patterns | [references/BEST_PRACTICES.md](references/BEST_PRACTICES.md) |
| Operations (prime, compact, Agent Mail) | [references/OPERATIONS.md](references/OPERATIONS.md) |
