# Quick Win Test Identification

How to identify tests that provide high value with minimal effort.

## What Makes a Quick Win?

**High Value + Low Effort = Quick Win**

```
            VALUE
       Low    High
     ┌──────┬───────┐
High │ Avoid│ Avoid │
     ├──────┼───────┤ EFFORT
Low  │ Skip │ WIN!  │
     └──────┴───────┘
```

## Quick Win Patterns

### Pattern 1: Missing Smoke Tests

**Signal**: No tests for basic functionality
**Example**: No test that login works
**Value**: Catches total breakage
**Effort**: Low - just hit the endpoint

```python
# Quick win: Basic smoke test
def test_login_works():
    response = client.post("/login", json={"user": "test", "pass": "test"})
    assert response.status_code == 200
```

### Pattern 2: Missing Error Response Tests

**Signal**: Happy path tested, errors not
**Example**: 200 responses tested, 400/500 not
**Value**: Catches silent failures
**Effort**: Low - modify existing test

```python
# Quick win: Add error case to existing test
def test_login_invalid_credentials():
    response = client.post("/login", json={"user": "bad", "pass": "bad"})
    assert response.status_code == 401
    assert "error" in response.json()
```

### Pattern 3: Input Validation Gaps

**Signal**: No tests for invalid inputs
**Example**: Required fields not tested
**Value**: Catches security/data issues
**Effort**: Low - parametrized tests

```python
# Quick win: Parametrized validation
@pytest.mark.parametrize("field,value,expected", [
    ("email", "", 400),
    ("email", "invalid", 400),
    ("email", None, 400),
    ("password", "", 400),
])
def test_signup_validation(field, value, expected):
    data = valid_signup_data()
    data[field] = value
    assert client.post("/signup", json=data).status_code == expected
```

### Pattern 4: Configuration Defaults

**Signal**: No tests for default behavior
**Example**: App starts without config file
**Value**: Catches startup crashes
**Effort**: Low - one test

```python
# Quick win: Default config works
def test_app_starts_with_defaults():
    os.environ.pop("CONFIG_PATH", None)
    app = create_app()
    assert app is not None
```

### Pattern 5: Boundary Conditions

**Signal**: Normal values tested, boundaries not
**Example**: Page 1 tested, page 0 and last page not
**Value**: Catches off-by-one errors
**Effort**: Low - copy existing test

```python
# Quick win: Boundary cases
def test_pagination_first_page():
    result = get_items(page=1)
    assert result.page == 1

def test_pagination_zero_page():
    result = get_items(page=0)
    assert result.page == 1  # Should default to 1

def test_pagination_past_end():
    result = get_items(page=999999)
    assert result.items == []
```

### Pattern 6: Empty State Handling

**Signal**: No tests for empty collections
**Example**: List with items tested, empty list not
**Value**: Catches null pointer errors
**Effort**: Low - one setup change

```python
# Quick win: Empty state
def test_dashboard_with_no_data():
    user = create_user_with_no_orders()
    response = client.get(f"/dashboard/{user.id}")
    assert response.status_code == 200
    assert response.json()["orders"] == []
```

## Quick Win Checklist

For each feature/endpoint, check:

- [ ] **Basic success** - Does the happy path have a test?
- [ ] **Error response** - Does invalid input return proper error?
- [ ] **Empty state** - Does empty/null input work?
- [ ] **Boundaries** - Are min/max values tested?
- [ ] **Required fields** - Are required fields validated?
- [ ] **Authentication** - Is auth required where expected?

## Identifying Quick Wins from Audit

### From Coverage Gaps

| Gap Type | Quick Win Test |
|----------|----------------|
| Endpoint untested | Add smoke test |
| Error handling missing | Add 4xx/5xx tests |
| Validation untested | Add invalid input tests |
| Edge case missing | Add boundary tests |

### From Quality Issues

| Issue | Quick Win |
|-------|-----------|
| Flaky test | Add retry or fix timing |
| Missing assertion | Add meaningful assertion |
| No cleanup | Add teardown |

## Quick Win Template

```markdown
### Quick Win: [Name]

**Current State**: [What's missing]
**Value**: [Why it matters]
**Effort**: [Why it's low effort]

**Test to Add**:
```python
def test_[name]():
    # Setup (minimal)
    # Action (one call)
    # Assert (obvious check)
```

**Estimated Time**: [< 2 hours]
```

## Quick Wins to Avoid

Not all easy tests are valuable:

| False Quick Win | Why It's Waste |
|-----------------|----------------|
| Testing constants | Can't break |
| Testing framework code | Already tested |
| Duplicating existing test | No new value |
| Testing internal implementation | Fragile |
| Testing obvious getters/setters | No logic to test |

## Prioritizing Quick Wins

When you have multiple quick wins:

1. **Critical paths first** - Login, checkout, signup
2. **Customer-facing** - API endpoints > internal tools
3. **Recent bugs** - Where problems have occurred
4. **Common paths** - High traffic areas
5. **Security-related** - Auth, validation, permissions

## Quick Win Sprint

A focused effort to add many quick wins:

```markdown
## Quick Win Sprint Plan

**Goal**: Add [N] quick win tests in [timeframe]

### Day 1: Critical Paths
- [ ] Login smoke test
- [ ] Signup validation
- [ ] Checkout basic flow

### Day 2: Error Handling
- [ ] 401 responses for protected routes
- [ ] 400 responses for invalid input
- [ ] 404 responses for missing resources

### Day 3: Edge Cases
- [ ] Empty states
- [ ] Boundary values
- [ ] Null handling

**Success Metric**: [N] new tests, [X]% coverage increase
```
