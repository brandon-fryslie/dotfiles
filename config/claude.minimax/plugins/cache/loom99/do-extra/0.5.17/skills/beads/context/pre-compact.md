# Beads Workflow - Full Reference (Pre-Compaction)

## Work Tracking: bd + .agent_planning

**Two complementary systems:**

| System | Use For | Examples |
|--------|---------|----------|
| **bd (beads)** | Concrete work items | Stories, bugs, tasks, epics with dependencies |
| **.agent_planning/** | Strategic docs | STATUS, PLAN, research, ADRs |

## Essential Commands

### Finding Work
```bash
bd ready --json                           # Unblocked work
bd stale --days 14 --json                 # Forgotten issues
bd list --status in_progress --json      # Active work
bd list --status open --priority 1 --json # High priority open
```

### Creating Issues
```bash
bd create "Title" -t bug|feature|task -p 0-4 --json
bd create "Title" --description="Details" -t bug -p 1 --json

# With dependencies
bd create "Found bug" -p 1 --deps discovered-from:bd-123 --json
```

### Updating and Completing
```bash
bd update bd-123 --status in_progress --json
bd update bd-123 --priority 1 --json
bd update bd-123 --notes "Progress update" --json
bd close bd-123 --reason "Completed" --json
```

### Dependencies
```bash
# "Task B needs Task A" → B depends on A
bd dep add <dependent> <prerequisite> --type blocks

# Example: bd-456 needs bd-123 done first
bd dep add bd-456 bd-123 --type blocks
```

### Info and Status
```bash
bd show bd-123 --json        # Full details
bd blocked --json            # What's blocked
bd info --json               # Database info
```

## Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

## Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

## AI Agent Workflow

1. **Check ready work**: `bd ready --json`
2. **Review planning docs**: `.agent_planning/` for context
3. **Claim task**: `bd update <id> --status in_progress --json`
4. **Work**: Implement, test, document
5. **Discover work**: `bd create` with `--deps discovered-from:<parent>`
6. **Update planning**: Add results to `.agent_planning/`
7. **Complete**: `bd close <id> --reason "Done" --json`
8. **Commit**: Include `.beads/issues.jsonl` with changes

## Cross-Referencing

**From beads → planning:**
```bash
bd create "Implement auth" \
  --description="See .agent_planning/PLAN-auth-2024-12-12.md" \
  -t feature -p 1 --json
```

**From planning → beads:**
```markdown
# .agent_planning/PLAN-auth.md
## Tracking
- bd-abc123: JWT generation
- bd-def456: Session management
```

## Auto-Sync

bd syncs automatically:
- Exports to `.beads/issues.jsonl` (5s debounce)
- Imports when newer (after git pull)
- No manual sync needed (unless forced with `bd sync`)

## .agent_planning/ Documents

**Types:**
- `EVALUATION-*.md` - Implementation state (project-evaluator)
- `PLAN-*.md` - Implementation plans (status-planner)
- `BACKLOG-*.md` - Prioritized work
- `RESEARCH-*.md` - Investigation results
- ADRs - Architecture decisions

**Usage:**
- Planning docs = WHAT and WHY (strategy)
- Beads = WHO, WHEN, progress (execution)
- Cross-reference for full context

## Important Rules

**DO:**
- ✅ Use bd for concrete work items
- ✅ Use .agent_planning/ for strategic docs
- ✅ Always use `--json` flag
- ✅ Link discovered work with `discovered-from`
- ✅ Cross-reference beads ↔ planning docs
- ✅ Check `bd ready --json` before starting work
- ✅ Commit `.beads/issues.jsonl` with code

**DON'T:**
- ❌ No markdown TODO lists
- ❌ No external issue trackers
- ❌ No duplicate tracking systems
- ❌ Don't put strategy in beads descriptions
- ❌ Don't put individual tasks in .agent_planning/

---

**Full details**: `skills/beads/context/BEADS_WORKFLOW.md` and `skills/beads/references/`
