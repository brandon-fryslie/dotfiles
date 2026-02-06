# FINAL RUN - Encyclopedia Generation & Archival

This is a FINAL run. All items are resolved (100% progress). Time to generate the canonical specification encyclopedia and archive sources.

## Output Model: Encyclopedia + Monolith

The final output includes BOTH:

1. **Encyclopedia** (directory): Topic-based documents with full detail, cross-linking, and comprehensive coverage
2. **Monolith** (single file): Executive summary document for quick reference and overview

The **encyclopedia topic documents should go into MORE detail** than the monolith is capable of containing. The monolith provides a high-level overview; the encyclopedia provides exhaustive specification.

**Naming**:
- Encyclopedia: `CANONICAL-<topic>-<timestamp>/` (directory)
- Monolith: `CANONICAL-ARCHITECTURE-<topic>-<timestamp>.md` (single file)

## What to Read

1. Read ALL source files listed in prior output's `source_files` front-matter
2. Read the most recent `CANONICALIZED-*` files
3. Read `CANONICALIZED-TOPICS-*.md` for topic breakdown
4. This re-read serves as validation that the index accurately captured all content

## Step 1: Determine Encyclopedia Structure

From the TOPICS file and your analysis, finalize the three-tier encyclopedia structure:

```
CANONICAL-<topic>-<timestamp>/
├── INDEX.md                      # Master navigation
├── TIERS.md                      # Explains tier system
├── <topic-1>/                    # Topic directories
│   ├── t1_<slug>.md             # Foundational content
│   ├── t2_<slug>.md             # Structural content
│   └── t3_<slug>.md             # Optional content
├── <topic-2>/
│   ├── t1_<slug>.md
│   └── t2_<slug>.md             # Not all topics need all tiers
├── GLOSSARY.md                   # All terms, alphabetically
├── RESOLUTION-LOG.md             # Decision history
└── appendices/
    ├── source-map.md
    └── superseded-docs.md
```

**Naming the directory**: Use the primary topic slug and timestamp:
- `CANONICAL-oscilla-v2-20260109-170000/`
- `CANONICAL-payment-api-20260109-170000/`

## Step 2: Create Directory Structure

```bash
mkdir -p CANONICAL-<topic>-<timestamp>/<topic-dir-1>
mkdir -p CANONICAL-<topic>-<timestamp>/<topic-dir-2>
mkdir -p CANONICAL-<topic>-<timestamp>/appendices
```

Create one directory per topic (not per tier - tiers are file prefixes within topics).

## Step 3: Generate INDEX.md

```markdown
---
status: CANONICAL
generated: <timestamp>
approved_by: <user>
approval_method: <full_walkthrough / summary_review / bulk_approve>
source_documents: <count>
topics: <count>
---

# <Topic>: Canonical Specification Index

> **STATUS: CANONICAL**
> This is the authoritative source of truth for <topic>.
> All other documents are superseded by this specification series.

Generated: <timestamp>
Approved by: <user>
Source Documents: <count> files from `<source_path>`

---

## Quick Navigation

| Document | Description |
|----------|-------------|
| [TIERS](./TIERS.md) | Explains the three-tier system |
| [GLOSSARY](./GLOSSARY.md) | Term definitions |
| [Resolution Log](./RESOLUTION-LOG.md) | Decision history |

## Topics

| # | Topic | T1 Files | T2 Files | T3 Files |
|---|-------|----------|----------|----------|
| 01 | [<topic-1>](./<topic-1>/) | <slugs> | <slugs> | <slugs> |
| 02 | [<topic-2>](./<topic-2>/) | <slugs> | <slugs> | - |
| ... | | | | |

## Recommended Reading Order

For newcomers to this architecture:

1. **[TIERS](./TIERS.md)** - Understand the organization system
2. **All `**/t1_*.md` files** - Foundational content (small and critical)
3. **Relevant `**/t2_*.md` files** - Structural context for your area
4. **[GLOSSARY](./GLOSSARY.md)** - Reference as needed

For implementers:
1. All `**/t1_*.md` files - Cannot violate these
2. Relevant `**/t2_*.md` files for your component
3. Consult `**/t3_*.md` files when you need specific details
4. [GLOSSARY](./GLOSSARY.md) - Naming conventions

For agents:
- **Always read**: `**/t1_*.md` (foundational across all topics)
- **Usually read**: `**/t2_*.md` (structural for relevant topics)
- **Consult as needed**: `**/t3_*.md` (reference material)

## Search Hints

Looking for something specific? Here's where to find it:

| Concept | Location |
|---------|----------|
| [concept] | [file#section] |
| [term] | [GLOSSARY.md#term] |
| [invariant] | [INVARIANTS.md#section] |

## Appendices

- [Source Map](./appendices/source-map.md) - Which sources contributed to which sections
- [Superseded Documents](./appendices/superseded-docs.md) - Archived original documents

---

## About This Encyclopedia

This specification series was generated through a structured canonicalization process:

1. **Source Analysis**: <N> documents analyzed for contradictions and ambiguities
2. **Resolution**: <N> items resolved through iterative refinement
3. **Editorial Review**: Peer design review conducted
4. **User Approval**: All decisions approved by <user>

Resolution history is preserved in [RESOLUTION-LOG.md](./RESOLUTION-LOG.md).
```

## Step 4: Generate TIERS.md

```markdown
---
parent: INDEX.md
---

# Tier System

This specification uses a three-tier system based on change cost.

## The Question

For any piece of information, ask: **"How expensive would this be to change?"**

## The Tiers

| Tier | File Prefix | Meaning | Contents |
|------|-------------|---------|----------|
| **T1** | `t1_*.md` | Cannot change. Would make this a different application. | Core principles, invariants |
| **T2** | `t2_*.md` | Can change, but it's work. Affects many other things. | Architecture, type system |
| **T3** | `t3_*.md` | Use it or don't. Change freely if something works better. | Examples, implementation details |

## Organization

- **Topics are directories**: Each topic (type-system, topology, etc.) has its own directory
- **Tiers are file prefixes**: Within each topic, files are prefixed with `t1_`, `t2_`, or `t3_`
- **Not all topics need all tiers**: Some topics may only have foundational or only optional content

## Conflict Resolution

**Lower tier number wins.**

If a `t3_*.md` file conflicts with a `t1_*.md` file, the t1 file wins. No exceptions.

## Reading Guide

For agents working with this specification:

- **Always read**: `**/t1_*.md` (all foundational content across all topics - small and critical)
- **Usually read**: `**/t2_*.md` (all structural content for relevant topics)
- **Consult as needed**: `**/t3_*.md` (reference material when you need specific details)

## Example Structure

```
type-system/
├── t1_core-types.md     # float, int, 5 axes - cannot change
├── t2_block-roles.md    # BlockRole architecture - hard to change
└── t3_diagnostics.md    # event types - change freely

topology/
├── t1_invariants.md     # multi-in/multi-out - cannot change
└── t2_dataflow.md       # edge semantics - hard to change
```
```

## Step 5: Generate SUMMARY.md (REMOVED)

This step is removed. The encyclopedia no longer has a monolithic SUMMARY.md. The purpose is served by:
- TIERS.md (explains the system)
- INDEX.md (navigation)
- Individual tier files (actual content)

## Step 6: Generate GLOSSARY.md (formerly Step 4)

```markdown
---
parent: INDEX.md
---

# <Topic>: Executive Summary

> Start here for a high-level understanding of the architecture.

## What This System Does

[2-3 paragraphs explaining the purpose and value proposition]

## Key Design Principles

1. **[Principle 1]** - [Brief explanation]
2. **[Principle 2]** - [Brief explanation]
3. **[Principle 3]** - [Brief explanation]

## Architecture at a Glance

[High-level architecture diagram or description]

### Major Components

| Component | Purpose | Key Document |
|-----------|---------|--------------|
| [Name] | [Brief] | [Link to topic] |

### Data Flow

[Brief description of how data moves through the system]

## What's New / What Changed

[If this is an update to a prior spec, summarize changes]

## Quick Reference

- **Invariants**: [INVARIANTS.md](./INVARIANTS.md)
- **Glossary**: [GLOSSARY.md](./GLOSSARY.md)
- **Full Topic List**: [INDEX.md](./INDEX.md)
```

## Step 6: Generate GLOSSARY.md (no longer Step 5, INVARIANTS.md removed)

Merge from CANONICALIZED-GLOSSARY plus all resolved terms from QUESTIONS.

```markdown
---
parent: INDEX.md
---

# Glossary

> Authoritative definitions for all terms in this specification.

Use these definitions consistently. When in doubt, this is the canonical source.

---

## Terms

### A

#### [Term]

**Definition**: [Complete, unambiguous definition]

**Type**: concept | type | variable | parameter | unit | abbreviation

**Canonical Form**: `exactSpelling` (use this exact casing/formatting)

**Related**: [Other terms], [See Also]

**Example**: [Usage example if helpful]

**Source**: [Which topic document defines this in context]

---

[Continue alphabetically]

---

## Naming Conventions

### General Rules

- [Convention 1]: [Description]
- [Convention 2]: [Description]

### Specific Patterns

| Pattern | When to Use | Example |
|---------|-------------|---------|
| [pattern] | [context] | [example] |

---

## Abbreviations

| Abbr | Expansion | Context |
|------|-----------|---------|
| [abbr] | [full] | [when used] |

---

## Deprecated Terms

| Deprecated | Use Instead | Notes |
|------------|-------------|-------|
| [old term] | [new term] | [migration notes] |
```

## Step 7: Generate RESOLUTION-LOG.md

```markdown
---
parent: INDEX.md
---

# Resolution Log

> Record of key decisions made during canonicalization.

This document preserves the rationale for important decisions.
If you're wondering "why is it this way?", check here.

---

## Decision Summary

| ID | Decision | Resolution | Rationale |
|----|----------|------------|-----------|
| D1 | [topic] | [choice] | [brief why] |

---

## Detailed Decisions

### D1: [Decision Title]

**Category**: Critical Contradiction / High-Impact Ambiguity / Terminology / Gap

**The Problem**:
[What was unclear or conflicting]

**Options Considered**:
1. **[Option A]**: [Description]
   - Pros: [list]
   - Cons: [list]

2. **[Option B]**: [Description]
   - Pros: [list]
   - Cons: [list]

**Resolution**: [Option chosen]

**Rationale**: [Why this choice]

**Implications**: [What this affects]

**Approved**: <timestamp> by <user>

---

[Continue for all significant decisions]
```

## Step 8: Generate Topic Documents (Tier Files)

For each topic identified in CANONICALIZED-TOPICS, generate tier files within that topic's directory.

### T1 (Foundational) Files - `<topic>/t1_<slug>.md`

```markdown
---
parent: ../INDEX.md
topic: <topic-slug>
tier: 1
---

# <Topic>: <Title> (Foundational)

> **Tier 1**: Cannot change. Would make this a different application.

**Related Topics**: [links to other topic directories]
**Key Terms**: [links to glossary entries]

---

## Overview

[What makes this foundational - why can't we change it?]

## Core Principles

[The inviolable principles for this topic]

## Invariants

[Rules that cannot be violated]

**Rule**: [Clear statement of what must always be true]

**Rationale**: [Why this matters]

**Consequences of Violation**: [What breaks]

---

## See Also

- [Related t2 file](./t2_<slug>.md) - Structural details
- [Glossary: Key Term](../GLOSSARY.md#term)
```

### T2 (Structural) Files - `<topic>/t2_<slug>.md`

```markdown
---
parent: ../INDEX.md
topic: <topic-slug>
tier: 2
---

# <Topic>: <Title> (Structural)

> **Tier 2**: Can change, but it's work. Affects many other things.

**Foundational Prerequisites**: [t1_<slug>.md] - Read this first
**Related Topics**: [links to other topics]

---

## Overview

[Architectural decisions for this area]

## [Section 1]

[Core architectural content]

## Type Definitions

```typescript
// Type definitions with comments
```

## Behavioral Specification

**When**: [trigger]
**Then**: [behavior]

---

## See Also

- [Foundational content](./t1_<slug>.md)
- [Optional details](./t3_<slug>.md)
```

### T3 (Optional) Files - `<topic>/t3_<slug>.md`

```markdown
---
parent: ../INDEX.md
topic: <topic-slug>
tier: 3
---

# <Topic>: <Title> (Optional)

> **Tier 3**: Use it or don't. Change freely if something works better.

**Context**: This provides examples and implementation suggestions.

---

## Examples

[Concrete examples]

## Implementation Patterns

[Suggested patterns - not prescriptive]

## Additional Details

[Deep technical details that can vary]

---

## See Also

- [Core architecture](./t2_<slug>.md)
- [Foundational rules](./t1_<slug>.md)
```

## Step 9: Generate Appendices

### source-map.md

```markdown
---
parent: ../INDEX.md
---

# Source Document Map

Which original documents contributed to which parts of this specification.

| Specification Section | Primary Sources |
|-----------------------|-----------------|
| [INVARIANTS.md] | [source1.md], [source2.md] |
| [topics/01-xxx.md] | [source3.md] |
| [GLOSSARY.md] | All sources |
```

### superseded-docs.md

```markdown
---
parent: ../INDEX.md
---

# Superseded Documents

The following documents are now historical artifacts.
This specification series is the authoritative source.

## Archived Documents

| Document | Original Location | Archived To |
|----------|-------------------|-------------|
| [name] | [path] | [archive-path] |

## Archive Location

All original documents were moved to:
`<archive-directory>/`

## Using Archived Documents

The archived documents may be useful for:
- Understanding historical context
- Reviewing original phrasing
- Tracing how decisions evolved

They should NOT be used for:
- Current implementation guidance
- Authoritative definitions
- Design decisions
```

## Step 10: Generate Monolith Document (REMOVED)

This step is removed. The encyclopedia structure with TIERS.md and INDEX.md serves the "quick reference" purpose.

Agents can easily filter by tier using glob patterns (`**/t1_*.md`), and humans can navigate via INDEX.md.

## Step 11: Archive Source Files (was Step 11, now Step 9)

```markdown
---
command: /canonicalize-architecture <arguments>
files: [list of files]
status: CANONICAL
source_files:
  - [list]
encyclopedia: CANONICAL-<topic>-<timestamp>/
archived_to: <archive-directory>/
---

# <Topic>: Canonical Architecture Specification

> **This is the authoritative source of truth for <topic>.**
> For detailed specifications, see the encyclopedia: [CANONICAL-<topic>-<timestamp>/](./CANONICAL-<topic>-<timestamp>/)

Generated: <timestamp>
Approved by: <user>

[Condensed version of the specification covering:]
1. Overview (2-3 paragraphs)
2. Invariants (summary table with links to encyclopedia)
3. Architecture overview (high-level, with links to topic docs for detail)
4. Key components (brief descriptions)
5. Glossary (abbreviated - key terms only, with link to full glossary)
6. Resolution log (summary table)

[For each section, include a note like:]
> **Full specification**: See [01-type-system.md](./CANONICAL-<topic>-<timestamp>/topics/01-type-system.md)
```

**Key principle**: The monolith is a **summary document** that links to the encyclopedia for detail. It should be self-contained enough to understand the architecture, but explicitly defer to topic documents for exhaustive specification.

## Step 9: Archive Source Files (formerly Step 11)

After generating the encyclopedia:

1. **Determine archive location**: Create archive directory
   - If sources are in `design-docs/spec/`, archive to `design-docs/spec-archived-<timestamp>/`

2. **Move source files**: Move all files listed in `source_files` to the archive
   - Preserve directory structure within the archive
   - Do NOT move the new `CANONICAL-*` directory

3. **Move intermediate outputs**: Also archive the `CANONICALIZED-*` working files
   - These are historical artifacts of the resolution process
   - Only the `CANONICAL-*` encyclopedia should remain

4. **Update superseded-docs.md**: Record all archived files

## Step 10: Validate Encyclopedia (formerly Step 12)

Before announcing completion, verify:

- [ ] INDEX.md has valid links to all topic directories
- [ ] TIERS.md exists and explains the system
- [ ] All tier files exist (t1, t2, t3 as planned)
- [ ] T1 files are small and critical
- [ ] T2 files contain structural/architectural content
- [ ] T3 files contain examples/implementation details
- [ ] GLOSSARY.md includes all terms from CANONICALIZED-GLOSSARY plus resolved terms
- [ ] Cross-links work (no broken relative links)
- [ ] No TODO/TBD markers remain
- [ ] All source files archived
- [ ] Tier prefixes are consistent (t1_, t2_, t3_)

## Output to User

1. Print: "FINAL RUN - Generating three-tier canonical specification encyclopedia..."
2. Announce: "All items resolved! Creating encyclopedia structure..."
3. List the generated files:
   ```
   Created:

   CANONICAL-<topic>-<timestamp>/
   ├── INDEX.md (master navigation)
   ├── TIERS.md (explains tier system)
   ├── <topic-1>/
   │   ├── t1_<slug>.md (foundational - N files)
   │   ├── t2_<slug>.md (structural - N files)
   │   └── t3_<slug>.md (optional - N files)
   ├── <topic-2>/
   │   ├── t1_<slug>.md
   │   └── t2_<slug>.md
   ├── GLOSSARY.md (N terms)
   ├── RESOLUTION-LOG.md (N decisions)
   └── appendices/ (source map, superseded docs)

   Tier Distribution:
   - T1 (Foundational): N files across M topics
   - T2 (Structural): N files across M topics
   - T3 (Optional): N files across M topics
   ```
4. Display the archive location
5. Print: "Canonicalization complete!"
6. Suggest:
   - "Start with TIERS.md to understand the organization"
   - "Read all **/t1_*.md files for foundational content (small and critical)"
   - "For agents: Use glob patterns (**/t1_*.md, **/t2_*.md, **/t3_*.md) to filter by tier"
