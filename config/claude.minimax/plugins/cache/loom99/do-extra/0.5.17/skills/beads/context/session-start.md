# Beads Workflow Reminders

**Work Tracking**: This project uses **bd (beads)** for tasks and **.agent_planning/** for strategy.

| System | Use For |
|--------|---------|
| **bd** | Tasks, bugs, features (concrete work items) |
| **.agent_planning/** | Plans, research, architecture (strategic docs) |

## Quick Commands

**Find work:**
```bash
bd ready --json              # Unblocked work
bd list --status in_progress --json  # Active work
```

**Claim and work:**
```bash
bd update bd-123 --status in_progress --json
```

**Create discovered work:**
```bash
bd create "Found bug" -t bug -p 1 --deps discovered-from:bd-123 --json
```

**Complete:**
```bash
bd close bd-123 --reason "Completed" --json
```

## Priorities

- `0` Critical (security, data loss)
- `1` High (major features, important bugs)
- `2` Medium (default)
- `3` Low (polish)
- `4` Backlog (future)

## Key Reminders

- ✅ Always use `--json` flag for bd commands
- ✅ Link discovered work with `--deps discovered-from:<parent-id>`
- ✅ Check `.agent_planning/` for context (STATUS, PLAN docs)
- ✅ Cross-reference between beads and planning docs
- ✅ Commit `.beads/issues.jsonl` with code changes
- ❌ No markdown TODO lists - use bd instead

See `skills/beads/context/BEADS_WORKFLOW.md` for full workflow.
