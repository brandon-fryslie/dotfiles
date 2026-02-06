# Medium Planning Audit Checklist

**Time budget**: 10-20 minutes

**Goal**: Systematic verification of each layer and alignment between layers.

## Phase 1: Document Inventory (2 minutes)

Complete the Quick Audit document discovery, then catalog:

```markdown
## Planning Document Inventory

### Strategy Layer
| Document | Last Modified | Status |
|----------|---------------|--------|
| PROJECT_SPEC.md | [date] | current/stale/missing |
| ... | | |

### Architecture Layer
| Document | Last Modified | Status |
|----------|---------------|--------|

### Plans Layer
| Document | Last Modified | Status |
|----------|---------------|--------|

### Implementation Layer
| Document | Last Modified | Status |
|----------|---------------|--------|
```

## Phase 2: Layer Completeness (5 minutes)

### Strategy Layer Assessment

| Check | Pass | Fail |
|-------|------|------|
| Problem statement defined? | Clear what we're solving | Vague or missing |
| Target users identified? | Specific personas/segments | "Everyone" or unclear |
| Success criteria defined? | Measurable outcomes | No way to know if done |
| Scope boundaries clear? | What's in/out stated | Unbounded scope |
| Key features listed? | Prioritized feature set | Wish list or missing |

**Completeness**: Count passes / total checks

### Architecture Layer Assessment

| Check | Pass | Fail |
|-------|------|------|
| Component structure defined? | Clear system breakdown | No structure documented |
| Data model documented? | Entities and relationships | Implicit only |
| Integration points identified? | External systems, APIs | Unknown dependencies |
| Technology choices documented? | Stack decisions recorded | Implicit or scattered |
| Key decisions explained? | Rationale for choices | "Just because" |

**Completeness**: Count passes / total checks

### Plans Layer Assessment

| Check | Pass | Fail |
|-------|------|------|
| Work items identified? | Concrete tasks exist | Vague intentions only |
| Priorities assigned? | P0/P1/P2 or equivalent | Everything same priority |
| Dependencies mapped? | Blockers identified | Linear assumption |
| Current sprint detailed? | Ready-to-pull items | High-level only |
| Near-term visible? | Sprint +1/+2 outlined | Only current sprint |

**Completeness**: Count passes / total checks

## Phase 3: Vertical Alignment (8 minutes)

### Strategy → Architecture Alignment

For each major strategy goal, verify architecture supports it:

| Strategy Goal | Architecture Support | Gap? |
|---------------|---------------------|------|
| [Goal from strategy] | [How architecture enables] | Y/N |

**Questions**:
- Does architecture enable all stated features?
- Are there architecture components with no strategy justification?
- Could this architecture deliver the success criteria?

### Architecture → Plans Alignment

For each architecture component, verify plans exist:

| Architecture Component | Planned Work | Gap? |
|------------------------|--------------|------|
| [Component] | [Related plan items] | Y/N |

**Questions**:
- Is there planned work for all architecture components?
- Do plans match architectural patterns (or diverge)?
- Are integration points planned?

### Plans → Implementation Alignment

For completed plan items, verify implementation matches:

| Plan Item | Implementation Status | Drift? |
|-----------|----------------------|--------|
| [Item] | [Actual status] | Y/N |

**Questions**:
- Does STATUS reflect PLAN progress accurately?
- Has implementation diverged from plan?
- Are "done" items actually done per acceptance criteria?

## Phase 4: Horizontal Consistency (3 minutes)

Check documents at same layer agree:

### Strategy Layer
- Do all strategy docs tell same story?
- Any contradictory goals?
- Same scope boundaries?

### Plans Layer
- Does BACKLOG align with PLAN?
- Does SPRINT derive from BACKLOG?
- Do priorities match across documents?

## Phase 5: Staleness Assessment (2 minutes)

| Document | Last Modified | Last STATUS Mention | Verdict |
|----------|---------------|---------------------|---------|
| [doc] | [date] | [date or "never"] | current/stale/obsolete |

**Staleness rules**:
- Strategy: OK if stable, flag if > 6 months with no revalidation
- Architecture: Flag if > 3 months without ADR activity
- Plans: Flag if > 1 month without STATUS updates
- Current sprint: Flag if > 1 week without progress

## Medium Audit Output Template

```markdown
# Medium Planning Audit - <date>

## Layer Health Summary
| Layer | Completeness | Staleness | Rating |
|-------|--------------|-----------|--------|
| Strategy | X/5 | [status] | ✅/⚠️/❌ |
| Architecture | X/5 | [status] | ✅/⚠️/❌ |
| Plans | X/5 | [status] | ✅/⚠️/❌ |

## Alignment Assessment
| Alignment | Issues Found | Rating |
|-----------|--------------|--------|
| Strategy → Architecture | [n] | ✅/⚠️/❌ |
| Architecture → Plans | [n] | ✅/⚠️/❌ |
| Plans → Implementation | [n] | ✅/⚠️/❌ |

## Gaps Identified
### Critical (blocks progress)
- [list]

### Important (should address soon)
- [list]

### Minor (when convenient)
- [list]

## Stale Documents Requiring Update
- [list with specific recommendations]

## Recommendations
1. [Prioritized action items]
```

## When to Escalate to Thorough

- Strategy layer incomplete or incoherent
- Major alignment gaps between layers
- Significant implementation drift
- Planning horizon problems (too detailed far out, or no visibility)
- Need full traceability matrix
