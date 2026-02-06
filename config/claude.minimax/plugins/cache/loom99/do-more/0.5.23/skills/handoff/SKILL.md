---
name: "do-handoff"
description: "Create context handoff document for transferring work to an agent. Contains everything needed to start with minimal investigation. Entry point for /do-more:handoff command."
context: fork
---

Create a comprehensive handoff document for agent context transfer.

<user-input>$ARGUMENTS</user-input>
<current-command>handoff</current-command>

## Purpose

Generate a complete context snapshot that allows an agent to pick up work immediately with minimal investigation. Use this before spawning agents or when switching contexts.

---

## Step 1: Determine Handoff Topic

**If `$ARGUMENTS` provided**:
- Use `$ARGUMENTS` as the topic

**If `$ARGUMENTS` is "current" or empty**:
- Use current conversation context
- If we were just discussing a specific task/feature/bug, that's the topic
- Otherwise, use the most recent planning doc topic

Set `handoff_topic` to the resolved topic.

---

## Step 2: Gather Context

Collect all relevant context for `handoff_topic`:

### 2a. Planning Documents

Search `.agent_planning/` for related docs:

```bash
# Find most recent PLAN related to topic
find .agent_planning -name "PLAN-*.md" -type f | xargs grep -l "<topic keywords>" | head -1

# Find most recent STATUS related to topic
find .agent_planning -name "STATUS-*.md" -type f | head -1

# Find related RESEARCH docs
find .agent_planning -name "RESEARCH-*.md" -type f | xargs grep -l "<topic keywords>"
```

### 2b. Beads Issues

```bash
# Find related beads issues
bd list --status open --json | jq -r '.[] | select(.title | test("<topic keywords>"; "i"))'

# Get in-progress issues
bd list --status in_progress --json
```

### 2c. Conversation Context

Extract from recent conversation:
- What have we discussed about this topic?
- What decisions have been made?
- What questions remain unanswered?
- What constraints or requirements were mentioned?

### 2d. Codebase Context

Identify key files related to `handoff_topic`:
- Files mentioned in conversation
- Files in PLAN scope
- Files modified recently related to topic

```bash
# Recent changes related to topic
git log --oneline --name-only -10 | grep -i "<topic keywords>"
```

---

## Step 3: Create Handoff Document

Write to `.agent_planning/HANDOFF-<topic>-<timestamp>.md`:

### Handoff Document Structure

```markdown
# Handoff: <Topic>

**Created**: <timestamp>
**For**: <Intended agent or workflow>
**Status**: <in-progress | ready-to-start | blocked>

---

## Objective

[Clear 1-2 sentence statement of what needs to be accomplished]

## Current State

### What's Been Done
- [Completed work item 1]
- [Completed work item 2]

### What's In Progress
- [Active work item 1]
- [Active work item 2]

### What Remains
- [Next work item 1]
- [Next work item 2]

## Context & Background

### Why We're Doing This
[Business/technical motivation - 2-3 sentences]

### Key Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| [Choice made] | [Why we chose this] | [When] |

### Important Constraints
- [Constraint 1: e.g., "Must maintain backward compatibility"]
- [Constraint 2: e.g., "Use existing auth pattern from auth/"]
- [Constraint 3: e.g., "No new dependencies without approval"]

## Acceptance Criteria

How we'll know this is complete:

- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]

## Scope

### Files to Modify
- `path/to/file1.ts` - [What needs changing]
- `path/to/file2.ts` - [What needs changing]

### Related Components
- `component/path` - [How it's related]
- `other/component` - [How it's related]

### Out of Scope
- [What NOT to change]
- [What to defer to later]

## Implementation Approach

### Recommended Steps
1. [Step 1 with rationale]
2. [Step 2 with rationale]
3. [Step 3 with rationale]

### Patterns to Follow
- [Pattern 1: e.g., "Use dependency injection like in services/"]
- [Pattern 2: e.g., "Follow error handling pattern from errors.ts"]

### Known Gotchas
- [Gotcha 1: e.g., "Config must be loaded before DB connection"]
- [Gotcha 2: e.g., "Watch out for race condition in session.ts:45"]

## Reference Materials

### Planning Documents
- [PLAN-<name>-<date>.md](.agent_planning/PLAN-<name>-<date>.md) - Full implementation plan
- [STATUS-<name>-<date>.md](.agent_planning/STATUS-<name>-<date>.md) - Current state analysis
- [RESEARCH-<name>-<date>.md](.agent_planning/RESEARCH-<name>-<date>.md) - Technical research

### Beads Issues
- [bd-abc123](command:bd show bd-abc123) - Main implementation issue
- [bd-def456](command:bd show bd-def456) - Related dependency

### Codebase References
- `path/to/similar/example.ts` - Good reference implementation
- `docs/architecture.md` - Relevant architecture doc

### External Resources
- [Relevant API docs](url) - For library/framework usage
- [Design doc](url) - If exists

## Questions & Blockers

### Open Questions
- [ ] [Question 1 that needs answering]
- [ ] [Question 2 that needs answering]

### Current Blockers
- [Blocker 1: what's blocking and why]
- [Blocker 2: what's blocking and why]

### Need User Input On
- [Decision point 1 requiring user]
- [Decision point 2 requiring user]

## Testing Strategy

### Existing Tests
- `tests/path/file.test.ts` - Related test file
- Coverage: [X%] for this area

### New Tests Needed
- [ ] [Test scenario 1]
- [ ] [Test scenario 2]

### Manual Testing
- [ ] [Manual test step 1]
- [ ] [Manual test step 2]

## Success Metrics

How to validate implementation:

- [Metric 1: e.g., "All existing tests pass"]
- [Metric 2: e.g., "New feature accessible via /api/endpoint"]
- [Metric 3: e.g., "Performance within 100ms for typical case"]

---

## Next Steps for Agent

**Immediate actions**:
1. [First thing to do]
2. [Second thing to do]
3. [Third thing to do]

**Before starting implementation**:
- [ ] Review all reference materials linked above
- [ ] Check for updates to beads issues
- [ ] Verify no conflicting work in progress

**When complete**:
- [ ] Update beads issue with results
- [ ] Update STATUS doc if major state change
- [ ] Mark handoff as complete
```

---

## Step 4: Output Handoff Summary

After creating the handoff document, output a brief summary to the user:

```
✅ Handoff document created: .agent_planning/HANDOFF-<topic>-<timestamp>.md

📋 Summary:
- Objective: <brief objective>
- Status: <current status>
- Key files: <count> files in scope
- Blockers: <count> blockers
- Next steps: <first 2 next steps>

🔗 Reference docs:
- PLAN: <filename>
- STATUS: <filename>
- Beads: <issue IDs>

To use this handoff:
- Spawn agent: Task(prompt="<Read and execute .agent_planning/HANDOFF-<topic>-<timestamp>.md>")
- Or resume work: Reference HANDOFF-<topic>-<timestamp>.md for context
```

---

## Step 5: Update Beads (if applicable)

If working on a beads issue, update it with handoff info:

```bash
bd update <issue-id> --notes "HANDOFF: Created context document at .agent_planning/HANDOFF-<topic>-<timestamp>.md" --json
```

---

## Best Practices

**When to create a handoff**:
- Before spawning an agent for implementation
- When switching between different areas of work
- When pausing work that will be resumed later
- When collaborating with another developer/agent
- After a planning session, before implementation

**Keep it concise**:
- Link to docs, don't duplicate them
- Focus on "what" and "why", not "how" (unless critical)
- Highlight decisions and constraints (easy to miss otherwise)
- Make acceptance criteria testable and specific

**Update as you go**:
- If you make decisions during implementation, update the handoff
- Mark completed items as done
- Add new blockers or questions as they arise
