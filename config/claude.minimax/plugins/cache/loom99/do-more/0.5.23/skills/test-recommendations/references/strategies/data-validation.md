# Data Validation Testing Strategy

When to use: Data pipelines, ETL systems, data transformations, schema evolution, data quality systems.

## The Challenge

Data pipelines fail silently:

```
Source → Transform → Load → Warehouse
  ↓          ↓         ↓        ↓
 OK?       OK?       OK?     ??? (data is wrong)
```

Tests pass, but data is corrupted, incomplete, or wrong.

## Testing Layers

### Layer 1: Schema Validation

Test that data conforms to expected schema.

```python
from pydantic import BaseModel, validator

class UserEvent(BaseModel):
    user_id: str
    event_type: str
    timestamp: datetime
    metadata: dict

    @validator('event_type')
    def valid_event_type(cls, v):
        valid_types = ['click', 'view', 'purchase']
        if v not in valid_types:
            raise ValueError(f'Invalid event type: {v}')
        return v

def test_schema_validation():
    # Valid
    UserEvent(user_id="123", event_type="click", ...)

    # Invalid - should raise
    with pytest.raises(ValueError):
        UserEvent(user_id="123", event_type="invalid", ...)
```

### Layer 2: Transformation Logic

Test individual transformations in isolation.

```python
def test_normalize_currency():
    raw = {"amount": 100, "currency": "EUR"}
    result = normalize_to_usd(raw, exchange_rate=1.1)
    assert result["amount_usd"] == 110.0
    assert result["original_currency"] == "EUR"

def test_handle_missing_fields():
    raw = {"amount": 100}  # No currency
    result = normalize_to_usd(raw)
    assert result["amount_usd"] == 100.0  # Default to USD
    assert result["original_currency"] == "USD"
```

### Layer 3: Data Quality Assertions

Test data quality expectations.

```python
import great_expectations as ge

def test_user_data_quality():
    df = ge.read_csv("users.csv")

    # No nulls in required columns
    assert df.expect_column_values_to_not_be_null("user_id").success
    assert df.expect_column_values_to_not_be_null("email").success

    # Valid email format
    assert df.expect_column_values_to_match_regex(
        "email", r"^[^@]+@[^@]+\.[^@]+$"
    ).success

    # Reasonable age range
    assert df.expect_column_values_to_be_between(
        "age", min_value=0, max_value=150
    ).success

    # No duplicate IDs
    assert df.expect_column_values_to_be_unique("user_id").success
```

### Layer 4: End-to-End Pipeline

Test full pipeline with known inputs/outputs.

```python
def test_full_pipeline():
    # Known input
    input_data = [
        {"user": "A", "amount": 100},
        {"user": "B", "amount": 200},
    ]

    # Run pipeline
    result = pipeline.run(input_data)

    # Known expected output
    assert result.total_users == 2
    assert result.total_amount == 300
    assert result.avg_amount == 150
```

## Critical Test Scenarios

### Schema Evolution

```python
def test_backwards_compatibility():
    # Old schema (version 1)
    old_record = {"user_id": "123", "name": "Alice"}

    # New schema (version 2) with additional field
    # Should handle missing field
    processor = UserProcessor(schema_version=2)
    result = processor.process(old_record)

    assert result.user_id == "123"
    assert result.name == "Alice"
    assert result.email is None  # New field, default to None

def test_forwards_compatibility():
    # New schema with extra fields
    new_record = {"user_id": "123", "name": "Alice", "new_field": "value"}

    # Old processor should ignore unknown fields
    processor = UserProcessor(schema_version=1)
    result = processor.process(new_record)

    assert result.user_id == "123"
    assert not hasattr(result, "new_field")
```

### Idempotency

```python
def test_pipeline_idempotent():
    input_data = [{"id": "1", "value": 100}]

    # Run twice
    pipeline.run(input_data)
    pipeline.run(input_data)

    # Should only have one record
    result = warehouse.query("SELECT * FROM table")
    assert len(result) == 1
```

### Data Lineage

```python
def test_lineage_tracking():
    input_record = {"id": "123", "value": 100}

    result = transform(input_record)

    # Lineage should be trackable
    assert result._source == "input_table"
    assert result._transformation == "normalize"
    assert result._timestamp is not None
```

### Null Handling

```python
@pytest.mark.parametrize("field,input,expected", [
    ("amount", None, 0.0),
    ("amount", "", 0.0),
    ("name", None, "Unknown"),
    ("timestamp", None, raises(ValueError)),
])
def test_null_handling(field, input, expected):
    record = {field: input}
    if expected == raises(ValueError):
        with pytest.raises(ValueError):
            transform(record)
    else:
        result = transform(record)
        assert result[field] == expected
```

### Late Arriving Data

```python
def test_late_data_handling():
    # Data arrives after window closes
    old_event = Event(
        timestamp=datetime.now() - timedelta(days=2),
        value=100
    )

    # Should still be processed
    result = pipeline.process(old_event)

    assert result.status == "processed"
    assert result.is_late == True
```

## Testing Tools

| Tool | Purpose |
|------|---------|
| Great Expectations | Data quality assertions |
| dbt tests | SQL-based data tests |
| Pydantic | Schema validation |
| Pandera | DataFrame validation |
| pytest-spark | Spark testing |
| testcontainers | Database containers |

## Recommendation Patterns

### For Data Pipeline Gaps

| Gap | Recommendation |
|-----|----------------|
| No schema tests | Add Pydantic/Avro schema validation |
| No quality checks | Add Great Expectations suite |
| No null handling | Add parametrized null tests |
| No idempotency | Add duplicate detection tests |
| No lineage tests | Track and test data provenance |

### Test Coverage Matrix

```markdown
| Pipeline Stage | Schema | Logic | Quality | E2E |
|----------------|--------|-------|---------|-----|
| Extract        | ✅     | N/A   | ❌      | ❌  |
| Transform      | ✅     | ⚠️    | ❌      | ❌  |
| Load           | ❌     | ❌    | ❌      | ❌  |
```

## Quality Dimensions

Test each of these:

| Dimension | What to Test |
|-----------|--------------|
| Completeness | No missing required data |
| Uniqueness | No duplicates where not expected |
| Validity | Values within expected ranges |
| Consistency | Related data matches |
| Timeliness | Data arrives within SLA |
| Accuracy | Values are correct (vs source of truth) |

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Testing only happy path | Edge cases corrupt data | Test nulls, empties, invalids |
| No production validation | Test env differs | Run quality checks in prod |
| Ignoring late data | Data loss | Test late arrival handling |
| Static test data | Misses real patterns | Use property-based testing |
