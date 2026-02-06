---
name: "do-add-tests"
description: "Add tests to existing untested code. Use when user wants to improve test coverage for existing functionality."
---

# Add Tests

Add tests to existing code. NOT TDD - this is retroactive testing.

## Process

**Step 1**: Use do:project-evaluator to identify untested code in target area.

**Step 2**: Use do:functional-tester to design and write tests:
- Focus on real user workflows
- Verify actual behavior
- Meaningful coverage, not 100%

**Step 3**: Use do:work-evaluator to verify:
- Tests pass against current code
- Tests would fail if functionality broke
- No tautological tests

## Output

```
═══════════════════════════════════════
Tests Added
  Target: [what was tested]
  Tests: [count] new tests
  Coverage: [before] → [after]
  Files: [test files created/modified]
═══════════════════════════════════════
```
