# Seam Creation for Legacy Code

How to add testability to code without interfaces or dependency injection.

## What is a Seam?

A seam is a place where you can alter behavior without editing the source code.

> "A seam is a place where you can alter behavior in your program without editing in that place." - Michael Feathers, Working Effectively with Legacy Code

## Types of Seams

### 1. Object Seam

Replace behavior by subclassing:

```python
# Original (untestable)
class OrderProcessor:
    def process(self, order):
        # ... processing logic ...
        self._send_email(order)

    def _send_email(self, order):
        smtp = smtplib.SMTP('smtp.company.com')
        smtp.send(compose_email(order))
```

**Create seam by making method overridable**:

```python
# Testable with seam
class OrderProcessor:
    def process(self, order):
        # ... processing logic ...
        self._send_email(order)

    def _send_email(self, order):
        smtp = smtplib.SMTP('smtp.company.com')
        smtp.send(compose_email(order))

# Test subclass
class TestableOrderProcessor(OrderProcessor):
    def __init__(self):
        self.emails_sent = []

    def _send_email(self, order):
        self.emails_sent.append(order)

# Test
def test_order_sends_email():
    processor = TestableOrderProcessor()
    processor.process(order)
    assert len(processor.emails_sent) == 1
```

### 2. Link Seam

Replace behavior at link/import time:

```python
# Original
import requests

def fetch_user(id):
    response = requests.get(f"https://api.com/users/{id}")
    return response.json()
```

**Create seam with module replacement**:

```python
# Test with mocked import
from unittest.mock import patch

def test_fetch_user():
    with patch('mymodule.requests.get') as mock_get:
        mock_get.return_value.json.return_value = {"id": 1, "name": "Alice"}

        user = fetch_user(1)

        assert user["name"] == "Alice"
```

### 3. Preprocessor Seam

Replace behavior at compile/preprocessing time (C/C++):

```c
// Original
void log_message(const char* msg) {
    fprintf(stderr, "%s\n", msg);
}

// With seam
#ifdef TESTING
#define LOG(msg) test_log(msg)
#else
#define LOG(msg) fprintf(stderr, "%s\n", msg)
#endif
```

## Seam Creation Patterns

### Pattern 1: Extract Method

Create a seam by extracting behavior to a method:

**Before**:
```python
class ReportGenerator:
    def generate(self):
        data = self._fetch_data()
        # ... 50 lines of processing ...
        timestamp = datetime.now()  # Hard to test!
        report = f"Generated at {timestamp}: {data}"
        return report
```

**After**:
```python
class ReportGenerator:
    def generate(self):
        data = self._fetch_data()
        # ... 50 lines of processing ...
        timestamp = self._get_timestamp()  # Seam!
        report = f"Generated at {timestamp}: {data}"
        return report

    def _get_timestamp(self):
        return datetime.now()

# Test
class TestableReportGenerator(ReportGenerator):
    def _get_timestamp(self):
        return datetime(2024, 1, 1, 12, 0, 0)
```

### Pattern 2: Introduce Instance Variable

Convert hard-coded value to configurable:

**Before**:
```python
class RateLimiter:
    def check(self, user):
        current_time = time.time()  # Hard to test!
        # ... rate limiting logic ...
```

**After**:
```python
class RateLimiter:
    def __init__(self, clock=None):
        self._clock = clock or time.time

    def check(self, user):
        current_time = self._clock()
        # ... rate limiting logic ...

# Test
def test_rate_limiting():
    fake_time = [1000]
    limiter = RateLimiter(clock=lambda: fake_time[0])

    limiter.check(user)  # First request at 1000

    fake_time[0] = 1001  # Advance time
    limiter.check(user)  # Should be rate limited
```

### Pattern 3: Wrap and Delegate

Wrap problematic code without modifying it:

**Before**:
```python
# Third-party code you can't modify
from vendor import LegacyPaymentProcessor

class OrderService:
    def checkout(self, order):
        processor = LegacyPaymentProcessor()
        processor.charge(order.total)
```

**After**:
```python
class PaymentWrapper:
    def __init__(self, processor=None):
        self._processor = processor or LegacyPaymentProcessor()

    def charge(self, amount):
        return self._processor.charge(amount)

class OrderService:
    def __init__(self, payment: PaymentWrapper = None):
        self._payment = payment or PaymentWrapper()

    def checkout(self, order):
        self._payment.charge(order.total)

# Test
def test_checkout():
    mock_payment = Mock(spec=PaymentWrapper)
    service = OrderService(payment=mock_payment)

    service.checkout(order)

    mock_payment.charge.assert_called_with(order.total)
```

### Pattern 4: Parameterize Constructor

Add dependencies as constructor parameters:

**Before**:
```python
class UserNotifier:
    def notify(self, user, message):
        sms = TwilioClient()
        sms.send(user.phone, message)
```

**After**:
```python
class UserNotifier:
    def __init__(self, sms_client=None):
        self._sms = sms_client or TwilioClient()

    def notify(self, user, message):
        self._sms.send(user.phone, message)
```

### Pattern 5: Sprout Method

Add new functionality via new method:

**Before** (complex method with untested new requirement):
```python
def process_payment(self, payment):
    # ... 100 lines of legacy code ...
    # NEW: Need to add fraud check
    # But can't safely modify this method
```

**After**:
```python
def process_payment(self, payment):
    # ... 100 lines of legacy code ...
    self._check_fraud(payment)  # New seam!

def _check_fraud(self, payment):
    # New testable code
    if payment.amount > 10000:
        self._flag_for_review(payment)
```

## When to Use Seams

| Situation | Approach |
|-----------|----------|
| Can't modify class | Subclass and override |
| External library | Wrap and delegate |
| Hard-coded dependency | Parameterize constructor |
| Complex method | Extract method |
| New functionality needed | Sprout method |

## Seams vs Proper DI

| Seams | Dependency Injection |
|-------|---------------------|
| Quick fix | Proper design |
| Minimal change | Requires refactoring |
| Works with legacy | Works with new code |
| May be fragile | More robust |
| Good first step | End goal |

**Recommendation**: Use seams to get tests in place, then refactor to proper DI.

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Too many seams | Complex inheritance | Refactor to DI |
| Seam in wrong place | Still can't test | Find the real dependency |
| Seam changes behavior | Production affected | Keep seam minimal |
| Forgot to use seam | Tests use real impl | Double-check test setup |
