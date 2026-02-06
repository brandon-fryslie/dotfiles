# Pure Function Extraction

How to extract testable pure functions from code with side effects.

## What is a Pure Function?

A pure function:
1. **Deterministic**: Same inputs always produce same outputs
2. **No side effects**: Doesn't modify external state

```python
# PURE: No side effects, deterministic
def add(a, b):
    return a + b

# IMPURE: Side effect (I/O)
def log_add(a, b):
    print(f"Adding {a} + {b}")  # Side effect!
    return a + b

# IMPURE: Non-deterministic
def random_add(a, b):
    return a + b + random.random()  # Different each time!
```

## Why Pure Functions are Testable

```python
# Pure function - trivial to test
def calculate_tax(amount, rate):
    return amount * rate

def test_calculate_tax():
    assert calculate_tax(100, 0.1) == 10
    assert calculate_tax(0, 0.1) == 0
    assert calculate_tax(100, 0) == 0

# Impure function - hard to test
def calculate_and_store_tax(order):
    tax = order.amount * get_tax_rate()  # External call
    db.save(order.id, tax)               # Side effect
    log(f"Calculated tax: {tax}")        # Side effect
    return tax
```

## The Impure Sandwich Pattern

Structure code as: **Impure → Pure → Impure**

```
┌─────────────────────────────┐
│  Impure: Gather inputs      │  ← I/O, read from DB/API
├─────────────────────────────┤
│  Pure: Process data         │  ← Business logic (testable!)
├─────────────────────────────┤
│  Impure: Handle outputs     │  ← I/O, write to DB/API
└─────────────────────────────┘
```

### Example Refactoring

**Before** (mixed impure/pure):
```python
def process_order(order_id):
    # Impure: Read
    order = db.get_order(order_id)
    customer = db.get_customer(order.customer_id)

    # Mixed impure and pure
    if customer.is_premium:
        discount = 0.1
    else:
        discount = 0

    if order.total > 100:
        discount += 0.05

    final_total = order.total * (1 - discount)

    # Impure: Write
    db.update_order(order_id, total=final_total)
    email_service.send_receipt(customer.email, final_total)

    return final_total
```

**After** (impure sandwich):
```python
# PURE: All business logic
def calculate_discount(is_premium: bool, order_total: float) -> float:
    discount = 0.1 if is_premium else 0
    if order_total > 100:
        discount += 0.05
    return discount

def calculate_final_total(order_total: float, discount: float) -> float:
    return order_total * (1 - discount)

# IMPURE: Orchestration
def process_order(order_id):
    # Impure: Gather
    order = db.get_order(order_id)
    customer = db.get_customer(order.customer_id)

    # Pure: Process
    discount = calculate_discount(customer.is_premium, order.total)
    final_total = calculate_final_total(order.total, discount)

    # Impure: Apply
    db.update_order(order_id, total=final_total)
    email_service.send_receipt(customer.email, final_total)

    return final_total
```

**Tests** (easy!):
```python
def test_premium_customer_discount():
    assert calculate_discount(is_premium=True, order_total=50) == 0.1

def test_large_order_discount():
    assert calculate_discount(is_premium=False, order_total=150) == 0.05

def test_premium_large_order_discount():
    assert calculate_discount(is_premium=True, order_total=150) == 0.15

def test_final_total_with_discount():
    assert calculate_final_total(100, 0.1) == 90
```

## Extraction Patterns

### Pattern 1: Extract Calculation

**Before**:
```python
def update_inventory(product_id, quantity_sold):
    product = db.get_product(product_id)
    new_quantity = product.quantity - quantity_sold
    if new_quantity < product.reorder_threshold:
        new_quantity = max(new_quantity, 0)
        needs_reorder = True
    else:
        needs_reorder = False
    db.update_product(product_id, quantity=new_quantity)
    if needs_reorder:
        order_service.create_reorder(product_id)
```

**After**:
```python
# Pure
def calculate_new_inventory(
    current_quantity: int,
    quantity_sold: int,
    reorder_threshold: int
) -> tuple[int, bool]:
    new_quantity = max(current_quantity - quantity_sold, 0)
    needs_reorder = new_quantity < reorder_threshold
    return new_quantity, needs_reorder

# Impure orchestration
def update_inventory(product_id, quantity_sold):
    product = db.get_product(product_id)
    new_quantity, needs_reorder = calculate_new_inventory(
        product.quantity, quantity_sold, product.reorder_threshold
    )
    db.update_product(product_id, quantity=new_quantity)
    if needs_reorder:
        order_service.create_reorder(product_id)
```

### Pattern 2: Extract Validation

**Before**:
```python
def create_user(request):
    if len(request.email) < 5 or '@' not in request.email:
        raise ValidationError("Invalid email")
    if len(request.password) < 8:
        raise ValidationError("Password too short")
    if request.age < 13:
        raise ValidationError("Must be 13 or older")

    user = User(
        email=request.email,
        password=hash(request.password),
        age=request.age
    )
    db.save(user)
    return user
```

**After**:
```python
# Pure
def validate_user_request(email: str, password: str, age: int) -> list[str]:
    errors = []
    if len(email) < 5 or '@' not in email:
        errors.append("Invalid email")
    if len(password) < 8:
        errors.append("Password too short")
    if age < 13:
        errors.append("Must be 13 or older")
    return errors

# Impure
def create_user(request):
    errors = validate_user_request(
        request.email, request.password, request.age
    )
    if errors:
        raise ValidationError(errors)

    user = User(
        email=request.email,
        password=hash(request.password),
        age=request.age
    )
    db.save(user)
    return user
```

### Pattern 3: Extract Transformation

**Before**:
```python
def process_csv(file_path):
    data = []
    with open(file_path) as f:
        reader = csv.reader(f)
        for row in reader:
            # Transform
            if len(row) >= 3:
                data.append({
                    'name': row[0].strip().title(),
                    'email': row[1].strip().lower(),
                    'age': int(row[2]) if row[2].isdigit() else None
                })
    db.bulk_insert(data)
```

**After**:
```python
# Pure
def transform_row(row: list[str]) -> dict | None:
    if len(row) < 3:
        return None
    return {
        'name': row[0].strip().title(),
        'email': row[1].strip().lower(),
        'age': int(row[2]) if row[2].isdigit() else None
    }

def transform_rows(rows: list[list[str]]) -> list[dict]:
    return [r for row in rows if (r := transform_row(row)) is not None]

# Impure
def process_csv(file_path):
    with open(file_path) as f:
        rows = list(csv.reader(f))
    data = transform_rows(rows)
    db.bulk_insert(data)
```

## Identifying Impure Code

| Signal | Type |
|--------|------|
| `print()`, `log()` | I/O |
| `db.query()`, `db.save()` | I/O |
| `requests.get()` | I/O |
| `datetime.now()` | Non-deterministic |
| `random.random()` | Non-deterministic |
| `self.field = x` (in method) | Mutation |
| `list.append()` | Mutation |

## Benefits Summary

| Aspect | Impure Code | Pure Functions |
|--------|-------------|----------------|
| Testing | Requires mocks | Simple assertions |
| Debugging | State tracking | Input/output only |
| Parallelization | Race conditions | Thread-safe |
| Reuse | Context-dependent | Context-free |
| Understanding | Follow state changes | Follow data flow |
