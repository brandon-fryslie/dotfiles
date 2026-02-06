---
name: "do-planning-audit"
description: "Audit alignment across strategy, architecture, plans, and implementation. Ensures planning documents remain effective and aligned over time. Supports quick, medium, and thorough intensity levels."
---

# Planning Audit

Hierarchical alignment audit across the planning stack:

```
Strategy/Vision → Architecture → Plans → Implementation
```

Each layer should logically derive from the one above. This skill audits for alignment gaps, staleness, completeness, and coherence at each level.

## When to Use

- `/do:plan audit plans` - Direct invocation
- `/do:plan audit comprehensive` - As part of full audit
- When plans feel disconnected from reality
- Before major planning sessions
- After strategy changes to check downstream impact

## Intensity Levels

| Level | Trigger Words | Time | Depth |
|-------|---------------|------|-------|
| **Quick** | "quick", "glance", "overview" | 2-5 min | Spot-check alignment, flag obvious issues |
| **Medium** | (default), "check", "review" | 10-20 min | Systematic layer-by-layer verification |
| **Thorough** | "thorough", "comprehensive", "deep", "forensic" | 30-60 min | Leave no stone unturned, full traceability |

## The Planning Stack

### Layer 1: Strategy/Vision
**Files**: `PROJECT_SPEC.md`, `VISION.md`, `STRATEGY.md`, `PROJECT.md`

What this layer defines:
- What are we building and why?
- Who is it for?
- What problems does it solve?
- What is success?

### Layer 2: Architecture
**Files**: `ARCHITECTURE.md`, system diagrams, ADRs (Architecture Decision Records)

What this layer defines:
- How will we structure the solution?
- What are the major components?
- How do they interact?
- What technologies/patterns?

### Layer 3: Plans
**Files**: `PLAN-*.md`, `BACKLOG-*.md`, `SPRINT-*.md`, `ROADMAP.md`

What this layer defines:
- What work needs to be done?
- In what order?
- What are the dependencies?

### Layer 4: Implementation
**Files**: Actual code, `EVALUATION-*.md`, `TODO-*.md`

What this layer defines:
- What has actually been built?
- Does it match the plans?

## Audit Process

### Quick Audit

1. **Locate documents** - Find what exists at each layer
2. **Spot-check alignment** - Do adjacent layers reference each other?
3. **Flag obvious issues** - Missing layers, stale dates, obvious contradictions
4. **Output** - Brief summary with red flags

See `../audit-master/references/planning/quick-audit.md` for checklist.

### Medium Audit

All of Quick, plus:

1. **Layer completeness** - Is each layer sufficiently detailed for its purpose?
2. **Vertical traceability** - Can you trace from strategy → architecture → plan → code?
3. **Horizontal consistency** - Do documents at same layer agree?
4. **Staleness detection** - Are documents outdated vs. reality?
5. **Output** - Layer-by-layer assessment with specific gaps

See `../audit-master/references/planning/medium-audit.md` for checklist.

### Thorough Audit

All of Medium, plus:

1. **Strategy coherence** - Does the strategy itself make sense? Gaps? Overlaps?
2. **Architecture sufficiency** - Does architecture enable all strategy goals?
3. **Plan coverage** - Is all strategy/architecture work planned?
4. **Plan realism** - Are plans achievable? Dependencies identified?
5. **Implementation alignment** - Does code match plans? Drift detected?
6. **Temporal consistency** - Planning horizon appropriate per layer?
7. **Output** - Comprehensive report with traceability matrix

See `../audit-master/references/planning/thorough-audit.md` for checklist.

## Planning Horizon Guidelines

| Distance | Detail Level | What Should Exist |
|----------|--------------|-------------------|
| Current sprint | Ready to pull | Full task breakdown, acceptance criteria |
| Sprint +1, +2 | Concrete | Stories identified, rough effort known |
| Sprint +3+ | Directional | Epics/themes, not detailed stories |
| Exception | Known critical work with clear implementation | Can be detailed regardless of distance |

**Anti-pattern**: Detailed task breakdowns for work 3+ sprints out (waste, will change)

**Anti-pattern**: No visibility beyond current sprint (no strategic alignment)

## Output Format

```
═══════════════════════════════════════
Planning Audit Complete ([intensity])

Layer Health:
  Strategy:     [rating] [issues]
  Architecture: [rating] [issues]
  Plans:        [rating] [issues]
  Alignment:    [rating] [issues]

Critical Gaps: [n]
Stale Documents: [n]
Alignment Issues: [n]

Report: PLANNING-AUDIT-<timestamp>.md
═══════════════════════════════════════
```

## Ratings

| Rating | Meaning |
|--------|---------|
| ✅ Healthy | Layer complete, aligned, current |
| ⚠️ Attention | Minor gaps or staleness |
| ❌ Critical | Major gaps, misalignment, or severely stale |
| ❓ Missing | Layer doesn't exist |
