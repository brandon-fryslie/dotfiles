# Vitest Setup

Fast, Vite-native testing framework with Jest-compatible API.

## Installation

```bash
pnpm add -D vitest
# or
npm install -D vitest
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for browser
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/']
    }
  }
})
```

## Example Test

```typescript
import { describe, it, expect } from 'vitest'

describe('example', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2)
  })
})
```

## Coverage Setup

```bash
pnpm add -D @vitest/coverage-v8
```

## Watch Mode

```bash
pnpm test        # Watch mode by default
pnpm test:run    # Single run
```
