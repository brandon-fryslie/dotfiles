## Work Tracking: bd (beads) + .agent_planning

**IMPORTANT**: This project uses **two complementary systems** for work management:

| System | Use For | Examples |
|--------|---------|----------|
| **bd (beads)** | Concrete work items, tasks, bugs | Stories, bugs, tasks, epics with dependencies |
| **.agent_planning/** | Strategic docs, research, architecture | STATUS reports, PLAN docs, research results, ADRs |

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Persistent: Survives context window resets and session boundaries

### Why .agent_planning/?

- Strategic planning: High-level decisions, architecture, evaluations
- Research results: Investigation outcomes, competitive analysis
- Status tracking: Implementation state, gap analysis
- Context preservation: Documents that inform but don't prescribe specific tasks

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready --json` shows unblocked issues
2. **Review planning docs**: Check `.agent_planning/` for context (STATUS, PLAN, research)
3. **Claim your task**: `bd update <id> --status in_progress --json`
4. **Work on it**: Implement, test, document
5. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id> --json`
6. **Update planning docs**: Add research results, status updates to `.agent_planning/`
7. **Complete**: `bd close <id> --reason "Done" --json`
8. **Commit together**: Always commit `.beads/issues.jsonl` with code/docs so state stays in sync

### Cross-Referencing beads ↔ .agent_planning

**From beads → planning docs:**
```bash
bd create "Implement auth system" \
  --description="See .agent_planning/PLAN-auth-2024-12-12.md for full design" \
  -t feature -p 1 --json
```

**From planning docs → beads:**
```markdown
# .agent_planning/PLAN-auth-2024-12-12.md

## Implementation Tracking
- bd-abc123: JWT token generation
- bd-def456: Session management
- bd-ghi789: Password reset flow
```

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### CLI Usage (do-more-now plugin)

This plugin uses the `bd` CLI directly. Always include `--json` flag for programmatic use:

```bash
# Good - JSON output for parsing
bd ready --json
bd create "Task" -p 1 --json
bd update bd-123 --status in_progress --json

# Bad - Human-readable output (harder to parse)
bd ready
bd create "Task" -p 1
```

### Strategic Planning Documents (.agent_planning/)

Strategic planning and research documents live in `.agent_planning/`:

**Document Types:**
- `EVALUATION-*.md` - Current implementation state (from project-evaluator)
- `PLAN-*.md` - Implementation plans (from status-planner)
- `BACKLOG-*.md` - Prioritized work items
- `RESEARCH-*.md` - Investigation results, competitive analysis
- Architecture Decision Records (ADRs)
- Design documents for complex features

**Relationship with beads:**
- Planning docs describe WHAT and WHY (strategy, architecture, research)
- Beads tracks WHO, WHEN, and progress (concrete tasks with dependencies)
- Cross-reference between them for full context

**Example workflow:**
1. project-evaluator writes `EVALUATION-auth-2024-12-12.md` (gap analysis)
2. status-planner writes `PLAN-auth-2024-12-12.md` (implementation plan)
3. status-planner creates beads issues for each work item
4. iterative-implementer claims bd-123, references plan in notes
5. Work proceeds, discoveries captured as new beads issues
6. On completion, bd-123 closed, `.agent_planning/` updated with outcomes

### Important Rules

**DO:**
- ✅ Use bd for ALL concrete work items (tasks, bugs, features)
- ✅ Use .agent_planning/ for strategic docs (plans, research, architecture)
- ✅ Always use `--json` flag for programmatic bd commands
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Cross-reference between beads issues and .agent_planning/ docs
- ✅ Check `bd ready --json` before asking "what should I work on?"
- ✅ Commit `.beads/issues.jsonl` with code changes

**DON'T:**
- ❌ Do NOT create markdown TODO lists (use bd instead)
- ❌ Do NOT use external issue trackers (bd is the single source of truth)
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT put strategy docs in beads descriptions (use .agent_planning/)
- ❌ Do NOT put individual tasks in .agent_planning/ (use beads)

For more beads details, see `skills/beads/SKILL.md` and `skills/beads/references/`.