---
name: "canonicalize-architecture"
description: "Analyze architecture/spec documents for contradictions, ambiguities, and inconsistencies. Produces an encyclopedia-style canonical specification series."
---
# Architecture Document Canonicalization

You are analyzing architecture and technical specification documents to surface contradictions, inconsistencies, and consequential ambiguities. The ultimate goal is to compile a comprehensive **canonical specification encyclopedia**—a three-tiered collection of documents organized by change cost.

## Purpose of the Canonical Specification

**What it IS:**
- Alignment of high-level ideas
- Reduction of contradictions and ambiguities
- A way to verify plans and implementations against goals and strategy
- The **ideas** matter, not the examples (examples help explain, but ideas are what's important)

**What it is NOT:**
- A complete encoding of every implementation detail
- A replacement for actual code or comprehensive documentation
- An attempt to specify everything exhaustively

## Three-Tier Organization

The canonical specification organizes content by answering: **"How expensive would this be to change?"**

| Tier | Directory | Meaning | Contents |
|------|-----------|---------|----------|
| **1_foundational** | `1_foundational/` | Cannot change. Would make this a different application. | Core invariants, fundamental principles |
| **2_structural** | `2_structural/` | Can change, but it's work. Affects many other things. | Architecture, type system, core topology |
| **3_optional** | `3_optional/` | Use it or don't. Change freely if something works better. | Examples, implementation notes, details |

### Conflict Resolution

**Lower number wins.**

If content in `3_optional/` conflicts with `1_foundational/`, the foundational tier wins. No exceptions.

### Agent Reading Pattern

- **Always read**: `1_foundational/` (small and critical)
- **Usually read**: `2_structural/` (core architecture context)
- **Consult as needed**: `3_optional/` (reference material)

## Critical Context: Documents Represent Historical Systems

**IMPORTANT**: Source documents may have been written for previous versions of the system and contain outdated assumptions, terminology, and architectural patterns that no longer apply.

The canonicalization process must:

1. **Extract architectural intent** where it aligns with current canonical spec
2. **Reject outdated assumptions** from previous system iterations
3. **Identify useful patterns** (UI flows, interaction models) that can be adapted to current architecture
4. **Not treat every detail as authoritative** just because it's written down

### Integration Priority

When integrating source documents into the canonical spec:

- **Canonical spec wins** - Always prefer existing canonical definitions over source document claims
- **Verify alignment** - Before accepting any architectural statement, verify it against existing canonical topics
- **Flag misalignment** - Clearly mark where source documents contradict or invent concepts not in canonical spec
- **Extract value** - Focus on what's useful (UI patterns, interaction flows, user needs) rather than treating docs as ground truth
- **Question authority** - Source documents describing "how X works" have NO authority over canonical spec's definition of X

### Example

If a UI spec document says "Domain blocks have jitter, spacing, and origin parameters," but the canonical spec defines `DomainDecl` with only `shape` parameters, the canonical spec wins. The UI spec's claims about domain parameters are rejected as outdated speculation from a previous system iteration.

## Output Model: Three-Tier Encyclopedia

The final output organizes content by **topic** (directories) and **tier** (file prefixes):

```
CANONICAL-<topic>-<timestamp>/
├── INDEX.md                      # Master navigation and overview
├── TIERS.md                      # Explains the tier system
├── type-system/                  # Topic directory
│   ├── t1_core-types.md         # Foundational: float, int, 5 axes
│   ├── t2_block-roles.md        # Structural: BlockRole architecture
│   └── t3_diagnostics.md        # Optional: event type details
├── topology/
│   ├── t1_invariants.md         # Foundational: multi-in/multi-out
│   ├── t2_dataflow.md           # Structural: edge semantics
│   └── t3_examples.md           # Optional: example graphs
├── principles/                   # Not all topics need all tiers
│   └── t1_identity.md           # What makes this app unique
├── GLOSSARY.md                   # Complete terminology reference
├── RESOLUTION-LOG.md             # Decision history with rationale
└── appendices/
    ├── source-map.md             # Which sources contributed to what
    └── superseded-docs.md        # List of archived originals
```

### Why This Organization

- **Topics stay cohesive**: All type-system content in one directory
- **Tiers easily filterable**: `**/t1_*.md`, `**/t2_*.md`, `**/t3_*.md`
- **Conflict resolution**: Lower tier number wins - simple and unambiguous
- **Agent filtering**: Load all t1 files always, t2 for context, t3 on-demand
- **Flexibility**: Not every topic needs all three tiers
- **Purpose alignment**: Separates "cannot change" from "implementation details"

## Input

The user has provided: $ARGUMENTS

This may be:
- A directory path (analyze all markdown/text files within)
- A space-separated list of file paths
- A glob pattern

## Step 0: Determine Run Type (DISPATCHER)

Before reading any source files, determine the run type by checking for existing outputs.

**Output Directory**: Determine the common ancestor directory of all input files.

Check for existing files/directories:
- `CANONICAL-<topic>-*/` directory (completed encyclopedia)
- `CANONICALIZED-SUMMARY-*.md` (in-progress working files)
- `CANONICALIZED-QUESTIONS-*.md`
- `CANONICALIZED-GLOSSARY-*.md`
- `CANONICALIZED-TOPICS-*.md` (topic breakdown)
- `EDITORIAL-REVIEW-*.md` (editorial review)
- `USER-APPROVAL-*.md` (user approval record)

**Decision table:**

| Condition | Run Type | Action |
|-----------|----------|--------|
| `CANONICAL-<topic>-*/` directory exists AND user chooses "update existing" | UPDATE | Load `references/run-update.md` |
| `CANONICAL-<topic>-*/` directory exists AND user chooses "start fresh" | FIRST | Archive old, load `references/run-first.md` |
| `CANONICAL-<topic>-*/` directory exists AND user chooses "abort" | ABORT | Exit without changes |
| No `CANONICALIZED-*` files exist | FIRST | Load `references/run-first.md` |
| `CANONICALIZED-*` exist with `indexed: true`, progress < 100% | MIDDLE | Load `references/run-middle.md` |
| `CANONICALIZED-*` exist, progress = 100%, no `EDITORIAL-REVIEW-*.md` exists | REVIEW | Load `references/run-review.md` |
| `EDITORIAL-REVIEW-*.md` exists, no `USER-APPROVAL-*.md` exists | APPROVAL | Load `references/run-approval.md` |
| `USER-APPROVAL-*.md` exists with `approved: true` | FINAL | Load `references/run-final.md` |

**Print the detected run type**, then load and follow the appropriate reference file.

---

## Shared Context

These rules apply to all run types:

### Precedence Rules for Prior Outputs

1. **Prior resolutions take precedence over source documents** - If a QUESTIONS file contains a `RESOLVED` item, that resolution is authoritative
2. **Carry forward all resolutions** - Every `RESOLVED` item from prior QUESTIONS files must appear in the new output
3. **Migrate resolved ambiguous terms** - When a term in the Ambiguous Terms table is marked resolved, move it to the GLOSSARY file in the next run

### Topic Identification and Tier Classification

During analysis, identify distinct topics that warrant separate documents AND classify them into tiers.

**Topic Boundaries:**
- Different architectural layers (type system, compiler, runtime, renderer)
- Distinct subsystems with clear interfaces
- Separable concerns (state management, time handling, error handling)
- Different user-facing concepts (blocks, wires, buses, domains)

**Tier Classification:**

For each topic, ask: **"How expensive would this be to change?"**

- **1_foundational**: "Cannot change" / "Would make this a different application"
  - Example: Core invariants, fundamental principles defining what this app IS

- **2_structural**: "Can change, but it's work" / "Touches many other things"
  - Example: Type system architecture, core topology, data flow patterns

- **3_optional**: "Use it or don't" / "Change freely"
  - Example: Implementation examples, detailed specifications, code patterns

**Naming Convention**: Use kebab-case slugs:
- `principles` (tier 1)
- `type-system` (tier 2)
- `examples/basic-flow` (tier 3)

### Timestamp Format

All timestamps: `YYYYMMDD-HHMMSS`

### Front-matter (all output files)

```yaml
---
command: /canonicalize-architecture $ARGUMENTS
files: [space-separated list of files processed this run]
indexed: true
source_files:
  - [path/to/source1.md]
  - [path/to/source2.md]
topics:
  - [topic-slug-1]
  - [topic-slug-2]
---
```

### Cross-Linking Convention

Within the encyclopedia, use relative links:
- `[See Invariants](../INVARIANTS.md)`
- `[Type System](./01-type-system.md)`
- `[Glossary: SignalType](../GLOSSARY.md#signaltype)`

### Encyclopedia Index Requirements

The INDEX.md must include:

1. **Status badge**: CANONICAL / UPDATING / DRAFT / SUPERSEDED
2. **Quick navigation**: Links to all major sections
3. **Topic map**: Visual or tabular overview of all topics
4. **Reading order**: Suggested sequence for newcomers
5. **Search hints**: Key terms and where to find them
6. **Version info**: When generated, from what sources, approval status
