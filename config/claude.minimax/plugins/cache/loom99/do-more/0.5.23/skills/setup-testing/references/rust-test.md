# Rust Testing Setup

Rust has built-in testing - no framework installation needed.

## Test Module (In-File)

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
    #[should_panic(expected = "overflow")]
    fn test_panic() {
        // Test expected panics
    }
}
```

## Integration Tests (tests/ directory)

```
project/
├── src/
│   └── lib.rs
├── tests/
│   └── integration_test.rs  # Integration tests
└── Cargo.toml
```

```rust
// tests/integration_test.rs
use myproject::add;

#[test]
fn test_integration() {
    assert_eq!(add(1, 2), 3);
}
```

## Running Tests

```bash
cargo test                 # All tests
cargo test test_name       # Specific test
cargo test -- --nocapture  # Show println! output
cargo test -- --ignored    # Run ignored tests
```

## Common Assertions

```rust
assert!(condition);
assert_eq!(left, right);
assert_ne!(left, right);
assert!(result.is_ok());
assert!(result.is_err());
```
