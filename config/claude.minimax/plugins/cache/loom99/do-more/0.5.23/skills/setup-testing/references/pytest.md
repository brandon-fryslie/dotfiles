# pytest Setup

Python's most popular testing framework.

## Installation

```bash
uv add --dev pytest pytest-cov
# or
pip install pytest pytest-cov
```

## Configuration (pyproject.toml)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-v --tb=short"

[tool.coverage.run]
source = ["src"]
omit = ["tests/*"]
```

## Directory Structure

```
project/
├── src/
│   └── mymodule/
├── tests/
│   ├── __init__.py
│   ├── conftest.py      # Shared fixtures
│   └── test_mymodule.py
└── pyproject.toml
```

## Example Test

```python
import pytest
from mymodule import my_function

def test_my_function():
    result = my_function(1, 2)
    assert result == 3

@pytest.fixture
def sample_data():
    return {"key": "value"}

def test_with_fixture(sample_data):
    assert sample_data["key"] == "value"
```

## Running Tests

```bash
pytest                    # Run all tests
pytest tests/test_foo.py  # Run specific file
pytest -k "test_name"     # Run by name pattern
pytest --cov              # With coverage
```
