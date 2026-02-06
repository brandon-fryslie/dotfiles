# Best Practices and Anti-Patterns

## DO: Always Include Descriptions

Issues without descriptions create context debt.

**Bad**:
```bash
bd create "Fix auth bug" -t bug -p 1 --json
bd create "Add feature" -t feature --json
bd create "Refactor code" -t task --json
```

**Good**:
```bash
bd create "Fix race condition in login handler" \
  --description="Login fails with 500 when two requests hit auth/login.go:45 simultaneously. Discovered during load testing. Stack trace shows channel write without sync." \
  -t bug -p 1 --json

bd create "Add user profile page" \
  --description="Users need to view and edit their profile info (name, email, avatar). Should support image upload to S3." \
  -t feature -p 2 --json
```

**Description should include**:
- **Why** - Problem statement or need
- **What** - Scope and approach
- **How discovered** - If found during work

## DO: Use discovered-from for Found Work

When you find bugs or TODOs during implementation:

```bash
# Working on bd-42, find a bug
bd create "Session tokens not invalidated on logout" \
  --description="Found while implementing bd-42. Logout clears cookie but server-side session persists." \
  -t bug -p 1 --deps discovered-from:bd-42 --json
```

**Why**:
- Maintains work context
- Automatically inherits parent's `source_repo`
- Creates audit trail

## DO: Run bd sync at Session End

**CRITICAL**: Always run before ending a session.

```bash
# End of session
bd sync
git status  # Verify "up to date with origin/main"
```

**Why**: Without `bd sync`, changes sit in 30-second debounce window. User might think you pushed but JSONL never reached git.

## DO: Check for Duplicates Before Creating

```bash
# Before creating
bd list --title-contains "auth" --json

# If similar exists
bd show bd-42 --json  # Compare

# If duplicate, merge
bd merge bd-new --into bd-existing --json
```

## DO: Update Status During Work

```bash
# When starting
bd update bd-42 --status in_progress --json

# When blocked
bd update bd-42 --status blocked --json

# When done
bd close bd-42 --reason "Implemented and tested" --json
```

## DO: Write Notes for Compaction Survival

Notes should enable full context recovery with zero conversation history.

**Good**:
```
COMPLETED: JWT auth with RS256 (1hr access, 7d refresh)
KEY DECISION: RS256 over HS256 - enables key rotation per security review
IN PROGRESS: Password reset flow - email service working
NEXT: Add rate limiting (5 attempts/15min)
BLOCKER: Waiting on user decision for token expiry
```

**Bad**:
```
Working on auth. Made progress. More to do.
```

## DO: Use Requirement Language for Dependencies

Think "X needs Y" not "X before Y".

```bash
# RIGHT: API needs database schema
bd dep add api-endpoint database-schema

# WRONG: "Setup before implementation"
bd dep add setup impl  # This says setup depends on impl!
```

---

## DON'T: Skip bd sync at Session End

**Wrong**:
```bash
bd create "Fix bug" -p 1 --json
# ... session ends without sync
# Changes never reach git
```

**Right**:
```bash
bd create "Fix bug" -p 1 --json
bd sync  # Force immediate push
```

## DON'T: Use Temporal Language for Dependencies

**Wrong** (temporal):
```bash
# "Phase 1 before Phase 2"
bd dep add phase1 phase2  # INVERTED! Says phase1 depends on phase2
```

**Right** (requirement):
```bash
# "Phase 2 needs Phase 1"
bd dep add phase2 phase1  # Correct! Phase2 depends on phase1
```

## DON'T: Create Issues Without Context

**Wrong**:
```bash
bd create "Fix bug" --json
bd create "Add feature" --json
```

Future agents (or you after compaction) won't know:
- What bug?
- Where is it?
- Why does it matter?
- What feature?
- What should it do?

## DON'T: Test in Production Database

**Wrong**:
```bash
./bd create "Test issue" -p 1
```

**Right**:
```bash
BEADS_DB=/tmp/test.db ./bd init --quiet --prefix test
BEADS_DB=/tmp/test.db ./bd create "Test issue" -p 1
```

## DON'T: Commit .beads/beads.db

Only JSONL should be in git:

**Committed (source of truth)**:
- `.beads/issues.jsonl`
- `.beads/deletions.jsonl`

**NOT committed (local cache)**:
- `.beads/beads.db`
- `.beads/beads.db-*`
- `.beads/bd.sock`

## DON'T: Over-Use blocks Dependencies

**Wrong**:
```bash
# Everything blocks everything in strict sequence
bd dep add task1 task2
bd dep add task2 task3
bd dep add task3 task4
# bd ready only shows task1; no parallel work possible
```

**Right**: Only use `blocks` for actual technical dependencies. Allow parallel work where possible.

## DON'T: Use discovered-from for Planned Work

**Wrong**:
```bash
bd dep add epic subtask --type discovered-from
```

**Problem**: `discovered-from` is for emergent discoveries, not planned decomposition.

**Right**:
```bash
bd dep add epic subtask --type parent-child
```

## DON'T: Assume Sequential IDs Are Unique

In multi-agent or multi-branch workflows, sequential IDs can collide:
- Agent A creates bd-10 on branch feature-auth
- Agent B creates bd-10 on branch feature-payments
- Merge conflict!

**Solution**: Use hash-based IDs (v0.20.1+) which are collision-resistant.

---

## Quality Checklist

### Before Creating an Issue
```
- [ ] Searched for similar existing issues?
- [ ] Description explains why, what, how discovered?
- [ ] Priority reflects actual urgency?
- [ ] Type matches the work (bug/feature/task)?
- [ ] Linked with discovered-from if found during work?
```

### Before Session End
```
- [ ] Filed issues for discovered work?
- [ ] Updated notes on in_progress issues?
- [ ] Closed completed issues with reason?
- [ ] Ran bd sync?
- [ ] Verified git status shows "up to date"?
```

### Writing Good Notes
```
- [ ] COMPLETED: Specific deliverables (not "made progress")?
- [ ] IN PROGRESS: Current state + immediate next step?
- [ ] KEY DECISIONS: Important choices with rationale?
- [ ] BLOCKERS: What's preventing progress (if any)?
- [ ] Readable by someone with zero context?
```

### Adding Dependencies
```
- [ ] Used requirement language (X needs Y)?
- [ ] Verified direction with bd blocked?
- [ ] Only used blocks for actual technical blockers?
- [ ] Used parent-child for epic breakdown?
- [ ] Used discovered-from for emergent work?
```
