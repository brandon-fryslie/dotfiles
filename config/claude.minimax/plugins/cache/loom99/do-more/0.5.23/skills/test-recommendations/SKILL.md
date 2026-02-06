---
name: "do-test-recommendations"
description: "Generate strategic test recommendations based on test-coverage-audit output. Produces prioritized test plan with specific recommendations for each gap. Use after running test-coverage-audit."
---

# Test Recommendations

Transform test coverage audit findings into actionable, prioritized recommendations.

**Input**: Output from `test-coverage-audit` skill
**Output**: Strategic test plan with specific recommendations

## Prerequisites

This skill requires a completed test-coverage-audit. If no audit exists:
1. Run `test-coverage-audit` first
2. Or provide audit data in the prompt

## Process

### Step 1: Parse Audit Findings

Extract from audit report:
- Architecture type (determines testing strategy)
- Complexity sources (what needs testing)
- Gap analysis (what's missing)
- Quality issues (what's wrong with existing tests)

### Step 2: Apply Strategic Framework

#### Testing Strategy by Architecture

| Architecture | Primary Strategy | Key Considerations |
|--------------|------------------|-------------------|
| Monolith | Test pyramid | Unit > Integration > E2E |
| Microservices | Contract-first | Consumer contracts, service mocks |
| Serverless | Integration-heavy | Function isolation, cold start |
| Real-time | Event-driven | Message ordering, replay |
| Data Pipeline | Data validation | Schema, lineage, idempotency |

Read appropriate strategy reference:
- [strategies/pyramid.md](references/strategies/pyramid.md) - Classic test pyramid
- [strategies/contract-testing.md](references/strategies/contract-testing.md) - Service contracts
- [strategies/event-driven.md](references/strategies/event-driven.md) - Async/message systems
- [strategies/data-validation.md](references/strategies/data-validation.md) - Data pipelines
- [strategies/property-based.md](references/strategies/property-based.md) - Property/fuzz testing

#### Gap Prioritization Matrix

For each gap identified in audit, score:

| Factor | P0 | P1 | P2 |
|--------|----|----|---|
| **Impact** | Data loss, security, money | UX degradation, partial failures | Minor annoyance |
| **Likelihood** | Common path, no fallback | Edge case, has fallback | Rare, recoverable |
| **Complexity** | Simple to test | Moderate effort | Complex setup |

Read: [prioritization/risk-matrix.md](references/prioritization/risk-matrix.md)

### Step 3: Generate Recommendations

For each gap, produce:

```markdown
### Recommendation: [Gap Name]

**Priority**: P0/P1/P2
**Gap**: [What's missing]
**Risk**: [What could go wrong]
**Recommendation**: [What to test and how]

#### Test Type
[Unit | Integration | E2E | Contract | Property]

#### Test Level
[Where in pyramid this belongs and why]

#### Approach
[Specific testing approach]

#### Framework/Tools
[Specific tools for the language/scenario]

#### Example Test Structure
```[language]
// Pseudocode or actual test structure
```

#### Effort Estimate
[Low | Medium | High] - [Why]

#### Dependencies
[What must exist before this test can be written]
```

### Step 4: Sequence Recommendations

Order recommendations by:

1. **Foundation first**: Tests that enable other tests
2. **P0 gaps**: Critical business/security risks
3. **Quick wins**: High value, low effort
4. **P1 gaps**: Important but not critical
5. **P2 gaps**: Nice to have

### Step 5: Identify Testability Blockers

Flag code that cannot be tested as-is:

```markdown
### Testability Blockers

| Area | Blocker | Refactoring Needed |
|------|---------|-------------------|
| PaymentService | Hard-coded Stripe client | Extract interface |
| UserAuth | Global state | Dependency injection |
| EmailSender | No interface | Create sendable interface |

**Note**: These blockers should be addressed before writing tests.
For refactoring recommendations, see `test-implementation-plan` skill.
```

---

## Output Format

```markdown
# Test Recommendations Report
**Project**: [name]
**Date**: [date]
**Based on**: Test Coverage Audit from [date]

## Executive Summary

**Architecture**: [type]
**Strategy**: [recommended approach]
**Total Gaps**: [n]
**Critical (P0)**: [n]
**Testability Blockers**: [n]

---

## Recommended Testing Strategy

[1-2 paragraph summary of the overall approach]

---

## P0 Recommendations (Critical)

### 1. [Gap Name]
[Full recommendation template]

### 2. [Gap Name]
[Full recommendation template]

---

## P1 Recommendations (Important)

### 3. [Gap Name]
[Full recommendation template]

---

## P2 Recommendations (Nice to Have)

### 4. [Gap Name]
[Full recommendation template]

---

## Testability Blockers

| Priority | Area | Blocker | Effort |
|----------|------|---------|--------|
| High | PaymentService | Hard-coded client | Medium |
| Medium | UserAuth | Global state | High |

---

## Implementation Sequence

```
Phase 1: Foundation (Week 1)
├── Fix testability blocker: PaymentService
├── P0-1: Payment error handling tests
└── P0-2: Auth flow E2E

Phase 2: Core Coverage (Week 2)
├── P1-1: Webhook tests
├── P1-2: Cache invalidation
└── P1-3: Database constraint tests

Phase 3: Hardening (Week 3+)
├── P2-1: Config validation
├── P2-2: Log output tests
└── Flaky test cleanup
```

---

## Quick Wins

Tests that provide high value with minimal effort:

| Test | Value | Effort | ROI |
|------|-------|--------|-----|
| Auth E2E | High | Low | Excellent |
| Input validation | High | Low | Excellent |
| Error response format | Medium | Low | Good |

---

## Next Steps

1. **Immediate**: Address P0 gaps
2. **This sprint**: Fix testability blockers + P1 gaps
3. **Ongoing**: P2 gaps + test quality improvements
4. **For detailed implementation plan**: Run `test-implementation-plan` skill
```

---

## Reference Documents

### Strategies
| Strategy | Reference |
|----------|-----------|
| Classic test pyramid | [strategies/pyramid.md](references/strategies/pyramid.md) |
| Contract testing | [strategies/contract-testing.md](references/strategies/contract-testing.md) |
| Event-driven testing | [strategies/event-driven.md](references/strategies/event-driven.md) |
| Data validation testing | [strategies/data-validation.md](references/strategies/data-validation.md) |
| Property-based testing | [strategies/property-based.md](references/strategies/property-based.md) |

### Prioritization
| Topic | Reference |
|-------|-----------|
| Risk matrix | [prioritization/risk-matrix.md](references/prioritization/risk-matrix.md) |
| Effort estimation | [prioritization/effort-estimation.md](references/prioritization/effort-estimation.md) |
| Quick wins | [prioritization/quick-wins.md](references/prioritization/quick-wins.md) |

---

## Integration

This skill consumes output from `test-coverage-audit` and produces input for `test-implementation-plan`.

```
test-coverage-audit → test-recommendations → test-implementation-plan
      (What's wrong)      (What to do)           (How to do it)
```

## Related Skills

| Skill | Purpose |
|-------|---------|
| `test-coverage-audit` | Forensic analysis (run first) |
| `test-implementation-plan` | Execution plan with refactoring |
| `do:add-tests` | Write specific tests |
| `do:tdd-workflow` | Test-first development |
