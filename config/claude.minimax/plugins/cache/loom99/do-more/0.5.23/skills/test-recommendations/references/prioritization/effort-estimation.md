# Test Effort Estimation

How to estimate the effort required to implement test recommendations.

## Effort Categories

### Low Effort (1-4 hours)

| Characteristic | Examples |
|----------------|----------|
| Single test file | One new test class |
| No new fixtures | Uses existing setup |
| No refactoring | Code already testable |
| Clear requirements | Obvious what to test |
| Existing patterns | Similar tests exist |

**Examples**:
- Add unit test for existing function
- Add error case to existing test
- Add assertion to existing e2e test
- Add validation test

### Medium Effort (4 hours - 2 days)

| Characteristic | Examples |
|----------------|----------|
| Multiple test files | New test suite |
| New fixtures needed | Test data, mocks |
| Minor refactoring | Extract dependency |
| Some ambiguity | Need to understand code first |
| New patterns | First test of this type |

**Examples**:
- Add integration test with database
- Create contract test for new service
- Add e2e test for new user flow
- Set up mock server for external API

### High Effort (2+ days)

| Characteristic | Examples |
|----------------|----------|
| New test infrastructure | New framework, tooling |
| Significant refactoring | Code not testable as-is |
| Complex setup | Multiple services, containers |
| High ambiguity | Requirements unclear |
| Breaking changes | May affect other tests |

**Examples**:
- Set up testcontainers for first time
- Refactor singleton to injectable
- Create Pact contract testing from scratch
- Add visual regression testing

## Estimation Factors

### Code Testability

| Factor | Low Effort | High Effort |
|--------|------------|-------------|
| Dependencies | Injectable | Hard-coded |
| State | Stateless/local | Global |
| Side effects | Isolated | Mixed with logic |
| Interfaces | Well-defined | Concrete classes |

### Test Infrastructure

| Factor | Low Effort | High Effort |
|--------|------------|-------------|
| Framework | Already configured | New setup |
| Fixtures | Reusable exist | Need to create |
| Test data | Factory exists | Manual creation |
| CI integration | Already running | New pipeline |

### Domain Complexity

| Factor | Low Effort | High Effort |
|--------|------------|-------------|
| Business rules | Simple | Complex edge cases |
| State machine | None | Multiple states |
| Async | Sync only | Async/concurrent |
| External deps | None | Multiple services |

## Estimation Template

For each recommendation:

```markdown
### Effort Estimate: [Recommendation Name]

**Base Effort**: [Low/Medium/High]

**Factors**:
| Factor | Assessment | Impact |
|--------|------------|--------|
| Testability | Code is [testable/needs refactoring] | +0/+1 |
| Infrastructure | [Exists/Needs setup] | +0/+1 |
| Fixtures | [Can reuse/Need new] | +0/+1 |
| Complexity | [Simple/Complex] | +0/+1 |
| Ambiguity | [Clear/Unclear] | +0/+1 |

**Adjusted Effort**: [Low/Medium/High]

**Time Estimate**: [X hours/days]

**Dependencies**:
- [What must be done first]

**Risks**:
- [What could increase effort]
```

## Effort by Test Type

### Unit Tests

| Scenario | Typical Effort |
|----------|----------------|
| Pure function | Low (< 1 hour) |
| Class with dependencies | Low-Medium (1-4 hours) |
| Class with mocks needed | Medium (4-8 hours) |
| Legacy code refactor | High (1-3 days) |

### Integration Tests

| Scenario | Typical Effort |
|----------|----------------|
| Existing test DB setup | Low (2-4 hours) |
| New test DB setup | Medium (1 day) |
| Container setup (first) | High (1-2 days) |
| Container setup (subsequent) | Low (2-4 hours) |

### E2E Tests

| Scenario | Typical Effort |
|----------|----------------|
| Add to existing suite | Low (2-4 hours) |
| New Playwright setup | Medium (1-2 days) |
| New Cypress setup | Medium (1-2 days) |
| Mobile E2E setup | High (2-5 days) |

### Contract Tests

| Scenario | Typical Effort |
|----------|----------------|
| Add consumer test | Low (2-4 hours) |
| Add provider verification | Low (2-4 hours) |
| Pact broker setup | Medium (1 day) |
| Full CDC pipeline | High (2-3 days) |

## ROI Calculation

Prioritize by ROI = Value / Effort

| Priority | Value Score |
|----------|-------------|
| P0 | 4 |
| P1 | 3 |
| P2 | 2 |
| P3 | 1 |

| Effort | Effort Score |
|--------|--------------|
| Low | 1 |
| Medium | 2 |
| High | 3 |

**ROI = Value / Effort**

| Example | Priority | Effort | ROI | Do When |
|---------|----------|--------|-----|---------|
| P0 + Low | 4 | 1 | 4.0 | Now |
| P1 + Low | 3 | 1 | 3.0 | Now |
| P0 + Medium | 4 | 2 | 2.0 | Soon |
| P2 + Low | 2 | 1 | 2.0 | Soon |
| P1 + Medium | 3 | 2 | 1.5 | Plan |
| P0 + High | 4 | 3 | 1.3 | Plan |
| P2 + Medium | 2 | 2 | 1.0 | Later |
| P1 + High | 3 | 3 | 1.0 | Later |
| P3 + Any | 1 | - | < 1 | Maybe |

## Common Effort Underestimates

| Cause | Reality |
|-------|---------|
| "Just add a test" | Need fixture, mock, setup |
| "Use existing pattern" | Pattern doesn't quite fit |
| "Quick refactor first" | Refactor has ripple effects |
| "Simple mock" | Mock behavior complex |
| "Same as last time" | Context differs |

**Rule of thumb**: Double your initial estimate.

## Parallel vs Sequential

Some tests can be worked on in parallel:

**Can parallelize**:
- Independent test suites
- Different test levels (unit vs e2e)
- Different services/modules

**Must sequence**:
- Tests that depend on refactoring
- Tests that share new fixtures
- Tests that require infrastructure setup
