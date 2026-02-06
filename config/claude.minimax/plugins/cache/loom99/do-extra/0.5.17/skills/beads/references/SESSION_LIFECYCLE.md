# Session Lifecycle Workflows

Step-by-step workflows for using bd throughout a coding session.

## Session Start

### Checklist
```
Session Start:
- [ ] bd ready --json - Find unblocked work
- [ ] bd list --status in_progress --json - Check active work
- [ ] bd stale --days 30 --json - Find forgotten issues
- [ ] If in_progress: bd show <id> to read notes
- [ ] Report to user: "X items ready, Y in progress"
- [ ] If nothing ready: bd blocked --json to check blockers
```

### Pattern
```bash
# 1. Check ready work
bd ready --json

# 2. Check if anything in progress from previous session
bd list --status in_progress --json

# 3. If in_progress exists, read notes for context
bd show bd-42 --json
# Read notes field: "COMPLETED: X. IN PROGRESS: Y. NEXT: Z"

# 4. Check for forgotten work
bd stale --days 30 --json
```

### Report Format
```
"I can see 3 items ready:
- bd-42 (P1): Fix auth race condition
- bd-43 (P2): Add user settings page
- bd-44 (P3): Update API docs

bd-41 is in_progress from last session. Notes say:
'COMPLETED: JWT validation. IN PROGRESS: Password reset. NEXT: Add rate limiting.'

Should I continue with bd-41 or pick up something else?"
```

## During Work

### Claiming Work
```bash
# Mark as in_progress when starting
bd update bd-42 --status in_progress --json
```

### Discovering New Work
```bash
# While working on bd-42, find a bug
bd create "Race condition in session manager" \
  --description="Discovered while implementing bd-42. Two goroutines write to channel without sync." \
  -t bug -p 1 --deps discovered-from:bd-42 --json

# Assess: blocker or can defer?
# If blocker: mark bd-42 blocked, work on new issue
# If deferrable: note in issue, continue bd-42
```

### Progress Checkpoints

Update notes at these triggers:
- **Context running low** - User mentions token limits
- **Token budget >70%** - Proactive checkpoint
- **Major milestone** - Completed significant piece
- **Hit a blocker** - Can't proceed
- **Task transition** - Switching issues
- **Before user input** - About to ask decision

```bash
bd update bd-42 --notes "COMPLETED: JWT validation with RS256.
KEY DECISION: RS256 over HS256 per security review.
IN PROGRESS: Password reset flow - email working.
NEXT: Add rate limiting (5 attempts/15min).
BLOCKER: None currently."
```

### Checking for Duplicates

Before creating new issues:
```bash
# Search for similar
bd list --title-contains "auth" --json

# If found similar, show both
bd show bd-42 bd-43 --json

# If duplicate, merge
bd merge bd-43 --into bd-42 --json
```

## Session End (MANDATORY)

### Checklist
```
Session End:
- [ ] File issues for remaining work discovered
- [ ] Update notes on in_progress issues
- [ ] Close completed issues with reason
- [ ] bd sync - MANDATORY, forces immediate push
- [ ] Verify: git status shows "up to date"
```

### Pattern
```bash
# 1. File remaining work
bd create "Follow-up: Add integration tests" \
  --description="Need tests for the auth changes made this session" \
  -p 2 --deps discovered-from:bd-42 --json

# 2. Update notes for handoff
bd update bd-42 --notes "COMPLETED: JWT + password reset flow.
IN PROGRESS: Rate limiting implementation 50% done.
NEXT: Finish rate limiter, then add tests.
KEY DECISION: Using sliding window, not fixed window."

# 3. Close completed work
bd close bd-43 --reason "Implemented and tested" --json

# 4. CRITICAL: Force sync
bd sync

# 5. Verify push succeeded
git status  # Should show "up to date with origin/main"
```

**CRITICAL**: The session is NOT complete until `bd sync` runs. Without it, changes stay in the 30-second debounce window and may never reach git.

## Post-Compaction Recovery

After a compaction event, conversation history is gone. bd notes are your only memory.

### Checklist
```
After Compaction:
- [ ] bd list --status in_progress --json
- [ ] For each: bd show <id> --json
- [ ] Read notes: COMPLETED, IN PROGRESS, NEXT, KEY DECISIONS
- [ ] Check dependencies: bd dep tree <id>
- [ ] Reconstruct context from notes
- [ ] Resume work
```

### What Survives Compaction
- All bd issues and notes
- Dependencies and relationships
- Full work history

### What Doesn't Survive
- Conversation history
- TodoWrite lists
- Recent discussion context

### Good Notes Enable Recovery

**Good** (enables full recovery):
```
COMPLETED: User authentication - added JWT token with 1hr expiry,
implemented refresh endpoint using rotating tokens.
IN PROGRESS: Password reset flow. Email service working.
NEXT: Add rate limiting (currently unlimited).
KEY DECISION: Using bcrypt 12 rounds after OWASP review.
BLOCKER: None.
```

**Bad** (useless after compaction):
```
Working on auth. Made progress. More to do.
```

## Multi-Session Resume

Starting after days/weeks away:

```bash
# 1. Get overview
bd stats --json

# 2. See what's ready
bd ready --json

# 3. Check what's blocked
bd blocked --json

# 4. Review recent completions for context
bd list --status closed --limit 10 --json

# 5. Pick work and read details
bd show bd-42 --json

# 6. Claim and begin
bd update bd-42 --status in_progress --json
```

## Side Quest Handling

When you discover work that might derail current task:

### Checklist
```
Side Quest Discovery:
- [ ] Create issue for discovered work
- [ ] Link with discovered-from to current task
- [ ] Assess: blocker or deferrable?
- [ ] If blocker: mark current blocked, switch
- [ ] If deferrable: note and continue current
```

### Example
```bash
# Working on bd-42 (user profiles)
# Discover: auth system needs role-based access

# 1. Create discovered issue
bd create "Auth needs RBAC" \
  --description="Found while implementing bd-42. Current auth has no role support." \
  -t bug -p 1 --deps discovered-from:bd-42 --json
# Returns: bd-50

# 2. Assess: this IS a blocker for profiles

# 3. Mark profiles blocked
bd update bd-42 --status blocked --json
bd dep add bd-42 bd-50  # profiles blocked by RBAC

# 4. Work on RBAC
bd update bd-50 --status in_progress --json
# ... implement RBAC ...

# 5. Complete RBAC
bd close bd-50 --reason "Implemented" --json

# 6. bd-42 automatically unblocked, resume
bd ready --json  # Shows bd-42 again
bd update bd-42 --status in_progress --json
```

## Epic Work Breakdown

### Checklist
```
Epic Planning:
- [ ] Create epic issue for high-level goal
- [ ] Break into child task issues
- [ ] Link with parent-child dependencies
- [ ] Add blocks between children if ordered
- [ ] Work through via bd ready
```

### Example
```bash
# 1. Create epic
bd create "OAuth Integration" -t epic -p 1 \
  --description="Add OAuth with Google and GitHub providers" --json
# Returns: bd-epic

# 2. Create children
bd create "Setup OAuth credentials" -p 1 --json    # bd-epic.1
bd create "Implement auth flow" -p 1 --json        # bd-epic.2
bd create "Add token storage" -p 1 --json          # bd-epic.3
bd create "Create login UI" -p 1 --json            # bd-epic.4

# 3. Link parent-child (automatic with dotted IDs)

# 4. Add ordering where needed
bd dep add bd-epic.2 bd-epic.1  # flow needs setup
bd dep add bd-epic.3 bd-epic.2  # storage needs flow

# 5. Work through
bd ready --json  # Shows bd-epic.1 and bd-epic.4 (unblocked)
```

## Unblocking Work

When `bd ready` is empty:

```bash
# 1. See what's blocked
bd blocked --json

# 2. Show the blockers
bd show bd-42 --json  # See what's blocking it

# 3. Work on blocker, or remove incorrect dependency
bd dep remove bd-blocker bd-42  # If dependency was wrong

# 4. Close blocker when done
bd close bd-blocker --reason "Done" --json

# 5. bd-42 automatically becomes ready
bd ready --json
```
