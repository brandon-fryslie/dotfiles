---
name: "do-explore"
description: "Explore codebase - ask questions, compare ideas, understand internals. Internal only. Entry point for /do-more:explore command."
context: fork
---

Explore the codebase. Internal-only - no external research.

<user-input>$ARGUMENTS</user-input>
<current-command>explore</current-command>

## Topic Resolution

Determine what to explore:

1. **If `$ARGUMENTS` provided** → Use `$ARGUMENTS` as the topic
2. **If no arguments, check conversation context** → If we were just discussing a subject, explore that
3. **If no obvious subject in conversation** → Ask what to explore

Set `main_instructions` to the resolved topic.

---

## Main Workflow

**Scope**: Codebase-only. Learn from internal sources, ask about the project, compare ideas within the project.

Use do:researcher in **explore mode** with `main_instructions`:

1. **Understand**: What/where/how is being asked?
2. **Search**: Grep/Glob to locate files quickly
3. **Read**: Examine key files
4. **Answer**: Respond concisely with `file:line` references

**Constraints**:
- Single-pass search for simple questions
- Multi-pass allowed for "compare" or "how does X relate to Y" questions
- Target: 30 seconds - 5 minutes depending on complexity

## Output

**Simple** (1-3 files): Answer inline with references
**Complex** (4+ files): EXPLORE-*.md with summary inline

## Redirects

- Needs external research → "Use `/do:external-research`"
- Needs correctness/status check → "Use `/do:plan status`"
