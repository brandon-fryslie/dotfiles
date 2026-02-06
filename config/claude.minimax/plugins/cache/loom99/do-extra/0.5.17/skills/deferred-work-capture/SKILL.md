---
name: "do-deferred-work-capture"
description: "Capture deferred work items discovered during workflows. Auto-persists to beads with fallback to planning docs. Prevents work from falling through the cracks."
---

# Deferred Work Capture

Capture discovered work that cannot be addressed immediately. Ensures nothing falls through the cracks.

## When to Invoke

Invoke this skill when you discover work that should be tracked but cannot be done now:

- Out-of-scope items during planning
- Questions needing user answers (PAUSE verdicts)
- Bugs found during implementation
- Missing tests identified in audits
- Blocked items needing external resolution
- Incomplete work when user chooses to stop

## Input

Provide as context:

```yaml
title: "Short descriptive title"
description: |
  Full description of what was discovered.
  Include:
  - What triggered the discovery
  - Why it can't be done now
  - What needs to happen
type: bug | task | chore | clarify
priority: 0-4
source_context: "Where discovered (e.g., 'work-evaluator PAUSE for auth feature')"
parent_id: "bd-xxx"  # Optional: link to parent work
blocking: false      # Set true if this blocks current work
```

### Input Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `title` | Yes | - | Short descriptive title (max 80 chars) |
| `description` | Yes | - | Full context: what, why, what's needed |
| `type` | No | `task` | Category: bug, task, chore, clarify |
| `priority` | No | `2` | 0=critical, 1=high, 2=medium, 3=low, 4=backlog |
| `source_context` | No | - | Where discovered (agent name, command, etc.) |
| `parent_id` | No | - | Beads ID to link via `discovered-from` |
| `blocking` | No | `false` | If true, marks as blocking current work |

### Types

| Type | When to Use |
|------|-------------|
| `bug` | Defect found during work |
| `task` | Concrete work item discovered |
| `chore` | Maintenance/cleanup needed |
| `clarify` | Needs user decision (questions needing answers) |

## Process

### Step 1: Deduplication Check

Before creating, check for existing similar work:

```bash
# Check beads for similar titles (if available)
bd list --title-contains "<key-words-from-title>" --json 2>/dev/null || true

# Also check fallback file
grep -i "<key-words>" .agent_planning/DEFERRED-WORK.md 2>/dev/null || true
```

**If duplicate found:**
- Return `duplicate_of` with existing ID
- Do NOT create new entry
- Log: "Duplicate detected - existing: <id>"

### Step 2: Persist to Beads (Primary)

```bash
bd create "$TITLE" \
  --description="$DESCRIPTION

Source: $SOURCE_CONTEXT
Discovered: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t $TYPE \
  -p $PRIORITY \
  ${PARENT_ID:+--deps discovered-from:$PARENT_ID} \
  --json
```

**On success:**
- Parse returned ID from JSON output
- Return `captured_id: <id>`
- Return `action_taken: created`

### Step 3: Fallback to File (If Beads Unavailable)

If `bd create` fails or beads not available, append to `.agent_planning/DEFERRED-WORK.md`.

**Create file if doesn't exist** with header:

```markdown
# Deferred Work Queue

Work items discovered during development that need future attention.
Auto-captured by deferred-work-capture skill.

**To process:**
- Run `/do:deferred-work-cleanup` for comprehensive review
- Run `bd list --status open` if beads available

---
```

**Append entry:**

```markdown
## [TYPE] [TIMESTAMP] $TITLE

**Type**: $TYPE | **Priority**: P$PRIORITY | **Source**: $SOURCE_CONTEXT
**Parent**: $PARENT_ID (if any)
**Status**: $STATUS

### Description
$DESCRIPTION

### Next Steps
- [ ] [Inferred action item based on description]

---
```

Where `$STATUS` is:
- `BLOCKING` if blocking=true
- `PENDING` otherwise

**On fallback:**
- Return `fallback_file: .agent_planning/DEFERRED-WORK.md`
- Return `action_taken: fallback`

### Step 4: Handle Blocking Items

If `blocking: true`:

**With beads:**
```bash
# If there's a current work item, add blocking dependency
bd dep add $CURRENT_WORK_ID $CAPTURED_ID --type blocks 2>/dev/null || true
bd update $CURRENT_WORK_ID --status blocked --json 2>/dev/null || true
```

**With fallback file:**
- Entry already marked with `BLOCKING` status
- No additional action needed

### Step 5: Return Result

```yaml
captured_id: "bd-xxx" | null
fallback_file: ".agent_planning/DEFERRED-WORK.md" | null
duplicate_of: "bd-yyy" | null
action_taken: "created" | "fallback" | "duplicate"
message: "Human-readable summary"
```

## Output Examples

**Success (beads):**
```
Deferred work captured: bd-a1b2c3
  Title: "Add rate limiting to auth endpoints"
  Type: task | Priority: P1
  Linked: discovered-from bd-parent
```

**Success (fallback):**
```
Deferred work captured to .agent_planning/DEFERRED-WORK.md
  Title: "Add rate limiting to auth endpoints"
  Type: task | Priority: P1
  Note: Beads unavailable - run 'bd sync' when available
```

**Duplicate detected:**
```
Duplicate detected - not creating new entry
  Existing: bd-xyz123 "Rate limiting for API endpoints"
  Action: Review existing issue for completeness
```

## Integration Points

This skill is called by:

**In plugins/do/:**
- `agents/work-evaluator.md` - PAUSE questions, BLOCKED reasons
- `agents/status-planner.md` - Out-of-scope items from PLAN

**In plugins/do-more/:**
- `agents/test-driven-implementer.md` - Discovered bugs during implementation
- `skills/work-checkpoint/SKILL.md` - Incomplete work when user stops
- `skills/iterative-workflow/SKILL.md` - INCOMPLETE/BLOCKED verdicts
- `commands/audit.md` - Gaps and vulnerabilities from audits
- `commands/test.md` - Missing tests from test audits

## Graceful Degradation

**Critical**: Never block workflow execution due to capture failure.

- If beads unavailable → Use fallback file silently
- If fallback file write fails → Log warning, continue workflow
- If dedup check fails → Proceed with creation (better duplicate than lost)

## Batch Capture

When capturing multiple items (e.g., from audit findings), call this skill once per item. Each call is independent.

```
For each gap in audit_findings:
  Skill("do:deferred-work-capture") with:
    title: gap.title
    description: gap.description
    type: "task"
    priority: gap.priority
    source_context: "audit findings"
```

## Syncing Fallback to Beads

If items were captured to fallback file and beads becomes available later:

1. Read `.agent_planning/DEFERRED-WORK.md`
2. For each PENDING entry:
   - Create in beads with same details
   - Mark entry as `SYNCED: <bd-id>`
3. Run `bd sync` to persist

The `/do:deferred-work-cleanup` command handles this automatically.

## See Also

- `skills/beads/SKILL.md` - Full beads CLI documentation
- `/do:deferred-work-cleanup` - Process and clean up deferred work queue
