---
name: "do-tdd"
description: "Write tests first, then implement. TDD workflow with TestLoop and ImplementLoop. Entry point for /do-more:tdd command."
context: fork
---

# TDD Command

Test-Driven Development workflow: write tests first, then implement to make them pass.

## Step 1: Determine Topic

<task-focus>
$ARGUMENTS
</task-focus>

If task-focus is empty, use the most recent PLAN file or ask the user.

**Output:** A topic string.

---

## Step 2: Resolve Topic Directory

All planning files for a topic live in `.agent_planning/<topic-slug>/`.

**Process:**

1. Generate a slug from the topic (lowercase, hyphenated, short)

2. Check for existing topic directories

3. **Exact match exists** → Use it
   **Similar directories found** → Ask user to choose
   **No match** → Create new directory and chain to `/do:plan $TOPIC`

**Output:** Topic directory path (e.g., `.agent_planning/auth/`)

---

## Step 3: Find or Create a Plan

Check topic directory for `PLAN-*.md` (newest by timestamp).

- **Plan exists** → Proceed to TestLoop
- **No plan** → Run `/do:plan $TOPIC`, then proceed

---

## TestLoop

Tests MUST be (TestCriteria):
- useful (no useless tests)
- complete (test all edge cases)
- flexible (allow refactoring without changing tests)
- Fully automated using existing or standard framework

**Step 1: Design and write tests**
Use the do:functional-tester agent to design and write high-level functional tests that validate real user workflows and follow all TestCriteria.

**Step 1b: Display results** - Show functional-tester's summary to user before proceeding.

**Step 2: Evaluate tests**
Use the do:project-evaluator agent to evaluate the tests just written. Evaluate in context of the plan to ensure they follow TestCriteria.

**Step 2b: Display results** - Show project-evaluator's summary and loop decision to user.

**Step 2c: Handle PAUSE (if applicable)**
If project-evaluator returns PAUSE with ambiguities about test design:
1. Use do:researcher to explore the testing question
2. Use project-evaluator (research evaluation mode) to assess if research is sufficient
3. If sufficient, project-evaluator makes the decision
4. Continue TestLoop with resolved ambiguity

**Exit Condition:** When TestCriteria are met with NO EXCEPTIONS, exit and proceed to ImplementLoop.

**Continue Condition:** If tests don't meet TestCriteria, restart the loop with specific feedback.

---

## ImplementLoop

**Step 1: Implement**
Use the do:iterative-implementer agent to implement the functionality that makes tests pass. The agent will automatically detect TDD mode and iterate until all tests pass.

**Step 1b: Display results** - Show iterative-implementer's summary (tests passing/failing, files, commits) to user.

**Step 2: Evaluate implementation**
Use the do:work-evaluator agent to evaluate the current implementation.

**Step 2b: Display results** - Show work-evaluator's summary and loop decision to user.

**Step 2c: Handle PAUSE (if applicable)**
If work-evaluator returns PAUSE with ambiguities about implementation:
1. Use do:researcher to explore the specific technical question
2. Use work-evaluator (research evaluation mode) to assess if research is sufficient
3. If sufficient, work-evaluator makes the decision
4. Continue ImplementLoop with resolved ambiguity

**Exit Condition:** No outstanding issues with well-defined solutions.

**Continue Condition:** If known issues remain and solution is well defined, restart the loop.

---

## Final Step

After BOTH loops complete, run `/do:status` to show current state.

Display summary:
```
═══════════════════════════════════════
TDD Complete
  Topic: $TOPIC
  TestLoop: n iterations | ImplementLoop: m iterations
  Tests: all passing | Files: [count] | Commits: [count]
  Research: [n decisions made OR "none needed"]
Next: Review STATUS or continue development
═══════════════════════════════════════
```

## Important Notes

- **PAUSE triggers automatic research** - user only involved if research cannot resolve after 3 iterations
- Both loops must complete before final evaluation
- Tests define the contract - implementation must pass through real functionality
