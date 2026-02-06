# Data Pipeline / ETL Testing Scenario

Testing batch processing, Airflow DAGs, Spark jobs, dbt models, and data transformations.

## Unique Challenges

Data pipelines have distinct testing requirements:
- **Stateful**: Output depends on input data state
- **Orchestrated**: DAGs have dependencies and scheduling
- **Large scale**: Can't always test with production-sized data
- **Schema-sensitive**: Breaking changes cascade downstream

## Testing Pyramid for Data Pipelines

```
         ╱╲
        ╱E2E╲          Full pipeline run, staging environment
       ╱──────╲
      ╱ Integ  ╲       DAG validation, cross-job dependencies
     ╱──────────╲
    ╱    Unit    ╲     Individual transformations, business logic
   ╱──────────────╲
```

| Level | What to Test | Data Used |
|-------|--------------|-----------|
| Unit | Transform functions, validators | Fixtures, small samples |
| Integration | DAG structure, job chaining | Test database |
| E2E | Full pipeline execution | Staging/subset of prod |

## Critical Test Areas

### 1. Transformation Logic

```python
# Unit test for transformation
def test_normalize_phone_number():
    assert normalize_phone("(555) 123-4567") == "+15551234567"
    assert normalize_phone("555.123.4567") == "+15551234567"
    assert normalize_phone("+1-555-123-4567") == "+15551234567"
    assert normalize_phone("invalid") is None

def test_calculate_revenue():
    orders = [
        {"qty": 2, "price": 10.00, "discount": 0.1},
        {"qty": 1, "price": 50.00, "discount": 0.0},
    ]
    # (2 * 10 * 0.9) + (1 * 50 * 1.0) = 18 + 50 = 68
    assert calculate_revenue(orders) == 68.00
```

### 2. Schema Validation

```python
from pydantic import BaseModel
from great_expectations import expect

class UserRecord(BaseModel):
    user_id: int
    email: str
    created_at: datetime

def test_schema_validation():
    valid = {"user_id": 1, "email": "a@b.com", "created_at": "2024-01-01T00:00:00Z"}
    UserRecord(**valid)  # Should not raise

def test_schema_rejects_invalid():
    invalid = {"user_id": "not_int", "email": "a@b.com"}
    with pytest.raises(ValidationError):
        UserRecord(**invalid)

# Great Expectations style
def test_data_quality():
    df = load_test_data()
    assert expect(df).column_values_to_be_unique("user_id")
    assert expect(df).column_values_to_not_be_null("email")
    assert expect(df).column_values_to_match_regex("email", r".*@.*\..*")
```

### 3. DAG Structure (Airflow)

```python
from airflow.models import DagBag

def test_dag_loads():
    dag_bag = DagBag(include_examples=False)
    assert len(dag_bag.import_errors) == 0
    assert "my_etl_dag" in dag_bag.dags

def test_dag_structure():
    dag = DagBag().get_dag("my_etl_dag")

    # Check expected tasks exist
    task_ids = [t.task_id for t in dag.tasks]
    assert "extract" in task_ids
    assert "transform" in task_ids
    assert "load" in task_ids

    # Check dependencies
    transform_task = dag.get_task("transform")
    upstream_ids = [t.task_id for t in transform_task.upstream_list]
    assert "extract" in upstream_ids

def test_dag_schedule():
    dag = DagBag().get_dag("my_etl_dag")
    assert dag.schedule_interval == "@daily"
    assert dag.catchup is False  # Don't backfill
```

### 4. Data Contracts

```python
# Test that output matches contract
def test_output_schema_contract():
    result = run_transform(test_input)

    # Required columns exist
    assert set(["user_id", "name", "total_orders"]).issubset(result.columns)

    # Types match contract
    assert result["user_id"].dtype == "int64"
    assert result["total_orders"].dtype == "float64"

    # No nulls in required fields
    assert result["user_id"].notna().all()
```

### 5. Idempotency

```python
def test_pipeline_is_idempotent():
    """Running twice should produce same result."""
    input_data = load_test_data()

    result1 = run_pipeline(input_data)
    result2 = run_pipeline(input_data)

    assert_frame_equal(result1, result2)

def test_rerun_doesnt_duplicate():
    """Re-running with same input doesn't create duplicates."""
    run_load(test_data, target_table="users")
    run_load(test_data, target_table="users")  # Same data again

    count = db.execute("SELECT COUNT(*) FROM users").scalar()
    assert count == len(test_data)  # Not doubled
```

### 6. Edge Cases

```python
def test_handles_empty_input():
    result = run_transform(pd.DataFrame())
    assert len(result) == 0
    assert list(result.columns) == expected_columns

def test_handles_null_values():
    data = pd.DataFrame({"value": [1, None, 3]})
    result = run_transform(data)
    # Nulls handled according to business rules
    assert result["value"].isna().sum() == 0  # Filled or filtered

def test_handles_duplicate_keys():
    data = pd.DataFrame({"id": [1, 1, 2], "value": [10, 20, 30]})
    result = run_transform(data)
    # Deduplication strategy applied
    assert len(result) == 2
```

### 7. Spark Job Testing

```python
from pyspark.sql import SparkSession
import pytest

@pytest.fixture(scope="session")
def spark():
    return SparkSession.builder \
        .master("local[2]") \
        .appName("test") \
        .getOrCreate()

def test_spark_transform(spark):
    input_df = spark.createDataFrame([
        (1, "alice", 100),
        (2, "bob", 200),
    ], ["id", "name", "amount"])

    result = my_transform(input_df)

    assert result.count() == 2
    assert "total" in result.columns
```

### 8. dbt Model Testing

```yaml
# schema.yml
models:
  - name: users
    columns:
      - name: user_id
        tests:
          - unique
          - not_null
      - name: email
        tests:
          - not_null
          - accepted_values:
              values: ['active', 'inactive', 'pending']

  - name: orders
    tests:
      - relationships:
          to: ref('users')
          field: user_id
```

```bash
# Run dbt tests
dbt test --select users orders
```

## Integration Testing

### Cross-Job Dependencies

```python
def test_downstream_receives_upstream_output():
    # Run extract
    extract_result = run_task("extract")

    # Verify transform can consume it
    transform_result = run_task("transform", input=extract_result)
    assert transform_result is not None

    # Verify load can consume transform output
    load_result = run_task("load", input=transform_result)
    assert load_result["rows_loaded"] > 0
```

### Database State

```python
@pytest.fixture
def test_db():
    """Create isolated test database."""
    engine = create_engine("postgresql://localhost/test_db")
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

def test_load_writes_to_db(test_db):
    run_load(test_data, engine=test_db)

    result = pd.read_sql("SELECT * FROM target_table", test_db)
    assert len(result) == len(test_data)
```

## E2E Testing

```python
def test_full_pipeline_staging():
    """Run full pipeline against staging environment."""
    # Trigger pipeline
    dag_run = trigger_dag("my_etl_dag", conf={"env": "staging"})

    # Wait for completion
    wait_for_dag_completion(dag_run, timeout=3600)

    # Verify results
    assert dag_run.state == "success"

    # Check data quality in target
    result = query_staging("SELECT COUNT(*) FROM target")
    assert result > 0
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] All transformation functions
- [ ] Schema validators
- [ ] Business logic calculations
- [ ] Edge cases (null, empty, duplicates)
- [ ] Error handling

### Integration Tests (Medium)
- [ ] DAG structure and dependencies
- [ ] Task execution order
- [ ] Database read/write operations
- [ ] Cross-job data flow

### E2E Tests (Few)
- [ ] Full pipeline in staging
- [ ] Data quality post-load
- [ ] Downstream consumers receive data

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing with production data | Slow, privacy issues | Use fixtures or anonymized samples |
| No schema tests | Breaking changes slip through | Schema validation at boundaries |
| Skipping idempotency tests | Duplicates on retry | Explicitly test re-run behavior |
| Only happy path | Edge cases cause prod failures | Test nulls, empties, duplicates |
| No DAG structure tests | Broken dependencies | Validate DAG before deploy |

## Tools

| Tool | Purpose |
|------|---------|
| Great Expectations | Data quality validation |
| dbt test | SQL model testing |
| pytest-spark | Spark job testing |
| Airflow test utilities | DAG validation |
| Datafold | Data diff testing |

## Test Structure

```
pipeline/
├── dags/
│   └── my_etl_dag.py
├── transforms/
│   ├── normalize.py
│   └── aggregate.py
├── tests/
│   ├── unit/
│   │   ├── test_normalize.py
│   │   └── test_aggregate.py
│   ├── integration/
│   │   ├── test_dag_structure.py
│   │   └── test_data_flow.py
│   ├── e2e/
│   │   └── test_full_pipeline.py
│   └── fixtures/
│       ├── sample_input.csv
│       └── expected_output.csv
└── expectations/
    └── users_suite.json
```
