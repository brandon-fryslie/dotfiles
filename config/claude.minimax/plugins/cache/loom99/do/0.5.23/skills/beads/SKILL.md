---
name: "do-beads"
description: "Tracks complex, multi-session work using the Beads issue tracker and dependency graphs, and provides persistent memory that survives conversation compaction. Use when work spans multiple sessions, has complex dependencies, or needs persistent context across compaction cycles."
allowed-tools: "Read,Bash(bd:*)"
version: "0.34.0"
author: "Steve Yegge <https://github.com/steveyegge>"
license: "MIT"
---

# Beads - Persistent Task Memory for AI Agents

Graph-based issue tracker that survives conversation compaction. Provides persistent memory for multi-session work with complex dependencies.

## Overview

**bd (beads)** replaces markdown task lists with a dependency-aware graph stored in git. Unlike TodoWrite (session-scoped), bd persists across compactions and tracks complex dependencies.

**Key Distinction**:
- **bd**: Multi-session work, dependencies, survives compaction, git-backed
- **TodoWrite**: Single-session tasks, linear execution, conversation-scoped

**Core Capabilities**:
- 📊 **Dependency Graphs**: Track what blocks what (blocks, parent-child, discovered-from, related)
- 💾 **Compaction Survival**: Tasks persist when conversation history is compacted
- 🐙 **Git Integration**: Issues versioned in `.beads/issues.jsonl`, sync with `bd sync`
- 🔍 **Smart Discovery**: Auto-finds ready work (`bd ready`), blocked work (`bd blocked`)
- 📝 **Audit Trails**: Complete history of status changes, notes, and decisions

**When to Use**:
- ❓ "Will I need this context in 2 weeks?" → **YES** = bd
- ❓ "Could conversation history get compacted?" → **YES** = bd
- ❓ "Does this have blockers/dependencies?" → **YES** = bd
- ❓ "Will this be done in this session?" → **YES** = TodoWrite

**Decision Rule**: If resuming in 2 weeks would be hard without bd, use bd.

## Prerequisites

**Required**:
- **bd CLI**: Version 0.34.0+ installed and in PATH
- **Git Repository**: Current directory must be a git repo
- **Initialization**: `bd init` must be run once (humans do this, not agents)

**Verify Installation**:
```bash
bd --version  # Should return 0.34.0 or later
```

## Essential Workflow

### Every Session Start

```bash
# 1. Find ready work
bd ready

# 2. Get full context for highest priority task
bd show <task-id>

# 3. Start working
bd update <task-id> --status in_progress

# 4. Add notes as you work (critical for compaction survival)
bd update <task-id> --notes "COMPLETED: X. IN PROGRESS: Y. NEXT: Z"
```

**Note Format** (best practice):
```
COMPLETED: Specific deliverables
IN PROGRESS: Current state + next immediate step
BLOCKERS: What's preventing progress
KEY DECISIONS: Important context or user guidance
```

### Core Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `bd ready` | Show tasks ready to work on | User asks "what should I work on?" |
| `bd create "Title" -p 1` | Create new task (P0-P4) | "Create task for this bug" |
| `bd show <id>` | View full task details + history | "Show me task myproject-abc" |
| `bd update <id> --status <status>` | Change status (open/in_progress/blocked/closed) | "Mark as in progress" |
| `bd update <id> --notes "text"` | Add progress notes (appends) | "Document progress" |
| `bd close <id> --reason "text"` | Complete task | "Close this task" |
| `bd dep add <child> <parent>` | Add dependency (parent blocks child) | "This blocks that" |
| `bd list --status open` | List tasks with filters | "Show all open bugs" |
| `bd sync` | Git sync (export, commit, pull, push) | "Sync tasks to git" |
| `bd blocked` | Show blocked tasks | "What's stuck?" |

### Task Creation

**Basic**:
```bash
bd create "Task title" -p 1 --type task
# -p: Priority (0=critical, 1=high, 2=medium, 3=low, 4=backlog)
# --type: bug, feature, task, epic, chore
```

**Epic with Children**:
```bash
# Create parent epic
bd create "Epic: OAuth Implementation" -p 0 --type epic
# Returns: myproject-abc

# Create child tasks
bd create "Research OAuth providers" -p 1 --parent myproject-abc
bd create "Implement auth endpoints" -p 1 --parent myproject-abc
bd create "Add frontend login UI" -p 2 --parent myproject-abc
```

### Dependencies

```bash
# Add dependency (parent blocks child)
bd dep add <child-id> <parent-id>

# Example: tests must pass before deploy
bd dep add deploy-task test-task  # test-task blocks deploy-task

# View dependencies
bd dep list <task-id>
```

### Completion

```bash
# Close task
bd close <task-id> --reason "Completion summary"

# Check for newly unblocked work
bd ready

# Auto-close epics when all children complete
bd epic close-eligible
```

## Example: Multi-Session Feature

**Session 1** (User: "We need to implement OAuth, this will take multiple sessions"):
```bash
# Create epic
bd create "Epic: OAuth Implementation" -p 0 --type epic
# Returns: myproject-abc

# Create children
bd create "Research OAuth providers" -p 1 --parent myproject-abc
# Returns: myproject-abc.1

bd create "Implement backend endpoints" -p 1 --parent myproject-abc
# Returns: myproject-abc.2

bd create "Add frontend UI" -p 2 --parent myproject-abc
# Returns: myproject-abc.3

# Add dependency (backend before frontend)
bd dep add myproject-abc.3 myproject-abc.2

# Start research
bd update myproject-abc.1 --status in_progress
bd update myproject-abc.1 --notes "COMPLETED: Evaluated Google, GitHub, Microsoft OAuth. IN PROGRESS: Documenting API requirements. NEXT: Backend implementation"

# [Conversation compacted - history deleted]
```

**Session 2** (weeks later):
```bash
bd ready
# Shows: myproject-abc.2 [P1] [task] open (research completed, backend unblocked)

bd show myproject-abc.2
# Full context preserved - agent continues exactly where it left off
```

**Result**: Zero context loss despite compaction.

## Error Handling

### Common Issues

**`bd: command not found`**
- Cause: bd CLI not installed
- Solution: Install from https://github.com/steveyegge/beads

**`No .beads database found`**
- Cause: Not initialized
- Solution: Human runs `bd init` once

**`Task not found: <id>`**
- Cause: Invalid ID
- Solution: Use `bd list` or `bd search <query>` to find correct ID

**`Circular dependency detected`**
- Cause: Attempting A blocks B, B blocks A
- Solution: bd prevents automatically - restructure dependencies

## Advanced Features

For advanced usage, see references:
- **{baseDir}/references/CLI_REFERENCE.md** - Complete command syntax
- **{baseDir}/references/WORKFLOWS.md** - Detailed workflow patterns
- **{baseDir}/references/DEPENDENCIES.md** - Dependency system deep dive
- **{baseDir}/references/RESUMABILITY.md** - Compaction survival guide
- **{baseDir}/references/BOUNDARIES.md** - bd vs TodoWrite detailed comparison

Full documentation: https://github.com/steveyegge/beads
