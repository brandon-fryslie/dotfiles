---
name: "do-rigidity"
description: "Analyze structural rigidity in codebase. Identifies high-coupling areas, dependency cycles, and recommends boundary insertions. Use when module changes cause cascading failures."
context: fork
---

# Rigidity Analysis Skill

Structural rigidity analysis using the gabe agent.

<user-input>$ARGUMENTS</user-input>
<current-command>rigidity</current-command>

## Mode Detection

Parse `$ARGUMENTS` to determine mode:
- "quick" or no args → Quick survey only (Phase A)
- "diagnose" → Full analysis (Phases A-C)
- "intervene" → Full workflow with interventions (Phases A-E, requires approval)

## Workflow

### Quick Mode (default)
1. Spawn gabe agent with instruction to run Phase A only
2. Output: SYSTEM_MAP.md with dependency overview

### Diagnose Mode
1. Spawn gabe agent with instruction to run Phases A-C
2. Output: SYSTEM_MAP.md, NUCLEATION_SITES.md, INTERVENTION_PLAN.md
3. Present findings to user

### Intervene Mode
1. Spawn gabe agent with full Phase A-E workflow
2. **CRITICAL**: Checkpoint after Phase C for user approval before Phase D
3. Phase D modifies code - requires explicit "proceed" from user
4. Output: All artifacts plus actual boundary installations

## Agent Invocation

Use the Task tool to spawn `do:gabe` agent:

```
Analyze codebase rigidity.

Mode: [quick|diagnose|intervene]
Project: [current working directory]

[For intervene mode]: Stop after Phase C and present INTERVENTION_PLAN.md
for user approval before proceeding to Phase D.

Output directory: .agent_planning/rigidity_breaker/<date>-<topic>/
```

## Output

```
═══════════════════════════════════════
Rigidity Analysis: [mode]

  [For quick]: System map generated
  [For diagnose]: Found N nucleation sites, M intervention candidates
  [For intervene]: Applied N boundary changes

  Artifacts: .agent_planning/rigidity_breaker/...

  Next: [suggestions based on mode]
═══════════════════════════════════════
```
