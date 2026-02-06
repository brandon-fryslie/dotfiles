# Classic Test Pyramid Strategy

When to use: Monoliths, modular monoliths, single-deployment applications.

## The Pyramid

```
         ╱╲
        ╱E2E╲          5-10% of tests
       ╱──────╲
      ╱ Integ  ╲       15-25% of tests
     ╱──────────╲
    ╱    Unit    ╲     70-80% of tests
   ╱──────────────╲
```

## Rationale

| Level | Cost | Speed | Confidence | Debugging |
|-------|------|-------|------------|-----------|
| Unit | Low | Fast | Low (isolated) | Easy |
| Integration | Medium | Medium | Medium | Moderate |
| E2E | High | Slow | High | Hard |

**Goal**: Maximum confidence with minimum cost/time.

## What to Test at Each Level

### Unit Tests (70-80%)

**Test**:
- Pure functions (calculation, transformation)
- Business logic (validation, rules)
- State transitions
- Edge cases (null, empty, boundary)
- Error conditions

**Don't test**:
- Database queries (mock them)
- External APIs (mock them)
- Framework code (trust it)

**Example**:
```python
def test_calculate_tax():
    assert calculate_tax(100, 0.1) == 10
    assert calculate_tax(0, 0.1) == 0
    assert calculate_tax(100, 0) == 0
```

### Integration Tests (15-25%)

**Test**:
- Database queries and transactions
- Component interactions
- API contract (request/response shape)
- Service layer behavior

**Don't test**:
- UI rendering
- External third-party APIs
- Infrastructure concerns

**Example**:
```python
def test_user_creation_persists():
    user = UserService().create(name="Alice")
    assert User.get(user.id).name == "Alice"
```

### E2E Tests (5-10%)

**Test**:
- Critical user journeys (login, checkout, signup)
- Happy path through full system
- Major error flows (payment decline)

**Don't test**:
- Every permutation
- Edge cases (handle at unit level)
- Internal implementation details

**Example**:
```python
def test_user_can_complete_purchase():
    login(user)
    add_to_cart(product)
    checkout()
    assert order_confirmation_shown()
```

## Anti-Patterns

### Ice Cream Cone (Inverted Pyramid)

```
      ╱────────────╲
     ╱    E2E       ╲      Many slow tests
    ╱────────────────╲
   ╱      Integ       ╲
  ╱────────────────────╲
 ╱        Unit          ╲  Few fast tests
 ────────────────────────
```

**Symptoms**:
- CI takes hours
- Tests are flaky
- Failures are hard to diagnose
- Small changes break many tests

**Fix**: Move tests down the pyramid.

### Hourglass (Missing Integration)

```
         ╱╲
        ╱E2E╲          Many
       ╱──────╲
      ╱ Integ  ╲       Few/None
     ╱──────────╲
    ╱    Unit    ╲     Many
   ╱──────────────╲
```

**Symptoms**:
- Unit tests pass, E2E fails
- Hard to isolate failures
- Components work alone but not together

**Fix**: Add integration tests for component boundaries.

## Pyramid by Project Type

### Web Backend/API

```
Unit (75%): Business logic, validation, transformations
Integration (20%): Database queries, service interactions
E2E (5%): Critical API flows
```

### Web Frontend

```
Unit (60%): Component logic, state management
Integration (30%): Component interactions, API integration
E2E (10%): User journeys
```

### Library/SDK

```
Unit (85%): All public APIs, edge cases
Integration (10%): Module interactions
E2E (5%): Example usage scenarios
```

## Recommendations by Gap Type

| Gap | Recommended Level | Why |
|-----|------------------|-----|
| Business logic untested | Unit | Fast, focused, easy to maintain |
| Components don't integrate | Integration | Test boundaries |
| User flows broken | E2E | End-to-end confidence |
| Edge cases missed | Unit | Exhaustive coverage feasible |
| Database queries wrong | Integration | Need real DB to verify |
