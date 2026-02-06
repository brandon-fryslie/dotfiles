---
name: "do-prune"
description: "Remove what has served its purpose and now obscures. Finds dead code, orphaned functions, scaffolding that outlived its use, and vestigial features. Uses distillation to know what to preserve. Outputs proposed removals with rationale."
---

# Prune

Remove the dead so the living can breathe.

## Purpose

After distillation reveals the essence, pruning removes what obscures it. Not refactoring - removal. The codebase should be smaller when you're done.

**Input**: A distillation (DISTILLATION-*.md) or run distill first
**Output**: Proposed removals with rationale, then the removals themselves

## When to Use

- After `/do:distill` has revealed the essence
- When the codebase feels cluttered
- Before major work, to clear the ground
- When tests pass but the code feels heavy

## Prerequisites

Check for existing distillation:
```bash
ls -t .agent_planning/DISTILLATION-*.md | head -1
```

If none exists or it's stale (>7 days), run distill first. Pruning without seeing is reckless.

## Process

### Phase 1: Load the Essence Map

Read the most recent distillation. Extract:

- **Core concepts** - These are protected. Do not prune.
- **Where essence is strong** - Tread carefully here.
- **Scattered essence** - Candidates for unification (prune the duplicates)
- **Obscured essence** - Something may be hiding important code
- **What would be skipped** - Prime pruning territory

### Phase 2: Hunt for Dead Wood

With the essence map as guide, search for:

**Unreachable code**:
- Unexported functions never called internally
- Exports never imported elsewhere
- Code paths behind impossible conditions
- Feature flags that are always off

**Orphaned artifacts**:
- Test files for deleted code
- Config for removed features
- Types/interfaces with no implementors
- Documentation for things that don't exist

**Scaffolding that stayed**:
- Console.logs and debug statements
- Commented-out code blocks
- TODO/FIXME that will never be done
- Temporary workarounds that became permanent

**Vestigial features**:
- Half-removed functionality
- Backwards compatibility for nothing
- Fallbacks to paths never taken
- Dual implementations where one won

**Redundant expressions**:
- From distillation's "scattered" section
- Same logic in multiple places
- Parallel hierarchies
- Copy-pasted patterns

### Phase 3: Verify Safety

For each candidate removal, verify:

| Check | Method |
|-------|--------|
| Not in core concepts? | Cross-reference distillation |
| Not imported/called? | Grep for references |
| Tests still pass without it? | Delete and run tests |
| No runtime references? | Check dynamic imports, reflection |

**If uncertain, don't cut.** Mark for review instead.

### Phase 4: Propose Removals

Before cutting, document what and why:

```markdown
## Proposed Removals

### Category: [Unreachable/Orphaned/Scaffolding/Vestigial/Redundant]

| File | Lines | What | Why Safe to Remove |
|------|-------|------|-------------------|
| src/utils/old.ts | 45-120 | `legacyParser` function | No imports, replaced by `parser.ts` |
| ... | ... | ... | ... |

**Total**: ~N lines across M files
```

### Phase 5: Execute Removals

Once proposed removals are reviewed:

1. **Remove in order of isolation** - Start with most isolated (fewest references)
2. **Run tests after each removal** - Catch unexpected dependencies
3. **Commit incrementally** - One logical removal per commit
4. **Document surprises** - If something breaks, note why

## Output Format

Write `PRUNE-<timestamp>.md`:

```markdown
# Prune Report
Timestamp: <YYYY-MM-DD-HHmmss>
Based on: DISTILLATION-<timestamp>.md

## Essence Preserved

Core concepts from distillation (protected from pruning):
- [Concept 1]
- [Concept 2]
- ...

## Dead Wood Found

### Unreachable Code
| Location | What | Evidence |
|----------|------|----------|
| ... | ... | No references found |

### Orphaned Artifacts
| Location | What | Evidence |
|----------|------|----------|
| ... | ... | Parent feature removed |

### Scaffolding
| Location | What | Evidence |
|----------|------|----------|
| ... | ... | Debug/temporary markers |

### Vestigial Features
| Location | What | Evidence |
|----------|------|----------|
| ... | ... | Partial removal detected |

### Redundant Expressions
| Location | What | Consolidate To |
|----------|------|----------------|
| ... | ... | [canonical location] |

## Proposed Removals

**Safe to remove** (verified no references, tests pass):

| File | Lines | Description |
|------|-------|-------------|
| ... | ... | ... |

**Total reduction**: ~N lines

**Review recommended** (uncertain or has references):

| File | Lines | Concern |
|------|-------|---------|
| ... | ... | [why uncertain] |

## Removal Log

[After execution, record what was actually removed]

| Commit | Files | Lines Removed | Notes |
|--------|-------|---------------|-------|
| abc123 | 3 | 145 | Removed legacy parser |
| ... | ... | ... | ... |

**Final reduction**: N lines removed, M files deleted

## Post-Prune

Tests: PASS/FAIL
Build: PASS/FAIL
Unexpected breaks: [list any surprises]
```

## Guidance

**Cut confidently, but verify first.** The distillation tells you what matters. Everything else is a candidate.

**Small cuts compound.** Don't only hunt for large dead branches. The scattered twigs add up.

**If it might be needed someday, it's still dead today.** Git remembers. You can bring it back.

**Redundancy is a form of death.** When the same thing exists twice, one of them is dead weight - even if both "work."

## What This Is Not

- Not refactoring (we're not restructuring, just removing)
- Not optimization (we're not making faster, just smaller)
- Not cleanup (we're not formatting or renaming)

It is simply: removing what no longer serves.
