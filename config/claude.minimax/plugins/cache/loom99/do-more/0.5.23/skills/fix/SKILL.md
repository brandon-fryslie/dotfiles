---
name: "do-fix"
description: "Bug fix workflow with verification. Use when user wants to fix a known bug or issue."
---

# Fix

Bug fix with verification.

## Process

**Step 1**: If bug not already understood, use do:researcher to investigate.

**Step 2**: Use do:iterative-implementer to:
- Write failing test that reproduces bug (if testable)
- Implement the fix
- Verify test passes
- Check for regressions

**Step 3**: Use do:work-evaluator to confirm:
- Bug is fixed
- No regressions introduced
- Tests pass

## Output

```
═══════════════════════════════════════
Fix Complete
  Bug: [description]
  Solution: [what was changed]
  Tests: [passing | added new test]
  Commits: [count]
═══════════════════════════════════════
```
