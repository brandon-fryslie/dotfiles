---
name: "do-distill"
description: "See the essence of a codebase. Identifies core abstractions, surfaces dilution and scattering, finds the true shape beneath accumulated code. Outputs a distillation - a seeing, not a plan. Use before pruning or honing."
---

# Distill

See what a codebase is *really* trying to be.

## Purpose

Before you can prune the dead or hone the dull, you must see clearly. Distill is the seer - it asks "what is this, really?" and surfaces the answer.

**Output**: A distillation document. Not a plan to change. A seeing.

## When to Use

- After a productive build session, before refining
- When inheriting or returning to unfamiliar code
- Before major architectural decisions
- When the codebase feels heavy but you can't say why
- As the first step in the distill → prune → hone cycle

## Process

### Phase 1: Fresh Eyes

Read the codebase as a stranger would. Forget what you know about its history.

**Ask**:
- What would someone need to understand to grok this?
- What are the 3-5 concepts that carry the weight?
- Where does the eye snag? What feels heavier than it should?

**Explore**:
- Entry points (main, index, app)
- Public interfaces (exports, APIs, CLI)
- Directory structure and naming

### Phase 2: Find the Load-Bearing Concepts

Every codebase has a small number of core abstractions that everything else hangs on. Find them.

**Indicators of core concepts**:
- Referenced from many places
- Other code exists to serve them
- Changing them would cascade widely
- They appear in naming, documentation, conversation

**Document**:
| Concept | What It Is | Where It Lives | Dependencies |
|---------|------------|----------------|--------------|
| ... | ... | ... | ... |

### Phase 3: Surface Dilution

Essence gets diluted when the same concept is expressed in multiple places, or when one concept is doing the work of several.

**Look for**:

**Scattered essence** - Same idea, multiple implementations:
- Two functions that do nearly the same thing
- Parallel hierarchies (UserService and UserManager)
- Repeated patterns that could be unified

**Diluted responsibility** - One thing doing too many jobs:
- God objects/modules
- Functions with "and" in their purpose
- Files that grew beyond their name

**Obscured essence** - Core concepts buried under accretion:
- Business logic hiding in utility files
- Important abstractions with generic names
- Load-bearing code that looks like helpers

### Phase 4: Find the Implied Architecture

Beneath the accumulated code is the architecture it wants to be. This may differ from what's documented or intended.

**Ask**:
- What structure would make this code obvious?
- Where are the natural boundaries?
- What dependencies exist vs. which should exist?

**Map**:
```
[Current State]          [Implied State]
A → B → C               A → B
    ↓                       ↓
    D ← E                   C → D
```

### Phase 5: The Stranger Test

Imagine explaining this codebase to a competent developer in 5 minutes. What would you say?

- If it takes longer, there's unnecessary complexity
- If you'd skip parts, those parts may not belong
- If you'd apologize for something, that's a signal

## Output Format

Write `DISTILLATION-<timestamp>.md`:

```markdown
# Distillation: [Project/Module Name]
Timestamp: <YYYY-MM-DD-HHmmss>
Scope: [what was examined]

## The Essence

**In one sentence**: [What this codebase is trying to be]

**Core concepts** (the load-bearing abstractions):
1. **[Concept]**: [What it is, where it lives]
2. **[Concept]**: [What it is, where it lives]
3. ...

## Where Essence Is Strong

[Parts of the codebase where the core concepts are clear, well-expressed, and focused]

- [Component/area]: [Why it's clear]
- ...

## Where Essence Is Diluted

### Scattered
[Same concept, multiple expressions]

| Concept | Expressions | Files |
|---------|-------------|-------|
| ... | ... | ... |

### Overloaded
[One thing doing too many jobs]

| Component | Responsibilities | Should Be |
|-----------|------------------|-----------|
| ... | ... | ... |

### Obscured
[Important things hiding in plain sight]

| What | Where It Hides | Its True Nature |
|------|----------------|-----------------|
| ... | ... | ... |

## The Implied Architecture

**Current shape**: [Brief description of how it's organized now]

**Natural shape**: [What structure the code wants to have]

**Tension points**: [Where current and natural shapes conflict]

## The Stranger Test

If I had 5 minutes to explain this codebase:

[Write the explanation you'd actually give]

**What I'd skip**: [Parts that don't belong in the core explanation]

**What I'd apologize for**: [Parts that feel wrong or overly complex]

## For the Practitioner

This distillation is a seeing, not a prescription.

**If proceeding to prune**: The scattered and obscured sections show where dead wood may hide.

**If proceeding to hone**: The overloaded and tension points show where sharpening is needed.

**If setting this aside**: Return when you're ready. The codebase will wait.
```

## Guidance

**Be patient**. Distillation cannot be rushed. If the essence isn't clear yet, keep looking.

**Be honest**. Name what you see, even if it's uncomfortable. A true seeing serves better than a kind one.

**Be humble**. You may be wrong about what's essential. The distillation is a hypothesis, not a verdict.

**Let it breathe**. Sometimes the right action after distilling is to do nothing. The act of seeing changes how you see.

## What This Is Not

- Not an audit (no pass/fail, no priorities)
- Not a plan (no action items, no timeline)
- Not a review (no approval, no changes requested)

It is simply: seeing clearly what is there.
