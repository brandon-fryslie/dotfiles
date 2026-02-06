# Remove Global State for Testability

How to refactor away singletons, global variables, and shared mutable state.

## The Problem

```python
# UNTESTABLE: Global state
_current_user = None

def login(username, password):
    global _current_user
    _current_user = authenticate(username, password)

def get_orders():
    global _current_user
    if _current_user is None:
        raise AuthError("Not logged in")
    return fetch_orders(_current_user.id)
```

**Why untestable?**
- Tests affect each other (state bleeds)
- Must reset state between tests
- Can't run tests in parallel
- Order of tests matters (flaky)

## Types of Global State

### 1. Module-Level Variables

```python
# Module state
_cache = {}
_config = None
_db_connection = None
```

### 2. Singletons

```python
class DatabaseConnection:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls._connect()
        return cls._instance
```

### 3. Class Variables

```python
class UserService:
    _active_sessions = {}  # Shared across all instances

    def login(self, user):
        UserService._active_sessions[user.id] = session
```

### 4. Environment State

```python
def get_config():
    return os.environ["CONFIG"]  # Different in tests vs prod
```

## Refactoring Strategies

### Strategy 1: Explicit Parameter Passing

**Before**:
```python
_db = None

def set_db(connection):
    global _db
    _db = connection

def get_user(id):
    return _db.query(f"SELECT * FROM users WHERE id = {id}")
```

**After**:
```python
def get_user(db, id):
    return db.query(f"SELECT * FROM users WHERE id = {id}")

# Test
def test_get_user():
    mock_db = MockDatabase()
    mock_db.add_user(User(id=1, name="Alice"))
    user = get_user(mock_db, 1)
    assert user.name == "Alice"
```

### Strategy 2: Context Object

**Before**:
```python
_current_user = None
_current_tenant = None

def get_current_user():
    return _current_user
```

**After**:
```python
@dataclass
class RequestContext:
    user: User
    tenant: Tenant
    request_id: str

def get_orders(ctx: RequestContext):
    return fetch_orders(ctx.user.id, ctx.tenant.id)

# Test
def test_get_orders():
    ctx = RequestContext(
        user=User(id=1),
        tenant=Tenant(id=1),
        request_id="test"
    )
    orders = get_orders(ctx)
```

### Strategy 3: Dependency Injection Container

**Before**:
```python
class OrderService:
    def process(self, order):
        db = DatabaseConnection.get_instance()
        email = EmailClient.get_instance()
        # ...
```

**After**:
```python
class OrderService:
    def __init__(self, db: Database, email: EmailClient):
        self.db = db
        self.email = email

# Wire up in composition root
container.register(Database, PostgresDatabase)
container.register(EmailClient, SmtpEmailClient)
```

### Strategy 4: Request-Scoped State

**Before**:
```python
_request_cache = {}

def get_cached(key):
    return _request_cache.get(key)
```

**After**:
```python
class RequestCache:
    def __init__(self):
        self._cache = {}

    def get(self, key):
        return self._cache.get(key)

    def set(self, key, value):
        self._cache[key] = value

# Each request gets its own instance
@app.middleware
def add_cache(request, call_next):
    request.state.cache = RequestCache()
    return call_next(request)
```

### Strategy 5: Factory Pattern

**Before**:
```python
class Logger:
    _instance = None

    @classmethod
    def get_logger(cls):
        if cls._instance is None:
            cls._instance = cls._create_logger()
        return cls._instance
```

**After**:
```python
class LoggerFactory:
    def __init__(self, config: LogConfig):
        self.config = config

    def create(self, name: str) -> Logger:
        return Logger(name, self.config)

# In tests
factory = LoggerFactory(test_config)
logger = factory.create("test")
```

## Patterns by Language

### Python

```python
# Use contextvars for request-scoped state
from contextvars import ContextVar

current_user: ContextVar[User] = ContextVar('current_user')

def set_user(user: User):
    current_user.set(user)

def get_user() -> User:
    return current_user.get()

# Automatically scoped to async context
```

### TypeScript

```typescript
// Use AsyncLocalStorage for request-scoped state
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
    user: User;
    requestId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

function withContext(ctx: RequestContext, fn: () => void) {
    asyncLocalStorage.run(ctx, fn);
}

function getContext(): RequestContext {
    return asyncLocalStorage.getStore()!;
}
```

### Go

```go
// Use context.Context for request-scoped values
type contextKey string

const userKey contextKey = "user"

func WithUser(ctx context.Context, user *User) context.Context {
    return context.WithValue(ctx, userKey, user)
}

func GetUser(ctx context.Context) *User {
    return ctx.Value(userKey).(*User)
}

// All functions take ctx as first parameter
func GetOrders(ctx context.Context) ([]Order, error) {
    user := GetUser(ctx)
    // ...
}
```

## Migration Steps

### Step 1: Identify All Global State

```bash
# Find module-level assignments
grep -rn "^[a-z_]* = " --include="*.py" | grep -v "def\|class"

# Find singleton patterns
grep -rn "_instance" --include="*.py"

# Find global keywords
grep -rn "global " --include="*.py"
```

### Step 2: Create Context/Container

```python
@dataclass
class AppContext:
    db: Database
    cache: Cache
    email: EmailClient
    config: Config
    logger: Logger
```

### Step 3: Thread Context Through

```python
# Add context to function signatures
def process_order(ctx: AppContext, order: Order):
    ctx.db.save(order)
    ctx.email.send_confirmation(order)

# Or use context var
app_context: ContextVar[AppContext] = ContextVar('app_context')
```

### Step 4: Update Tests

```python
@pytest.fixture
def app_context():
    return AppContext(
        db=MockDatabase(),
        cache=MockCache(),
        email=MockEmailClient(),
        config=TestConfig(),
        logger=MockLogger()
    )

def test_process_order(app_context):
    process_order(app_context, order)
    assert app_context.db.saved[-1] == order
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Replacing with "test globals" | Still global | Use DI or context |
| Resetting in setUp | Fragile, order-dependent | Isolate completely |
| Thread-local as solution | Still shared in tests | Use request scope |
| Partial refactoring | Some paths still global | Complete the migration |
