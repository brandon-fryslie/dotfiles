# Rust Testing Reference

## Built-in Testing

Rust has testing built into the language. No external framework required for basics.

```bash
# Run all tests
cargo test

# With output
cargo test -- --nocapture

# Specific test
cargo test test_name
```

## Test File Patterns

```bash
# Inline tests (same file)
grep -rn "#\[cfg(test)\]" src/

# Integration tests
ls tests/*.rs 2>/dev/null
```

**Convention**:
- Unit tests: `mod tests { }` block at bottom of source file
- Integration tests: `tests/` directory at crate root

## Coverage Tools

### cargo-tarpaulin

```bash
# Install
cargo install cargo-tarpaulin

# Run with coverage
cargo tarpaulin

# HTML output
cargo tarpaulin --out Html

# With threshold
cargo tarpaulin --fail-under 80
```

### cargo-llvm-cov (Modern)

```bash
# Install
cargo install cargo-llvm-cov

# Run
cargo llvm-cov

# HTML report
cargo llvm-cov --html
```

## Test Categories

### Unit Tests (Inline)

```rust
// src/lib.rs
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(1, 2), 3);
    }

    #[test]
    fn test_add_negative() {
        assert_eq!(add(-1, -2), -3);
    }
}
```

### Integration Tests

```rust
// tests/integration_test.rs
use mycrate::add;

#[test]
fn test_full_workflow() {
    let result = add(1, 2);
    assert_eq!(result, 3);
}
```

### Ignored Tests (Slow/Integration)

```rust
#[test]
#[ignore]
fn expensive_test() {
    // Long-running test
}
```

**Run:**
```bash
cargo test              # Skip ignored
cargo test -- --ignored # Run only ignored
cargo test -- --include-ignored # Run all
```

## Common Patterns to Audit

### Result-Based Testing

```rust
#[test]
fn test_parse() -> Result<(), Box<dyn std::error::Error>> {
    let result = parse("input")?;
    assert_eq!(result, expected);
    Ok(())
}
```

### Panic Testing

```rust
#[test]
#[should_panic(expected = "division by zero")]
fn test_divide_by_zero() {
    divide(1, 0);
}
```

### Parameterized Tests (test-case crate)

```rust
use test_case::test_case;

#[test_case(1, 2, 3 ; "positive numbers")]
#[test_case(-1, -2, -3 ; "negative numbers")]
#[test_case(0, 0, 0 ; "zeros")]
fn test_add(a: i32, b: i32, expected: i32) {
    assert_eq!(add(a, b), expected);
}
```

### Mock Frameworks

**mockall** (popular):
```rust
use mockall::automock;

#[automock]
trait Database {
    fn get(&self, id: u32) -> Option<String>;
}

#[test]
fn test_with_mock() {
    let mut mock = MockDatabase::new();
    mock.expect_get()
        .with(eq(1))
        .returning(|_| Some("test".to_string()));

    let result = service_using_db(&mock);
    assert!(result.is_ok());
}
```

## Async Testing

### tokio::test

```rust
#[tokio::test]
async fn test_async_operation() {
    let result = async_fetch().await;
    assert!(result.is_ok());
}
```

### async-std

```rust
#[async_std::test]
async fn test_async_std() {
    let result = fetch().await;
    assert_eq!(result, expected);
}
```

## Quality Checks

### Find Tests Without Assertions
```bash
grep -A 10 "#\[test\]" src/**/*.rs | grep -L "assert"
```

### Find Ignored Tests
```bash
grep -rn "#\[ignore\]" src/ tests/
```

### Clippy Lints for Tests
```bash
cargo clippy --tests
```

### Doc Tests

```rust
/// Adds two numbers
///
/// # Examples
///
/// ```
/// let result = mycrate::add(1, 2);
/// assert_eq!(result, 3);
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

**Run doc tests:**
```bash
cargo test --doc
```

## CI Configuration

### GitHub Actions
```yaml
- name: Test
  run: |
    cargo test --all-features
    cargo tarpaulin --fail-under 80
```

### Cargo.toml Test Config
```toml
[profile.test]
opt-level = 0

[dev-dependencies]
mockall = "0.11"
tokio = { version = "1", features = ["test-util"] }
```

## Directory Convention

```
mycrate/
├── src/
│   ├── lib.rs          # Unit tests at bottom
│   └── auth/
│       ├── mod.rs
│       └── login.rs    # #[cfg(test)] mod tests
├── tests/              # Integration tests
│   ├── common/         # Shared test utilities
│   │   └── mod.rs
│   ├── api_test.rs
│   └── db_test.rs
└── benches/            # Benchmarks
    └── bench.rs
```

## Benchmarking

```rust
// benches/bench.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn benchmark_parse(c: &mut Criterion) {
    c.bench_function("parse", |b| b.iter(|| parse(input)));
}

criterion_group!(benches, benchmark_parse);
criterion_main!(benches);
```

**Run:**
```bash
cargo bench
```
