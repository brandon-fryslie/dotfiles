# Common LLM/AI Testing Mistakes

How AI systems commonly fail at writing automated tests, and how to detect and avoid these mistakes.

## The Core Problem

LLMs optimize for **appearing correct** rather than **being correct**. This manifests in tests that:
- Pass without validating anything meaningful
- Test implementation details rather than behavior
- Mock away the thing being tested
- Provide false confidence through high coverage numbers

## Mistake Categories

### 1. Mocking the Subject Under Test

**What happens**: The LLM mocks so much that the test validates mocks, not code.

```python
# WRONG: Mocking everything, testing nothing
def test_order_service_creates_order():
    mock_db = MagicMock()
    mock_validator = MagicMock()
    mock_validator.validate.return_value = True
    mock_db.save.return_value = Order(id=1)

    service = OrderService(mock_db, mock_validator)
    result = service.create_order({"item": "test"})

    assert result.id == 1  # Just testing the mock's return value!
    mock_db.save.assert_called_once()  # Just testing we called a mock
```

**Why it happens**: LLMs see "mock everything" as a pattern and apply it universally.

**How to detect**:
- Test passes even if implementation is completely wrong
- Assertions only verify mock return values or call counts
- No real logic is exercised

**Fix**: Mock at boundaries, not internals:
```python
# RIGHT: Test real logic, mock only external boundary
def test_order_service_creates_order(test_db):
    service = OrderService(test_db, RealValidator())
    result = service.create_order({"item": "test", "qty": 1})

    assert result.id is not None
    assert test_db.query(Order).get(result.id).item == "test"
```

---

### 2. Tautological Tests

**What happens**: Tests assert things that are guaranteed to be true.

```python
# WRONG: Tautological - always passes
def test_list_returns_list():
    result = get_items()
    assert isinstance(result, list)  # Function returns [], so... yes

def test_response_has_data():
    response = {"data": {"user": "test"}}  # Defined right here!
    assert "data" in response  # Obviously true

def test_mock_returns_what_we_set():
    mock = Mock(return_value=42)
    assert mock() == 42  # We just set this!
```

**Why it happens**: LLMs generate "reasonable looking" assertions without understanding purpose.

**How to detect**:
- Remove the implementation and test still passes
- Assertion is true by definition
- No transformation or logic between setup and assertion

**Fix**: Test behavior, not structure:
```python
# RIGHT: Test actual behavior
def test_get_items_returns_user_items():
    create_item(user_id=1, name="item1")
    create_item(user_id=1, name="item2")
    create_item(user_id=2, name="other")

    result = get_items(user_id=1)

    assert len(result) == 2
    assert all(item.user_id == 1 for item in result)
```

---

### 3. Testing Implementation, Not Behavior

**What happens**: Tests break when you refactor, even though behavior is unchanged.

```python
# WRONG: Coupled to implementation
def test_user_service_uses_cache():
    mock_cache = Mock()
    mock_db = Mock()
    service = UserService(mock_cache, mock_db)

    service.get_user(1)

    mock_cache.get.assert_called_with("user:1")  # Implementation detail!
    mock_db.query.assert_called_once()  # Implementation detail!

# If we change caching strategy, test breaks
# But the USER-FACING BEHAVIOR hasn't changed
```

**Why it happens**: LLMs test what they can see (method calls) rather than outcomes.

**How to detect**:
- Tests break on refactoring
- Tests verify method calls rather than results
- Test names describe HOW not WHAT

**Fix**: Test observable behavior:
```python
# RIGHT: Test behavior, not mechanism
def test_get_user_returns_user_data():
    create_user(id=1, name="Alice")

    user = service.get_user(1)

    assert user.name == "Alice"

def test_get_user_is_fast_on_repeated_calls():
    create_user(id=1, name="Alice")

    # First call
    start = time.time()
    service.get_user(1)
    first_call = time.time() - start

    # Second call (should be cached)
    start = time.time()
    service.get_user(1)
    second_call = time.time() - start

    assert second_call < first_call * 0.1  # 10x faster = cached
```

---

### 4. Happy Path Only

**What happens**: Tests only cover success cases, errors go untested.

```python
# WRONG: Only testing success
def test_create_user():
    result = create_user(email="valid@test.com", name="Test")
    assert result.id is not None

# Missing:
# - Invalid email
# - Duplicate email
# - Empty name
# - Database failure
# - Network timeout
```

**Why it happens**: LLMs generate the "obvious" test case.

**How to detect**:
- No tests with `pytest.raises` or `expect().toThrow()`
- No tests for invalid input
- Coverage gaps on error handling code

**Fix**: Explicitly test error paths:
```python
# RIGHT: Test error cases
def test_create_user_rejects_invalid_email():
    with pytest.raises(ValidationError, match="invalid email"):
        create_user(email="not-an-email", name="Test")

def test_create_user_rejects_duplicate():
    create_user(email="test@test.com", name="First")

    with pytest.raises(DuplicateError):
        create_user(email="test@test.com", name="Second")
```

---

### 5. Wrong Test Level

**What happens**: Tests are at the wrong level for what they're validating.

```python
# WRONG: Unit test trying to be integration test
def test_full_order_flow():
    mock_db = Mock()
    mock_payment = Mock()
    mock_email = Mock()
    mock_inventory = Mock()
    # ... 15 mocks later ...

    service = OrderService(mock_db, mock_payment, ...)
    service.place_order(order_data)

    # Testing complex flow with all mocks = meaningless
```

**Why it happens**: LLMs see "test this feature" and create one test, regardless of complexity.

**How to detect**:
- >3 mocks in a "unit" test
- Test file longer than implementation
- Test setup is majority of test code

**Fix**: Split by test level:
```python
# RIGHT: Unit test for logic
def test_calculate_order_total():
    items = [Item(price=10, qty=2), Item(price=5, qty=1)]
    assert calculate_total(items) == 25

# RIGHT: Integration test for flow
def test_order_placed_updates_inventory(test_db):
    create_inventory_item(sku="ABC", qty=10)
    place_order(sku="ABC", qty=3)
    assert get_inventory("ABC").qty == 7
```

---

### 6. Magic Values Without Meaning

**What happens**: Tests use arbitrary values that obscure intent.

```python
# WRONG: Why these specific values?
def test_order():
    order = create_order(item_id=42, quantity=7, user_id=123)
    assert order.total == 103.53
```

**Why it happens**: LLMs generate plausible-looking values without semantic meaning.

**How to detect**:
- Hard to understand what's being tested
- Values don't relate to business rules
- Expected values are "magic numbers"

**Fix**: Use meaningful test data:
```python
# RIGHT: Clear intent
def test_order_total_includes_tax():
    TAX_RATE = 0.1  # 10%
    ITEM_PRICE = 100

    order = create_order(
        item=Item(price=ITEM_PRICE),
        quantity=1,
        user=User(state="CA")  # CA has sales tax
    )

    expected = ITEM_PRICE * (1 + TAX_RATE)  # 110
    assert order.total == expected
```

---

### 7. Snapshot Abuse

**What happens**: Snapshot tests for everything, meaningless diffs.

```python
# WRONG: Snapshot for data that changes
def test_user_api(snapshot):
    response = client.get("/users/1")
    assert response.json() == snapshot  # Includes timestamps, IDs...
```

**Why it happens**: Snapshots are easy to generate without thinking.

**How to detect**:
- Frequent snapshot updates with no understanding
- Snapshots include timestamps, IDs, random data
- Nobody reviews snapshot diffs

**Fix**: Snapshot only stable output, assert specific fields:
```python
# RIGHT: Assert meaningful fields, snapshot stable output
def test_user_api():
    response = client.get("/users/1")
    data = response.json()

    assert data["name"] == "Alice"
    assert data["email"] == "alice@test.com"
    # Don't snapshot: id, created_at, updated_at
```

---

### 8. Overconfidence in "Passing Tests"

**What happens**: LLM reports "all tests pass" as success, but tests validate nothing.

```python
# LLM generated test suite
def test_app_works():
    app = App()
    assert app  # Truthy check, always passes

def test_function_runs():
    result = my_function()  # No assertion at all!

def test_no_exception():
    try:
        risky_operation()
    except:
        pass  # Swallowed exception, always passes
```

**Why it happens**: LLMs optimize for "green checkmarks."

**How to detect**:
- Tests with no assertions
- Assertions on truthiness only
- Exception handling that swallows failures

**Fix**: Every test must have meaningful assertions:
```python
# Checklist for each test:
# [ ] At least one assertion
# [ ] Assertion would fail if behavior changed
# [ ] Test can actually catch the bug it's meant to prevent
```

---

## Detecting LLM-Generated Test Problems

### Red Flags Checklist

| Red Flag | Indicates |
|----------|-----------|
| Test passes with empty implementation | Tautological |
| More mocks than real objects | Over-mocking |
| `assert mock.called` as main assertion | Not testing behavior |
| No error/edge case tests | Happy path only |
| Test name doesn't match assertion | Confusion about intent |
| Magic numbers without comments | Unclear intent |
| 100% coverage, bugs still found | Tests don't validate |

### Automated Detection

```python
# Script to detect suspicious patterns
def audit_test_file(filepath):
    issues = []

    content = read_file(filepath)

    # Detect MagicMock abuse
    mock_count = content.count("MagicMock()")
    if mock_count > 5:
        issues.append(f"Excessive MagicMock usage: {mock_count}")

    # Detect missing assertions
    test_functions = extract_test_functions(content)
    for func in test_functions:
        if "assert" not in func and "expect" not in func:
            issues.append(f"No assertion in {func.name}")

    # Detect tautological patterns
    if "assert True" in content or "assert 1 == 1" in content:
        issues.append("Tautological assertion detected")

    return issues
```

### Human Review Questions

For each test, ask:
1. "If I break the implementation, will this test fail?"
2. "Is this test verifying user-visible behavior?"
3. "Would a future developer understand what this tests?"
4. "Is this the right level (unit/integration/e2e) for this behavior?"

---

## Mitigation Strategies

### 1. Mutation Testing

Run mutation testing to verify tests catch bugs:

```bash
# Python
mutmut run

# JavaScript
npx stryker run
```

If mutations survive (code changes, tests pass), tests are weak.

### 2. Test-First Review

Before implementing:
1. Write test
2. Verify test FAILS
3. Implement
4. Verify test PASSES

If test passes before implementation → test is tautological.

### 3. Coverage of Behavior, Not Lines

Focus on:
- "Can a user log in?" not "Is line 42 executed?"
- "Does invalid input get rejected?" not "Is the if-branch covered?"

### 4. The Delete Test

For any test, ask: "If I deleted this test, what bug could ship?"

If the answer is "nothing specific" → test may be useless.
