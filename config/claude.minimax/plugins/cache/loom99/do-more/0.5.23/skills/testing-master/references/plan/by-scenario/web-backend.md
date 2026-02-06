# Web Backend Test Implementation Plan

Specific implementation guidance for testing web backend/API applications.

## Typical Testability Blockers

### 1. Database Access

**Blocker**: Direct database calls in route handlers

```python
# BEFORE
@app.route("/users/<id>")
def get_user(id):
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = %s", [id])
    return cursor.fetchone()
```

**Fix**: Repository pattern

```python
# AFTER
class UserRepository:
    def __init__(self, db: Database):
        self.db = db

    def get(self, id: str) -> User:
        return self.db.query("SELECT * FROM users WHERE id = %s", [id])

@app.route("/users/<id>")
def get_user(id, user_repo: UserRepository = Depends(get_user_repo)):
    return user_repo.get(id)
```

### 2. External API Calls

**Blocker**: HTTP calls inside business logic

```python
# BEFORE
def create_order(order):
    # Business logic mixed with HTTP call
    stripe.charge(order.total)
```

**Fix**: Gateway pattern

```python
# AFTER
class PaymentGateway(Protocol):
    def charge(self, amount: float) -> ChargeResult: ...

def create_order(order, payment: PaymentGateway):
    payment.charge(order.total)
```

### 3. Request Context

**Blocker**: Accessing request globals

```python
# BEFORE
def process_something():
    user = flask.g.current_user  # Global access
```

**Fix**: Explicit parameters

```python
# AFTER
def process_something(user: User):
    # User passed explicitly
```

## Implementation Sequence

### Phase 1: Test Infrastructure (Day 1)

```markdown
1. Set up test database
   - [ ] Create test Docker Compose
   - [ ] Add pytest fixtures for DB
   - [ ] Configure test database URL

2. Set up test client
   - [ ] Configure FastAPI/Flask TestClient
   - [ ] Add authentication helpers
   - [ ] Create request factory

3. Set up factories
   - [ ] User factory
   - [ ] Order factory (etc.)
```

Example fixtures:

```python
# conftest.py
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def database():
    with PostgresContainer("postgres:15") as postgres:
        yield postgres.get_connection_url()

@pytest.fixture
def db_session(database):
    engine = create_engine(database)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)
```

### Phase 2: Repository Layer (Day 2)

```markdown
1. Extract repositories
   - [ ] UserRepository
   - [ ] OrderRepository
   - [ ] ProductRepository

2. Add repository tests
   - [ ] CRUD operations
   - [ ] Query methods
   - [ ] Edge cases (not found, etc.)
```

Example repository test:

```python
def test_user_repository_create(db_session):
    repo = UserRepository(db_session)
    user = repo.create(name="Alice", email="alice@test.com")
    assert user.id is not None
    assert user.name == "Alice"

def test_user_repository_not_found(db_session):
    repo = UserRepository(db_session)
    with pytest.raises(NotFoundError):
        repo.get("nonexistent")
```

### Phase 3: Service Layer (Day 3-4)

```markdown
1. Extract services
   - [ ] UserService
   - [ ] OrderService
   - [ ] PaymentService (with gateway)

2. Add service tests
   - [ ] Business logic tests (unit)
   - [ ] Mocked dependencies
   - [ ] Error handling
```

Example service test:

```python
def test_order_service_calculates_total():
    mock_repo = Mock(spec=OrderRepository)
    mock_payment = Mock(spec=PaymentGateway)

    service = OrderService(mock_repo, mock_payment)
    order = service.create(items=[
        {"product_id": "1", "quantity": 2, "price": 10.0},
        {"product_id": "2", "quantity": 1, "price": 5.0},
    ])

    assert order.total == 25.0

def test_order_service_payment_failure():
    mock_repo = Mock(spec=OrderRepository)
    mock_payment = Mock(spec=PaymentGateway)
    mock_payment.charge.side_effect = PaymentError("Declined")

    service = OrderService(mock_repo, mock_payment)

    with pytest.raises(PaymentError):
        service.create(items=[...])

    # Order should not be saved
    mock_repo.save.assert_not_called()
```

### Phase 4: API Layer (Day 5)

```markdown
1. Route tests
   - [ ] Success responses
   - [ ] Error responses
   - [ ] Validation

2. Integration tests
   - [ ] Full request/response cycle
   - [ ] Authentication
   - [ ] Authorization
```

Example API tests:

```python
def test_create_user_success(client):
    response = client.post("/users", json={
        "name": "Alice",
        "email": "alice@test.com"
    })
    assert response.status_code == 201
    assert response.json()["id"] is not None

def test_create_user_validation_error(client):
    response = client.post("/users", json={
        "name": "",  # Invalid
        "email": "not-an-email"  # Invalid
    })
    assert response.status_code == 400
    assert "errors" in response.json()

def test_get_user_not_found(client):
    response = client.get("/users/nonexistent")
    assert response.status_code == 404
```

### Phase 5: E2E Tests (Day 6)

```markdown
1. Critical user journeys
   - [ ] User registration
   - [ ] Login flow
   - [ ] Checkout process

2. Full stack tests
   - [ ] Real database
   - [ ] Mocked external services
```

Example E2E test:

```python
def test_complete_checkout_flow(client, db_session):
    # Register
    client.post("/auth/register", json={...})

    # Login
    response = client.post("/auth/login", json={...})
    token = response.json()["token"]

    # Add to cart
    client.post("/cart/items", json={...},
                headers={"Authorization": f"Bearer {token}"})

    # Checkout (with mocked payment)
    with patch("app.services.stripe_client") as mock_stripe:
        mock_stripe.charge.return_value = {"id": "ch_123"}

        response = client.post("/checkout",
                              headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["order_id"] is not None

    # Verify order in database
    order = db_session.query(Order).first()
    assert order.status == "completed"
```

## File Structure After Refactoring

```
src/
├── api/
│   ├── routes/
│   │   ├── users.py
│   │   └── orders.py
│   └── dependencies.py
├── services/
│   ├── user_service.py
│   └── order_service.py
├── repositories/
│   ├── base.py
│   ├── user_repository.py
│   └── order_repository.py
├── gateways/
│   ├── payment_gateway.py
│   └── email_gateway.py
└── models/

tests/
├── conftest.py
├── unit/
│   ├── services/
│   │   └── test_order_service.py
│   └── repositories/
├── integration/
│   ├── test_user_api.py
│   └── test_order_api.py
└── e2e/
    └── test_checkout_flow.py
```

## Coverage Targets

| Layer | Target | Type |
|-------|--------|------|
| Repositories | 90% | Integration |
| Services | 85% | Unit + Integration |
| Routes | 80% | Integration |
| E2E | Critical paths | E2E |
