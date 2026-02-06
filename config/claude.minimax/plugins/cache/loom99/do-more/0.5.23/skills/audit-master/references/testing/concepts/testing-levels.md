# Testing Levels: Definitive Guide

Comprehensive definitions of testing levels, when to use each, and when NOT to use them.

## The Testing Pyramid

```
         ╱╲
        ╱E2E╲           Confidence: Highest | Speed: Slowest | Cost: Highest
       ╱──────╲
      ╱ Integ  ╲        Confidence: High    | Speed: Medium  | Cost: Medium
     ╱──────────╲
    ╱    Unit    ╲      Confidence: Low     | Speed: Fastest | Cost: Lowest
   ╱──────────────╲
```

## Unit Tests

### Definition

A unit test verifies a single unit of code (function, method, class) in **complete isolation** from all external dependencies.

### Characteristics

| Property | Unit Test |
|----------|-----------|
| Scope | Single function/method/class |
| Dependencies | All mocked/stubbed |
| Speed | Milliseconds |
| Determinism | 100% deterministic |
| What it validates | Logic correctness in isolation |

### What Unit Tests ARE

```python
# YES: Pure function, no dependencies
def test_calculate_tax():
    assert calculate_tax(100, rate=0.1) == 10

# YES: Class method with mocked dependencies
def test_user_service_validates_email():
    mock_repo = Mock()
    service = UserService(mock_repo)

    with pytest.raises(ValidationError):
        service.create_user(email="invalid")

    mock_repo.save.assert_not_called()
```

### What Unit Tests ARE NOT

```python
# NO: This is integration (real database)
def test_user_created():
    db = get_test_database()
    service = UserService(db)
    service.create_user(email="test@test.com")
    assert db.query(User).count() == 1

# NO: This is integration (HTTP call)
def test_api_returns_data():
    response = requests.get("http://api.example.com/users")
    assert response.status_code == 200
```

### When to Use Unit Tests

✅ **Use for:**
- Pure functions (formatters, calculators, validators)
- Business logic with clear inputs/outputs
- State machines
- Algorithms
- Data transformations
- Error path validation

❌ **Don't use for:**
- Verifying external integrations work
- Validating UI rendering
- Testing that "the system works"
- Replacing integration tests with heavily mocked unit tests

### The Unit Test Trap

**Warning**: High unit test coverage with mocked dependencies does NOT mean your system works.

```
100 unit tests passing + 0 integration tests = Unknown system state
 50 unit tests passing + 5 integration tests = Known system state
```

---

## Integration Tests

### Definition

An integration test verifies that multiple components work together correctly. It crosses at least one boundary (database, API, service, file system).

### Characteristics

| Property | Integration Test |
|----------|-----------------|
| Scope | Multiple components |
| Dependencies | Some real, some mocked |
| Speed | Seconds to minutes |
| Determinism | Usually deterministic |
| What it validates | Components communicate correctly |

### Types of Integration Tests

| Type | What's Real | What's Mocked |
|------|-------------|---------------|
| Database integration | Database | External APIs |
| API integration | HTTP layer + logic | External services |
| Service integration | Multiple services | External vendors |
| Contract tests | API contracts | Implementation details |

### What Integration Tests ARE

```python
# YES: Real database, tests actual persistence
def test_user_persisted_to_database(test_db):
    service = UserService(test_db)
    user = service.create_user(email="test@test.com")

    saved = test_db.query(User).get(user.id)
    assert saved.email == "test@test.com"

# YES: Real HTTP endpoint, mocked external APIs
def test_api_endpoint(client, mock_external_api):
    mock_external_api.return_value = {"status": "ok"}

    response = client.post("/process", json={"data": "test"})

    assert response.status_code == 200
```

### What Integration Tests ARE NOT

```python
# NO: This is a unit test (everything mocked)
def test_service_with_mock_db():
    mock_db = Mock()
    mock_db.query.return_value = [User(name="test")]
    service = UserService(mock_db)
    # Not testing real integration

# NO: This is E2E (full system)
def test_complete_flow():
    browser.goto("/login")
    browser.fill("email", "test@test.com")
    # Testing full user flow, not specific integration
```

### When to Use Integration Tests

✅ **Use for:**
- Database queries and transactions
- API request/response handling
- Message queue produce/consume
- File system operations
- Service-to-service communication
- Authentication/authorization flows

❌ **Don't use for:**
- Testing pure business logic (use unit tests)
- Full user journeys (use E2E)
- Visual verification (use visual tests)

---

## End-to-End (E2E) Tests

### Definition

An E2E test verifies the complete system works from the user's perspective, exercising all layers simultaneously.

### Characteristics

| Property | E2E Test |
|----------|----------|
| Scope | Entire system |
| Dependencies | All real (or production-like) |
| Speed | Minutes |
| Determinism | Can be flaky |
| What it validates | System works for real users |

### What E2E Tests ARE

```python
# YES: Real browser, real backend, real database
def test_user_can_complete_purchase(browser, running_app):
    browser.goto("http://localhost:3000")
    browser.click("text=Products")
    browser.click("text=Add to Cart")
    browser.click("text=Checkout")
    browser.fill("#card-number", "4242424242424242")
    browser.click("text=Pay")

    assert browser.locator(".confirmation").is_visible()
    # Verify in database too
    assert Order.query.count() == 1
```

### What E2E Tests ARE NOT

```python
# NO: This is integration (no user interface)
def test_api_creates_order():
    response = client.post("/orders", json={...})
    assert response.status_code == 201

# NO: This is unit test with UI components
def test_button_renders():
    render(<Button />)
    expect(screen.getByRole('button')).toBeInTheDocument()
```

### When to Use E2E Tests

✅ **Use for:**
- Critical user journeys (login, checkout, signup)
- Smoke tests (basic functionality works)
- Cross-system flows
- Validating real user experience

❌ **Don't use for:**
- Edge cases (too slow, use unit tests)
- Every possible path (combinatorial explosion)
- Rapid iteration during development
- Testing internal implementation details

---

## Component Tests (Frontend-Specific)

### Definition

Component tests verify UI components render and behave correctly with mocked data/APIs.

### Characteristics

| Property | Component Test |
|----------|---------------|
| Scope | Single UI component + children |
| Dependencies | Props provided, APIs mocked |
| Speed | Milliseconds to seconds |
| Determinism | Deterministic |
| What it validates | Component behavior |

### When to Use

✅ **Use for:**
- Component rendering
- User interactions (clicks, inputs)
- State management
- Conditional rendering

❌ **Don't use for:**
- Visual pixel-perfect verification (use visual tests)
- Full page flows (use E2E)
- API correctness (use integration tests)

---

## Contract Tests

### Definition

Contract tests verify that service boundaries (APIs) conform to agreed-upon contracts, without testing the full integration.

### Characteristics

| Property | Contract Test |
|----------|--------------|
| Scope | API boundary |
| Dependencies | Mock implementation, real contract |
| Speed | Fast |
| What it validates | API shape, not behavior |

### When to Use

✅ **Use for:**
- Microservice communication
- Third-party API integration
- Frontend/backend alignment

❌ **Don't use for:**
- Replacing integration tests entirely
- Testing business logic

---

## Choosing the Right Level

### Decision Matrix

| Question | If YES → | If NO → |
|----------|----------|---------|
| Testing pure logic? | Unit | Continue |
| Testing component boundaries? | Integration | Continue |
| Testing user journey? | E2E | Continue |
| Testing UI component behavior? | Component | Continue |
| Testing API contract? | Contract | Continue |

### The "Test It Once" Principle

Each behavior should be tested at **one level only**:

```
✅ GOOD:
- Tax calculation → Unit test
- Tax calculation saves to DB → Integration test
- User sees tax on checkout page → E2E test

❌ BAD:
- Tax calculation → Unit test
- Tax calculation → Integration test (redundant)
- Tax calculation → E2E test (redundant)
```

### Cost-Benefit by Level

| Level | Development Cost | Maintenance Cost | Confidence |
|-------|-----------------|------------------|------------|
| Unit | Low | Low | Logic only |
| Integration | Medium | Medium | Boundaries work |
| E2E | High | High | System works |

**Optimize for**: Maximum confidence at minimum cost

### Recommended Ratios

| Project Type | Unit | Integration | E2E |
|--------------|------|-------------|-----|
| Library/SDK | 80% | 15% | 5% |
| Backend API | 50% | 40% | 10% |
| Full-stack web | 40% | 35% | 25% |
| Mobile app | 40% | 40% | 20% |

These are starting points, not rules.

---

## Anti-Patterns by Level

### Unit Test Anti-Patterns

| Anti-Pattern | Problem |
|--------------|---------|
| Testing private methods | Couples tests to implementation |
| Over-mocking | Tests mock behavior, not code |
| Testing framework code | Testing what you don't own |
| Tautological tests | `assert mock.called` when you just called it |

### Integration Test Anti-Patterns

| Anti-Pattern | Problem |
|--------------|---------|
| Shared test state | Tests affect each other |
| Testing everything at this level | Too slow |
| Not cleaning up | State leaks between tests |

### E2E Test Anti-Patterns

| Anti-Pattern | Problem |
|--------------|---------|
| Too many E2E tests | Slow CI, flaky tests |
| Testing edge cases | Should be unit tests |
| No test isolation | Flaky, order-dependent |
| Sleeping instead of waiting | Slow and unreliable |

---

## Summary Table

| Level | Speed | Confidence | Isolation | When to Use |
|-------|-------|------------|-----------|-------------|
| Unit | ⚡⚡⚡⚡⚡ | 🎯 Logic | Complete | Pure logic, algorithms |
| Integration | ⚡⚡⚡ | 🎯🎯 Boundaries | Partial | DB, APIs, services |
| E2E | ⚡ | 🎯🎯🎯 System | None | Critical user paths |
| Component | ⚡⚡⚡⚡ | 🎯🎯 UI | Partial | UI behavior |
| Contract | ⚡⚡⚡⚡ | 🎯 API shape | High | Service boundaries |
