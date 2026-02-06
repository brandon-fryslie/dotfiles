# Go Testing Reference

## Built-in Testing

Go has testing built into the standard library. No external framework required.

```bash
# Run all tests
go test ./...

# With verbose output
go test -v ./...

# Specific package
go test ./pkg/auth/...
```

## Test File Patterns

```bash
# Go convention: *_test.go in same package
find . -name "*_test.go" | head -30
```

**Convention**: Test file `foo_test.go` lives next to `foo.go`

## Coverage Tools

### Built-in Coverage

```bash
# Generate coverage
go test -cover ./...

# With profile
go test -coverprofile=coverage.out ./...

# HTML report
go tool cover -html=coverage.out

# Function-level coverage
go tool cover -func=coverage.out
```

**Output interpretation:**
```
ok      myapp/auth      0.015s  coverage: 85.0% of statements
```

### Coverage Threshold in CI

```bash
# Check minimum coverage
go test -coverprofile=coverage.out ./...
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | tr -d '%')
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "Coverage $COVERAGE% below threshold"
  exit 1
fi
```

## Test Categories

### Unit Tests (Default)

```go
func TestParseInput(t *testing.T) {
    result := ParseInput("test")
    if result != "expected" {
        t.Errorf("got %s, want expected", result)
    }
}
```

### Table-Driven Tests (Idiomatic)

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := Add(tt.a, tt.b); got != tt.expected {
                t.Errorf("Add(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.expected)
            }
        })
    }
}
```

### Integration Tests (Build Tags)

```go
//go:build integration

package db_test

func TestDatabaseConnection(t *testing.T) {
    // Real database test
}
```

**Run:**
```bash
go test -tags=integration ./...
```

### Short Mode

```go
func TestSlowOperation(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping slow test in short mode")
    }
    // Slow test
}
```

**Run:**
```bash
go test -short ./...  # Skip slow tests
```

## Common Patterns to Audit

### Testify (Popular Assertion Library)

```go
import "github.com/stretchr/testify/assert"

func TestUser(t *testing.T) {
    user := GetUser(1)
    assert.NotNil(t, user)
    assert.Equal(t, "Alice", user.Name)
}
```

### Mock Generation

```bash
# mockgen (official)
go install github.com/golang/mock/mockgen@latest
mockgen -source=service.go -destination=mock_service.go

# mockery (popular alternative)
go install github.com/vektra/mockery/v2@latest
mockery --name=Service
```

### Interface-Based Testing

```go
// Define interface for testability
type UserStore interface {
    GetUser(id int) (*User, error)
}

// Production implementation
type DBUserStore struct { db *sql.DB }

// Test implementation
type MockUserStore struct { users map[int]*User }

func TestService(t *testing.T) {
    store := &MockUserStore{users: map[int]*User{1: {Name: "Test"}}}
    svc := NewService(store)
    // Test with mock
}
```

## E2E Testing

### HTTP Testing

```go
import (
    "net/http/httptest"
    "testing"
)

func TestAPIEndpoint(t *testing.T) {
    srv := httptest.NewServer(handler)
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/users")
    if err != nil {
        t.Fatal(err)
    }
    if resp.StatusCode != 200 {
        t.Errorf("status = %d, want 200", resp.StatusCode)
    }
}
```

### Database Integration

```go
func TestDatabase(t *testing.T) {
    db := setupTestDB(t)
    t.Cleanup(func() { db.Close() })

    // Insert test data
    _, err := db.Exec("INSERT INTO users (name) VALUES (?)", "Test")
    if err != nil {
        t.Fatal(err)
    }

    // Verify
    var name string
    err = db.QueryRow("SELECT name FROM users WHERE name = ?", "Test").Scan(&name)
    if err != nil {
        t.Fatal(err)
    }
}
```

## Quality Checks

### Find Tests Without Assertions
```bash
# Tests that only call functions without checking results
grep -L "t.Error\|t.Fatal\|assert\|require" *_test.go
```

### Find Skipped Tests
```bash
grep -rn "t.Skip" *_test.go
```

### Race Detection
```bash
go test -race ./...
```

### Benchmark Tests
```go
func BenchmarkParse(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Parse(input)
    }
}
```

**Run:**
```bash
go test -bench=. ./...
```

## CI Configuration

### GitHub Actions
```yaml
- name: Test
  run: |
    go test -race -coverprofile=coverage.out ./...
    go tool cover -func=coverage.out
```

### Makefile Pattern
```makefile
test:
	go test -v ./...

test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

test-integration:
	go test -tags=integration -v ./...
```

## Directory Convention

```
myapp/
├── auth/
│   ├── login.go
│   └── login_test.go    # Same package
├── db/
│   ├── store.go
│   └── store_test.go
└── integration_test/    # Or use build tags
    └── full_test.go
```
