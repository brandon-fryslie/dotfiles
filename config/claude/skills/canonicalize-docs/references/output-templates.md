# Output Templates

Templates for the working documents generated during FIRST and MIDDLE runs.
These intermediate files guide the resolution process before the final encyclopedia is generated.

---

## CANONICALIZED-SUMMARY Template

```markdown
---
command: /canonicalize-architecture $ARGUMENTS
files: [space-separated list of actual files processed]
indexed: true
source_files:
  - [path/to/source1.md]
  - [path/to/source2.md]
---

# Canonical Architecture Summary: <Topic>

Generated: <timestamp>
Supersedes: [list any prior CANONICALIZED-SUMMARY files found]
Documents Analyzed: [list with brief description of each]

## Executive Summary
[2-3 paragraph overview of the architecture/design]

## Document Purposes
[What each source document covers and its role]

## Architecture Overview
[High-level synthesis of the architecture as described]

## Key Components
[For each major component: purpose, responsibilities, interfaces]

## Data Flow
[How data moves through the system]

## Invariants
[Non-negotiable constraints that must always hold]

## Canonicalization Status
- Fully Resolved: [count]
- Pending Questions: [count] (see QUESTIONS file)
- Ambiguous Terms: [count] (see QUESTIONS file)
- Topics Identified: [count] (see TOPICS file)

## Recommendations for Next Steps
[Ordered list of actions to complete canonicalization]
```

---

## CANONICALIZED-QUESTIONS Template

```markdown
---
command: /canonicalize-architecture $ARGUMENTS
files: [space-separated list of actual files processed]
indexed: true
source_files:
  - [path/to/source1.md]
  - [path/to/source2.md]
---

# Open Questions & Ambiguities: <Topic>

Generated: <timestamp>
Supersedes: [list any prior CANONICALIZED-QUESTIONS files found]

## How to Resolve Items

This file is designed for iterative resolution. To resolve an item:

1. **Edit this file directly** - Change `Status: UNRESOLVED` to `Status: RESOLVED`
2. **Add your resolution** - Use one of these approaches:
   - `Resolution: AGREE` - Accept the suggested resolution as-is
   - `Resolution: AGREE, but [adjustment]` - Accept with minor modification
   - `Resolution: [your decision]` - Provide your own resolution
3. **Re-run the command** - The next run will carry forward your resolution

**Shorthand**: Writing just `AGREE` means you accept the **Suggested Resolution** exactly as written. No need to repeat it.

Example (accepting suggestion):
```
- **Status**: RESOLVED
- **Resolution**: AGREE
```

Example (accepting with adjustment):
```
- **Status**: RESOLVED
- **Resolution**: AGREE, but use `time_ms` instead of `timeMs` for consistency with existing code
```

When ALL items are resolved, the next run will generate the canonical specification encyclopedia.

---

## Quick Wins

These items have clear, low-risk recommendations. Review and resolve quickly by marking AGREE or adjusting.

| # | Item | Recommendation | Status | Resolution |
|---|------|----------------|--------|------------|
| 1 | [short description] | [brief recommendation] | UNRESOLVED | |
| 2 | [short description] | [brief recommendation] | UNRESOLVED | |

*(To resolve: change UNRESOLVED to RESOLVED and add AGREE or your decision in the Resolution column)*

---

## Resolution Order

Items are organized by suggested resolution order. Resolve in this sequence for best results:

1. **Critical Contradictions** - These block other decisions; resolve first
2. **High-Impact Ambiguities** - Affect multiple components or core behavior
3. **Terminology/Naming** - Establish consistent vocabulary
4. **Gaps** - Missing content that needs to be specified
5. **Low-Impact Items** - Minor details, can often just AGREE

---

## 1. Critical Contradictions

*Resolve these first - they block other decisions*

[Each contradiction with:]
### C1: [short title]
- **Locations**: [file:line references]
- **Source Quotes**:
  - From `[file1]`: "[exact quote showing the conflict]"
  - From `[file2]`: "[exact quote showing the conflict]"
- **Conflict**: [clear description]
- **Impact**: [what breaks if unresolved]
- **Options**:
  1. [Option A with implications]
  2. [Option B with implications]
- **Suggested Resolution**: [recommendation with rationale - why this aligns with overall architecture]
- **Encyclopedia Location**: [Which topic document will contain this]
- **Status**: UNRESOLVED
- **Resolution**:

---

## 2. High-Impact Ambiguities

*Core behaviors and cross-cutting concerns*

[Each ambiguity with:]
### A1: [short title]
- **Location**: [file:line reference]
- **Source Quote**: "[exact quote from source document]"
- **Description**: [what's unclear]
- **Questions to Resolve**: [specific questions]
- **Architectural Context**: [how this relates to other components/decisions]
- **Suggested Resolution**: [recommendation with rationale - why this makes sense given the architecture]
- **Encyclopedia Location**: [Which topic document will contain this]
- **Status**: UNRESOLVED
- **Resolution**:

---

## 3. Terminology & Naming

*Establish consistent vocabulary*

### Ambiguous Terms

To resolve: Change UNRESOLVED to RESOLVED and either write AGREE or provide your Canonical Definition.
Resolved terms will be moved to the GLOSSARY file on the next run.

| # | Term | Variations | Locations | Issue | Suggested Canonical Form | Status | Resolution |
|---|------|------------|-----------|-------|-------------------------|--------|------------|
| T1 | [term] | [var1, var2] | [file:line, ...] | [what differs] | [recommendation + rationale] | UNRESOLVED | |

---

## 4. Gaps and Missing Content

*Content that needs to be specified*

[Each gap with:]
### G1: [short title]
- **Expected**: [what should exist]
- **Current State**: [what's missing]
- **Referenced From**: [file:line where this gap was noticed]
- **Priority**: HIGH | MEDIUM | LOW
- **Encyclopedia Location**: [Which topic document should contain this]
- **Suggested Resolution**: [what to specify, or "defer to implementation" if appropriate]
- **Status**: UNRESOLVED
- **Resolution**:

---

## 5. Low-Impact Items

*Minor details - often safe to AGREE*

[Each item with:]
### L1: [short title]
- **Location**: [file:line reference]
- **Issue**: [brief description]
- **Suggested Resolution**: [recommendation]
- **Status**: UNRESOLVED
- **Resolution**:

---

## Cross-Reference Matrix

[Table showing which documents reference which concepts, highlighting conflicts]

---

## Resolution Progress

| Category | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical Contradictions | [n] | [n] | [n] |
| High-Impact Ambiguities | [n] | [n] | [n] |
| Terminology | [n] | [n] | [n] |
| Gaps | [n] | [n] | [n] |
| Low-Impact | [n] | [n] | [n] |
| **Total** | **[n]** | **[n]** | **[n]** |

**Progress: [percentage]%**

When progress reaches 100%, the next run will generate the canonical specification encyclopedia.
```

---

## CANONICALIZED-GLOSSARY Template

```markdown
---
command: /canonicalize-architecture $ARGUMENTS
files: [space-separated list of actual files processed]
indexed: true
source_files:
  - [path/to/source1.md]
  - [path/to/source2.md]
---

# Canonical Glossary: <Topic>

Generated: <timestamp>
Supersedes: [list any prior CANONICALIZED-GLOSSARY files found]

## Usage

This glossary contains authoritative definitions for all unambiguous terms in the <topic> domain.
Use these definitions consistently across all documentation and implementation.

## Terms

### [Term Name]
**Definition**: [Clear, complete definition]
**Type**: concept | variable | parameter | type | unit | abbreviation
**Source**: [file:line where authoritatively defined]
**Encyclopedia Location**: [Which topic document will elaborate on this]
**Related**: [other related terms]
**Example**: [usage example if helpful]

---

[Repeat for each term, alphabetically ordered]

## Naming Conventions

[Document any patterns observed:]
- Variable naming: [e.g., camelCase, snake_case]
- Time units: [e.g., always suffix with unit like `_ms`]
- Coordinate systems: [e.g., origin, axis orientation]

## Abbreviations

| Abbreviation | Expansion | Context |
|--------------|-----------|---------|
| [abbr] | [full form] | [when to use] |
```

---

## CANONICALIZED-TOPICS Template

This file tracks the topic breakdown and tier classification for the encyclopedia structure.

```markdown
---
command: /canonicalize-architecture $ARGUMENTS
files: [space-separated list of actual files processed]
indexed: true
source_files:
  - [path/to/source1.md]
  - [path/to/source2.md]
---

# Topic Breakdown & Tier Classification: <Topic>

Generated: <timestamp>
Supersedes: [list any prior CANONICALIZED-TOPICS files found]

## Encyclopedia Structure

The final canonical specification will be organized by topic (directories) and tier (file prefixes):

```
CANONICAL-<topic>-<timestamp>/
├── INDEX.md
├── TIERS.md
├── <topic-dir>/
│   ├── t1_<slug>.md     # Foundational
│   ├── t2_<slug>.md     # Structural
│   └── t3_<slug>.md     # Optional
├── GLOSSARY.md
├── RESOLUTION-LOG.md
└── appendices/
```

---

## Topics and Tier Breakdown

| # | Topic Slug | Title | Description | T1 Files | T2 Files | T3 Files |
|---|------------|-------|-------------|----------|----------|----------|
| 01 | `type-system` | Type System | Five-axis type model | core-types | block-roles, constraints | diagnostics, examples |
| 02 | `topology` | Topology | Graph structure | invariants | dataflow, edges | examples |
| ... | | | | | | |

---

## Detailed Topic Outlines

### 01: Type System (`type-system`)

**Primary Sources**: [list files]

**Tier Breakdown**:

**T1 (Foundational)** - `t1_core-types.md`:
- Float and Int as base payload types
- Five-axis extent model (cannot change these axes)
- SignalType as union of payload + extent
- "Changing these would make this a different type system entirely"

**T2 (Structural)** - `t2_block-roles.md`, `t2_constraints.md`:
- BlockRole usage in editor
- Type constraint checking
- Extent defaults (v0)
- "Can change, but affects many components"

**T3 (Optional)** - `t3_diagnostics.md`, `t3_examples.md`:
- Event type details in diagnostics
- Example signal type combinations
- Implementation patterns
- "Change freely if something works better"

**Key Terms** (to include in GLOSSARY.md):
- PayloadType
- Extent
- SignalType
- Cardinality
- ...

**Dependencies**: None (foundational)

**Dependents**: [topology], [compilation], ...

---

### 02: Block System (`blocks`)

**Primary Sources**: [list files]

**Contents**:
1. Overview
2. Block Structure
3. Block and Edge Roles
4. Stateful Primitives
5. Basic 12 Blocks (MVP)

**Key Invariants**:
- [Ix]: [related invariant]

**Key Terms**:
- Block
- BlockRole
- DerivedBlockMeta
- ...

**Dependencies**: [01-type-system]

**Dependents**: [03-compilation], [04-runtime], ...

---

[Continue for all topics]

---

## Topic Relationships

```
[Dependency diagram or description showing how topics relate]

01-type-system (foundation)
    ↓
02-blocks ← 03-time
    ↓
04-compilation
    ↓
05-runtime → 06-renderer
```

---

## Suggested Reading Order

For newcomers:
1. SUMMARY (overview)
2. 01-type-system (foundation)
3. 02-blocks (core concepts)
4. [Continue...]

For implementers:
1. INVARIANTS (rules)
2. [Relevant topic]
3. GLOSSARY (naming)

---

## Topic Assignment Status

| Source Document | Assigned To Topic | Coverage |
|-----------------|-------------------|----------|
| [source1.md] | 01-type-system | Full |
| [source2.md] | 02-blocks, 03-time | Split |
| [source3.md] | 04-compilation | Partial (some deferred) |

---

## Notes for Final Generation

- [Any special handling needed for specific topics]
- [Cross-topic content that needs careful placement]
- [Topics that may need merging or splitting based on resolution]
```
