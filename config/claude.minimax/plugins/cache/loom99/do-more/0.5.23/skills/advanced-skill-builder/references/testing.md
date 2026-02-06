# Testing and Evaluation

Build evaluations BEFORE writing extensive documentation. This ensures skills solve real problems.

## Evaluation-Driven Development

```
1. Identify gaps    → Run Claude on tasks WITHOUT skill
2. Create evals     → Build 3+ test scenarios
3. Baseline         → Measure performance without skill
4. Write minimal    → Only enough to pass evals
5. Iterate          → Test, compare, refine
```

**Why this works:** You solve actual problems, not imagined ones.

## Evaluation Structure

```json
{
  "skills": ["skill-name"],
  "query": "User request that should trigger this skill",
  "files": ["test-files/input.pdf"],
  "expected_behavior": [
    "Successfully reads the input file",
    "Applies the correct processing method",
    "Produces output matching expected format"
  ]
}
```

Create at least 3 evaluations covering:
1. Happy path (normal usage)
2. Edge case (unusual but valid input)
3. Error case (invalid input, should fail gracefully)

## Multi-Model Testing

Skills are additions to models. Test with all models you'll use:

| Model | Considerations |
|-------|----------------|
| Claude Haiku | Fast, economical. May need more explicit guidance. |
| Claude Sonnet | Balanced. Good default target. |
| Claude Opus | Powerful reasoning. Don't over-explain. |

**What works for Opus may need more detail for Haiku.**

## The Claude A/B Pattern

Use one Claude instance to create skills, another to test them:

```
Claude A (Creator)     Claude B (Tester)
       │                      │
       │  Creates skill       │
       ├──────────────────────>
       │                      │
       │                      │  Tests with real tasks
       │                      │
       │  Observes behavior   │
       <──────────────────────┤
       │                      │
       │  Refines skill       │
       ├──────────────────────>
       │                      │
       └──────────────────────┘
            (iterate)
```

**Process:**

1. **Work through task with Claude A** (no skill)
   - Notice what context you provide
   - Note repeated explanations

2. **Ask Claude A to create skill**
   - "Create a skill capturing this pattern"
   - Review for conciseness

3. **Test with Claude B** (fresh instance + skill)
   - Give real tasks, not test scenarios
   - Observe struggles and successes

4. **Return to Claude A with observations**
   - "Claude B forgot to filter test accounts"
   - "The rule about X wasn't prominent enough"

5. **Iterate until reliable**

## What to Observe

Watch how Claude actually uses skills:

| Observation | Indicates |
|-------------|-----------|
| Unexpected file read order | Structure isn't intuitive |
| Missed references | Links need to be more explicit |
| Overreliance on one file | Content should be in SKILL.md |
| Files never read | Unnecessary or poorly signaled |
| Repeated context provision | Skill missing critical info |

## Testing Checklist

Before finalizing:

```
[ ] 3+ evaluations created
[ ] Tested with Haiku
[ ] Tested with Sonnet
[ ] Tested with Opus (if applicable)
[ ] Tested with real usage scenarios
[ ] Observed Claude's file navigation
[ ] Incorporated observations into refinements
```

## Team Feedback

If skill will be shared:

1. Share with teammates
2. Observe their usage patterns
3. Ask:
   - Does it trigger when expected?
   - Are instructions clear?
   - What's missing?
4. Incorporate feedback

Different users reveal blind spots in your own usage patterns.

## Iteration Workflow

After initial creation:

```
1. Use skill on real task
2. Notice struggles or inefficiencies
3. Identify what should be updated
4. Make changes
5. Test again
6. Repeat until solid
```

**Don't ship untested skills.** Real usage reveals problems documentation can't predict.

## Common Testing Failures

| Failure | Cause | Fix |
|---------|-------|-----|
| Skill doesn't trigger | Description missing triggers | Add explicit trigger phrases |
| Wrong behavior | Instructions ambiguous | Add constraints or examples |
| Misses edge cases | No edge case evals | Add edge case test scenarios |
| Works for Opus, fails for Haiku | Instructions too terse | Add more explicit guidance |
| Claude ignores reference files | Poor signaling | Add "Read X before Y" instructions |
