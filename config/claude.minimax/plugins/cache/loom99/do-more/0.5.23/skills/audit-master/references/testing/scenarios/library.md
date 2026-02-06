# Library/SDK Testing Scenario

Testing reusable libraries, npm packages, Python packages, and SDKs.

## Testing Strategy for Libraries

Libraries have different priorities than applications:

```
         ╱╲
        ╱E2E╲          Minimal: example app works
       ╱──────╲
      ╱ Integ  ╲       Public API contracts
     ╱──────────╲
    ╱    Unit    ╲     Every function, edge case, error
   ╱──────────────╲
```

| Level | Priority | Purpose |
|-------|----------|---------|
| Unit | **Highest** | Every public function, all edge cases |
| Integration | High | API contracts, module interactions |
| E2E | Low | Example usage works |

## Critical Test Areas

### 1. Public API Surface

**Every exported function/class must be tested:**

```typescript
// Your library exports
export { parse, format, validate };

// Tests must cover ALL exports
describe('parse', () => { /* exhaustive tests */ });
describe('format', () => { /* exhaustive tests */ });
describe('validate', () => { /* exhaustive tests */ });
```

### 2. Type Safety (TypeScript)

```typescript
// Ensure types work correctly
test('type inference works', () => {
  const result = parse<User>('{"name": "Alice"}');
  // TypeScript should infer result is User
  expectTypeOf(result).toEqualTypeOf<User>();
});

// Test generic constraints
test('rejects invalid types', () => {
  // @ts-expect-error - should not accept number
  parse<number>('not a number');
});
```

### 3. Edge Cases

Libraries must handle ALL edge cases:

```typescript
describe('parse', () => {
  // Happy path
  test('parses valid JSON', () => {
    expect(parse('{"a": 1}')).toEqual({ a: 1 });
  });

  // Edge cases
  test('handles empty string', () => {
    expect(parse('')).toBeNull();
  });

  test('handles null', () => {
    expect(parse(null)).toBeNull();
  });

  test('handles undefined', () => {
    expect(parse(undefined)).toBeNull();
  });

  test('handles malformed JSON', () => {
    expect(() => parse('{')).toThrow(ParseError);
  });

  test('handles deeply nested objects', () => {
    const deep = JSON.stringify({ a: { b: { c: { d: 1 } } } });
    expect(parse(deep)).toEqual({ a: { b: { c: { d: 1 } } } });
  });

  test('handles unicode', () => {
    expect(parse('{"emoji": "🎉"}')).toEqual({ emoji: '🎉' });
  });

  test('handles large input', () => {
    const large = JSON.stringify({ data: 'x'.repeat(1000000) });
    expect(() => parse(large)).not.toThrow();
  });
});
```

### 4. Error Messages

Library errors must be helpful to users:

```typescript
test('error includes helpful message', () => {
  try {
    validate({ name: '' }, schema);
    fail('should throw');
  } catch (e) {
    expect(e.message).toContain('name');
    expect(e.message).toContain('required');
    // Not just "validation failed"
  }
});

test('error includes path for nested fields', () => {
  try {
    validate({ user: { email: 'bad' } }, schema);
  } catch (e) {
    expect(e.path).toEqual(['user', 'email']);
  }
});
```

### 5. Backwards Compatibility

```typescript
// Test old API still works
describe('v1 compatibility', () => {
  test('deprecated method still works', () => {
    const result = oldMethod('input'); // Deprecated but supported
    expect(result).toBeDefined();
  });
});

// Test migration path
describe('migration', () => {
  test('old and new produce same results', () => {
    const oldResult = oldMethod('input');
    const newResult = newMethod('input');
    expect(oldResult).toEqual(newResult);
  });
});
```

### 6. Performance Characteristics

```typescript
test('parse is O(n)', () => {
  const small = 'x'.repeat(1000);
  const large = 'x'.repeat(10000);

  const smallTime = benchmark(() => parse(small));
  const largeTime = benchmark(() => parse(large));

  // Large should take ~10x, not ~100x (quadratic)
  expect(largeTime / smallTime).toBeLessThan(20);
});

test('no memory leaks', () => {
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10000; i++) {
    parse('{"data": "test"}');
  }
  global.gc?.();
  const after = process.memoryUsage().heapUsed;
  expect(after - before).toBeLessThan(10 * 1024 * 1024); // 10MB tolerance
});
```

### 7. Browser/Node Compatibility (if applicable)

```typescript
// Test both environments
describe.each(['node', 'browser'])('%s environment', (env) => {
  test('works in environment', async () => {
    const result = env === 'browser'
      ? await runInBrowser(() => myLib.parse('{}'))
      : myLib.parse('{}');
    expect(result).toBeDefined();
  });
});
```

### 8. Bundle Size (for npm packages)

```typescript
// In CI
test('bundle size under limit', async () => {
  const stats = await analyzeBundle('./dist/index.js');
  expect(stats.gzipped).toBeLessThan(10 * 1024); // 10KB limit
});
```

## Coverage Expectations

### Unit Tests (Exhaustive)
- [ ] Every exported function
- [ ] All parameter variations
- [ ] All return value cases
- [ ] All error conditions
- [ ] Edge cases (null, undefined, empty, large)
- [ ] Type behavior (TypeScript)

### Integration Tests (High)
- [ ] Module interactions
- [ ] Configuration combinations
- [ ] Plugin/extension systems
- [ ] Side effects (if any)

### E2E Tests (Minimal)
- [ ] README examples work
- [ ] Basic usage in real app
- [ ] Installation works

## Documentation Testing

```typescript
// Extract code from README
import { extractCodeBlocks } from './test-utils';

const examples = extractCodeBlocks('./README.md');

examples.forEach((example, index) => {
  test(`README example ${index + 1} works`, () => {
    expect(() => eval(example)).not.toThrow();
  });
});
```

Or use doctest-style:
```python
def parse(input: str) -> dict:
    """Parse JSON string.

    >>> parse('{"a": 1}')
    {'a': 1}
    >>> parse('')
    None
    """
```

## Property-Based Testing

For libraries, consider property-based tests:

```typescript
import fc from 'fast-check';

test('parse and stringify are inverse', () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      const str = stringify(value);
      const parsed = parse(str);
      expect(parsed).toEqual(value);
    })
  );
});

test('format is idempotent', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const once = format(input);
      const twice = format(once);
      expect(once).toEqual(twice);
    })
  );
});
```

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing internals | Breaks on refactor | Test public API only |
| Missing edge cases | Users hit bugs | Exhaustive edge case tests |
| No error case tests | Cryptic errors for users | Test all error paths |
| Ignoring types | Type bugs ship | Test type behavior |
| No real-world examples | README doesn't work | Test README examples |

## Test Structure

```
library/
├── src/
│   ├── index.ts          # Public exports
│   ├── parse.ts
│   └── format.ts
├── tests/
│   ├── unit/
│   │   ├── parse.test.ts       # Exhaustive
│   │   └── format.test.ts
│   ├── integration/
│   │   └── api-contract.test.ts
│   ├── e2e/
│   │   └── example-app.test.ts
│   └── fixtures/
│       ├── valid-inputs.json
│       └── edge-cases.json
├── examples/
│   └── basic-usage/
└── README.md
```

## Versioning Tests

```typescript
// Ensure semver compliance
describe('semantic versioning', () => {
  test('minor version: no breaking changes', () => {
    // All v1.x APIs still work
    expect(v1Api.parse).toBeDefined();
    expect(v1Api.format).toBeDefined();
  });

  test('major version: document breaking changes', () => {
    // v2 changes documented
    expect(v2Api.parse).toBeDefined();
    expect(v2Api.oldMethod).toBeUndefined(); // Removed in v2
  });
});
```
