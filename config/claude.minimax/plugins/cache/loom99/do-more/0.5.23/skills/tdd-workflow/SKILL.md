---
name: "do-tdd-workflow"
description: "Test-Driven Development workflow. Use when user explicitly wants TDD or when implementing API/logic with existing test framework."
---

# TDD Workflow

Tests first, then implement.

## TestLoop (max 3 iterations)

**Step 1: Design tests**
Use do:functional-tester to write failing tests:
- Real user workflows
- Un-gameable by design
- Verify actual behavior

**Step 2: Evaluate tests**
Use do:project-evaluator to verify tests meet criteria:
- Useful, complete, flexible
- Would fail if functionality faked

**Loop** until tests are sufficient.

## ImplementLoop

**Step 1: Implement**
Use do:test-driven-implementer to make tests pass:
- Real functionality, no shortcuts
- No test modification
- Clean, maintainable code

**Step 2: Evaluate**
Use do:work-evaluator to assess:
- All tests pass
- No outstanding issues

**Loop** until complete.

## Output

```
═══════════════════════════════════════
TDD Implementation Complete
  Tests: [count] | All passing
  Files: [count] | Commits: [count]
Next: /do:plan to update status
═══════════════════════════════════════
```
