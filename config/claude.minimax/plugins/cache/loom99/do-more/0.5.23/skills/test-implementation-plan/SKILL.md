---
name: "do-test-implementation-plan"
description: "Generate detailed implementation plan for test recommendations, including testability refactoring. Produces actionable execution plan with code changes needed to make code testable BEFORE/concurrent with writing tests."
---

# Test Implementation Plan

Transform test recommendations into an actionable execution plan with testability refactoring.

**Input**: Output from `test-recommendations` skill
**Output**: Step-by-step implementation plan including refactoring

## Philosophy

### Testability First

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

### The Refactor-Test Loop

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

---

## Process

### Step 1: Extract Testability Blockers

From test-recommendations output, list all blockers:

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

### Step 2: Map Refactoring Patterns

For each blocker, identify the refactoring pattern:

Read appropriate reference:
- [refactoring/dependency-injection.md](references/refactoring/dependency-injection.md)
- [refactoring/extract-interface.md](references/refactoring/extract-interface.md)
- [refactoring/remove-global-state.md](references/refactoring/remove-global-state.md)
- [refactoring/seam-creation.md](references/refactoring/seam-creation.md)
- [refactoring/pure-function-extraction.md](references/refactoring/pure-function-extraction.md)

### Step 3: Sequence Refactoring

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

### Step 4: Generate Implementation Tasks

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

### Step 5: Create Execution Timeline

```markdown
## Execution Timeline

### Week 1: Foundation + Quick Wins
```
Day 1-2: DI Setup
├── Install/configure DI container
├── Create service interfaces
└── Wire up existing services

Day 3-4: Quick Win Tests
├── Add smoke tests (P0)
├── Add validation tests (P1)
└── Add error response tests (P1)

Day 5: Verification
├── Run full test suite
├── Measure coverage change
└── Document changes
```

### Week 2: Critical Path Testing
```
Day 1-2: Payment Refactoring
├── Extract PaymentService interface
├── Make Stripe client injectable
└── Add payment tests

Day 3-4: Auth Refactoring
├── Remove global auth state
├── Make AuthService injectable
└── Add auth flow tests

Day 5: Integration
├── Integration tests with mocked services
└── E2E tests for critical paths
```
```

---

## Output Format

```markdown
# Test Implementation Plan
**Project**: [name]
**Date**: [date]
**Based on**: Test Recommendations from [date]

## Executive Summary

**Total Tasks**: [n]
**Refactoring Required**: [n blockers]
**Estimated Duration**: [X weeks]
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

**Recommendation**: [From test-recommendations]
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

---

## Reference Documents

### Refactoring Patterns
| Pattern | Reference |
|---------|-----------|
| Dependency Injection | [refactoring/dependency-injection.md](references/refactoring/dependency-injection.md) |
| Extract Interface | [refactoring/extract-interface.md](references/refactoring/extract-interface.md) |
| Remove Global State | [refactoring/remove-global-state.md](references/refactoring/remove-global-state.md) |
| Seam Creation | [refactoring/seam-creation.md](references/refactoring/seam-creation.md) |
| Pure Function Extraction | [refactoring/pure-function-extraction.md](references/refactoring/pure-function-extraction.md) |

### Scenario-Specific Plans
| Scenario | Reference |
|----------|-----------|
| Web Backend | [by-scenario/web-backend.md](references/by-scenario/web-backend.md) |
| CLI Tool | [by-scenario/cli.md](references/by-scenario/cli.md) |
| Microservices | [by-scenario/microservices.md](references/by-scenario/microservices.md) |

---

## Integration

This skill is the final step in the test improvement pipeline:

```
test-coverage-audit → test-recommendations → test-implementation-plan
      (What's wrong)      (What to do)           (How to do it)
```

## Related Skills

| Skill | Purpose |
|-------|---------|
| `test-coverage-audit` | Forensic analysis (run first) |
| `test-recommendations` | Strategic recommendations (run second) |
| `do:add-tests` | Write specific tests |
| `do:refactor` | Execute refactoring tasks |
| `do:tdd-workflow` | Test-first development |
