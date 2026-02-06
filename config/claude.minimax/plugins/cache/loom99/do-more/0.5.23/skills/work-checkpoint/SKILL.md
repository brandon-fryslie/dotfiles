---
name: "do-work-checkpoint"
description: "Present completed work to user for verification at the end of a /do:* command. Runs in main context so CAN use AskUserQuestion. Lists accomplishments, asks for feedback, and determines next action."
---

# Work Checkpoint

Present completed work to user for verification and determine next steps.

**Critical**: You run in main Claude context, so you CAN use AskUserQuestion directly.

## When to Invoke

Invoke at the **end of `/do:*` commands** when verification is needed.

**Skip checkpoint if**:
- No significant work was completed
- User explicitly said "don't stop" or "keep going"

## Process

**Step 1**: Gather completed work

**Step 1**: Gather completed work


Check recent git history and planning files in `.agent_planning/<topic>/` to understand what was accomplished.

Extract:
- What was implemented (from git log and SPRINT-*-PLAN.md)
- Files created or modified
- Tests written or run
- Commits made
- Decisions logged

**Step 3**: Build verification checklist

For each significant unit of work, create a verification item:

```markdown
## Work Completed

### 1. [Feature/Task Name]
**What was done**: [Brief description]
**Files changed**: [List of files]
**How to verify**:
- [ ] [Specific verification step - e.g., "Run `npm test` and check X passes"]
- [ ] [Another step - e.g., "Open http://localhost:3000 and test Y"]

### 2. [Another Feature/Task]
...
```

**Step 4**: Present work and ask for feedback

Display the verification checklist (from Step 3), then use AskUserQuestion with TWO questions:

```json
{
  "questions": [
    {
      "question": "Any feedback on the work completed above? (Leave blank if all looks good)",
      "header": "Feedback",
      "options": [
        {"label": "All looks good", "description": "No issues or comments"},
        {"label": "Minor notes", "description": "Small things to mention but OK to continue"},
        {"label": "Has issues", "description": "Problems that should be addressed"}
      ],
      "multiSelect": false
    },
    {
      "question": "What would you like to do next?",
      "header": "Next",
      "options": [
        {"label": "Address feedback", "description": "Fix issues or incorporate notes before continuing"},
        {"label": "Continue work", "description": "Proceed to next planned task"},
        {"label": "Stop here", "description": "Pause and wait for further instructions"}
      ],
      "multiSelect": false
    }
  ]
}
```

**Key UX points**:
- User sees full work summary with verification steps BEFORE the questions
- "Other" freeform input is available for detailed comments on either question
- Two questions appear together, user can answer both at once
- If user has specific feedback, they use "Other" on the Feedback question

**Step 5**: Capture incomplete work (if stopping)

If user selects "Stop here" AND there is incomplete work from the session, capture it:

For each incomplete or partially completed item:
```
Skill("do:deferred-work-capture") with:
  title: "Incomplete: <item name>"
  description: |
    Work stopped before completion at user checkpoint.

    What was completed: <completed parts>
    What remains: <remaining parts>
    Files affected: <list of files>
    How to resume: <steps to continue>
  type: task
  priority: 2
  source_context: "work-checkpoint stop for <command>"
```

This ensures incomplete work is tracked for future sessions.

**Step 6**: Return action

Based on user response:

| Response | Action |
|----------|--------|
| "Address feedback" | Return `"ACTION: FIX_FEEDBACK"` with collected issues |
| "Continue work" | Return `"ACTION: CONTINUE"` |
| "Stop here" | Capture incomplete work, then return `"ACTION: STOP"` |
| Custom input | Return `"ACTION: CUSTOM"` with user's input |

## Output Format

```
CHECKPOINT_RESULT: <ACTION>
WORK_ITEMS_REVIEWED: <n>
FEEDBACK_SUMMARY:
- Item 1: [status] - [any notes]
- Item 2: [status] - [any notes]
USER_NEXT_ACTION: <what user wants to do>
ISSUES_TO_ADDRESS:
- [If any feedback needs addressing]
```

## Example Flow

```
User runs: /do:it implement user authentication

[... agents complete work ...]

work-checkpoint invoked, displays:

═══════════════════════════════════════════════════════════════
Work Completed - Please Verify
═══════════════════════════════════════════════════════════════

1. User Authentication Module
   What was done: Added login/logout endpoints, JWT tokens
   Files: src/auth.py, src/routes/auth.py, tests/test_auth.py
   How to verify:
   - Run `pytest tests/test_auth.py -v`
   - Test POST /login with valid credentials

2. Password Hashing
   What was done: Added bcrypt password hashing
   Files: src/auth.py
   How to verify:
   - Check passwords are not stored in plaintext

═══════════════════════════════════════════════════════════════

[AskUserQuestion with 2 questions]:
  Q1: "Any feedback on the work completed above?"
      [All looks good] [Minor notes] [Has issues] [Other: ___]

  Q2: "What would you like to do next?"
      [Address feedback] [Continue work] [Stop here] [Other: ___]

User answers:
  Q1: Other → "Need to add rate limiting to auth endpoints"
  Q2: "Address feedback"

Returns:
CHECKPOINT_RESULT: FIX_FEEDBACK
WORK_ITEMS_REVIEWED: 2
USER_FEEDBACK: "Need to add rate limiting to auth endpoints"
USER_NEXT_ACTION: Address feedback
ISSUES_TO_ADDRESS:
- Add rate limiting to authentication endpoints
```

## Compact Mode

For small changes (1-2 items, simple modifications), use compact mode:

Single question combining verification and next steps:

```json
{
  "questions": [
    {
      "question": "Completed: [brief summary]. How does it look and what's next?",
      "header": "Review",
      "options": [
        {"label": "Good, continue", "description": "Looks correct, proceed to next task"},
        {"label": "Good, stop", "description": "Looks correct, wait for instructions"},
        {"label": "Needs changes", "description": "Has issues to address first"}
      ],
      "multiSelect": false
    }
  ]
}
```

## References

- `references/verification-templates.md` - Templates for different work types
- `references/feedback-handling.md` - How to process and act on feedback
