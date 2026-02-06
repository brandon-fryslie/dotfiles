# Thorough Planning Audit Checklist

**Time budget**: 30-60 minutes

**Goal**: Leave no stone unturned. Full verification of coherence, alignment, and traceability across all planning layers. The "snap on the rubber gloves" audit.

## Phase 1: Complete Document Inventory (5 minutes)

### Deep Discovery

```bash
# Find ALL planning-related documents
find . -name "*.md" -type f | xargs grep -l -i \
  "strategy\|vision\|architecture\|roadmap\|plan\|sprint\|backlog\|spec\|requirement" \
  2>/dev/null | head -50

# Find all .agent_planning contents
find .agent_planning -type f -name "*.md" 2>/dev/null

# Check for non-standard locations
find . -path ./node_modules -prune -o -name "*.md" -print | \
  xargs grep -l "## Goals\|## Features\|## Requirements" 2>/dev/null
```

### Document Registry

Create complete inventory with metadata:

```markdown
| Document | Layer | Location | Modified | Lines | References To | Referenced By |
|----------|-------|----------|----------|-------|---------------|---------------|
| PROJECT_SPEC.md | Strategy | root | [date] | [n] | - | ARCHITECTURE.md, PLAN-*.md |
| ... | | | | | | |
```

## Phase 2: Strategy Coherence Deep Dive (10 minutes)

### Internal Consistency

| Check | Evidence | Issue? |
|-------|----------|--------|
| Goals non-contradictory | [specific text] | Y/N |
| Features align to goals | [mapping] | Y/N |
| Scope is bounded | [boundaries stated] | Y/N |
| Success is measurable | [metrics defined] | Y/N |
| Priorities are clear | [P0/P1/P2 or equivalent] | Y/N |

### Completeness Assessment

| Aspect | Present? | Quality |
|--------|----------|---------|
| Problem statement | Y/N | clear/vague/missing |
| Target users | Y/N | specific/generic/missing |
| Value proposition | Y/N | compelling/weak/missing |
| Scope boundaries | Y/N | clear/fuzzy/missing |
| Success criteria | Y/N | measurable/vague/missing |
| Feature inventory | Y/N | prioritized/flat/missing |
| Non-goals (what we won't do) | Y/N | explicit/implicit/missing |
| Assumptions | Y/N | documented/hidden |
| Risks | Y/N | identified/ignored |

### Strategy Smells

| Smell | Detection | Found? |
|-------|-----------|--------|
| Scope creep built-in | "And also...", expanding feature lists | |
| Success theater | Metrics that can't fail or don't matter | |
| User confusion | Multiple conflicting personas | |
| Strategy by committee | Contradictory goals, no prioritization | |
| Boiling the ocean | Trying to solve everything | |

## Phase 3: Architecture Sufficiency Analysis (10 minutes)

### Strategy Coverage Matrix

For EVERY strategy goal/feature, verify architecture enables it:

```markdown
## Strategy → Architecture Traceability

| Strategy Item | Required Capability | Architecture Component | Coverage |
|---------------|--------------------|-----------------------|----------|
| [Feature A] | [What's needed] | [Component that provides] | Full/Partial/None |
| [Feature B] | [What's needed] | [Component] | Full/Partial/None |
| [Goal X] | [What's needed] | [Component] | Full/Partial/None |
```

### Architecture Orphan Check

Components in architecture with no strategy justification:

| Architecture Component | Strategy Justification | Verdict |
|------------------------|------------------------|---------|
| [Component] | [Why it exists] | Justified/Speculative/Orphan |

### Architecture Completeness

| Aspect | Documented? | Quality |
|--------|-------------|---------|
| System decomposition | Y/N | clear/vague |
| Data model | Y/N | complete/partial |
| API contracts | Y/N | specified/implicit |
| Integration points | Y/N | documented/hidden |
| Security model | Y/N | designed/afterthought |
| Error handling strategy | Y/N | consistent/ad-hoc |
| Scalability considerations | Y/N | addressed/ignored |
| Technology rationale | Y/N | reasoned/arbitrary |

## Phase 4: Plans Alignment Analysis (10 minutes)

### Architecture → Plans Traceability

For every architecture component, verify planned work:

```markdown
## Architecture → Plans Traceability

| Architecture Component | Planned Work Items | Status | Gap? |
|------------------------|-------------------|--------|------|
| [Component A] | PLAN-X item 1, item 2 | planned/in-progress/done | Y/N |
| [Component B] | [items] | [status] | Y/N |
```

### Plans → Strategy Traceability (reverse check)

For every plan item, trace back to strategy:

| Plan Item | Strategy Justification | Verdict |
|-----------|------------------------|---------|
| [Item] | [Feature/goal it serves] | Aligned/Tangential/Orphan |

**Orphan work**: Plan items with no clear strategy connection are scope creep or tech debt (should be labeled as such).

### Planning Horizon Assessment

| Time Horizon | Expected Detail | Actual Detail | Verdict |
|--------------|-----------------|---------------|---------|
| Current sprint | Task-level, acceptance criteria | [actual] | ✅/⚠️/❌ |
| Sprint +1 | Story-level, estimated | [actual] | ✅/⚠️/❌ |
| Sprint +2 | Story-level, roughly estimated | [actual] | ✅/⚠️/❌ |
| Sprint +3+ | Epic/theme level only | [actual] | ✅/⚠️/❌ |

**Anti-patterns to flag**:
- Task breakdowns for sprint +3 or beyond (over-planning)
- No visibility beyond current sprint (under-planning)
- Equal detail at all horizons (planning theater)

### Dependency Analysis

```markdown
## Critical Path & Dependencies

| Item | Depends On | Blocks | Risk Level |
|------|------------|--------|------------|
| [Item A] | [Item B] | [Items C, D] | High/Med/Low |

### Unidentified Dependencies?
[Items that likely have hidden dependencies]

### Circular Dependencies?
[Any planning cycles detected]
```

## Phase 5: Implementation Alignment (10 minutes)

### Plans → Code Traceability

For completed plan items, verify implementation:

```markdown
## Implementation Verification

| Plan Item (Marked Complete) | Implementation Evidence | Matches Plan? |
|-----------------------------|------------------------|---------------|
| [Item] | [file:line or "not found"] | Yes/Partial/No/Missing |
```

### Drift Detection

| Area | Plan Says | Reality Shows | Drift |
|------|-----------|---------------|-------|
| [Feature] | [planned approach] | [actual approach] | None/Minor/Major |

### STATUS Accuracy

Compare most recent STATUS to reality:

| STATUS Claim | Verification | Accurate? |
|--------------|--------------|-----------|
| "[Feature] complete" | [Run it, check code] | Y/N |
| "[X]% done" | [Evidence] | Y/N |
| "[Blocker] resolved" | [Evidence] | Y/N |

## Phase 6: Full Traceability Matrix (5 minutes)

Build complete traceability:

```markdown
## Full Traceability Matrix

| Strategy | Architecture | Plan | Implementation | Status |
|----------|--------------|------|----------------|--------|
| Goal A | Component X | Plan Item 1 | src/x.ts | ✅ Done |
| Goal A | Component X | Plan Item 2 | - | 🔄 In Progress |
| Goal B | Component Y | - | - | ❌ Not Planned |
| - | Component Z | Plan Item 5 | src/z.ts | ⚠️ Orphan Work |
```

**Analysis**:
- Rows with gaps = alignment issues
- Orphan rows = scope creep or missing documentation
- Empty implementation = not yet built
- Implementation without plan = undocumented work

## Thorough Audit Output Template

```markdown
# Thorough Planning Audit - <date>

## Executive Summary
[2-3 sentence overall assessment]

## Layer Health
| Layer | Completeness | Coherence | Freshness | Rating |
|-------|--------------|-----------|-----------|--------|
| Strategy | X/9 | [assessment] | [date] | ✅/⚠️/❌ |
| Architecture | X/8 | [assessment] | [date] | ✅/⚠️/❌ |
| Plans | X/5 | [assessment] | [date] | ✅/⚠️/❌ |

## Alignment Health
| Alignment | Coverage | Gaps | Orphans | Rating |
|-----------|----------|------|---------|--------|
| Strategy → Architecture | X% | [n] | [n] | ✅/⚠️/❌ |
| Architecture → Plans | X% | [n] | [n] | ✅/⚠️/❌ |
| Plans → Implementation | X% | [n drift] | [n] | ✅/⚠️/❌ |

## Traceability Matrix
[Full matrix or link to separate file]

## Critical Findings

### P0 - Blocks Progress
1. [Finding with evidence]

### P1 - Address Soon
1. [Finding with evidence]

### P2 - Plan to Address
1. [Finding with evidence]

## Planning Horizon Assessment
| Horizon | Status | Issues |
|---------|--------|--------|
| Current sprint | [status] | [issues] |
| Near-term (1-2 sprints) | [status] | [issues] |
| Medium-term (3+ sprints) | [status] | [issues] |

## Stale Documents
| Document | Last Modified | Recommendation |
|----------|---------------|----------------|
| [doc] | [date] | Update/Archive/Delete |

## Recommendations (Prioritized)
1. [Most critical action]
2. [Next action]
3. ...

## Appendices
- A: Full Document Inventory
- B: Complete Traceability Matrix
- C: Detailed Gap Analysis
```
