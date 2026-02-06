---
name: "do-research-external"
description: "[market|docs|patterns] Research external sources - market analysis, competitors, external docs. Entry point for /do-more:research command."
context: fork
---

Research from external sources. Web search, market analysis, competitor comparison.

<user-input>$ARGUMENTS</user-input>
<current-command>research</current-command>

## Topic Resolution

Determine what to research:

1. **If `$ARGUMENTS` provided** → Use `$ARGUMENTS` as the topic
2. **If no arguments, check conversation context** → If we were just discussing a subject, research that
3. **If no obvious subject in conversation** → Ask what to research

Set `main_instructions` to the resolved topic.

---

## Main Workflow

**Scope**: External-only. Learn from web, compare with external tools/projects, market viability.

For internal codebase questions → Use `/do:explore`

### Intent Detection

Using `main_instructions`:

| Intent signals | Action |
|----------------|--------|
| "market", "competitors", "alternatives", "demand", "landscape" | Invoke `do:market-research` skill |
| "docs", "documentation", "how to use X" | Use do:researcher (external docs) |
| "best practices", "patterns", "how others do" | Use do:researcher (industry research) |
| *(default)* | Use do:researcher (general external) |

**Use the Skill tool** for market-research. Otherwise continue with do:researcher below.

### Process (for non-market research)

Use do:researcher in **external mode**:

1. **Search**: Web search for relevant sources
2. **Gather**: Collect information from multiple sources
3. **Compare**: Contrast with project context
4. **Synthesize**: Form recommendations with tradeoffs

### Output

```
═══════════════════════════════════════
Research Complete
  Topic: [summary]
  Sources: [count] external sources
  Report: RESEARCH-<topic>-<timestamp>.md
Next: /do:plan to incorporate findings
═══════════════════════════════════════
```
