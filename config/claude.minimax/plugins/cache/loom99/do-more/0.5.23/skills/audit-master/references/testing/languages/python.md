# Python Testing Reference

## Framework Detection

```bash
# Check for test frameworks
grep -r "pytest\|unittest\|nose" pyproject.toml setup.py requirements*.txt 2>/dev/null
```

| Framework | Indicator | Recommended |
|-----------|-----------|-------------|
| pytest | `pytest` in deps, `conftest.py` | ✅ Yes |
| unittest | `import unittest` | Legacy, migrate |
| nose | `nosetests` | Deprecated |

## Test File Patterns

```bash
# pytest convention
find . -name "test_*.py" -o -name "*_test.py" | head -30

# unittest convention
find . -path "*/tests/*.py" | head -30
```

## Coverage Tools

### pytest-cov (Recommended)

```bash
# Install
pip install pytest-cov

# Run with coverage
pytest --cov=src --cov-report=term-missing

# Generate HTML report
pytest --cov=src --cov-report=html
```

**Interpreting output:**
```
Name                    Stmts   Miss  Cover   Missing
-----------------------------------------------------
src/auth/login.py         50     10    80%   45-50, 62
```

### coverage.py (Direct)

```bash
coverage run -m pytest
coverage report
coverage html
```

## Test Categories by Framework

### pytest Markers

```python
# Mark tests by type
@pytest.mark.unit
def test_parse_input(): ...

@pytest.mark.integration
def test_database_write(): ...

@pytest.mark.e2e
def test_full_workflow(): ...
```

**Run by category:**
```bash
pytest -m unit          # Unit only
pytest -m integration   # Integration only
pytest -m "not e2e"     # Skip slow e2e
```

### Directory Convention

```
tests/
├── unit/           # Fast, isolated
├── integration/    # DB, services
├── e2e/            # Full system
└── conftest.py     # Shared fixtures
```

## Common Patterns to Audit

### Fixture Usage

**Good** - Reusable fixtures:
```python
@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
```

**Bad** - Setup in each test:
```python
def test_user():
    session = create_test_session()  # Repeated everywhere
```

### Mocking Patterns

**Good** - Targeted patching:
```python
@patch('myapp.auth.external_api.verify')
def test_auth(mock_verify):
    mock_verify.return_value = True
```

**Bad** - MagicMock for everything:
```python
def test_auth():
    mock = MagicMock()  # Accepts any attribute!
```

### Async Testing

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await async_operation()
    assert result is not None
```

**Requires**: `pytest-asyncio` package

## E2E Frameworks

| Framework | Use Case | Setup |
|-----------|----------|-------|
| playwright | Browser automation | `pip install playwright` |
| selenium | Browser (legacy) | `pip install selenium` |
| httpx | API testing | `pip install httpx` |
| requests | Simple API | `pip install requests` |

### Playwright Example

```python
from playwright.sync_api import sync_playwright

def test_login_page():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8000/login")
        page.fill("#email", "test@test.com")
        page.click("#submit")
        assert page.url == "http://localhost:8000/dashboard"
```

## Quality Checks

### Find Tautological Tests
```bash
grep -rn "assert True" tests/
grep -rn "assert 1 == 1" tests/
```

### Find Over-Mocked Tests
```bash
grep -rn "MagicMock()" tests/ | wc -l
grep -rn "create_autospec" tests/ | wc -l  # Better pattern
```

### Find Tests Without Assertions
```bash
# Tests that might not assert anything
grep -L "assert" tests/test_*.py
```

## CI Configuration

### GitHub Actions
```yaml
- name: Run tests
  run: |
    pytest --cov=src --cov-fail-under=80
```

### Coverage Thresholds
```toml
# pyproject.toml
[tool.coverage.report]
fail_under = 80
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
]
```
