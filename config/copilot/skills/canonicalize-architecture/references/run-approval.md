# APPROVAL RUN - User Approval Walkthrough

This is an APPROVAL run. The editorial review is complete. Before generating the encyclopedia, you must obtain explicit user approval for all resolutions.

## Purpose

Walk the user through every significant decision made during canonicalization. The user should understand and approve each change before it becomes part of the canonical encyclopedia.

## What to Read

1. Read the `EDITORIAL-REVIEW-*.md` file
2. Read the `CANONICALIZED-QUESTIONS-*.md` file (all resolutions)
3. Read the `CANONICALIZED-GLOSSARY-*.md` file (naming changes)
4. Read the `CANONICALIZED-TOPICS-*.md` file (encyclopedia structure)

## Step 1: Offer Walkthrough

Present the user with options:

```
APPROVAL RUN - User approval required before generating the encyclopedia.

I found [N] resolutions and [M] naming changes that will become canonical.
The encyclopedia will have [P] topic documents.

How would you like to proceed?

1. **Full walkthrough** - Review each item one by one (recommended for first-time canonicalization)
2. **Summary review** - Show all changes grouped by category, approve in bulk
3. **Trust the process** - Approve all without detailed review (only if you've reviewed the EDITORIAL-REVIEW document)

Which would you prefer?
```

## Step 2A: Full Walkthrough (if selected)

For EACH resolution in the QUESTIONS file, present:

```markdown
---
## Resolution [N] of [Total]: [Short Title]

**Category**: [Critical Contradiction / High-Impact Ambiguity / Terminology / etc.]
**Will appear in**: [Topic document name]

### What We Started With

[Quote or describe the original state - the contradiction, ambiguity, or undefined term]

**Source**: [Which document(s) this came from]

### What We're Changing To

[The resolution that was decided]

### Why This Change

[Brief rationale]

---

**Options**:
- **Approve** - Accept this resolution
- **More info** - I'll provide detailed pros/cons and alternatives
- **Modify** - Suggest a different resolution
- **Skip for now** - Come back to this one later
- **Reject** - This resolution is wrong, revert to unresolved

Your choice?
```

### If User Selects "More Info"

Provide a detailed analysis:

```markdown
### Detailed Analysis: [Title]

#### The Problem in Full

[Comprehensive description of the original issue]

#### Options Considered

**Option A: [Description]**
- Pros: [list]
- Cons: [list]
- Implications: [what this means for the architecture]

**Option B: [Description]**
- Pros: [list]
- Cons: [list]
- Implications: [what this means for the architecture]

[Continue for all reasonable options]

#### Why We Chose [Selected Option]

[Detailed rationale]

#### What Happens If We Choose Differently

[Consequences of changing this decision]

---

Now that you have the full picture, what would you like to do?
- **Approve** the current resolution
- **Choose Option [X]** instead
- **Propose something else** (describe your alternative)
```

### If User Selects "Modify"

1. Ask user for their preferred resolution
2. Validate it against related resolutions (check for conflicts)
3. If conflicts exist, explain them and ask user to resolve
4. Update the resolution in the working document

### If User Selects "Reject"

1. Mark the item as UNRESOLVED
2. Note that this will require another MIDDLE run to re-resolve
3. Ask if user wants to continue with remaining items or stop

## Step 2.5: Encyclopedia Structure and Tier Approval

After item-level approval, review the encyclopedia structure and tier assignments:

```markdown
---
## Encyclopedia Structure & Tier Approval

The specification will be organized by **topic** (directories) and **tier** (file prefixes):

```
CANONICAL-<topic>-<timestamp>/
├── INDEX.md
├── TIERS.md
├── <topic-1>/
│   ├── t1_<slug>.md     # Foundational (N files)
│   ├── t2_<slug>.md     # Structural (N files)
│   └── t3_<slug>.md     # Optional (N files)
├── <topic-2>/
│   ├── t1_<slug>.md
│   └── t2_<slug>.md     # (not all topics need all tiers)
├── GLOSSARY.md
├── RESOLUTION-LOG.md
└── appendices/
```

**Tier Distribution**:
- T1 (Foundational): N files across M topics - "Cannot change"
- T2 (Structural): N files across M topics - "Hard to change"
- T3 (Optional): N files across M topics - "Change freely"

**Reading Guide**:
- Always read: **/t1_*.md (foundational across all topics)
- Usually read: **/t2_*.md (structural for relevant topics)
- Consult as needed: **/t3_*.md (reference material)

**Questions**:
- Does this structure make sense?
- Should any topics be merged or split?
- Are tier assignments correct? (Is anything in t1 that should be t3, or vice versa?)
- Is t1 content small and critical, or bloated?

**Options**:
- **Approve structure and tiers** - Generate encyclopedia with this organization
- **Adjust structure** - I'd like to change the topic organization
- **Adjust tiers** - I'd like to reclassify some content
- **Discuss** - Let's talk about the structure/tiers before approving
```

## Step 2B: Summary Review (if selected)

Group all resolutions by category and present:

```markdown
## Category: [Name]

| # | Item | Original | Resolution | Topic |
|---|------|----------|------------|-------|
| 1 | [title] | [brief original] | [brief resolution] | 01-xxx |
| 2 | [title] | [brief original] | [brief resolution] | 02-yyy |

**Approve all [N] items in this category?** [Yes / Review individually / Reject all]
```

Repeat for each category, then present encyclopedia structure.

## Step 2C: Trust the Process (if selected)

Confirm:
```
You've chosen to approve all resolutions without detailed review.

Please confirm you have:
- [ ] Read the EDITORIAL-REVIEW document
- [ ] Understood the major changes being made
- [ ] Reviewed the encyclopedia structure in CANONICALIZED-TOPICS
- [ ] Accept responsibility for any issues that may arise

Type "I approve all resolutions" to proceed, or choose a different option.
```

## Step 3: Address Any Editorial Issues

If the EDITORIAL-REVIEW document contained critical issues or significant concerns:

```markdown
## Editorial Issues to Address

The editorial review identified these issues:

### Critical Issues (must address)

[List critical issues and ask user how to handle each]

### Significant Concerns (should address)

[List concerns and ask user if they want to address or accept as-is]
```

## Step 4: Generate Approval Record

Once all items are approved (or explicitly accepted with modifications), create `USER-APPROVAL-<topic>-<timestamp>.md`:

```markdown
---
command: /canonicalize-architecture $ARGUMENTS
approved: true
approval_timestamp: <timestamp>
approval_method: [full_walkthrough / summary_review / bulk_approve]
reviewed_items: [N]
approved_items: [N]
modified_items: [list of any that were modified]
rejected_items: [list of any that were rejected, or "none"]
encyclopedia_structure_approved: true
topics_approved: [list of topic slugs]
tier_assignments_approved: true
tier_distribution:
  t1: [N] files
  t2: [N] files
  t3: [N] files
---

# User Approval Record: <Topic>

Generated: <timestamp>

## Approval Summary

- **Total items reviewed**: [N]
- **Approved as-is**: [N]
- **Approved with modifications**: [N]
- **Rejected/deferred**: [N]

## Encyclopedia Structure & Tier Assignments

Approved structure:
```
CANONICAL-<topic>-<timestamp>/
├── INDEX.md
├── TIERS.md
├── <topic>/
│   ├── t1_<slug>.md
│   ├── t2_<slug>.md
│   └── t3_<slug>.md
```

Approved tier distribution:
- T1 (Foundational): N files
- T2 (Structural): N files
- T3 (Optional): N files

## Modifications Made

[If any items were modified during approval, document them here]

### [Item ID]: [Title]

**Original resolution**: [what it was]
**User modification**: [what it became]
**Rationale**: [why user changed it]

## Rejected Items

[If any items were rejected, they remain unresolved and block compendium generation]

## User Confirmation

The user has reviewed and approved the canonicalized architecture specification.

Approved by: [User]
Method: [full_walkthrough / summary_review / bulk_approve]
Timestamp: <timestamp>

---

**Next step**: Run again to generate the canonical specification encyclopedia.
```

## Step 5: Handle Rejections

If any items were rejected:

1. Do NOT set `approved: true` in the front-matter
2. Set `approved: false` and `blocked_by: [list of rejected items]`
3. Inform user: "Some items were rejected. These must be re-resolved before the encyclopedia can be generated."
4. The next run will be a MIDDLE run to re-resolve rejected items

## Output to User

After generating the approval record:

1. If all approved:
   - "All [N] items approved. Ready to generate the canonical specification encyclopedia."
   - "The encyclopedia will contain [P] topic documents."
   - "Run again to generate the final CANONICAL-<topic>-<timestamp>/ directory."

2. If some rejected:
   - "[N] items approved, [M] items rejected."
   - "Rejected items must be re-resolved before proceeding."
   - "Run again to re-resolve: [list rejected items]"

3. If tier assignments approved:
   - "Tier assignments approved:"
   - "  - T1 (Foundational): N files"
   - "  - T2 (Structural): N files"
   - "  - T3 (Optional): N files"
