---
name: "do-deep-audit"
description: "Comprehensive technical audit checklists for architecture, design, efficiency, and domain-specific analysis. Use when project-evaluator runs in audit mode."
---

# Deep Audit

Detailed checklists and examples for comprehensive technical audits. This skill provides the reference material that `project-evaluator` uses in audit mode.

## When to Use

Invoked automatically by `project-evaluator` when user requests:
- `/do:plan audit`
- "comprehensive evaluation"
- "deep audit"
- "thorough analysis"

## Quick Reference

### Audit Dimensions

| Dimension | Reference File | Focus |
|-----------|----------------|-------|
| Architecture | `../audit-master/references/code-quality/architecture.md` | Structure, alignment, violations |
| Design Quality | `../audit-master/references/code-quality/design-quality.md` | Patterns, smells, intentionality |
| Efficiency | `../audit-master/references/code-quality/efficiency.md` | Dead code, redundancy, performance |
| Domains | `../audit-master/references/code-quality/domains.md` | Domain-specific anti-patterns |

## Audit Workflow

1. **Identify audit scope** - whole project or specific area?
2. **Select applicable dimensions** - not all apply to every project
3. **Load reference files** for selected dimensions
4. **Execute checklists** systematically
5. **Document findings** with evidence (file:line references)

## Output

Findings feed into `project-evaluator`'s STATUS report under "Deep Audit Findings" section.

## Priority Levels

| Priority | Meaning | Action |
|----------|---------|--------|
| P0 | Critical - blocks functionality or causes harm | Fix immediately |
| P1 | High - significant quality/maintenance issue | Fix soon |
| P2 | Medium - noticeable but not urgent | Plan to address |
| P3 | Low - polish, nice-to-have | Backlog |
