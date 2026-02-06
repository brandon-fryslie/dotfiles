# UPDATE RUN - Incremental Integration

This is an UPDATE run. A canonical specification encyclopedia already exists and you are integrating new source documents.

## Step 1: Downgrade Status to UPDATING

Before analysis, update the INDEX.md file:

```yaml
---
status: UPDATING
generated: <original-timestamp>
updated: <current-timestamp>
updating_sources: [list of new source files being integrated]
---
```

Add a prominent notice at the top:
```markdown
> **STATUS: UPDATING**
> Integration in progress. New sources: [list files]
> Started: <timestamp>
```

## Step 2: Load Existing Canonical State

Read and understand the existing canonical specification:

1. **Read INDEX.md** - Current topics, source count, resolution count
2. **Read all existing topic files** (topics/*.md) - Current canonical content
3. **Read GLOSSARY.md** - Current canonical terms
4. **Read INVARIANTS.md** - Current rules
5. **Read RESOLUTION-LOG.md** - All prior resolutions

**Create a mental model of:**
- What is already canonical
- What topics already exist
- What terms are already defined
- What resolutions have been made

## Step 3: Read New Source Documents

1. Identify NEW sources (not already processed, based on INDEX.md source list)
2. Read ALL new source documents
3. **Print the list of NEW files that will be processed**

## Step 4: Comparative Analysis

For each new document, compare against existing canonical specification:

###  Contradictions (Severity by Tier)

**New contradicts existing canonical** - severity depends on which tier is contradicted:

- **Contradicts T1 (Foundational)**: New source says X, canonical t1 file says Y
  - **Example**: "New doc says 3-axis system, canonical t1_core-types says 5-axis"
  - **Tag**: CONTRADICTION-T1
  - **Severity**: CRITICAL - T1 cannot change; new source is wrong or misaligned

- **Contradicts T2 (Structural)**: New source says X, canonical t2 file says Y
  - **Example**: "New doc describes different BlockRole semantics"
  - **Tag**: CONTRADICTION-T2
  - **Severity**: HIGH - T2 can change but it's costly; needs careful evaluation

- **Contradicts T3 (Optional)**: New source says X, canonical t3 file says Y
  - **Example**: "New example shows different pattern"
  - **Tag**: CONTRADICTION-T3
  - **Severity**: NORMAL - T3 is flexible; pick what works better

**Internal contradictions within new sources:**
- New source A says X, new source B says Y
- **Tag**: CONTRADICTION-INTERNAL
- **Severity**: HIGH - Should be resolved

### Overlaps (INFORMATIONAL)

- **Redundant with existing**: New source covers topics already in canonical
- **Example**: "New doc defines SignalType, already in topic 01-type-system"
- **Tag**: OVERLAP
- **Resolution**: Merge, or note as supporting evidence

**Complementary information:**
- New source adds detail to existing topic
- **Tag**: COMPLEMENT
- **Action**: Enhance existing topic

### Ambiguities (IMPORTANT)

- **Blocking implementation**: New source underspecifies critical behavior
- **Conflicts with canonical clarity**: New source introduces ambiguity where canonical is clear
- **Tag**: AMBIGUITY
- **Severity**: Must resolve if it affects canonical topics

### Gaps (NOTABLE)

- **Missing concepts**: New source references concepts not in canonical or new sources
- **Incomplete specs**: Sections marked TODO/TBD/FIXME
- **Tag**: GAP
- **Action**: Document for later completion

### New Topics (STRUCTURAL)

- **Genuinely new domain**: New source covers topic NOT in existing canonical
- **Example**: "Debugger/diagnostics system not in canonical spec"
- **Tag**: NEW-TOPIC
- **Action**: Propose new topic document

## Step 5: Generate Update Outputs

Create working files with "update" prefix:

1. **CANONICALIZED-QUESTIONS-update-<timestamp>.md**
   - All contradictions (canonical vs new, internal)
   - All ambiguities requiring resolution
   - Format: Same as regular QUESTIONS file but with comparative context

2. **CANONICALIZED-SUMMARY-update-<timestamp>.md**
   - Summary of new sources analyzed
   - List of affected existing topics
   - List of proposed new topics
   - Overlap analysis
   - Gap analysis

3. **CANONICALIZED-GLOSSARY-update-<timestamp>.md**
   - NEW terms from new sources (not in existing GLOSSARY)
   - CONFLICTING terms (new source vs canonical)
   - COMPLEMENTARY definitions (new source adds detail)

4. **CANONICALIZED-TOPICS-update-<timestamp>.md** (if new topics proposed)
   - Proposed new topic documents
   - Updates to existing topics
   - Topic dependency map (updated)

## Step 6: Resolution Process

**User must resolve issues in QUESTIONS file:**

For each item:
- **CONTRADICTION-T1**: Almost always keep canonical; T1 is foundational and cannot change
- **CONTRADICTION-T2**: Evaluate carefully; T2 can change but it's work and affects many things
- **CONTRADICTION-T3**: Pick what works better; T3 is flexible
- **CONTRADICTION-INTERNAL**: Choose one interpretation
- **AMBIGUITY**: Clarify the spec
- **OVERLAP**: Note action (merge, cross-reference, or archive)
- **NEW-TOPIC**: Approve or reject new topic proposal + assign tier for new content

**Mark resolved items:**
```markdown
### Q1: <issue description>

**Status**: RESOLVED

**Resolution**: <decision>

**Rationale**: <why>

**Impact**: <which topics/files will change>

**Approved by**: <name>
**Approved at**: <timestamp>
```

## Step 7: Integration Phase (After Resolution)

Once all CRITICAL and HIGH items are resolved:

1. **Update affected existing topics**
   - Incorporate new information
   - Add cross-references
   - Preserve resolution rationale

2. **Create new topic documents** (if approved)
   - Follow existing topic template
   - Cross-link to related topics

3. **Update GLOSSARY.md**
   - Add new terms
   - Update conflicting terms per resolution
   - Add complementary definitions

4. **Update RESOLUTION-LOG.md**
   - Add all resolutions from this update
   - Category: "Update YYYY-MM-DD"
   - Include comparative context (old vs new)

5. **Update INDEX.md**
   - Increment source_documents count
   - Increment topics count (if new topics)
   - Add new topics to table
   - Update search hints
   - Increment resolution count

6. **Update appendices/source-map.md**
   - Map new sources to topics
   - Note which topics were updated

## Step 8: Status Upgrade to CANONICAL

After all integration work is complete:

Update INDEX.md:
```yaml
---
status: CANONICAL
generated: <original-timestamp>
updated: <current-timestamp>
update_history:
  - date: <current-timestamp>
    sources_added: <count>
    topics_added: <count>
    topics_updated: <list>
    resolutions_made: <count>
---
```

Remove UPDATING notice, add completion note:
```markdown
> **STATUS: CANONICAL**
> This is the authoritative source of truth.
> Last updated: <timestamp> (integrated <N> new sources)
```

## Output to User

1. Print: "UPDATE RUN - Integrating new sources into existing canonical spec..."
2. Display: "Existing canonical: CANONICAL-<topic>-<timestamp>/"
3. Display: "Current status: <X> topics, <Y> sources, <Z> resolutions"
4. Display: "NEW sources being integrated: [list]"
5. Display a summary of findings by tier:
   - CRITICAL (T1 contradictions): <count>
   - HIGH (T2 contradictions, internal): <count>
   - NORMAL (T3 contradictions): <count>
   - Overlaps: <count>
   - New topics proposed: <count>
   - Gaps identified: <count>
6. List the created update working files with full paths
7. Show resolution progress: "X of Y items must be resolved"
8. Highlight CRITICAL issues (T1 contradictions - foundational cannot change)
9. Explain tier-based severity:
   - "T1 contradictions are CRITICAL - foundational content cannot change"
   - "T2 contradictions are HIGH - structural changes are costly"
   - "T3 contradictions are NORMAL - pick what works better"
10. Remind user: "Resolve all CRITICAL items in QUESTIONS file, then re-run to integrate"
11. Note: "INDEX.md status set to UPDATING until integration complete"

## Special Cases

**If no contradictions or ambiguities found:**
- Create SUMMARY showing overlaps/complements only
- Ask user: "New sources align with canonical. Integrate immediately? [Y/n]"
- If yes, proceed directly to integration phase
- Still update RESOLUTION-LOG with "No conflicts" note

**If all new sources are pure overlaps:**
- Note: "All content already covered in canonical spec"
- Ask: "Archive new sources as superseded? [Y/n]"
- Update superseded-docs.md appendix

**If new sources are entirely new domain:**
- Note: "New topic domain detected: <topic-name>"
- Propose: "Add as topic 0X-<topic-slug>? [Y/n]"
- If approved, proceed with new topic creation

## Integration Principles

1. **Canonical precedence**: Existing canonical content takes precedence unless explicitly superseded by resolution
2. **Additive by default**: New information complements rather than replaces, unless contradiction resolved
3. **Explicit changes only**: Don't silently change canonical content; all changes go through resolution
4. **Preserve rationale**: Every change must be documented in RESOLUTION-LOG
5. **Cross-reference heavily**: Link new content to existing topics extensively

## Approval Gate

Before changing INDEX.md status back to CANONICAL, verify:
- [ ] All CRITICAL items resolved
- [ ] All HIGH items resolved or explicitly deferred
- [ ] All new terms added to GLOSSARY
- [ ] All resolutions added to RESOLUTION-LOG
- [ ] All affected topics updated
- [ ] All new topics created and linked
- [ ] INDEX.md metadata updated (counts, search hints, topics table)
- [ ] User has approved the integration

**If any checklist item fails:** Keep status as UPDATING and inform user of blockers.
