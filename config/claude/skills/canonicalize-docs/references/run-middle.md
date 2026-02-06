# MIDDLE RUN - Resolution Processing

This is a MIDDLE run. Prior indexed outputs exist and resolutions need processing.

## What to Read

**Do NOT read source files** - they haven't changed and are already fully extracted.

Read ONLY:
1. Most recent `CANONICALIZED-SUMMARY-*.md`
2. Most recent `CANONICALIZED-QUESTIONS-*.md`
3. Most recent `CANONICALIZED-GLOSSARY-*.md`
4. Most recent `CANONICALIZED-TOPICS-*.md`

## Step 2: Parse Resolutions

From the QUESTIONS file, identify all items where:
- `Status` changed from `UNRESOLVED` to `RESOLVED`
- `Resolution` field contains a value (either `AGREE`, `AGREE, but...`, or custom text)

For each resolution:
- If `AGREE`: Use the `Suggested Resolution` as the canonical decision
- If `AGREE, but [adjustment]`: Apply the suggested resolution with the specified modification
- If custom text: Use that as the canonical decision

## Step 3: Apply Resolutions

1. **Migrate resolved terms**: Move any RESOLVED terms from the Ambiguous Terms table to the GLOSSARY
2. **Update counts**: Recalculate resolution progress
3. **Preserve resolved items**: Keep all RESOLVED items in the new QUESTIONS file (they're part of the resolution history)

## Step 4: Process Topic and Tier Changes

Check if the TOPICS file was modified:
- Topics added or removed
- Topics renamed or reorganized
- Content reassigned between topics
- **Tier assignments changed** (content moved from t1 to t2, t2 to t3, etc.)

If topics or tiers changed:
- Update topic + tier assignments in QUESTIONS file
- Regenerate TOPICS file with new structure
- Validate tier assignments are sensible (flag if t1 content looks like t3, etc.)

## Step 5: Check for Full Resolution

Check if ALL of the following are true:
1. No UNRESOLVED contradictions remain
2. No UNRESOLVED ambiguities remain
3. No UNRESOLVED gaps remain
4. No UNRESOLVED terms in the Ambiguous Terms table
5. Progress = 100%

If fully resolved: Inform user to re-run for REVIEW run (editorial review)
If not fully resolved: Generate updated outputs

## Step 6: Generate Updated Outputs

Load and follow the output templates: `@references/output-templates.md`

Generate four files (superseding the prior versions):
1. `CANONICALIZED-SUMMARY-<topic>-<timestamp>.md` - Updated counts
2. `CANONICALIZED-QUESTIONS-<topic>-<timestamp>.md` - With resolutions applied
3. `CANONICALIZED-GLOSSARY-<topic>-<timestamp>.md` - With migrated terms
4. `CANONICALIZED-TOPICS-<topic>-<timestamp>.md` - With any structural changes

## Output to User

1. Print: "MIDDLE RUN - Reading from index (skipping source files)..."
2. List resolutions that were processed (e.g., "Processed 5 resolutions: C1, A2, T3, T4, G1")
3. Show updated resolution progress
4. **Show updated encyclopedia structure if changed:**
   ```
   Encyclopedia Structure (updated):
   CANONICAL-<topic>-<timestamp>/
   ├── INDEX.md
   ├── TIERS.md
   ├── <topic>/
   │   ├── t1_<slug>.md
   │   ├── t2_<slug>.md
   │   └── t3_<slug>.md
   ```
   **Tier Distribution (if changed):**
   - T1: <N> files, T2: <N> files, T3: <N> files
5. List newly created output files
6. If items remain: "Edit the QUESTIONS file to continue resolving, then re-run"
7. If all resolved: "All items resolved! Re-run to start the editorial review process"

## Tracking Topic and Tier Assignment

As resolutions are applied, track which topics and tiers are affected:

```
Resolutions by Topic + Tier:
- type-system/t1_core-types: C1 (float vs double)
- type-system/t2_constraints: A3 (axis semantics)
- topology/t1_invariants: C2 (multi-in/multi-out)
- topology/t3_examples: G1 (missing edge cases)
```

This helps users see which parts of the final encyclopedia have been updated and at what tier level.
