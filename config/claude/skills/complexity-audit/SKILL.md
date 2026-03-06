---
name: complexity-audit
description: Audit a codebase for architectural complexity that blocks new feature development. Finds god modules, dead code, scattered concerns, duplicated state, incomplete refactorings, and UX special cases. Use when the user wants to evaluate complexity, find what to simplify, or decide what features to cut before building new ones.
---

# Complexity Audit

Systematic architectural complexity audit. Adapts approach based on project size — small projects get a full audit, large projects get a scoping question first.

## When to Use

- "audit this codebase for complexity"
- "what's blocking us from shipping new features"
- "where is complexity getting out of hand"
- "what can we simplify or cut"
- "complexity audit"
- Before major new feature work, to identify what to clean up first

## Workflow

### Step 1: Scope the Project

Before doing anything else, measure the project:

```
# Count source files (adjust glob for the project's language)
Glob(pattern="src/**/*.{py,ts,tsx,js,jsx,go,rs,java}")
```

Also quickly read the README, entry points, or CLI help to get a sense of what the application does.

Classify the project:
- **Small** (< 50 source files, < 10k LOC): proceed directly to **Full Audit** (Step 2A)
- **Large** (>= 50 source files or >= 10k LOC): proceed to **Scoping Question** (Step 2B)

### Step 2A: Full Audit (Small Projects)

For small projects, run both feature and subsystem audits. Skip the scoping question — just do everything. Proceed to Step 3 with mode = "features" (primary) + "subsystems" (secondary).

### Step 2B: Scoping Question (Large Projects)

Ask the user how they want to proceed. Use AskUserQuestion with these options:

- **Option 1: "Audit all features"** — Discover every user-visible feature, trace each across the codebase, and rate its complexity vs. value. Best when you want to know what to cut or simplify.
- **Option 2: "Audit all subsystems"** — Evaluate each module/directory for god modules, dead code, coupling, and structural issues. Best when you want to know where to refactor.
- **Option 3: [Agent's recommendation]** — Based on what you learned in Step 1, recommend the most useful approach. For example: "Audit features in the TUI layer" or "Audit the 5 largest modules." Explain why in the description.
- **Option 4: (free-form)** — The user types what they want.

### Step 3: Execute the Audit

#### Mode: Features

Feature-oriented audits have two phases: **discovery** then **tracing**.

##### Phase 1: Feature Discovery

Launch an Explore agent to discover the full feature list. The agent should read:
- README, CLAUDE.md, docs/ — what does the app claim to do?
- Entry points (main, CLI args, routes, config schemas) — what can be configured or invoked?
- UI layer (components, pages, commands, keybindings) — what can the user interact with?
- Any feature flags, toggle systems, or mode switches

Agent prompt:
```
Discover every user-visible feature in this application. A "feature" is anything a user
can see, interact with, configure, or that changes what they see.

Read these files to build the feature list:
[list entry points, README, UI files, CLI definitions, config schemas]

For each feature, report:
- Name (short, descriptive)
- One-line description of what it does for the user
- Which files appear to be involved (best guess from imports, function names, config keys)

Also identify any features that seem to exist in code but aren't documented — these are
especially important.

Do NOT edit any files. Output a numbered feature list.
```

##### Phase 2: Feature Tracing

For each discovered feature (or batch of 3-5 related features), launch an Explore agent to trace it across the codebase.

Agent prompt:
```
Trace the following feature(s) across the entire codebase:

[feature name]: [one-line description]
Files likely involved: [list from discovery phase]

For EACH feature, find and report:

1. **All files touched** — every file that contains logic for this feature (not just the
   primary file — find the tendrils)
2. **State managed** — what dicts, flags, caches, reactive properties, or cross-request
   state does this feature own or depend on?
3. **Special-case logic** — any if/else branches, mode flags, or conditional behavior
   specific to this feature. Count the branches.
4. **UX special cases** — places where this feature treats certain data differently for
   display purposes (e.g., "only the first message > 500 bytes gets tracked")
5. **Coupling** — does this feature's code reach into other features' state or logic?
   Would changing this feature force changes elsewhere?
6. **Boundary erosion** — does this feature force subsystems to know about each other that
   otherwise wouldn't? Does it create imports or dependencies between modules that have
   no other reason to be connected? A feature that erodes subsystem boundaries is more
   expensive than its own line count suggests.
7. **Dead or vestigial parts** — any code that was part of this feature but appears unused
8. **Parameter threading** — how many layers does data pass through to get from input to
   where it's used?

Be exhaustive — grep for related identifiers, follow imports, check tests.
Report line counts. Do NOT edit any files.
```

##### Phase 3: Synthesize Feature Report

After all tracing agents complete, compile the feature-by-feature assessment.

#### Mode: Subsystems

Subsystem-oriented audits group files into logical modules and audit each in parallel.

##### Phase 1: Group Files

Group all source files into 3-6 logical subsystems based on directory structure, imports, or concern. Each group becomes one parallel audit agent.

##### Phase 2: Parallel Module Audits

Launch one Explore agent per subsystem:

```
Read and analyze the following files thoroughly for complexity:

[list files]

For each file, assess:
1. Special-case logic (if/else chains, mode flags, conditional behavior) — count branches
2. "UX special cases" — places where code treats certain data differently for display
3. Incomplete refactorings or dead code — leftover junk, half-finished migrations
4. Feature flags or mode switches — how many, are they all wired/used
5. How many distinct "features" / concerns each file supports (god module detection)
6. Coupling between features — can they be changed independently?

Cross-cutting (look across all files in this group):
7. State duplication — same concept in multiple places
8. Parameter threading depth — how deep values must pass through layers
9. Scattered ownership — same concern handled at multiple callsites
10. Boundary clarity — does this subsystem have a clear, narrow interface? Or do other
    modules reach into its internals, import its private types, or depend on its
    implementation details? A subsystem with a diffuse boundary is a complexity
    multiplier — every feature that touches it has to understand its internals.
    Look for: wide import surfaces, modules that import from deep paths within this
    subsystem, circular or bidirectional dependencies, types that leak across boundaries.

Also search for TODO, FIXME, HACK, XXX comments in these files.

Be exhaustive — read each entire file and report everything you find. Do NOT edit any files.
Report line counts for each file.
```

##### Phase 3: Synthesize Subsystem Report

After all agents complete, compile the module complexity map and cross-cutting findings.

### Step 4: Write Report

Write the report to a project-appropriate location (e.g., `.agent_planning/COMPLEXITY-AUDIT-{date}.md` or `docs/COMPLEXITY_AUDIT.md`). Do NOT overwrite existing audit files — create a new dated one.

## Report Templates

### Feature Audit Report

```markdown
# Complexity Audit: [Project Name] — Features

**Date:** YYYY-MM-DD
**Scope:** [N] features across [M] source files ([L] LOC)

## Executive Summary
- Features audited: N
- Features rated HIGH complexity: list
- Features that touch 3+ subsystems: list
- Recommended cuts/simplifications: list
- Quick wins: list

## Feature-by-Feature Complexity Assessment

### 1. [Feature Name]
**Complexity: HIGH/MODERATE/LOW | Value: HIGH/MODERATE/LOW | Verdict: KEEP/SIMPLIFY/EVALUATE/CONSIDER REMOVING/CONSOLIDATE**

- **What:** One-line description of what the feature does
- **Where:** file(s) and approximate line counts
- **Files touched:** N files across M directories (list them)
- **State:** What state does this feature manage? (dicts, flags, caches, cross-request state)
- **UX special cases:** Places where this feature treats certain data differently for display
- **Coupling:** What other features does this reach into? What breaks if you change it?
- **Boundary erosion:** Does this feature force subsystems to know about each other? Note which
  subsystem boundaries are degraded by this feature's existence. (Often a poorly designed feature
  forces subsystems to have poor boundaries, and those boundaries can't be fixed while the feature exists.)
- **Why it's complex:** Root cause of the complexity
- **Why keep/cut:** Justification for the verdict
- **If removed:** What architectural cleanup becomes possible? Be specific: name the legacy code
  paths that could be deleted, the subsystem boundaries that could be restored, the isolation
  improvements that would follow. Then name what those improvements would enable — which future
  features become simpler, which existing features could be made more uniform or consistent.
  Example: "Removing Feature A would let us delete the dual-path rendering in rendering.py and
  restore the boundary between formatting and display. That isolation would let us implement
  Features B and C with a single render path instead of the current per-type dispatch."

[Repeat for every feature. The list must be EXHAUSTIVE — include features the user
might not even know exist. Features that seem simple but have hidden complexity
are especially important to surface.]

## Dead Code & Quick Wins

### Dead/Unused Types
| Type | Status | Action |
|------|--------|--------|
| `FooBlock` | Defined but never instantiated | **REMOVE** |

### Dead Functions
| Function | Location | Action |
|----------|----------|--------|
| `unused_func()` | module.py:123 | **REMOVE** |

### Dual Implementations
| Concern | Approach A | Approach B | Action |
|---------|-----------|-----------|--------|
| Token counting | heuristic in analysis.py | tiktoken in counter.py | Pick one |

## Complexity Blockers for Future Work

What upcoming features or changes would be difficult given current complexity?
For each blocker:
1. What you'd want to build
2. What makes it hard today
3. What to simplify first

## Recommended Complexity Reduction Plan

### Phase 1: Quick Wins (remove dead weight)
1. ...

### Phase 2: Simplify High-Complexity Features
1. ...

### Phase 3: Feature Cuts (evaluate with user)
1. ...

## Risk Assessment

| Cut | Risk | Mitigation |
|-----|------|------------|
| ... | Zero/Low/Moderate/High | ... |
```

### Subsystem Audit Report

```markdown
# Complexity Audit: [Project Name] — Subsystems

**Date:** YYYY-MM-DD
**Scope:** [N] modules across [M] source files ([L] LOC)

## Executive Summary
- Total files audited: N
- Total lines of code: N
- God modules (>1 concern or >500 lines): list
- Dead code found: list
- Quick wins (removable with no behavior change): list

## Module Complexity Map

| Module | Lines | Complexity | Role |
|--------|-------|-----------|------|
| `module.py` | 1,483 | **HIGH** | Brief description of what it does and why it's complex |

## Subsystem Boundary Assessment

For each subsystem, assess boundary clarity:

### [Subsystem Name]
- **Boundary clarity:** CLEAR / DIFFUSE / ERODED
- **Interface width:** How many symbols (functions, types, constants) do other modules import?
- **Deep imports:** Do consumers import from internal/private paths, or only from the public surface?
- **Bidirectional deps:** Does this subsystem import from modules that also import from it?
- **Boundary erosion cause:** If DIFFUSE or ERODED, which features caused it? (Often a poorly
  designed feature forces subsystems to have poor boundaries, and those boundaries can't be
  fixed while the feature exists.)

Subsystems with diffuse boundaries are complexity multipliers — they make every feature
that touches them harder to reason about, test, and change.

## Per-Subsystem Findings

### [Subsystem Name]
For each finding:
- **What**: description
- **Where**: file:line
- **Severity**: High / Medium / Low
- **Type**: god-module | dead-code | scattered-concern | state-duplication |
            parameter-threading | dual-implementation | incomplete-refactoring |
            ux-special-case | feature-coupling | diffuse-boundary
- **Quick win?**: yes/no
- **Blocks**: what future work this complexity would obstruct

## Recommended Complexity Reduction Plan

### Phase 1: Quick Wins (remove dead weight)
1. ...

### Phase 2: Consolidate Duplication
1. ...

### Phase 3: Decompose God Modules
1. ...

### Phase 4: Feature Cuts (evaluate with user)
1. ...

## Risk Assessment

| Cut | Risk | Mitigation |
|-----|------|------------|
| ... | Zero/Low/Moderate/High | ... |
```

## Key Principles

- **Exhaustive**: Read every file, not just the ones that look complex. Complexity hides in unexpected places.
- **Quantitative**: Count lines, branches, concerns, duplication sites, files touched. "This file is complex" is not useful. "This file has 1,483 lines, 8 concerns, and 23 subclasses (2 dead)" is useful.
- **Actionable**: Every finding must say what to do about it and whether it's a quick win.
- **Feature-oriented**: Frame complexity in terms of what it blocks. "This duplication will cause bugs when you add X" is more useful than "this is duplicated."
- **Features cross boundaries**: A feature that adds complexity to 5 subsystems is more important to surface than a complex subsystem. The feature audit traces across module boundaries — that's the point.

## What This Is NOT

- Not a style/lint audit — don't flag formatting, naming conventions, or missing docstrings
- Not a security audit — don't flag vulnerabilities (use a security audit for that)
- Not a performance audit — don't flag slow code unless it's also structurally complex
- Focus exclusively on **architectural complexity that impedes change**
