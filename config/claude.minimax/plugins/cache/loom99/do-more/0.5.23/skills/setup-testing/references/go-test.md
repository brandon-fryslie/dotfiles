# Go Testing Setup

Go has built-in testing - no framework installation needed.

## Directory Structure

```
project/
├── mypackage/
│   ├── mypackage.go
│   └── mypackage_test.go  # Tests alongside source
└── go.mod
```

## Example Test

```go
package mypackage

import "testing"

func TestMyFunction(t *testing.T) {
    result := MyFunction(1, 2)
    if result != 3 {
        t.Errorf("Expected 3, got %d", result)
    }
}

func TestWithSubtests(t *testing.T) {
    tests := []struct {
        name     string
        input    int
        expected int
    }{
        {"positive", 1, 2},
        {"zero", 0, 1},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := MyFunction(tt.input); got != tt.expected {
                t.Errorf("MyFunction(%d) = %d, want %d", tt.input, got, tt.expected)
            }
        })
    }
}
```

## Running Tests

```bash
go test ./...              # All tests
go test -v ./...           # Verbose
go test -cover ./...       # With coverage
go test -race ./...        # Race detection
go test -run TestName      # Specific test
```

## Testify (Optional Enhancement)

```bash
go get github.com/stretchr/testify
```

```go
import "github.com/stretchr/testify/assert"

func TestWithTestify(t *testing.T) {
    assert.Equal(t, 3, MyFunction(1, 2))
}
```
