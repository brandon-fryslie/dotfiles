---
name: "do-retro-capture"
description: "Silently capture workflow observations to retro log when you notice repeated issues, user frustration, or process inefficiencies. Use when you observe patterns that could improve future work."
---

# Retro Capture Skill

This skill enables you to silently add observations to the retro log when you notice workflow patterns, friction points, or improvement opportunities.

## When to Use This Skill

Add retro items **silently** (without interrupting the user) when you observe:

1. **Repeated issues**: User encounters same problem >2 times
2. **User frustration**: User expresses frustration or has to manually fix your work
3. **Workflow inefficiency**: Task takes significantly longer than expected
4. **Process gaps**: Missing tools, unclear docs, or workflow friction
5. **Success patterns**: Something worked particularly well and should be remembered
6. **Technical debt impact**: Legacy code or architectural issues blocking progress

## Categories

Choose the most appropriate category:

- `friction` - Things slowing down the workflow
- `success` - Things that worked particularly well
- `confusion` - Unclear processes or documentation
- `observation` - Patterns noticed over time
- `debt` - Technical debt causing problems
- `tooling` - Tool or workflow improvements needed

## How to Add Items

Use the retro-add.py script via Bash:

```bash
echo '{
  "category": "friction",
  "text": "User had to manually fix import paths after refactor 3 times",
  "source": "agent",
  "context": {
    "trigger": "repeated_manual_fix",
    "frequency": 3,
    "command": "/do:it refactor-auth"
  }
}' | "${CLAUDE_PLUGIN_ROOT}/scripts/py-shim.sh" retro-add.py --stdin
```

Or use command-line args:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/py-shim.sh" retro-add.py \
  --category friction \
  --text "Tests failed mysteriously, took 15min to debug" \
  --source agent \
  --context '{"trigger": "flaky_tests", "duration_minutes": 15}'
```

## Important Guidelines

1. **Be silent**: Do NOT tell the user you're adding a retro item
   - Users will see items during `/retro list` or `/retro session`
   - Silent capture prevents interruption to flow

2. **Be specific**: Include concrete details
   - ❌ "User had problems"
   - ✅ "User had to manually fix import paths after refactor 3 times"

3. **Add context**: Include metadata that will help during retro session
   - What command was running
   - How many times it happened
   - What the trigger was
   - Relevant file paths or error messages

4. **Don't over-capture**: Only add items for actual patterns
   - One-off issues: probably not worth capturing
   - Repeated issues: definitely capture
   - Significant workflow wins: capture to reinforce

5. **Choose right category**: Think about what the item represents
   - User had to fix your mistake → `friction`
   - Tests unexpectedly failed → `observation`
   - New approach worked great → `success`
   - Legacy code blocked feature → `debt`

## Examples

### Example 1: Repeated Manual Fixes

User had to fix linting errors 3 times after you made changes:

```bash
echo '{
  "category": "friction",
  "text": "User manually fixed linting errors 3 times after agent code changes",
  "source": "agent",
  "context": {
    "trigger": "repeated_manual_fix",
    "frequency": 3,
    "issue": "linting_errors"
  }
}' | "${CLAUDE_PLUGIN_ROOT}/scripts/py-shim.sh" retro-add.py --stdin
```

### Example 2: Workflow Success

User's new testing approach worked really well:

```bash
echo '{
  "category": "success",
  "text": "TDD workflow with TestLoop prevented rework, implementation passed on first try",
  "source": "agent",
  "context": {
    "trigger": "workflow_efficiency",
    "command": "/do:tdd",
    "outcome": "zero_rework"
  }
}' | "${CLAUDE_PLUGIN_ROOT}/scripts/py-shim.sh" retro-add.py --stdin
```

### Example 3: Technical Debt Impact

Legacy code blocked feature implementation:

```bash
echo '{
  "category": "debt",
  "text": "Legacy auth middleware forced 2-hour refactor before implementing new feature",
  "source": "agent",
  "context": {
    "trigger": "blocking_debt",
    "duration_hours": 2,
    "files": ["src/middleware/auth.ts"],
    "command": "/do:it add-oauth"
  }
}' | "${CLAUDE_PLUGIN_ROOT}/scripts/py-shim.sh" retro-add.py --stdin
```

### Example 4: User Confusion

User asked same question multiple times:

```bash
echo '{
  "category": "confusion",
  "text": "User asked 3 times which agent handles test implementation (answer: test-driven-implementer)",
  "source": "agent",
  "context": {
    "trigger": "repeated_question",
    "frequency": 3,
    "topic": "agent_selection"
  }
}' | "${CLAUDE_PLUGIN_ROOT}/scripts/py-shim.sh" retro-add.py --stdin
```

## Integration with Retro Command

Items you add will be:

1. **Accumulated** in `.agent_planning/retro/items.jsonl`
2. **Displayed** when user runs `/retro list`
3. **Reviewed** during `/retro session`
4. **Converted to action items** via beads tasks during retro

This creates a continuous improvement loop where you help identify patterns that might otherwise be forgotten.

## Remember

- **Silent capture** - Don't announce you're adding items
- **Concrete details** - Be specific about what happened
- **Meaningful patterns** - Only capture things worth discussing later
- **Rich context** - Include metadata that will help during retro

The goal is to preserve observations that would otherwise be lost when conversations compact or sessions end.
