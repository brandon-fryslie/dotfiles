---
name: "do-iterative-workflow"
description: "Iterative implementation with runtime validation. Use for UI work, exploratory development, or when TDD is impractical."
---

# Iterative Workflow

Build incrementally, validate with runtime evidence.

## Loop

**Step 1: Implement**
Use do:iterative-implementer to:
- Read STATUS/PLAN for context
- Build working functionality
- Commit frequently

**Step 2: Evaluate**
Use do:work-evaluator to validate:
- Run the software
- Capture evidence (screenshots, logs, output)
- Compare against acceptance criteria

**Verdict**:
- COMPLETE → Exit
- INCOMPLETE with clear path → Continue (capture remaining items)
- PAUSE → Research, then continue (work-evaluator captures questions)
- BLOCKED → Capture blocker, surface to user

**Step 3: Capture Deferred Work (on INCOMPLETE/BLOCKED)**

When exiting with INCOMPLETE or BLOCKED, capture remaining work:

```
Skill("do:deferred-work-capture") with:
  title: "<remaining item or blocker>"
  description: |
    Iterative workflow exited before completion.

    Status: INCOMPLETE | BLOCKED
    What was done: <completed work>
    What remains: <remaining work>
    Why stopping: <reason>
  type: task  # or "clarify" for PAUSE questions
  priority: <based on original priority>
  source_context: "iterative-workflow <verdict> for <feature>"
```

**Loop** until COMPLETE or BLOCKED.

## Output

```
═══════════════════════════════════════
Iterative Implementation Complete
  Iterations: [count]
  Files: [count] | Commits: [count]
Next: /do:plan to update status
═══════════════════════════════════════
```
