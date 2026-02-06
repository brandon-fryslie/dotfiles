# Verification Templates

Templates for presenting work for user verification, organized by work type.

## Implementation Work

```markdown
### [Feature Name]
**What was done**: [Implementation summary]
**Files changed**: [file1.py, file2.py]
**How to verify**:
- [ ] Run tests: `pytest tests/test_feature.py -v`
- [ ] Manual test: [specific steps]
- [ ] Check [specific behavior]
```

## Bug Fix

```markdown
### Bug Fix: [Issue Description]
**Root cause**: [What was wrong]
**Fix applied**: [What was changed]
**Files changed**: [files]
**How to verify**:
- [ ] Reproduce original bug (should no longer occur)
- [ ] Run regression tests: `[command]`
- [ ] Check edge cases: [list any]
```

## Test Writing

```markdown
### Tests for [Component]
**Tests added**: [n] new tests
**Coverage**: [what's covered]
**Files**: [test files]
**How to verify**:
- [ ] Run tests: `[command]`
- [ ] All tests should pass
- [ ] Check coverage report if applicable
```

## Research/Planning

```markdown
### Research: [Topic]
**Question answered**: [the question]
**Recommendation**: [chosen option]
**Output file**: [RESEARCH-*.md or PLAN-*.md]
**How to verify**:
- [ ] Review [output file] for completeness
- [ ] Check alternatives were considered
- [ ] Verify recommendation fits your needs
```

## Refactoring

```markdown
### Refactor: [What was refactored]
**Before**: [old structure/pattern]
**After**: [new structure/pattern]
**Files changed**: [files]
**How to verify**:
- [ ] Run full test suite (no regressions)
- [ ] Check code is cleaner/more maintainable
- [ ] Verify functionality unchanged
```

## Documentation

```markdown
### Documentation: [What was documented]
**Created/Updated**: [files]
**Content added**: [summary]
**How to verify**:
- [ ] Read through documentation
- [ ] Check accuracy of examples
- [ ] Verify links work
```

## Multiple Small Changes

When several small changes were made, group them:

```markdown
### Various Updates
| Change | File | Verify |
|--------|------|--------|
| [change 1] | [file] | [how] |
| [change 2] | [file] | [how] |
| [change 3] | [file] | [how] |
```

## No Changes Made

When work was attempted but nothing changed:

```markdown
### [Task Attempted]
**Result**: No changes made
**Reason**: [why - e.g., "already implemented", "blocked by X", "needs clarification"]
**Next steps**: [what's needed to proceed]
```
