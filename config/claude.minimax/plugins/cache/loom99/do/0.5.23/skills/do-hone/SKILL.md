---
name: "do-hone"
description: "Sharpen what remains toward its purpose. After distilling and pruning, hone tightens names, clarifies boundaries, simplifies signatures, and makes code say what it means. The blade cuts clean."
---

# Hone

Sharpen the blade.

## Purpose

After distillation reveals the essence and pruning removes the dead, honing sharpens what remains. Every name earns its letters. Every boundary becomes clear. Every signature says exactly what it means.

**Input**: A distillation and ideally a completed prune
**Output**: Targeted refinements that sharpen toward the revealed essence

## When to Use

- After `/do:prune` has cleared the dead wood
- When code works but feels dull or imprecise
- When names no longer match what things do
- When boundaries have blurred over time
- As the final step in distill → prune → hone

## Prerequisites

Check for distillation:
```bash
ls -t .agent_planning/DISTILLATION-*.md | head -1
```

Honing without knowing the essence is just polishing. Know what you're sharpening *toward*.

## Process

### Phase 1: Load the Essence

From the distillation, extract:

- **Core concepts** - These define what "sharp" means
- **Implied architecture** - The natural shape to sharpen toward
- **Overloaded components** - Need boundary clarification
- **Tension points** - Where current and natural shapes conflict

### Phase 2: Assess Sharpness

For each area of the codebase, ask:

**Names** - Do they say what things are?
- Does `processData` actually describe what it does?
- Do file names match their contents?
- Are concepts named consistently across the codebase?

**Boundaries** - Is it clear what belongs where?
- Can you tell what a module does from its exports?
- Are responsibilities clearly delineated?
- Do dependencies flow in the right direction?

**Signatures** - Do interfaces say what they mean?
- Are parameters necessary and sufficient?
- Are return types precise?
- Do function signatures reveal intent?

**Expressions** - Is the code saying what it means?
- Are there roundabout ways of doing simple things?
- Is cleverness obscuring clarity?
- Would a stranger understand the intent?

### Phase 3: Identify Dullness

Catalog what needs sharpening:

**Dull names**:
- Generic: `data`, `info`, `item`, `thing`, `result`
- Misleading: name says X, code does Y
- Inconsistent: same concept, different names
- Abbreviated: meaning lost to brevity

**Blurred boundaries**:
- Module doing unrelated things
- Unclear public vs. private
- Circular dependencies
- Leaky abstractions

**Vague signatures**:
- Too many parameters
- Unclear parameter purpose
- Return type less specific than actual
- Side effects hidden from signature

**Indirect expressions**:
- Three lines where one would do
- Abstraction adding complexity, not clarity
- Pattern applied where simple code suffices

### Phase 4: Plan the Sharpening

For each identified dullness:

| Current | Problem | Sharpened | Risk |
|---------|---------|-----------|------|
| `processData()` | Generic name | `validateUserInput()` | Low - rename only |
| `utils/helpers.ts` | Dumping ground | Split by purpose | Medium - moves code |
| `config` parameter object | 12 fields | 3 focused params | Medium - signature change |

**Prioritize**:
1. Names - lowest risk, highest clarity gain
2. Signatures - moderate risk, precision gain
3. Boundaries - highest risk, architectural gain

### Phase 5: Execute Sharpening

**For names**:
1. Rename with IDE refactoring (catches all references)
2. Update related names for consistency
3. Verify tests still pass

**For boundaries**:
1. Move one thing at a time
2. Update imports
3. Verify no circular dependencies introduced
4. Run tests after each move

**For signatures**:
1. Change internal implementation first
2. Update call sites
3. Deprecate old signature if public API
4. Run tests

**For expressions**:
1. Simplify one expression at a time
2. Ensure behavior unchanged
3. Run tests

## Output Format

Write `HONE-<timestamp>.md`:

```markdown
# Hone Report
Timestamp: <YYYY-MM-DD-HHmmss>
Based on: DISTILLATION-<timestamp>.md

## Sharpening Toward

The essence this honing serves:
[One sentence from distillation]

Core concepts guiding this work:
- [Concept 1]
- [Concept 2]

## Dullness Found

### Names
| Current | Problem | Location |
|---------|---------|----------|
| ... | ... | ... |

### Boundaries
| Component | Problem | Natural Shape |
|-----------|---------|---------------|
| ... | ... | ... |

### Signatures
| Function | Problem | Cleaner Form |
|----------|---------|--------------|
| ... | ... | ... |

### Expressions
| Location | Current | Sharper |
|----------|---------|---------|
| ... | ... | ... |

## Sharpening Plan

### Priority 1: Names (Low Risk)
| From | To | Files Affected |
|------|-----|----------------|
| ... | ... | ... |

### Priority 2: Signatures (Medium Risk)
| Function | Change | Call Sites |
|----------|--------|------------|
| ... | ... | ... |

### Priority 3: Boundaries (Higher Risk)
| Move | From | To | Rationale |
|------|------|-----|-----------|
| ... | ... | ... | ... |

## Execution Log

[After sharpening, record what changed]

| Change | Type | Commit | Tests |
|--------|------|--------|-------|
| Renamed X to Y | Name | abc123 | Pass |
| ... | ... | ... | ... |

## Post-Hone

The codebase now:
- [How it's sharper]
- [What's clearer]
- [What a stranger would now understand]
```

## Guidance

**Sharp means clear, not clever.** The goal is code that says what it means, not code that impresses.

**Names are the cheapest improvement.** A good name costs nothing and pays forever.

**Boundaries matter more than they seem.** A clear boundary prevents a hundred future confusions.

**Hone toward the essence.** Every sharpening should make the core concepts clearer, not just make code "nicer."

## What This Is Not

- Not refactoring (we're not restructuring architecture)
- Not adding features (we're not changing behavior)
- Not formatting (we're not adjusting whitespace)

It is simply: making the code say what it means.

## The Trio Complete

```
distill  →  See the essence
prune    →  Remove the dead
hone     →  Sharpen what remains
```

The codebase breathes. The blade cuts clean. The work is done - until it grows again.
