# Microservices Test Implementation Plan

Specific implementation guidance for testing microservice architectures.

## Typical Testability Blockers

### 1. Hard-coded Service URLs

**Blocker**: Service URLs embedded in code

```python
# BEFORE
def get_user_profile(user_id):
    response = requests.get(f"http://user-service:8080/users/{user_id}")
    return response.json()
```

**Fix**: Configurable service clients

```python
# AFTER
class UserServiceClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def get_profile(self, user_id: str) -> dict:
        response = requests.get(f"{self.base_url}/users/{user_id}")
        return response.json()

# Configuration
client = UserServiceClient(os.environ.get("USER_SERVICE_URL", "http://user-service:8080"))
```

### 2. No Contract Testing

**Blocker**: Services mock each other differently

```python
# PROBLEM: Each service has its own idea of the API
# Service A thinks: {"user": {"id": "123", "name": "Alice"}}
# Service B returns: {"id": "123", "userName": "Alice"}
```

**Fix**: Consumer-driven contracts

```python
# Consumer test defines expected response
@pact_consumer("order-service")
def test_user_service_returns_user():
    pact.given("user 123 exists")
        .upon_receiving("a request for user 123")
        .with_request("GET", "/users/123")
        .will_respond_with(200, body={
            "id": "123",
            "name": Like("string")
        })
```

### 3. Tightly Coupled Async Communication

**Blocker**: Direct queue access in business logic

```python
# BEFORE
def create_order(order):
    # Business logic mixed with infrastructure
    kafka.produce("orders", order.to_json())
```

**Fix**: Event publisher abstraction

```python
# AFTER
class EventPublisher(Protocol):
    def publish(self, topic: str, event: Event) -> None: ...

def create_order(order, publisher: EventPublisher):
    # Business logic
    publisher.publish("orders", OrderCreated(order))
```

## Implementation Sequence

### Phase 1: Contract Testing Setup (Day 1-2)

```markdown
1. Choose contract framework
   - [ ] Pact (recommended for REST)
   - [ ] OpenAPI validation
   - [ ] gRPC reflection

2. Set up contract broker
   - [ ] Deploy Pact Broker (or use hosted)
   - [ ] Configure CI to publish contracts
   - [ ] Configure CI to verify contracts

3. Identify critical integrations
   - [ ] List all service dependencies
   - [ ] Prioritize by criticality
```

Example Pact setup:

```python
# Consumer test (order-service consuming user-service)
from pact import Consumer, Provider

pact = Consumer("order-service").has_pact_with(
    Provider("user-service"),
    pact_dir="./pacts"
)

@pact.service_consumer("order-service")
def test_get_user_for_order():
    expected = {
        "id": "123",
        "name": "Alice",
        "email": "alice@test.com"
    }

    (pact
        .given("user 123 exists")
        .upon_receiving("a request for user 123")
        .with_request("GET", "/users/123")
        .will_respond_with(200, body=Like(expected)))

    with pact:
        result = user_client.get_user("123")

    assert result["name"] == "Alice"
```

```python
# Provider verification (user-service)
from pact import Verifier

def test_provider_honors_contracts():
    verifier = Verifier(provider="user-service", provider_base_url="http://localhost:8080")

    verifier.verify_with_broker(
        broker_url=os.environ["PACT_BROKER_URL"],
        publish_verification_results=True,
        provider_version=os.environ["GIT_SHA"]
    )
```

### Phase 2: Service Client Abstraction (Day 3)

```markdown
1. Create client interfaces
   - [ ] UserServiceClient
   - [ ] PaymentServiceClient
   - [ ] NotificationServiceClient

2. Implement real clients
   - [ ] HTTP implementation
   - [ ] Error handling
   - [ ] Retry logic

3. Create mock implementations
   - [ ] For unit tests
   - [ ] For contract tests
```

Example client abstraction:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class User:
    id: str
    name: str
    email: str

class UserService(ABC):
    @abstractmethod
    def get_user(self, user_id: str) -> User:
        pass

    @abstractmethod
    def create_user(self, name: str, email: str) -> User:
        pass

class HttpUserService(UserService):
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url
        self.timeout = timeout

    def get_user(self, user_id: str) -> User:
        response = requests.get(
            f"{self.base_url}/users/{user_id}",
            timeout=self.timeout
        )
        response.raise_for_status()
        data = response.json()
        return User(**data)

class MockUserService(UserService):
    def __init__(self):
        self.users: dict[str, User] = {}

    def get_user(self, user_id: str) -> User:
        if user_id not in self.users:
            raise UserNotFoundError(user_id)
        return self.users[user_id]

    def add_user(self, user: User):
        self.users[user.id] = user
```

### Phase 3: Event-Driven Testing (Day 4)

```markdown
1. Abstract event infrastructure
   - [ ] EventPublisher interface
   - [ ] EventConsumer interface

2. Create test doubles
   - [ ] InMemoryEventBus
   - [ ] TestableKafkaConsumer

3. Test event flows
   - [ ] Publishing tests
   - [ ] Consuming tests
   - [ ] Idempotency tests
```

Example event abstraction:

```python
class EventPublisher(Protocol):
    def publish(self, topic: str, event: Event) -> None: ...

class KafkaEventPublisher:
    def __init__(self, producer: KafkaProducer):
        self.producer = producer

    def publish(self, topic: str, event: Event) -> None:
        self.producer.send(topic, event.to_json().encode())

class InMemoryEventPublisher:
    def __init__(self):
        self.events: list[tuple[str, Event]] = []

    def publish(self, topic: str, event: Event) -> None:
        self.events.append((topic, event))

    def get_events(self, topic: str) -> list[Event]:
        return [e for t, e in self.events if t == topic]

# Test
def test_order_creation_publishes_event():
    publisher = InMemoryEventPublisher()
    service = OrderService(publisher=publisher)

    service.create_order(items=[...])

    events = publisher.get_events("orders")
    assert len(events) == 1
    assert isinstance(events[0], OrderCreated)
```

### Phase 4: Integration Testing with Containers (Day 5)

```markdown
1. Set up Testcontainers
   - [ ] Database containers
   - [ ] Kafka/RabbitMQ containers
   - [ ] Other service containers

2. Create integration test fixtures
   - [ ] Service startup
   - [ ] Data seeding
   - [ ] Cleanup
```

Example testcontainers setup:

```python
import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.kafka import KafkaContainer

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:15") as container:
        yield container

@pytest.fixture(scope="session")
def kafka():
    with KafkaContainer("confluentinc/cp-kafka:7.4.0") as container:
        yield container

@pytest.fixture
def integration_context(postgres, kafka):
    return IntegrationContext(
        database_url=postgres.get_connection_url(),
        kafka_bootstrap=kafka.get_bootstrap_server()
    )

def test_full_order_flow(integration_context):
    # Create order
    order_service = OrderService(
        db=integration_context.database_url,
        kafka=integration_context.kafka_bootstrap
    )

    order = order_service.create(items=[...])

    # Verify event published
    consumer = KafkaConsumer(integration_context.kafka_bootstrap)
    messages = consumer.consume("orders", timeout=5)
    assert len(messages) == 1
```

### Phase 5: Service Mesh Testing (Day 6)

```markdown
1. Test resilience patterns
   - [ ] Circuit breaker
   - [ ] Retry logic
   - [ ] Timeout handling

2. Test service discovery
   - [ ] Dynamic routing
   - [ ] Load balancing
```

Example resilience tests:

```python
def test_circuit_breaker_opens_on_failures(mock_user_service):
    # Configure mock to fail
    mock_user_service.fail_next(5)

    client = ResilientUserClient(mock_user_service, failure_threshold=3)

    # First 3 failures
    for _ in range(3):
        with pytest.raises(ServiceError):
            client.get_user("123")

    # Circuit should be open now
    assert client.circuit_breaker.is_open

    # Subsequent calls should fail fast
    with pytest.raises(CircuitOpenError):
        client.get_user("123")

def test_retry_on_transient_failure(mock_user_service):
    # Fail twice, then succeed
    mock_user_service.fail_next(2)

    client = ResilientUserClient(mock_user_service, max_retries=3)

    result = client.get_user("123")

    assert result is not None
    assert mock_user_service.call_count == 3
```

## File Structure After Refactoring

```
services/
└── order-service/
    ├── src/
    │   ├── api/
    │   ├── domain/
    │   ├── clients/              # Service clients
    │   │   ├── interfaces.py
    │   │   ├── user_client.py
    │   │   └── payment_client.py
    │   └── events/
    │       ├── publisher.py
    │       └── consumer.py
    ├── tests/
    │   ├── unit/
    │   │   └── test_domain.py
    │   ├── integration/
    │   │   └── test_api.py
    │   ├── contracts/
    │   │   └── test_user_service_consumer.py
    │   └── e2e/
    │       └── test_order_flow.py
    └── pacts/                    # Generated contracts
        └── order-service-user-service.json

    └── user-service/
        ├── src/
        └── tests/
            └── contracts/
                └── test_provider_verification.py
```

## CI Pipeline

```yaml
# Per-service CI
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/unit/

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/contracts/
      - run: pact publish pacts/ --broker-url $PACT_BROKER

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres: postgres:15
      kafka: confluentinc/cp-kafka:7.4.0
    steps:
      - run: pytest tests/integration/

  can-i-deploy:
    needs: [contract-tests]
    runs-on: ubuntu-latest
    steps:
      - run: |
          pact broker can-i-deploy \
            --pacticipant order-service \
            --version $GIT_SHA \
            --to production
```

## Coverage Targets

| Test Type | Target | Scope |
|-----------|--------|-------|
| Unit | 85% | Business logic |
| Contract | 100% | All external calls |
| Integration | 70% | Critical paths |
| E2E | Key journeys | Cross-service flows |
