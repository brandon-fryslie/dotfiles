# FIRST RUN - Full Analysis

This is a FIRST run. No prior canonicalization outputs exist.

## What to Read

1. Read ALL source documents from the provided input
2. If a directory is given, find all `.md`, `.txt`, and other documentation files recursively
3. **Print the list of files that will be processed**

## Step 2: Deep Analysis

For each document and across all documents, identify:

**Contradictions** (Critical)
- Direct conflicts between statements in different documents
- Conflicting definitions of the same concept
- Incompatible requirements or constraints
- Version/date conflicts suggesting outdated information

**Inconsistencies** (High Priority)
- Same concept described differently in different places
- Terminology variations (same thing, different names)
- Naming conventions that differ across documents
- Implicit assumptions that conflict

**Consequential Ambiguities** (Important)
- Underspecified behaviors that would require design decisions
- Missing edge case definitions
- Unclear ownership/responsibility boundaries
- Unspecified error handling or failure modes
- Timing/ordering ambiguities
- Scope ambiguities (what's in vs out)

**Gaps** (Notable)
- Referenced documents/concepts that don't exist
- Missing sections that would be expected
- Incomplete specifications
- TODO/TBD/FIXME markers

## Step 3: Compile Glossaries

Extract ALL significant terms from the documents:
- Technical concepts and their definitions
- Variable names, parameter names, type names
- Domain-specific terminology
- Abbreviations and acronyms
- Units and measurement conventions

Separate into two categories:

**Ambiguous Terms** (for QUESTIONS file):
- Terms with multiple non-identical definitions across documents
- Terms with subtle variations (e.g., `t_ms` vs `tMillis` vs `timeMilliseconds`)
- Terms used inconsistently
- Terms whose scope or meaning is unclear

**Canonical Terms** (for GLOSSARY file):
- Terms with clear, consistent, unambiguous definitions
- Terms where all sources agree
- Terms you can confidently define canonically

## Step 4: Identify Topics and Classify into Tiers

This is a critical step for the three-tier encyclopedia output model.

Analyze the content and identify distinct topics that warrant separate documents, THEN classify content within each topic into tiers.

### Part A: Identify Topics

For each potential topic:

1. **Name it**: Use kebab-case slug (e.g., `type-system`, `topology`)
2. **Describe it**: One-sentence summary of what this topic covers
3. **List sources**: Which source documents contribute to this topic
4. **Identify key concepts**: Main terms/ideas that belong in this topic
5. **Map dependencies**: Which topics must be understood before this one

**Good topic boundaries:**
- Different architectural layers (type system, compiler, runtime, renderer)
- Distinct subsystems with clear interfaces
- Separable concerns (state management, time handling, error handling)
- Different user-facing concepts (blocks, wires, buses, domains)

### Part B: Classify Content into Tiers

For each topic, break down its content into tiers by asking: **"How expensive would this be to change?"**

**T1 (Foundational)** - File prefix `t1_<slug>.md`:
- Answer: "Cannot change" / "Would make this a different application"
- Example: Core type system (float, int, 5 axes), fundamental invariants
- Small, critical content that defines what this app IS

**T2 (Structural)** - File prefix `t2_<slug>.md`:
- Answer: "Can change, but it's work" / "Touches many other things"
- Example: BlockRole architecture, dataflow patterns, edge semantics
- Core architectural decisions that interconnect

**T3 (Optional)** - File prefix `t3_<slug>.md`:
- Answer: "Use it or don't" / "Change freely if something works better"
- Example: Implementation examples, diagnostics event types, detailed specs
- Reference material, most actual code and examples go here

**Note**: Not every topic needs all three tiers. Some topics may only have t1 content, others only t3.

**Assign each issue to a topic + tier:**
For every contradiction, ambiguity, and gap identified, note which topic directory AND which tier file it belongs to. This helps track where resolutions will land in the final encyclopedia.

## Step 5: Generate Outputs

Load and follow the output templates: `@references/output-templates.md`

Generate four files:
1. `CANONICALIZED-SUMMARY-<topic>-<timestamp>.md`
2. `CANONICALIZED-QUESTIONS-<topic>-<timestamp>.md`
3. `CANONICALIZED-GLOSSARY-<topic>-<timestamp>.md`
4. `CANONICALIZED-TOPICS-<topic>-<timestamp>.md` (NEW - topic breakdown)

If no issues are found (no contradictions, ambiguities, or gaps):
- Still generate SUMMARY, GLOSSARY, and TOPICS
- Skip QUESTIONS or note it's empty
- Inform user they can proceed directly to FINAL run

## Output to User

1. Print: "FIRST RUN - Reading all source files..."
2. Display files that were processed
3. Display a brief summary of findings
4. **Display the proposed encyclopedia structure:**
   ```
   Proposed Encyclopedia Structure:
   CANONICAL-<topic>-<timestamp>/
   ├── INDEX.md
   ├── TIERS.md
   ├── <topic-1>/
   │   ├── t1_<slug>.md     # Foundational (<N> files)
   │   ├── t2_<slug>.md     # Structural (<N> files)
   │   └── t3_<slug>.md     # Optional (<N> files)
   ├── <topic-2>/
   │   └── t1_<slug>.md     # (not all topics need all tiers)
   ├── GLOSSARY.md
   ├── RESOLUTION-LOG.md
   └── appendices/
   ```
5. **Display tier distribution:**
   ```
   Tier Distribution:
   - T1 (Foundational): <N> files across <M> topics
   - T2 (Structural): <N> files across <M> topics
   - T3 (Optional): <N> files across <M> topics
   ```
6. List the created working files with their full paths
7. Show resolution progress (X of Y items resolved)
8. Highlight the most critical unresolved issues
9. Remind user: "Edit the QUESTIONS file to resolve items, then re-run this command"
10. Note: "The TOPICS file shows the planned encyclopedia structure with tier breakdowns. Edit it to adjust topic organization or tier assignments if needed."
