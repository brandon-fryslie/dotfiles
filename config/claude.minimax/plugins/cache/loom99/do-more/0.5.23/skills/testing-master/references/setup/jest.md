# Jest Setup

Popular JavaScript testing framework with great defaults.

## Installation

```bash
pnpm add -D jest @types/jest ts-jest
# or for TypeScript projects
pnpm add -D jest @types/jest ts-jest typescript
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Configuration (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage'
}
```

## Example Test

```typescript
describe('example', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle async', async () => {
    const result = await Promise.resolve(42)
    expect(result).toBe(42)
  })
})
```

## Common Matchers

```typescript
expect(value).toBe(exact)           // Exact equality
expect(value).toEqual(object)       // Deep equality
expect(value).toBeTruthy()          // Truthy check
expect(fn).toThrow()                // Error thrown
expect(fn).toHaveBeenCalledWith(x)  // Mock call check
```
