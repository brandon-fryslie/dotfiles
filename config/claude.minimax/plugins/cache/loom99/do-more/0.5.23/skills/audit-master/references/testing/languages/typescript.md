# TypeScript/JavaScript Testing Reference

## Framework Detection

```bash
# Check package.json for test frameworks
grep -E "jest|vitest|mocha|jasmine|ava" package.json
```

| Framework | Indicator | Recommended |
|-----------|-----------|-------------|
| Vitest | `vitest` in deps | ✅ Modern TS |
| Jest | `jest` in deps | ✅ Mature, wide support |
| Mocha | `mocha` in deps | Legacy |
| Jasmine | `jasmine` in deps | Legacy |

## Test File Patterns

```bash
# Common patterns
find . -name "*.test.ts" -o -name "*.spec.ts" | head -30
find . -path "*/__tests__/*" | head -30
find . -path "*/tests/*" -name "*.ts" | head -30
```

## Coverage Tools

### Vitest Coverage

```bash
# Install
pnpm add -D @vitest/coverage-v8

# Configure in vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 80 }
    }
  }
})

# Run
pnpm vitest --coverage
```

### Jest Coverage

```bash
# Built-in
npx jest --coverage

# Configure in jest.config.js
module.exports = {
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: { lines: 80, branches: 80 }
  }
}
```

## Test Categories

### Vitest/Jest Describe Blocks

```typescript
describe('Unit: parseInput', () => {
  it('handles empty string', () => { ... });
});

describe('Integration: Database', () => {
  it('writes user record', () => { ... });
});

describe('E2E: Login Flow', () => {
  it('user can login and see dashboard', () => { ... });
});
```

**Run by pattern:**
```bash
vitest --grep "Unit:"        # Unit only
jest --testPathPattern=unit  # Unit directory
```

### Directory Convention

```
src/
├── auth/
│   ├── login.ts
│   └── login.test.ts      # Co-located
tests/
├── unit/                   # Or centralized
├── integration/
└── e2e/
```

## Common Patterns to Audit

### Mocking

**Good** - Type-safe mocks with vi.mock/jest.mock:
```typescript
vi.mock('./database', () => ({
  query: vi.fn().mockResolvedValue([{ id: 1 }])
}));
```

**Bad** - Casting to any:
```typescript
const mockDb = { query: jest.fn() } as any;  // Loses type safety
```

### Async Testing

```typescript
it('fetches user data', async () => {
  const result = await fetchUser(1);
  expect(result.name).toBe('Alice');
});
```

### Snapshot Testing

**Appropriate for**: UI components, serializable output
**Avoid for**: Business logic, frequently changing data

```typescript
it('renders correctly', () => {
  const { container } = render(<Button />);
  expect(container).toMatchSnapshot();
});
```

## E2E Frameworks

| Framework | Use Case | Setup |
|-----------|----------|-------|
| Playwright | Browser automation | `pnpm add -D @playwright/test` |
| Cypress | Browser (interactive) | `pnpm add -D cypress` |
| Supertest | API testing | `pnpm add -D supertest` |

### Playwright Example

```typescript
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'test@test.com');
  await page.fill('#password', 'password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### API Testing with Supertest

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('API', () => {
  it('creates user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});
```

## Quality Checks

### Find Tests Without Assertions
```bash
grep -L "expect\|assert" **/*.test.ts
```

### Find Skipped Tests
```bash
grep -rn "it.skip\|test.skip\|xit\|xdescribe" tests/
```

### Find Tests with Only
```bash
grep -rn "it.only\|test.only\|fit\|fdescribe" tests/  # Should not be committed
```

### Check Mock Usage
```bash
# Count mock patterns
grep -rn "vi.mock\|jest.mock" tests/ | wc -l
grep -rn "as any" tests/ | wc -l  # Type safety bypasses
```

## CI Configuration

### GitHub Actions
```yaml
- name: Run tests
  run: pnpm test -- --coverage --coverage.thresholds.lines=80
```

### Pre-commit Hook
```json
// package.json
"lint-staged": {
  "*.ts": ["vitest related --run"]
}
```

## React/Vue Specific

### React Testing Library

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

test('button click updates count', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### Vue Test Utils

```typescript
import { mount } from '@vue/test-utils';

test('emits click event', async () => {
  const wrapper = mount(Button);
  await wrapper.trigger('click');
  expect(wrapper.emitted('click')).toBeTruthy();
});
```
