---
name: "do-it"
description: "Implement a feature with automatic planning, human-in-the-loop verification, and feedback cycles. Use any time you want to implement some functionality, and ALWAYS use when implementing work planned with do:plan"
---

# Implementation Command

Do some work: resolve topic, get plan, approve DoD, spawn agent to build functionality, validate through runtime evaluation.

At each step, you are careful to ask prompt the user if there are any outstanding architectural questions.

**Do it right the first time**: It's far more work to do the wrong work and then need to undo it.  You're too experienced to make that sort of mistake.  Whenever there are architectural or implementation questions, you ASK

**Regardless of ANY other circumstances, ALL implementation done by this command MUST be done using the `do:iterative-implementer` agent.  If no planning files are accepted, provide a comprehensive and detailed prompt to the agent**

## Step 1: Determine What to Work On

<task-focus>
$ARGUMENTS
</task-focus>


**Resolution order:**

1. **User specified a task** → Use `$ARGUMENTS` as the topic
2. **Recent conversation context** → If we were just discussing something specific (e.g., user said "yes" or "make it so" after a proposal), use that as the topic
3. **Nothing clear** → Ask the user with concrete options:

```
┌─ What should I implement? ─────────────────────────┐
│ 1. [Most recent topic from .agent_planning/]       │
│ 2. [Highest priority incomplete work item]         │
│ 3. Something else (describe it)                    │
└────────────────────────────────────────────────────┘
```

**Output:** A topic string (e.g., "user authentication", "payment flow").

---

## Step 2: Resolve Topic Directory

All planning files for a topic live in `.agent_planning/<topic-slug>/`.

**Process:**

1. Generate a slug from the topic (lowercase, hyphenated, short)
   - "user authentication" → `auth` or `user-auth`
   - "payment processing" → `payments`

2. List existing topic directories:
   ```bash
   ls -d .agent_planning/*/
   ```

3. Check for matches:

   **Exact match exists** → Use it, proceed to Step 3

   **Similar directories found** → Ask user:
   ```
   ┌─ Topic: "user authentication" ─────────────────────┐
   │                                                    │
   │ Similar existing topics found:                     │
   │ 1. auth/ (3 files, last modified: 2024-12-12)     │
   │ 2. login/ (1 file, last modified: 2024-12-10)     │
   │ 3. Create new: user-auth/                          │
   │                                                    │
   └────────────────────────────────────────────────────┘
   ```

   **No similar directories**
      1. First, check .agent_planning/ for a plan on this topic (legacy plans are here)
      2. → Create new directory for topic and move existing plan to new directory
         - if no legacy plan found, continue with new directory

**Output:** Topic directory path (e.g., `.agent_planning/auth/`)

---

## Step 3: Find or Create a Plan

Check topic directory for sprint plans.

**Search:**
1. List files in topic directory: `ls .agent_planning/<topic>/`
2. Look for sprint files: `SPRINT-*-PLAN.md`, `SPRINT-*-DOD.md`, `SPRINT-*-CONTEXT.md`
3. Check confidence level in each sprint plan header

**Status-Based Decision:**

| Files Found | Status | Action |
|-------------|--------|--------|
| No plans | - | Run `/do:plan $TOPIC`, then proceed |
| Sprint plans exist | READY FOR IMPLEMENTATION | All items HIGH → Step 4 |
| Sprint plans exist | PARTIALLY READY | Start HIGH items immediately; for MEDIUM/LOW items, surface unknowns to user first, resolve, then implement |
| Sprint plans exist | RESEARCH REQUIRED | Exploration required: ask user questions, run research, re-plan |

**For MEDIUM/LOW confidence items within a sprint:**
- Read the "Unknowns to Resolve" and "Exit Criteria" sections for those items
- Present options to user with tradeoffs table
- After user input, update the item's confidence to HIGH
- Implement once resolved

**Output:** Sprint PLAN filepath, DOD filepath, and sprint status.

---

## Step 4: Definition of Done (Main Context Approval)

**You MUST read the DOD file before spawning the implementer.** The DOD is the verification contract — implementation is judged against it.

1. Read `SPRINT-*-DOD.md` for the current sprint. This is the Definition of Done.
2. Check `.agent_planning/<topic>/USER-RESPONSE-*.md` for prior approval. If a plan was approved here, automatically proceed to implementation.
3. If no prior approval exists, or the user rejected the plan: present the Definition of Done to the user and ask for approval. Upon approval, proceed to **Step 5**.

**IMPORTANT**: If the file specifies the user rejected the plan, it may have been revised later without updating this file, so read the planning documents, provide a summary to the user, and ask them for approval.

**Regardless of ANY other circumstances, ALL implementation done by this command MUST be done using the `do:iterative-implementer` agent. If no planning files are accepted, provide a comprehensive and detailed prompt to the agent.**

---

## Step 5: Implementation Loop

Repeat until complete:

### Step 5.1: Implement

First: Do you need to ask the user any questions?

Use the Task tool to spawn `do:iterative-implementer` agent:

```
Implement: $TOPIC

## Topic Directory
.agent_planning/<topic>/

## Files to Read
- Definition of Done: $DOD_FILEPATH (user has approved this)
- Full Plan: $PLAN_FILEPATH

## Instructions
1. Read both files for full context
2. Implement each acceptance criterion from the DoD
3. Commit after each logical chunk of work
4. When all criteria complete, run validation (tests, lint, type check)
5. Use `do:prompt-questioning` skill if you need user input during implementation
6. Update planning docs when done
```

**Step 5.1b: Display results** - Show iterative-implementer's summary (completed items, files, commits) to user.

### Step 5.2: Evaluate

Use the do:work-evaluator agent to assess if goals are achieved. The agent will:
- Run the software
- Collect evidence (screenshots, logs, output)
- Compare against Definition of Done
- Determine: COMPLETE, INCOMPLETE, PAUSE, or BLOCKED

**Step 5.2b: Display results** - Show work-evaluator's summary and loop decision to user.

**CRITICAL** Before continuing, do you need to ask the user any questions?

### Loop Conditions

**Exit Condition (COMPLETE)**:
When work-evaluator confirms all goals achieved (status: COMPLETE), exit the loop and proceed to Step 6.

**Continue Condition (INCOMPLETE)**:
If work-evaluator reports INCOMPLETE and the path forward is clear (concrete next steps identified), continue the loop.

**Research Condition (PAUSE)**:
If work-evaluator reports PAUSE with ambiguities that need resolution:
1. Use the do:researcher agent to explore the specific question(s)
2. Use work-evaluator (research evaluation mode) to assess if research is sufficient
3. If sufficient, work-evaluator makes the decision
4. Continue the implementation loop with resolved ambiguity
5. ASK THE USER ANY QUESTIONS

**CRITICAL: YOU MUST ALWAYS REQUEST FEEDBACK FROM THE USER ON ALL UNANSWERED QUESTIONS, UNLESS THE USER REQUESTS OTHERWISE.**

**Blocked Condition (BLOCKED)**:
If work-evaluator reports BLOCKED with no clear path forward (external dependency, fundamental issue, unanswered questions, matter of personal taste), pause and request user guidance.

---

## Step 6: Validation

Once work-evaluator reports COMPLETE, perform final validation.

### Machine Validation

Run automated testing or validation appropriate for the codebase:
- Test suites (unit, integration, e2e)
- Linting and type checking
- Build verification

Document results.

### Human Validation

Present final state for user testing:

```
┌─ Validation: $TOPIC ───────────────────────────────┐
│                                                    │
│ Agent reported: [COMPLETE | IN_PROGRESS]           │
│ Machine checks: [PASS | FAIL summary]              │
│                                                    │
│ Please verify each criterion:                      │
│ - [ ] [Criterion 1] - [how to test]                │
│ - [ ] [Criterion 2] - [how to test]                │
│                                                    │
│ 1. Approved - implementation complete              │
│ 2. Issues - describe problems (spawns fix agent)   │
│ 3. Polish - minor refinements needed               │
└────────────────────────────────────────────────────┘
```

If issues found → spawn agent again with fix instructions (return to Step 5).
If approved → proceed to Step 7.

Reminder: do you need to ask the user any questions?

---

## Step 8: Handle deferred work

Was there any deferred work from any of the previous steps?  If so, we need to surface this info to the user:

═══════════════════════════════════
Deferred Work
Topic: $TOPIC
Status: DEFERRED
Goals: [incomplete goals]
Work items:
- [list deferred work items]
═══════════════════════════════════

Now we must plan each deferred work item.  For each work item, run /do:plan [deferred work item].  This will update the planning documents to ensure the work is not lost.

Now is a great time: Do you need to ask the user any questions?

Ask the user if they would like to implement the deferred work items.  If so, run /do:it [deferred work item] for EACH deferred work item.

**ALWAYS**: Before proceeding to the next step, run `/do:plan [current topic]` ONE MORE TIME to update the planning docs with the outcomes of the implementation.

You MUST ALWAYS end by running a final `/do:plan` to ensure the planning docs are in the correct state.

## Step 7: Handle deferred work

Was there any deferred work from any of the previous steps?  If so, we need to surface this info to the user:

═══════════════════════════════════
Deferred Work
Topic: $TOPIC
Status: DEFERRED
Goals: [incomplete goals]
Work items:
- [list deferred work items]
═══════════════════════════════════

Now we must plan each deferred work item.  For each work item, run /do:plan [deferred work item].  This will update the planning documents to ensure the work is not lost.

Now is a great time: Do you need to ask the user any questions?

Ask the user if they would like to implement the deferred work items.  If so, run /do:it [deferred work item] for EACH deferred work item.

**ALWAYS**: Before proceeding to the next step, run `/do:plan [current topic]` ONE MORE TIME to update the planning docs with the outcomes of the implementation.

You MUST ALWAYS end by running a final `/do:plan` to ensure the planning docs are in the correct state.

## Step 8: Completion

After handling validation, surfacing deferred work to user, planning deferred work, and implementing deferred work,
run `/do:status` to show current project state.
After handling validation, surfacing deferred work to user, planning deferred work, and implementing deferred work,
run `/do:status` to show current project state.

Display summary:
```
═══════════════════════════════════
Implementation Complete
  Topic: $TOPIC
  Iterations: n | Status: COMPLETE
  Files: [count] | Commits: [count] | Goals: n/n achieved
  Research: [n decisions made OR "none needed"]
Next: Review STATUS or continue with /do:it [next topic]
═══════════════════════════════════
```

---

## Summary

**Regardless of ANY other circumstances, ALL implementation done by this command MUST be done using the `do:iterative-implementer` agent.  If no planning files are accepted, provide a comprehensive and detailed prompt to the agent**

**Main context handles:**
- Topic resolution (Step 1)
- Topic directory resolution (Step 2) - ask user if ambiguous
- Plan + DoD lookup (Step 3) - just filenames
  - Ask questions
- DoD approval (Step 4) - read small DoD file
  - Ask questions
- Validation (Step 6) - user checkpoint
  - Ask questions
- Handle deferred work (Step 7)
  - Ask questions
- Final status update (Step 8)

**Agent handles:**
- Reading full plan (main context never reads it)
- Implementation
  - Ask questions
- Commits
- Can prompt user via skill if needed

**Directory structure:**
```
.agent_planning/
├── auth/
│   ├── SPRINT-<ts>-<slug>-PLAN.md    # Sprint plan with confidence level
│   ├── SPRINT-<ts>-<slug>-DOD.md     # Definition of Done
│   ├── SPRINT-<ts>-<slug>-CONTEXT.md # Implementation context
│   ├── EVALUATION-<timestamp>.md     # Evaluation snapshots
│   └── USER-RESPONSE-<timestamp>.md  # User approval
├── payments/
│   └── ...
└── do-command-logs/           # Execution tracking (unchanged)
```

**Confidence Levels:**
- HIGH: Implement immediately
- MEDIUM: Research unknowns, then implement
- LOW: Explore options with user, then re-plan

## Important Notes

- This workflow does not *require* tests to be written first, but we highly encourage automated testing and recommend that all implementation be covered by automated tests
- Runtime validation trumps automated testing for verification.  If the tests pass but the software doesn't run, this is a sign we need to update the tests
- Work-evaluator uses actual software execution to verify functionality
- Exceptional quality standards are maintained through iterative-implementer's strict, no-compromise engineering practices
- **PAUSE triggers automatic research** - user only involved if research gets stuck
- User may test and provide feedback during any iteration
