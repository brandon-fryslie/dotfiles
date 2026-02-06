# Web Backend/API Testing Scenario

Testing REST APIs, GraphQL, and backend services.

## Testing Pyramid for APIs

```
         ╱╲
        ╱E2E╲          Full stack with real DB
       ╱──────╲
      ╱ Integ  ╲       API endpoints + test DB
     ╱──────────╲
    ╱    Unit    ╲     Business logic, validators
   ╱──────────────╲
```

| Level | What to Test | Scope |
|-------|--------------|-------|
| Unit | Services, validators, utils | Single function/class |
| Integration | Endpoints, DB operations | API + real/test DB |
| E2E | Full user flows, auth | Entire system running |

## Critical Test Areas

### 1. Endpoint Response Codes

| Code | Meaning | Must Test |
|------|---------|-----------|
| 200 | Success | Every happy path |
| 201 | Created | POST creates |
| 400 | Bad request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not found | Missing resource |
| 500 | Server error | Should never happen in tests |

```python
# FastAPI example
def test_get_user():
    response = client.get("/users/1")
    assert response.status_code == 200
    assert response.json()["id"] == 1

def test_get_user_not_found():
    response = client.get("/users/999")
    assert response.status_code == 404

def test_create_user_invalid():
    response = client.post("/users", json={"name": ""})
    assert response.status_code == 400
```

### 2. Request Validation

```python
def test_missing_required_field():
    response = client.post("/users", json={})
    assert response.status_code == 400
    assert "name" in response.json()["detail"].lower()

def test_invalid_email_format():
    response = client.post("/users", json={"email": "not-an-email"})
    assert response.status_code == 400

def test_field_length_validation():
    response = client.post("/users", json={"name": "x" * 1000})
    assert response.status_code == 400
```

### 3. Authentication

```python
def test_endpoint_requires_auth():
    response = client.get("/protected")
    assert response.status_code == 401

def test_valid_token_accepted():
    response = client.get("/protected", headers={"Authorization": f"Bearer {valid_token}"})
    assert response.status_code == 200

def test_expired_token_rejected():
    response = client.get("/protected", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
```

### 4. Authorization

```python
def test_user_cannot_access_other_users_data():
    # User 1 trying to access User 2's data
    response = client.get("/users/2/private", headers=auth_header(user=1))
    assert response.status_code == 403

def test_admin_can_access_all():
    response = client.get("/users/2/private", headers=auth_header(admin=True))
    assert response.status_code == 200
```

### 5. Database Integration

```python
@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.close()

def test_create_persists_to_db(db_session):
    response = client.post("/users", json={"name": "Test"})
    user_id = response.json()["id"]

    # Verify in DB
    user = db_session.query(User).filter_by(id=user_id).first()
    assert user is not None
    assert user.name == "Test"
```

### 6. Business Logic

```python
# Service layer unit tests
def test_calculate_order_total():
    items = [{"price": 10, "qty": 2}, {"price": 5, "qty": 1}]
    total = OrderService.calculate_total(items)
    assert total == 25

def test_discount_applied_correctly():
    total = OrderService.apply_discount(100, discount_percent=20)
    assert total == 80
```

### 7. Error Handling

```python
def test_database_error_returns_500():
    with patch('app.db.session.commit', side_effect=DatabaseError):
        response = client.post("/users", json={"name": "Test"})
        assert response.status_code == 500
        # Should not expose internals
        assert "DatabaseError" not in response.text

def test_validation_error_is_helpful():
    response = client.post("/users", json={"email": "bad"})
    error = response.json()
    assert "email" in str(error).lower()
    assert "valid" in str(error).lower()
```

### 8. Pagination

```python
def test_pagination_defaults():
    response = client.get("/users")
    assert len(response.json()["items"]) <= 20  # Default page size

def test_pagination_params():
    response = client.get("/users?page=2&per_page=10")
    data = response.json()
    assert data["page"] == 2
    assert data["per_page"] == 10

def test_pagination_metadata():
    response = client.get("/users")
    data = response.json()
    assert "total" in data
    assert "pages" in data
```

### 9. Rate Limiting

```python
def test_rate_limit_enforced():
    # Exceed rate limit
    for _ in range(100):
        client.get("/api/resource")

    response = client.get("/api/resource")
    assert response.status_code == 429
```

## GraphQL-Specific

```python
def test_graphql_query():
    query = """
    query {
      user(id: 1) {
        name
        email
      }
    }
    """
    response = client.post("/graphql", json={"query": query})
    assert response.status_code == 200
    assert response.json()["data"]["user"]["name"] == "Alice"

def test_graphql_validation_error():
    query = "{ invalidField }"
    response = client.post("/graphql", json={"query": query})
    assert "errors" in response.json()
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Service methods
- [ ] Validators
- [ ] Serializers
- [ ] Business logic
- [ ] Utility functions

### Integration Tests (Medium)
- [ ] Each endpoint (success + errors)
- [ ] Authentication flow
- [ ] Authorization rules
- [ ] Database operations
- [ ] External service calls (mocked)

### E2E Tests (Few)
- [ ] Complete user registration
- [ ] Main business flow
- [ ] Cross-service workflows

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Sharing test data between tests | Flaky, order-dependent | Clean state per test |
| Testing only 200 responses | Errors not caught | Test all status codes |
| Mocking the database | Doesn't test queries | Use test database |
| No auth tests | Security holes | Test every auth scenario |
| Exact response matching | Breaks on additions | Check specific fields |

## Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── test_user_service.py
│   │   └── test_order_service.py
│   └── validators/
│       └── test_email_validator.py
├── integration/
│   ├── api/
│   │   ├── test_users_api.py
│   │   ├── test_orders_api.py
│   │   └── test_auth_api.py
│   └── db/
│       └── test_user_repository.py
├── e2e/
│   └── test_checkout_flow.py
├── conftest.py           # Fixtures
└── factories.py          # Test data factories
```

## Tools by Framework

| Framework | Test Client | DB Testing |
|-----------|-------------|------------|
| FastAPI | `TestClient` | SQLAlchemy test session |
| Django | `django.test.Client` | `TransactionTestCase` |
| Express | `supertest` | Test database |
| Rails | `ActionDispatch::IntegrationTest` | Fixtures/FactoryBot |
| Spring | `MockMvc` | `@DataJpaTest` |
