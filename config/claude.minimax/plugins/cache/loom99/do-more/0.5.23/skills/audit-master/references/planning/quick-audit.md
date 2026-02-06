# Quick Planning Audit Checklist

**Time budget**: 2-5 minutes

**Goal**: Spot-check for obvious problems. Not comprehensive.

## Step 1: Document Discovery (30 seconds)

Glob for planning documents:

```bash
# Strategy layer
ls -la PROJECT_SPEC.md PROJECT.md VISION.md STRATEGY.md 2>/dev/null
ls -la .agent_planning/PROJECT*.md 2>/dev/null

# Architecture layer
ls -la ARCHITECTURE.md 2>/dev/null
ls -la docs/architecture* docs/adr/* 2>/dev/null

# Plans layer
ls -la .agent_planning/PLAN-*.md .agent_planning/BACKLOG-*.md 2>/dev/null
ls -la .agent_planning/SPRINT-*.md ROADMAP.md 2>/dev/null

# Implementation status
ls -la .agent_planning/EVALUATION-*.md .agent_planning/TODO-*.md 2>/dev/null
```

**Record**: Which layers exist? Which are missing entirely?

## Step 2: Quick Freshness Check (1 minute)

For each document found, check modification date:

| Staleness | Interpretation |
|-----------|----------------|
| < 1 week | Current |
| 1-4 weeks | Probably fine |
| 1-3 months | Review needed |
| > 3 months | Likely stale |

**Flag**: Any planning docs > 1 month old without recent STATUS indicating they're still valid.

## Step 3: Cross-Reference Spot Check (2 minutes)

Pick ONE path through the stack and verify references exist:

1. Open most recent PLAN-*.md
2. Does it reference strategy/spec? (should mention goals/features from strategy)
3. Does it reference architecture? (should align with stated structure)
4. Does EVALUATION-*.md reflect progress on this plan?

**Flag**: If plan doesn't mention strategy at all, alignment is suspect.

## Step 4: Red Flag Scan (1 minute)

Quick grep for problems:

```bash
# Contradictions
grep -rn "TODO\|FIXME\|TBD\|NEEDS.*DECISION" .agent_planning/*.md

# Old dates in active docs
grep -rn "202[0-3]-" .agent_planning/PLAN-*.md .agent_planning/SPRINT-*.md

# Planning too far out
grep -rn "Sprint [4-9]\|Sprint 1[0-9]" .agent_planning/*.md
```

## Quick Audit Output Template

```markdown
# Quick Planning Audit - <date>

## Document Inventory
| Layer | Documents Found | Most Recent |
|-------|-----------------|-------------|
| Strategy | [list or "MISSING"] | [date] |
| Architecture | [list or "MISSING"] | [date] |
| Plans | [list or "MISSING"] | [date] |
| Status | [list or "MISSING"] | [date] |

## Red Flags
- [ ] [Any immediate concerns]

## Quick Assessment
[1-2 sentence overall health summary]

## Recommendation
- [ ] HEALTHY - No immediate action needed
- [ ] REVIEW - Medium audit recommended
- [ ] CRITICAL - Thorough audit needed before proceeding
```

## When to Escalate to Medium

- Missing entire layers
- Documents > 2 months old
- Obvious contradictions found
- Plan doesn't reference strategy at all
- STATUS shows significant drift from PLAN
