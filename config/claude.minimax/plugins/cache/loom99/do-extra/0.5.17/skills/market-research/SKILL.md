---
name: "do-market-research"
description: "External/market research - competitive landscape, demand signals, alternatives. Use when user asks about competitors, market demand, or external approaches."
---

# Market Research

External research: competitors, demand, alternatives.

## Process

**Step 1**: Gather project context from PROJECT_SPEC.md or CLAUDE.md.

**Step 2**: Use do:researcher with WebSearch/WebFetch:

**If no specific topic** (competitive analysis):
- Search for similar tools/projects
- Assess demand signals (stars, downloads, discussions)
- Compare approaches
- Identify opportunities and threats

**If specific topic**:
- Research that topic externally
- Ground findings in project context

**Step 3**: Generate RESEARCH-market-*.md

## Output

```
═══════════════════════════════════════
Market Research Complete
  Topic: [competitive analysis | specific topic]
  Alternatives: [count] found
  Key insight: [1-sentence]

  Report: RESEARCH-market-<timestamp>.md
Next: /do:plan to incorporate findings
═══════════════════════════════════════
```
