---
name: "do-research"
description: "Research a problem or question through iterative exploration. Loops researcher->evaluator until sufficient, then auto-selects recommendation. Output feeds into /plan. Entry point for /do:research command."
context: fork
---

Research a question or problem to produce a well-considered decision.

<research-question>
$ARGUMENTS
</research-question>

## Scope Selection

Determine scope based on the question:

- **Project-wide** (architecture, patterns, major decisions): Use project-evaluator for evaluation
- **Focused/specific** (implementation detail, concrete problem): Use work-evaluator for evaluation

Default to **focused** unless the question clearly affects project-wide architecture.

## Research Loop

**Maximum 3 iterations.** Track iteration count and enforce limit.

Repeat until research is SUFFICIENT OR iteration limit reached:

**Step 1: Research** (iteration n of 3)
Use the do:researcher agent to explore the problem:
- Gather context from codebase and external sources
- Identify all viable options
- Document tradeoffs specific to this project
- Form a recommendation

**Step 1b: Display results** - Show researcher's summary (options found, recommendation) to user.

**Step 2: Evaluate**
Use the appropriate evaluator based on scope:
- **Project-wide**: do:project-evaluator (research evaluation mode)
- **Focused**: do:work-evaluator (research evaluation mode)

The evaluator assesses:
- Does research answer the actual question?
- Are options genuinely different and complete?
- Are tradeoffs specific to this project?
- Is the recommendation actionable?

Verdict: **SUFFICIENT** or **INSUFFICIENT**

**Step 2b: Display results** - Show evaluator's verdict and any gaps identified.

**Continue Condition**:
If INSUFFICIENT AND iteration < 3, provide evaluator's feedback to researcher and continue loop.

**Exit Conditions**:
- **SUFFICIENT**: Evaluator satisfied → proceed to decision
- **Iteration limit reached**: After 3 iterations still INSUFFICIENT → surface to user with best available research and explicit gaps. User must provide guidance before continuing.

## Decision Step

After loop exits with SUFFICIENT:

**Step 3: Make Decision**
Use the same evaluator to **choose** the recommendation:
- Review recommendation against project constraints
- Either ACCEPT recommendation or CHOOSE ALTERNATIVE with rationale
- Output a clear decision

**Step 3b: Display decision** - Show chosen option and rationale.

## Output Format

Generate decision output that feeds into /plan:

```markdown
## Research Decision: [Topic]

**Question**: [Original question]
**Research**: RESEARCH-<topic>-<timestamp>.md

**Decision**: [Chosen option]
**Rationale**: [Why this fits the project]
**Tradeoffs Accepted**: [What we're giving up]

**Implementation Impact**:
- [How this affects existing code]
- [New components/patterns needed]
- [Files likely to change]

**Next**: /plan to incorporate into project plan
```

## Final Summary

Display:
```
═══════════════════════════════════
Research Complete
  Question: [summary]
  Iterations: n | Decision: [chosen option]
  Research: RESEARCH-<topic>-<timestamp>.md
Next: /plan to create implementation plan
═══════════════════════════════════
```

## Important Notes

- Research loop continues until evaluator is satisfied, removing user from iteration
- Evaluator auto-selects recommendation based on project fit
- Output is designed to feed directly into planning workflow
- Use project-evaluator for architectural questions, work-evaluator for specific technical questions
- **Iteration limit enforced**: Maximum 3 iterations. If still INSUFFICIENT after 3 rounds, STOP and surface to user with:
  - Best available research so far
  - Specific gaps that couldn't be resolved
  - Request for user guidance before continuing
