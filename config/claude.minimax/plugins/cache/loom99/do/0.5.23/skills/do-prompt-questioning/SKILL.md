---
name: "do-prompt-questioning"
description: "Allow subagents to ask questions to users and receive responses for decision-making. Use when a subagent needs human input to proceed."
---

# Prompt Questioning Skill

## Purpose

Enable subagents to ask questions to users and receive responses. This provides a clean interface for subagents that need human input to make decisions or proceed with work.

## When to Use

- Subagent needs clarification to proceed
- Subagent needs to present options and get user choice
- Subagent needs verification or approval before continuing
- Subagent encounters ambiguity that requires human judgment

## Core Procedure

### Step 1: Formulate Question

Structure the question clearly:
- **Context**: Brief explanation of current state/situation
- **Question**: What you need to know
- **Options** (if applicable): Clear choices with implications
- **Default** (if applicable): Recommended choice with reasoning

### Step 2: Present to User

Format the question for clarity:

```
┌─ Question ───────────────────────────────┐
│ [Context if needed]                      │
│                                          │
│ [Your question here?]                    │
│                                          │
│ Options:                                 │
│ 1. [Option A] - [brief implication]      │
│ 2. [Option B] - [brief implication]      │
│ 3. [Option C] - [brief implication]      │
│                                          │
│ [Recommendation if any]                  │
└──────────────────────────────────────────┘
```

### Step 3: Await Response

Wait for user response. Do not proceed without answer.

### Step 4: Process Response

Parse the response and use it to inform the decision or action.

## Question Types

### Yes/No Confirmation
```
Should I proceed with [action]?
- Yes: [what happens]
- No: [what happens]
```

### Multiple Choice
```
Which approach should I use?
1. [Approach A] - [tradeoff]
2. [Approach B] - [tradeoff]
3. [Approach C] - [tradeoff]
```

### Open-Ended Input
```
What [thing] would you like me to use?

Example: "postgres" or "sqlite"
```

### Verification
```
I've completed [action]. Please verify:
- [Item 1]
- [Item 2]

Does this look correct?
1. Yes, continue
2. No, [describe issue]
```

## Key Principles

**Be Specific**: Ask clear, answerable questions. Avoid vague or open-ended questions when a specific choice is needed.

**Provide Context**: Give enough background that the user can make an informed decision without extensive research.

**Offer Options When Possible**: Multiple choice questions are easier to answer than open-ended ones.

**Explain Implications**: For each option, briefly explain what choosing it means.

**Respect Time**: Keep questions concise. Don't ask multiple questions at once unless they're tightly related.

**Default Sensibly**: When there's a clear best choice, recommend it but let user override.

## Examples

### Verification Request
```
┌─ Verification Required ──────────────────┐
│ I've added error handling to the API     │
│ endpoint. Here's what changed:           │
│                                          │
│ - Added try/catch around database calls  │
│ - Returns 500 with error message on fail │
│ - Logs errors to console                 │
│                                          │
│ Does this look correct?                  │
│ 1. Approve - commit and continue         │
│ 2. Revise - [describe what to change]    │
│ 3. Reject - discard this change          │
└──────────────────────────────────────────┘
```

### Clarification Request
```
┌─ Clarification Needed ───────────────────┐
│ The spec mentions "user preferences"     │
│ but doesn't specify storage location.    │
│                                          │
│ Where should preferences be stored?      │
│ 1. Local storage (browser only)          │
│ 2. Database (synced across devices)      │
│ 3. Both (local + sync to server)         │
│                                          │
│ Recommendation: Option 2 for consistency │
└──────────────────────────────────────────┘
```

### Choice Request
```
┌─ Decision Required ──────────────────────┐
│ Multiple approaches could work here:     │
│                                          │
│ 1. Refactor existing code                │
│    - Safer, preserves behavior           │
│    - Takes longer                        │
│                                          │
│ 2. Rewrite from scratch                  │
│    - Cleaner result                      │
│    - Higher risk of regression           │
│                                          │
│ Which approach?                          │
└──────────────────────────────────────────┘
```

## Anti-Patterns

**Asking obvious questions**: Don't ask what you can reasonably determine yourself.

**Compound questions**: Ask one thing at a time unless tightly related.

**No options provided**: When choices exist, list them instead of asking open-ended.

**Missing implications**: Always explain what each choice means.

**Blocking unnecessarily**: Only ask when you genuinely cannot proceed without input.

## Integration

This skill is designed to be used by any subagent that needs human input:

- **iterative-implementer**: Verification after changes
- **work-evaluator**: Ambiguity resolution
- **researcher**: Direction on research focus
- **Any subagent**: When human judgment is needed

The skill provides a consistent interface for human interaction across all subagents.
