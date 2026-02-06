# Dependency Injection for Testability

How to refactor hard-coded dependencies into injectable ones.

## The Problem

```python
# UNTESTABLE: Hard-coded dependency
class PaymentService:
    def __init__(self):
        self.stripe = stripe.Client(os.environ["STRIPE_KEY"])

    def charge(self, amount):
        return self.stripe.create_charge(amount)
```

**Why untestable?**
- Can't replace Stripe with mock
- Requires real API key
- Makes real API calls in tests
- Tests are slow and flaky

## The Solution

```python
# TESTABLE: Injectable dependency
class PaymentService:
    def __init__(self, stripe_client: StripeClient):
        self.stripe = stripe_client

    def charge(self, amount):
        return self.stripe.create_charge(amount)

# In production
service = PaymentService(stripe.Client(os.environ["STRIPE_KEY"]))

# In tests
mock_stripe = Mock(spec=StripeClient)
service = PaymentService(mock_stripe)
```

## Refactoring Steps

### Step 1: Identify the Dependency

Find hard-coded instantiation in constructors or methods:

```python
# Red flags:
self.thing = SomeClass()           # Constructor call
self.thing = some_module.client()  # Module-level client
self.thing = os.environ["KEY"]     # Environment variable
```

### Step 2: Extract Interface (Optional but Recommended)

```python
# Before: Concrete class
class PaymentService:
    def __init__(self):
        self.stripe = stripe.Client(...)

# After: Interface
from abc import ABC, abstractmethod

class PaymentClient(ABC):
    @abstractmethod
    def create_charge(self, amount: float) -> ChargeResult:
        pass

class StripePaymentClient(PaymentClient):
    def __init__(self, api_key: str):
        self.client = stripe.Client(api_key)

    def create_charge(self, amount: float) -> ChargeResult:
        return self.client.create_charge(amount)
```

### Step 3: Accept Dependency in Constructor

```python
class PaymentService:
    def __init__(self, payment_client: PaymentClient):
        self.client = payment_client
```

### Step 4: Update All Instantiation Sites

Find and update all places that create the service:

```python
# Before
service = PaymentService()

# After
stripe_client = StripePaymentClient(os.environ["STRIPE_KEY"])
service = PaymentService(stripe_client)
```

### Step 5: Create Test Double

```python
class MockPaymentClient(PaymentClient):
    def __init__(self):
        self.charges = []
        self.should_fail = False

    def create_charge(self, amount: float) -> ChargeResult:
        if self.should_fail:
            raise PaymentError("Card declined")
        charge = ChargeResult(id=f"ch_{len(self.charges)}", amount=amount)
        self.charges.append(charge)
        return charge
```

### Step 6: Write Tests

```python
def test_successful_charge():
    mock_client = MockPaymentClient()
    service = PaymentService(mock_client)

    result = service.charge(100)

    assert result.amount == 100
    assert len(mock_client.charges) == 1

def test_failed_charge():
    mock_client = MockPaymentClient()
    mock_client.should_fail = True
    service = PaymentService(mock_client)

    with pytest.raises(PaymentError):
        service.charge(100)
```

## Patterns by Language

### Python

```python
# Using Protocol (Python 3.8+)
from typing import Protocol

class EmailSender(Protocol):
    def send(self, to: str, subject: str, body: str) -> bool: ...

class SmtpEmailSender:
    def send(self, to: str, subject: str, body: str) -> bool:
        # Real implementation
        ...

class NotificationService:
    def __init__(self, email_sender: EmailSender):
        self.email = email_sender
```

### TypeScript

```typescript
// Using interface
interface PaymentClient {
    charge(amount: number): Promise<ChargeResult>;
}

class StripeClient implements PaymentClient {
    async charge(amount: number): Promise<ChargeResult> {
        // Real implementation
    }
}

class PaymentService {
    constructor(private client: PaymentClient) {}

    async processPayment(amount: number) {
        return this.client.charge(amount);
    }
}
```

### Go

```go
// Using interface
type PaymentClient interface {
    Charge(amount float64) (*ChargeResult, error)
}

type StripeClient struct {
    apiKey string
}

func (s *StripeClient) Charge(amount float64) (*ChargeResult, error) {
    // Real implementation
}

type PaymentService struct {
    client PaymentClient
}

func NewPaymentService(client PaymentClient) *PaymentService {
    return &PaymentService{client: client}
}
```

## DI Containers (Optional)

For complex apps, use a DI container:

### Python (dependency-injector)

```python
from dependency_injector import containers, providers

class Container(containers.DeclarativeContainer):
    config = providers.Configuration()

    stripe_client = providers.Singleton(
        StripePaymentClient,
        api_key=config.stripe_key
    )

    payment_service = providers.Factory(
        PaymentService,
        payment_client=stripe_client
    )

# Usage
container = Container()
container.config.stripe_key.from_env("STRIPE_KEY")
service = container.payment_service()
```

### TypeScript (tsyringe)

```typescript
import { container, injectable, inject } from "tsyringe";

@injectable()
class PaymentService {
    constructor(
        @inject("PaymentClient") private client: PaymentClient
    ) {}
}

// Registration
container.register("PaymentClient", { useClass: StripeClient });

// Usage
const service = container.resolve(PaymentService);
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Optional dependency | Defaults to real implementation | Make required |
| Lazy injection | Hard to mock | Inject at construction |
| God object | Too many dependencies | Split into smaller services |
| Deep nesting | Hard to wire up | Use DI container |

## Verification Checklist

After refactoring:

- [ ] No `new` calls in business logic
- [ ] No environment variables read in constructors
- [ ] All dependencies passed in constructor
- [ ] Tests use mock implementations
- [ ] Production code unchanged behavior
