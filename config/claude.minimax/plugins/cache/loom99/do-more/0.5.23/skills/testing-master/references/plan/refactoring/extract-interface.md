# Extract Interface for Testability

How to create interfaces from concrete classes to enable mocking.

## The Problem

```python
# UNTESTABLE: Concrete class coupling
class OrderService:
    def create_order(self, cart):
        # Process order...
        email = EmailClient()  # Concrete class
        email.send(cart.user.email, "Order Confirmation", body)
```

**Why untestable?**
- Sends real emails in tests
- Can't verify email was sent
- Can't test email failure handling
- Tight coupling to EmailClient implementation

## The Solution

```python
# Interface
class EmailSender(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str) -> bool:
        pass

# Concrete implementation
class SmtpEmailSender(EmailSender):
    def send(self, to: str, subject: str, body: str) -> bool:
        # Real email sending
        ...

# Service uses interface
class OrderService:
    def __init__(self, email_sender: EmailSender):
        self.email = email_sender

    def create_order(self, cart):
        # Process order...
        self.email.send(cart.user.email, "Order Confirmation", body)
```

## Refactoring Steps

### Step 1: Identify Concrete Dependencies

Find classes instantiated directly:

```python
# Red flags:
thing = ConcreteClass()
thing = module.Client()
from module import ConcreteClass  # then used directly
```

### Step 2: Define the Interface

Extract the methods you actually use:

```python
# Original class has many methods
class EmailClient:
    def send(self, to, subject, body): ...
    def send_bulk(self, recipients, subject, body): ...
    def get_templates(self): ...
    def validate_email(self, email): ...

# Interface only what you use
class EmailSender(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str) -> bool:
        pass
```

### Step 3: Implement the Interface

```python
class SmtpEmailSender(EmailSender):
    def __init__(self, smtp_config: SmtpConfig):
        self.client = EmailClient(smtp_config)

    def send(self, to: str, subject: str, body: str) -> bool:
        return self.client.send(to, subject, body)
```

### Step 4: Create Mock Implementation

```python
class MockEmailSender(EmailSender):
    def __init__(self):
        self.sent_emails = []
        self.should_fail = False

    def send(self, to: str, subject: str, body: str) -> bool:
        if self.should_fail:
            raise EmailError("Failed to send")
        self.sent_emails.append({
            "to": to,
            "subject": subject,
            "body": body
        })
        return True
```

### Step 5: Update Consumer

```python
class OrderService:
    def __init__(self, email_sender: EmailSender):
        self.email = email_sender
```

### Step 6: Write Tests

```python
def test_order_sends_confirmation_email():
    mock_email = MockEmailSender()
    service = OrderService(mock_email)

    service.create_order(cart)

    assert len(mock_email.sent_emails) == 1
    assert mock_email.sent_emails[0]["to"] == cart.user.email
    assert "Order Confirmation" in mock_email.sent_emails[0]["subject"]

def test_order_handles_email_failure():
    mock_email = MockEmailSender()
    mock_email.should_fail = True
    service = OrderService(mock_email)

    # Should not throw, order still created
    order = service.create_order(cart)

    assert order is not None
    # Email failure logged but not fatal
```

## Patterns by Language

### Python (ABC)

```python
from abc import ABC, abstractmethod

class Repository(ABC):
    @abstractmethod
    def save(self, entity) -> None:
        pass

    @abstractmethod
    def find(self, id: str):
        pass

class SqlRepository(Repository):
    def save(self, entity) -> None:
        # SQL implementation
        ...

    def find(self, id: str):
        # SQL implementation
        ...
```

### Python (Protocol)

```python
from typing import Protocol

class Repository(Protocol):
    def save(self, entity) -> None: ...
    def find(self, id: str): ...

# Any class with these methods works - no inheritance needed
class SqlRepository:
    def save(self, entity) -> None:
        ...

    def find(self, id: str):
        ...
```

### TypeScript

```typescript
interface PaymentGateway {
    charge(amount: number, card: Card): Promise<ChargeResult>;
    refund(chargeId: string): Promise<RefundResult>;
}

class StripeGateway implements PaymentGateway {
    async charge(amount: number, card: Card): Promise<ChargeResult> {
        // Stripe implementation
    }

    async refund(chargeId: string): Promise<RefundResult> {
        // Stripe implementation
    }
}
```

### Go

```go
type Storage interface {
    Save(key string, data []byte) error
    Load(key string) ([]byte, error)
}

type S3Storage struct {
    bucket string
}

func (s *S3Storage) Save(key string, data []byte) error {
    // S3 implementation
}

func (s *S3Storage) Load(key string) ([]byte, error) {
    // S3 implementation
}
```

## Interface Segregation

**Bad**: Fat interface

```python
class UserService(ABC):
    @abstractmethod
    def create(self, user): pass
    @abstractmethod
    def update(self, user): pass
    @abstractmethod
    def delete(self, id): pass
    @abstractmethod
    def find(self, id): pass
    @abstractmethod
    def search(self, query): pass
    @abstractmethod
    def authenticate(self, creds): pass
    @abstractmethod
    def send_reset_email(self, email): pass
```

**Good**: Segregated interfaces

```python
class UserRepository(ABC):
    @abstractmethod
    def save(self, user): pass
    @abstractmethod
    def find(self, id): pass
    @abstractmethod
    def search(self, query): pass

class Authenticator(ABC):
    @abstractmethod
    def authenticate(self, creds): pass

class PasswordResetter(ABC):
    @abstractmethod
    def send_reset_email(self, email): pass
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Interface too big | Hard to mock | Segregate |
| Interface mirrors implementation | Leaky abstraction | Define by consumer need |
| No interface for internal classes | Over-engineering | Only abstract boundaries |
| Abstract methods have implementations | Defeats purpose | Use interface properly |

## When NOT to Extract Interface

- Pure data classes (DTOs, models)
- Utility functions
- Internal implementation details
- One-off code never tested in isolation
