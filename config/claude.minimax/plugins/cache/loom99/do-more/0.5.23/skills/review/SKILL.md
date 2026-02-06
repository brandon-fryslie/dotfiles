---
name: "do-review"
description: "Code review and quality assessment. Use when user wants to review a PR, recent changes, or specific code."
---

# Review

Code review and quality assessment.

## Process

Use do:project-evaluator in **review mode**:

**Determine target**:
- PR/diff specified → review those changes
- File specified → review that file
- No target → review recent uncommitted changes

**Assess**:
- Code quality
- Potential bugs
- Security concerns
- Performance issues
- Maintainability
- Test coverage

## Output

Review with verdict: APPROVE | REQUEST_CHANGES | CONCERNS

```
═══════════════════════════════════════
Code Review Complete
  Target: [what was reviewed]
  Verdict: [APPROVE | REQUEST_CHANGES | CONCERNS]

  [Key findings - 3-5 bullets]

  Full review: REVIEW-<target>-<timestamp>.md
═══════════════════════════════════════
```
