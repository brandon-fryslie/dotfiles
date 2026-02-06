# Feedback Handling

How to process and act on user feedback from checkpoints.

## Feedback Categories

| User Response | Meaning | Action |
|---------------|---------|--------|
| "Looks great!" | Fully satisfied | Mark complete, no follow-up |
| "It's okay" | Works but minor issues | Note issues, may address later |
| "Needs work" | Significant problems | Must address before continuing |
| Custom text | Specific feedback | Parse and categorize |

## Parsing Custom Feedback

When user provides freeform text, categorize into:

1. **Bug reports**: "It crashes when...", "Doesn't work if..."
2. **Missing features**: "Need to add...", "Should also..."
3. **Quality concerns**: "Code is messy", "Should refactor..."
4. **Questions**: "Why did you...", "What about...?"
5. **Preferences**: "I'd prefer...", "Can you change to..."

## Building Fix List

When ACTION is FIX_FEEDBACK, compile issues:

```markdown
## Issues to Address

### From: [Work Item Name]
- [ ] [Issue 1 from feedback]
- [ ] [Issue 2 from feedback]

### From: [Another Work Item]
- [ ] [Issue from feedback]
```

## Feedback-to-Action Mapping

| Feedback Type | Recommended Action |
|---------------|-------------------|
| Bug report | Fix immediately before continuing |
| Missing feature (small) | Add to current work |
| Missing feature (large) | Add to backlog, continue |
| Quality concern | Address if quick, otherwise backlog |
| Question | Answer, clarify, then continue |
| Preference | Apply if reasonable, discuss if not |

## Continuing After Feedback

When user says "Continue work" but feedback was noted:

1. Log feedback in `.agent_planning/FEEDBACK-<timestamp>.md`
2. Continue to next planned task
3. Address logged feedback in future iteration

## Feedback File Format

```markdown
# Feedback Log

**Checkpoint**: <timestamp>
**Command**: /do:<command>
**EXEC_ID**: <exec-id>

## Noted Issues (Not Blocking)

### [Work Item]
- [Feedback that was "okay" but noted]

## Future Considerations

- [Any preferences or suggestions to remember]
```

## Escalation

If user repeatedly marks items as "Needs work":

1. After 2+ items need work → Ask if they want to stop and discuss
2. Offer: "Several items need attention. Should we pause to discuss the overall approach?"
3. Prevent continuing if critical items are broken
