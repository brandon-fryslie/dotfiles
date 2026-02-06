# REVIEW RUN - Peer Design Review

This is a REVIEW run. All items are resolved (100% progress). Before generating the encyclopedia, you must perform a comprehensive peer design review.

## Purpose

You are a senior engineer conducting a peer design review. Imagine you're a coworker who's been asked to review this architecture spec before it gets finalized. Your job is to:

1. **Challenge assumptions** - "Why did we choose X over Y?"
2. **Find holes** - "What happens when Z?"
3. **Push back on complexity** - "Do we really need this?"
4. **Catch inconsistencies** - "This says A here but B there"
5. **Think about the poor soul who implements this** - "How would I actually build this?"
6. **Consider maintenance** - "What happens in 6 months when requirements change?"
7. **Review the encyclopedia structure** - "Does this topic breakdown make sense?"

Be constructively critical. This is the time to raise concerns, not after we've built the thing.

## What to Read

1. Read ALL `CANONICALIZED-*` files in full
2. Read the original source files for context
3. Read any refinement documents that were applied
4. **Pay special attention to `CANONICALIZED-TOPICS-*.md`** - the encyclopedia structure

## Review Mindset

Ask yourself these questions as you review:

**Architecture Questions**
- Does this design actually solve the stated problem?
- Are we over-engineering? Under-engineering?
- What are the failure modes?
- How does this interact with other parts of the system?
- What's the migration path from current state?

**Implementation Questions**
- Can I actually implement this as specified?
- Are there ambiguities that would cause me to guess?
- What would trip up a new team member?
- Are the invariants actually enforceable?

**Naming & Terminology Questions**
- Will these names make sense in 6 months?
- Is there existing terminology we should align with?
- Will these names cause confusion with similar concepts?

**Trade-off Questions**
- What did we give up by choosing this approach?
- Are the trade-offs documented and justified?
- Would I make the same trade-offs?

**Encyclopedia Structure Questions**
- Do the topic boundaries make sense?
- Is anything awkwardly split across topics?
- Are there topics that should be merged or split?
- Does the reading order make sense?
- Can each topic stand alone while being part of the whole?

**Tier Classification Questions** (CRITICAL)
- Is anything in t1 (foundational) that's actually t2 (structural) or t3 (optional)?
- Is anything in t3 (optional) that should be t1 (foundational)?
- Ask for each t1 item: "If we changed this, would it be a different application?" If no → wrong tier
- Ask for each t3 item: "Can we change this freely?" If no → wrong tier
- Is the t1 content actually small and critical, or is it bloated?

## Generate Design Review Document

Create `EDITORIAL-REVIEW-<topic>-<timestamp>.md` with this structure:

```markdown
---
command: /canonicalize-architecture $ARGUMENTS
reviewed_files:
  - [CANONICALIZED-SUMMARY-*.md]
  - [CANONICALIZED-QUESTIONS-*.md]
  - [CANONICALIZED-GLOSSARY-*.md]
  - [CANONICALIZED-TOPICS-*.md]
status: REVIEW_COMPLETE
---

# Peer Design Review: <Topic>

Generated: <timestamp>
Reviewer: Claude (peer review)

---

## Overall Assessment

[2-3 paragraphs giving your honest assessment as a peer reviewer. What's good? What concerns you? Would you approve this design as-is?]

**Verdict**: [Approve / Approve with concerns / Request changes / Major rework needed]

---

## What I Like

Before diving into concerns, acknowledge what's working well. Good design decisions should be called out.

- [Thing that's well-designed and why]
- [Another good decision]
- [etc.]

---

## Encyclopedia Structure Review

### Topic Organization

| Topic | Assessment | Notes |
|-------|------------|-------|
| type-system | Good / Needs adjustment | [notes] |
| topology | Good / Needs adjustment | [notes] |

### Tier Classification Review

| Topic | T1 Files | T2 Files | T3 Files | Assessment |
|-------|----------|----------|----------|------------|
| type-system | core-types | block-roles | diagnostics | T1 looks good / T3 might be t2 |
| topology | invariants | dataflow | examples | Good distribution |

**Tier Concerns**:
- [Flag any t1 content that seems too mutable]
- [Flag any t3 content that seems too critical]
- [Flag any bloated t1 sections]

### Structure Concerns

[Any issues with the encyclopedia organization or tier assignments]

### Suggested Changes

[Specific recommendations for topic changes or tier reclassification]

---

## Blocking Concerns

Things I would block this review on. These need to be addressed.

### [B1]: [Short Title]

**Where**: [Which document/section/topic]

**The Issue**: [Describe the problem clearly - what's wrong, ambiguous, or missing]

**Why It Matters**: [What could go wrong if we ship this as-is]

**My Suggestion**: [How I'd fix it, or questions to answer]

**Questions for the Author**:
- [Specific question 1]
- [Specific question 2]

---

## Non-Blocking Concerns

Things that bother me but shouldn't block shipping. Worth discussing.

### [N1]: [Short Title]

**Where**: [Which document/section/topic]

**The Issue**: [What's concerning]

**Why I'm Raising It**: [What could go wrong, or why this feels off]

**Suggestion**: [Optional - how to address]

**Alternative View**: [If there's a reasonable argument for keeping it as-is]

---

## Questions & Clarifications

Things I don't fully understand or want to discuss.

### [Q1]: [Question]

**Context**: [Why I'm asking]

**My Current Understanding**: [What I think it means]

**What I Need Clarified**: [Specific ask]

---

## Nits & Polish

Small stuff. Take it or leave it.

| # | Location | Comment |
|---|----------|---------|
| 1 | [section/topic] | [small suggestion] |
| 2 | [section/topic] | [typo/clarity/etc] |

---

## Consistency Audit

### Cross-Reference Check

| Claim | Source | Verified? | Notes |
|-------|--------|-----------|-------|
| [claim made] | [where] | Yes/No/Partial | [any issues] |

### Terminology Consistency

| Term | Definition Location | Used Consistently? | Issues |
|------|--------------------|--------------------|--------|
| [term] | [glossary ref] | Yes/No | [where it deviates] |

### Cross-Topic Consistency

| Concept | Topics Mentioning | Consistent? | Issues |
|---------|-------------------|-------------|--------|
| [concept] | 01-xxx, 03-zzz | Yes/No | [conflicts] |

---

## Implementation Readiness

Could someone implement this spec as written?

- [ ] All types fully specified
- [ ] All behaviors unambiguous
- [ ] Error cases covered
- [ ] Edge cases documented
- [ ] No circular definitions
- [ ] No "TBD" or "TODO" items remaining
- [ ] Topic boundaries clear for implementers
- [ ] Tier classifications make sense (t1 is truly foundational, t3 is truly optional)
- [ ] T1 content is small and critical (not bloated)

**Gaps that would block implementation**:
[List any, or "None - spec is implementation-ready"]

**Tier Misclassifications that need fixing**:
[List any items in wrong tiers, or "None - tier assignments are sound"]

---

## Summary

| Category | Count |
|----------|-------|
| Blocking Concerns | [N] |
| Non-Blocking Concerns | [N] |
| Questions | [N] |
| Nits | [N] |
| Topic Structure Issues | [N] |
| Tier Misclassifications | [N] |

**Recommendation**: [Approve / Approve after addressing blocking concerns / Needs another round]

**Next Steps**: [What should happen based on this review]
```

## Present to User

After generating the review document:

1. Print: "REVIEW RUN - Peer design review complete"

2. Give a brief summary in conversational tone:
   ```
   I've completed my review of the canonicalized spec. Here's where I landed:

   **Verdict**: [Your verdict]

   **The Good**: [1-2 sentence summary of what's working]

   **Encyclopedia Structure**: [Assessment of topic organization]

   **Tier Classifications**: [Assessment - sound / some misclassifications found]

   **Blocking Concerns**: [N] - [Brief list if any]

   **Tier Issues**: [N] - [Brief note if any]

   **Other Concerns**: [N] - [Brief note]

   **Questions**: [N] - [Brief note]
   ```

3. If blocking concerns exist:
   - "I'd want to resolve the blocking concerns before we finalize this."
   - "Want to discuss them, or should I just list them out?"

4. If no blocking concerns:
   - "Nothing blocking from my side. Ready to walk through the approval process when you are."
   - "Run again to start the item-by-item approval, or let me know if you want to discuss any of my concerns first."

## Output File Location

Place the `EDITORIAL-REVIEW-*.md` file in the same directory as the `CANONICALIZED-*` files.
