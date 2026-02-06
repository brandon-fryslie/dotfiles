---
name: "do-refactor"
description: "Safe code restructuring without behavior change. Use when user wants to improve code structure, clean up, or reorganize."
---

# Refactor

Safe restructuring. No behavior changes, just improved structure.

## Process

**Step 1**: Use do:project-evaluator to understand current structure and identify targets.

**Step 2**: Use do:iterative-implementer in **refactor mode**:
- Incremental structural changes
- Run existing tests after each change
- Commit frequently with clear messages

**Step 3**: Use do:work-evaluator to verify:
- All existing tests still pass
- No functionality changed
- Code quality improved

**Loop** until work-evaluator confirms COMPLETE.

## Constraints

- Tests must pass before and after
- No new features
- No behavior changes
- Commit each logical change separately

```
═══════════════════════════════════════
Refactor Complete
  Changes: [summary]
  Tests: All passing
  Commits: [count]
═══════════════════════════════════════
```
