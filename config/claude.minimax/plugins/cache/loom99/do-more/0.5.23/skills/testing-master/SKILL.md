---
name: "do-testing-master"
description: "Testing lifecycle management - framework setup, strategic recommendations, and implementation planning. Use when setting up test infrastructure, improving test quality, or planning test implementation. For test coverage auditing, use audit-master with the testing dimension."
---

# Testing Master

Testing lifecycle: Setup → Recommend → Plan

Use this skill when working on automated testing infrastructure, coverage improvement, test quality, or test implementation planning.

**Note**: For test coverage auditing, use `audit-master` with the testing dimension. This skill focuses on setup, recommendations, and implementation planning.

---

## Table of Contents

- [Overview](#overview)
- [Phase 1: Setup](#phase-1-setup)
  - [When to Use Setup](#when-to-use-setup)
  - [Setup Process](#setup-process)
  - [Setup Reference Documents](#setup-reference-documents)
- [Phase 2: Recommend](#phase-2-recommend)
  - [When to Use Recommend](#when-to-use-recommend)
  - [Recommend Process](#recommend-process)
  - [Recommend Output Format](#recommend-output-format)
  - [Recommend Reference Documents](#recommend-reference-documents)
- [Phase 3: Plan](#phase-3-plan)
  - [When to Use Plan](#when-to-use-plan)
  - [Plan Philosophy](#plan-philosophy)
  - [Plan Process](#plan-process)
  - [Plan Output Format](#plan-output-format)
  - [Plan Reference Documents](#plan-reference-documents)
- [Complete Reference Index](#complete-reference-index)
- [Related Skills](#related-skills)

---

## Overview

This skill provides a testing improvement lifecycle:

```
┌─────────┐     ┌───────────┐     ┌────────┐
│  Setup  │ ──▶ │ Recommend │ ──▶ │  Plan  │
└─────────┘     └───────────┘     └────────┘
  Framework       Strategic        Execution
  Config          Priorities       Tasks
```

| Phase | Purpose | Output |
|-------|---------|--------|
| Setup | Configure test framework | Working test runner |
| Recommend | Prioritize improvements | Strategic test plan |
| Plan | Create execution plan | Actionable tasks with refactoring |

**For test coverage auditing**: Use `/do:audit tests` or `audit-master` skill with the testing dimension.

---

## Phase 1: Setup

Configure testing infrastructure for a project that lacks it.

### When to Use Setup

- Project has no test framework configured
- User wants to establish testing before other phases
- Migrating to a new test framework

### Setup Process

**Step 1**: Detect project type

Examine manifest files: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.

**Step 2**: Recommend framework

| Language | Default | Details |
|----------|---------|---------|
| JavaScript/TypeScript | Vitest | See [references/setup/vitest.md](references/setup/vitest.md) |
| Python | pytest | See [references/setup/pytest.md](references/setup/pytest.md) |
| Go | go test | See [references/setup/go-test.md](references/setup/go-test.md) |
| Rust | cargo test | See [references/setup/rust-test.md](references/setup/rust-test.md) |
| Java | JUnit 5 | Built-in to most IDEs |
| Ruby | RSpec | `gem install rspec` |

**Step 3**: Confirm with user

Use AskUserQuestion to confirm framework choice, test location, and extras (coverage, watch mode).

**Step 4**: Install and configure

1. Add dev dependencies
2. Create test directory
3. Add test scripts to manifest
4. Create example test file
5. Update `.gitignore` if needed

**Step 5**: Verify

Run the example test to confirm setup works.

### Setup Output

```
═══════════════════════════════════════
Testing Framework Configured
  Framework: [name]
  Test dir: [path]
  Run: [command]
Next: /do:audit tests to analyze coverage
═══════════════════════════════════════
```

### Setup Reference Documents

| Framework | Reference |
|-----------|-----------|
| Vitest | [references/setup/vitest.md](references/setup/vitest.md) |
| pytest | [references/setup/pytest.md](references/setup/pytest.md) |
| Jest | [references/setup/jest.md](references/setup/jest.md) |
| Go test | [references/setup/go-test.md](references/setup/go-test.md) |
| Rust test | [references/setup/rust-test.md](references/setup/rust-test.md) |

---

## Phase 2: Recommend

Transform test coverage audit findings into actionable, prioritized recommendations.

### When to Use Recommend

- After completing an audit (via `audit-master` testing dimension)
- When prioritizing test improvements
- Planning test strategy
- Identifying quick wins

**Input**: Output from `audit-master` testing dimension
**Output**: Strategic test plan with specific recommendations

### Recommend Process

#### Step 2.1: Parse Audit Findings

Extract from audit report:
- Architecture type (determines testing strategy)
- Complexity sources (what needs testing)
- Gap analysis (what's missing)
- Quality issues (what's wrong with existing tests)

#### Step 2.2: Apply Strategic Framework

##### Testing Strategy by Architecture

| Architecture | Primary Strategy | Key Considerations |
|--------------|------------------|-------------------|
| Monolith | Test pyramid | Unit > Integration > E2E |
| Microservices | Contract-first | Consumer contracts, service mocks |
| Serverless | Integration-heavy | Function isolation, cold start |
| Real-time | Event-driven | Message ordering, replay |
| Data Pipeline | Data validation | Schema, lineage, idempotency |

Read appropriate strategy reference:
- [references/recommend/strategies/pyramid.md](references/recommend/strategies/pyramid.md) - Classic test pyramid
- [references/recommend/strategies/contract-testing.md](references/recommend/strategies/contract-testing.md) - Service contracts
- [references/recommend/strategies/event-driven.md](references/recommend/strategies/event-driven.md) - Async/message systems
- [references/recommend/strategies/data-validation.md](references/recommend/strategies/data-validation.md) - Data pipelines
- [references/recommend/strategies/property-based.md](references/recommend/strategies/property-based.md) - Property/fuzz testing

##### Gap Prioritization Matrix

For each gap identified in audit, score:

| Factor | P0 | P1 | P2 |
|--------|----|----|---|
| **Impact** | Data loss, security, money | UX degradation, partial failures | Minor annoyance |
| **Likelihood** | Common path, no fallback | Edge case, has fallback | Rare, recoverable |
| **Complexity** | Simple to test | Moderate effort | Complex setup |

Read: [references/recommend/prioritization/risk-matrix.md](references/recommend/prioritization/risk-matrix.md)

#### Step 2.3: Generate Recommendations

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

#### Step 2.4: Sequence Recommendations

Order recommendations by:

1. **Foundation first**: Tests that enable other tests
2. **P0 gaps**: Critical business/security risks
3. **Quick wins**: High value, low effort
4. **P1 gaps**: Important but not critical
5. **P2 gaps**: Nice to have

#### Step 2.5: Identify Testability Blockers

Flag code that cannot be tested as-is:

```markdown
### Testability Blockers

| Area | Blocker | Refactoring Needed |
|------|---------|-------------------|
| PaymentService | Hard-coded Stripe client | Extract interface |
| UserAuth | Global state | Dependency injection |
| EmailSender | No interface | Create sendable interface |

**Note**: These blockers should be addressed before writing tests.
For refactoring recommendations, see Plan phase.
```

### Recommend Output Format

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
Phase 1: Foundation
├── Fix testability blocker: PaymentService
├── P0-1: Payment error handling tests
└── P0-2: Auth flow E2E

Phase 2: Core Coverage
├── P1-1: Webhook tests
├── P1-2: Cache invalidation
└── P1-3: Database constraint tests

Phase 3: Hardening
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
4. **For detailed implementation plan**: Run Plan phase
```

### Recommend Reference Documents

#### Strategies
| Strategy | Reference |
|----------|-----------|
| Classic test pyramid | [references/recommend/strategies/pyramid.md](references/recommend/strategies/pyramid.md) |
| Contract testing | [references/recommend/strategies/contract-testing.md](references/recommend/strategies/contract-testing.md) |
| Event-driven testing | [references/recommend/strategies/event-driven.md](references/recommend/strategies/event-driven.md) |
| Data validation testing | [references/recommend/strategies/data-validation.md](references/recommend/strategies/data-validation.md) |
| Property-based testing | [references/recommend/strategies/property-based.md](references/recommend/strategies/property-based.md) |

#### Prioritization
| Topic | Reference |
|-------|-----------|
| Risk matrix | [references/recommend/prioritization/risk-matrix.md](references/recommend/prioritization/risk-matrix.md) |
| Effort estimation | [references/recommend/prioritization/effort-estimation.md](references/recommend/prioritization/effort-estimation.md) |
| Quick wins | [references/recommend/prioritization/quick-wins.md](references/recommend/prioritization/quick-wins.md) |

---

## Phase 3: Plan

Transform test recommendations into an actionable execution plan with testability refactoring.

### When to Use Plan

- After completing recommendations
- Before implementing tests
- When code needs refactoring for testability
- Creating sprint/iteration plans

**Input**: Output from Recommend phase
**Output**: Step-by-step implementation plan including refactoring

### Plan Philosophy

#### Testability First

Code that can't be tested isn't just hard to test - it's probably poorly designed.

```
WRONG:
1. Write untestable code
2. Try to test it
3. Struggle with mocks
4. Write fragile tests
5. Tests break constantly

RIGHT:
1. Identify testability blockers
2. Refactor for testability
3. Write clean tests
4. Tests are stable
5. Refactoring is safe
```

#### The Refactor-Test Loop

```
┌─────────────────┐
│ Identify Blocker│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Refactor Code   │ ← Make testable
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Write Tests     │ ← Test new design
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify Coverage │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Next Blocker    │
└─────────────────┘
```

### Plan Process

#### Step 3.1: Extract Testability Blockers

From recommendations output, list all blockers:

```markdown
## Testability Blockers

| Area | Blocker Type | Impact | Refactoring Pattern |
|------|--------------|--------|---------------------|
| PaymentService | Hard-coded dependency | High | Dependency Injection |
| UserAuth | Global state | High | Context/Request scope |
| EmailSender | No interface | Medium | Extract interface |
| Config | Static methods | Medium | Instance methods |
| Logger | Side effects in constructor | Low | Factory pattern |
```

#### Step 3.2: Map Refactoring Patterns

For each blocker, identify the refactoring pattern:

Read appropriate reference:
- [references/plan/refactoring/dependency-injection.md](references/plan/refactoring/dependency-injection.md)
- [references/plan/refactoring/extract-interface.md](references/plan/refactoring/extract-interface.md)
- [references/plan/refactoring/remove-global-state.md](references/plan/refactoring/remove-global-state.md)
- [references/plan/refactoring/seam-creation.md](references/plan/refactoring/seam-creation.md)
- [references/plan/refactoring/pure-function-extraction.md](references/plan/refactoring/pure-function-extraction.md)

#### Step 3.3: Sequence Refactoring

Order by:
1. **Foundation blockers** - Enable other refactoring
2. **High-impact blockers** - Enable P0 tests
3. **Shared blockers** - Multiple tests blocked
4. **Low-risk first** - Build confidence

```markdown
## Refactoring Sequence

### Phase 1: Foundation
| Order | Refactoring | Enables | Risk |
|-------|-------------|---------|------|
| 1.1 | Add DI container | All service tests | Low |
| 1.2 | Extract ConfigService interface | Config tests | Low |

### Phase 2: Critical Path
| Order | Refactoring | Enables | Risk |
|-------|-------------|---------|------|
| 2.1 | PaymentService → injectable | Payment tests | Medium |
| 2.2 | AuthService → injectable | Auth tests | Medium |

### Phase 3: Secondary
| Order | Refactoring | Enables | Risk |
|-------|-------------|---------|------|
| 3.1 | EmailSender interface | Email tests | Low |
| 3.2 | Logger factory | Logger tests | Low |
```

#### Step 3.4: Generate Implementation Tasks

For each refactoring + test combination:

```markdown
### Task: [Name]

**Type**: Refactoring / Test Writing / Both
**Priority**: P0/P1/P2
**Estimated Effort**: [Low/Medium/High]

#### Prerequisites
- [What must be done first]

#### Refactoring Steps
1. [Specific code change]
2. [Specific code change]
3. [Verify existing tests still pass]

#### Files to Modify
| File | Change Type | Description |
|------|-------------|-------------|
| src/services/payment.py | Modify | Add interface |
| src/services/payment.py | Modify | Accept dependency in constructor |
| src/app.py | Modify | Wire up DI |

#### Test Steps
1. [Create test file]
2. [Write specific tests]
3. [Verify coverage]

#### Test Files to Create
| File | Test Type | Tests |
|------|-----------|-------|
| tests/unit/test_payment.py | Unit | Error handling, validation |
| tests/integration/test_payment.py | Integration | Stripe mock |

#### Verification
- [ ] Existing tests pass
- [ ] New tests pass
- [ ] Coverage increased
- [ ] No regressions
```

#### Step 3.5: Create Execution Timeline

```markdown
## Execution Timeline

### Batch 1: Foundation + Quick Wins
```
DI Setup
├── Install/configure DI container
├── Create service interfaces
└── Wire up existing services

Quick Win Tests
├── Add smoke tests (P0)
├── Add validation tests (P1)
└── Add error response tests (P1)

Verification
├── Run full test suite
├── Measure coverage change
└── Document changes
```

### Batch 2: Critical Path Testing
```
Payment Refactoring
├── Extract PaymentService interface
├── Make Stripe client injectable
└── Add payment tests

Auth Refactoring
├── Remove global auth state
├── Make AuthService injectable
└── Add auth flow tests

Integration
├── Integration tests with mocked services
└── E2E tests for critical paths
```
```

### Plan Output Format

```markdown
# Test Implementation Plan
**Project**: [name]
**Date**: [date]
**Based on**: Test Recommendations from [date]

## Executive Summary

**Total Tasks**: [n]
**Refactoring Required**: [n blockers]
**Risk Level**: [Low/Medium/High]

---

## Phase 1: Foundation Refactoring

### 1.1 [Refactoring Name]

**Blocker**: [What's blocking tests]
**Pattern**: [Refactoring pattern to apply]
**Risk**: [Low/Medium/High]

#### Current Code
```python
# Problematic code
class PaymentService:
    def __init__(self):
        self.stripe = stripe.Client(os.environ["STRIPE_KEY"])
```

#### Target Code
```python
# Testable code
class PaymentService:
    def __init__(self, stripe_client: StripeClient):
        self.stripe = stripe_client
```

#### Steps
1. Create StripeClient interface
2. Modify PaymentService constructor
3. Update all instantiation sites
4. Run existing tests

#### Files
- src/services/payment.py
- src/interfaces/stripe.py (new)
- src/app.py

---

## Phase 2: Test Implementation

### 2.1 [Test Suite Name]

**Recommendation**: [From recommendations]
**Type**: [Unit/Integration/E2E]
**Priority**: [P0/P1/P2]

#### Prerequisites
- [Refactoring 1.1 complete]

#### Test Cases
| Test | Description | Approach |
|------|-------------|----------|
| test_payment_success | Happy path | Mock Stripe success |
| test_payment_declined | Card declined | Mock Stripe decline |
| test_payment_timeout | Network timeout | Mock timeout |

#### Test Code Structure
```python
# tests/unit/test_payment.py
class TestPaymentService:
    def test_payment_success(self, mock_stripe):
        mock_stripe.create_charge.return_value = {"id": "ch_123"}
        service = PaymentService(mock_stripe)
        result = service.charge(100)
        assert result.success

    def test_payment_declined(self, mock_stripe):
        mock_stripe.create_charge.side_effect = CardDeclined()
        service = PaymentService(mock_stripe)
        with pytest.raises(PaymentError):
            service.charge(100)
```

#### Verification
- [ ] All tests pass
- [ ] Coverage > 80% for PaymentService
- [ ] Error paths covered

---

## Phase 3: Integration & E2E

### 3.1 [E2E Test Suite]

**User Journey**: [What user does]
**Priority**: P0

#### Prerequisites
- [All unit/integration tests passing]

#### Test Scenario
```gherkin
Feature: User Checkout
  Scenario: Successful purchase
    Given user is logged in
    And cart has items
    When user completes checkout
    Then order is created
    And payment is processed
    And confirmation email is sent
```

#### Implementation
```python
async def test_checkout_flow(page):
    await page.goto("/login")
    await page.fill("[name=email]", "test@test.com")
    await page.fill("[name=password]", "password")
    await page.click("button[type=submit]")

    await page.goto("/cart")
    await page.click("[data-testid=checkout]")

    await expect(page.locator(".confirmation")).to_be_visible()
```

---

## Appendix A: Refactoring Patterns

| Pattern | When to Use | Reference |
|---------|-------------|-----------|
| Dependency Injection | Hard-coded dependencies | [link] |
| Extract Interface | Concrete class coupling | [link] |
| Remove Global State | Singletons, globals | [link] |
| Seam Creation | Legacy code, no interfaces | [link] |
| Pure Function Extraction | Side effects mixed with logic | [link] |

## Appendix B: Test Templates

[Test templates for common scenarios]

## Appendix C: Verification Checklist

- [ ] All existing tests pass
- [ ] New tests provide meaningful coverage
- [ ] No flaky tests introduced
- [ ] CI pipeline updated
- [ ] Documentation updated
```

### Plan Reference Documents

#### Refactoring Patterns
| Pattern | Reference |
|---------|-----------|
| Dependency Injection | [references/plan/refactoring/dependency-injection.md](references/plan/refactoring/dependency-injection.md) |
| Extract Interface | [references/plan/refactoring/extract-interface.md](references/plan/refactoring/extract-interface.md) |
| Remove Global State | [references/plan/refactoring/remove-global-state.md](references/plan/refactoring/remove-global-state.md) |
| Seam Creation | [references/plan/refactoring/seam-creation.md](references/plan/refactoring/seam-creation.md) |
| Pure Function Extraction | [references/plan/refactoring/pure-function-extraction.md](references/plan/refactoring/pure-function-extraction.md) |

#### Scenario-Specific Plans
| Scenario | Reference |
|----------|-----------|
| Web Backend | [references/plan/by-scenario/web-backend.md](references/plan/by-scenario/web-backend.md) |
| CLI Tool | [references/plan/by-scenario/cli.md](references/plan/by-scenario/cli.md) |
| Microservices | [references/plan/by-scenario/microservices.md](references/plan/by-scenario/microservices.md) |

---

## Complete Reference Index

### Setup References
| File | Purpose |
|------|---------|
| [references/setup/vitest.md](references/setup/vitest.md) | Vitest configuration |
| [references/setup/pytest.md](references/setup/pytest.md) | pytest configuration |
| [references/setup/jest.md](references/setup/jest.md) | Jest configuration |
| [references/setup/go-test.md](references/setup/go-test.md) | Go test configuration |
| [references/setup/rust-test.md](references/setup/rust-test.md) | Rust test configuration |

### Recommend References

#### Strategies
| File | Purpose |
|------|---------|
| [references/recommend/strategies/pyramid.md](references/recommend/strategies/pyramid.md) | Test pyramid strategy |
| [references/recommend/strategies/contract-testing.md](references/recommend/strategies/contract-testing.md) | Contract testing |
| [references/recommend/strategies/event-driven.md](references/recommend/strategies/event-driven.md) | Event-driven testing |
| [references/recommend/strategies/data-validation.md](references/recommend/strategies/data-validation.md) | Data validation testing |
| [references/recommend/strategies/property-based.md](references/recommend/strategies/property-based.md) | Property-based testing |

#### Prioritization
| File | Purpose |
|------|---------|
| [references/recommend/prioritization/risk-matrix.md](references/recommend/prioritization/risk-matrix.md) | Risk prioritization |
| [references/recommend/prioritization/effort-estimation.md](references/recommend/prioritization/effort-estimation.md) | Effort estimation |
| [references/recommend/prioritization/quick-wins.md](references/recommend/prioritization/quick-wins.md) | Quick win identification |

### Plan References

#### Refactoring
| File | Purpose |
|------|---------|
| [references/plan/refactoring/dependency-injection.md](references/plan/refactoring/dependency-injection.md) | DI patterns |
| [references/plan/refactoring/extract-interface.md](references/plan/refactoring/extract-interface.md) | Interface extraction |
| [references/plan/refactoring/remove-global-state.md](references/plan/refactoring/remove-global-state.md) | Global state removal |
| [references/plan/refactoring/seam-creation.md](references/plan/refactoring/seam-creation.md) | Seam creation |
| [references/plan/refactoring/pure-function-extraction.md](references/plan/refactoring/pure-function-extraction.md) | Pure function extraction |

#### By Scenario
| File | Purpose |
|------|---------|
| [references/plan/by-scenario/web-backend.md](references/plan/by-scenario/web-backend.md) | Web backend plans |
| [references/plan/by-scenario/cli.md](references/plan/by-scenario/cli.md) | CLI plans |
| [references/plan/by-scenario/microservices.md](references/plan/by-scenario/microservices.md) | Microservices plans |

---

## Related Skills

| Skill | Purpose |
|-------|---------|
| `audit-master` | Test coverage auditing (use testing dimension) |
| `do:add-tests` | Write specific tests |
| `do:tdd-workflow` | Test-first development |
| `do:refactor` | Execute refactoring tasks |
