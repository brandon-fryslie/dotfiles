# Web Frontend Testing Scenario

Testing React, Vue, Angular, and other web frontend applications.

## Testing Pyramid for Frontends

```
         ╱╲
        ╱E2E╲          Playwright/Cypress - real browser
       ╱──────╲
      ╱ Integ  ╲       Component + API mocks
     ╱──────────╲
    ╱    Unit    ╲     Utils, hooks, pure logic
   ╱──────────────╲
```

| Level | What to Test | Tools |
|-------|--------------|-------|
| Unit | Utilities, hooks, reducers | Jest/Vitest |
| Integration | Components with mocked API | Testing Library |
| E2E | Full user flows in browser | Playwright/Cypress |

## Critical Test Areas

### 1. Component Rendering

**Unit: Does component render?**
```typescript
import { render, screen } from '@testing-library/react';

test('renders user name', () => {
  render(<UserCard user={{ name: 'Alice' }} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
});
```

**Integration: Does component respond to interaction?**
```typescript
test('shows details on click', async () => {
  render(<UserCard user={testUser} />);
  await userEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(screen.getByText(testUser.email)).toBeInTheDocument();
});
```

### 2. User Interactions

**Must test:**
- Click events
- Form input
- Keyboard navigation
- Hover states (where functional)
- Drag and drop (if used)

```typescript
test('form submission', async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: 'test@test.com',
    password: 'password'
  });
});
```

### 3. API Integration

**Mock at network level (MSW):**
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: 'Alice' }]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('loads and displays users', async () => {
  render(<UserList />);
  expect(await screen.findByText('Alice')).toBeInTheDocument();
});
```

**Test error states:**
```typescript
test('shows error on API failure', async () => {
  server.use(
    rest.get('/api/users', (req, res, ctx) => {
      return res(ctx.status(500));
    })
  );

  render(<UserList />);
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### 4. Routing

```typescript
import { MemoryRouter } from 'react-router-dom';

test('navigates to user detail', async () => {
  render(
    <MemoryRouter initialEntries={['/users']}>
      <App />
    </MemoryRouter>
  );

  await userEvent.click(screen.getByText('Alice'));
  expect(screen.getByText('User Details')).toBeInTheDocument();
});
```

### 5. State Management

**Redux/Zustand/etc:**
```typescript
test('adds item to cart', () => {
  const { result } = renderHook(() => useCartStore());

  act(() => {
    result.current.addItem({ id: 1, name: 'Product' });
  });

  expect(result.current.items).toHaveLength(1);
});
```

### 6. Accessibility

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 7. E2E User Flows

**Playwright:**
```typescript
import { test, expect } from '@playwright/test';

test('complete checkout flow', async ({ page }) => {
  await page.goto('/products');
  await page.click('text=Add to Cart');
  await page.click('text=Checkout');

  await page.fill('#email', 'test@test.com');
  await page.fill('#card', '4242424242424242');
  await page.click('text=Pay');

  await expect(page).toHaveURL('/confirmation');
  await expect(page.locator('.order-number')).toBeVisible();
});
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Utility functions
- [ ] Custom hooks
- [ ] Reducers/state logic
- [ ] Formatters/validators

### Integration Tests (Medium)
- [ ] Component rendering
- [ ] User interactions
- [ ] Form validation
- [ ] Error states
- [ ] Loading states
- [ ] API response handling

### E2E Tests (Few)
- [ ] Authentication flow
- [ ] Main user journey (depends on app)
- [ ] Critical business flows
- [ ] Cross-browser if needed

## Framework-Specific

### React
- Testing Library: `@testing-library/react`
- Hooks: `@testing-library/react-hooks` or `renderHook`
- Router: Wrap with `MemoryRouter`

### Vue
- Testing Library: `@testing-library/vue`
- Vue Test Utils: `@vue/test-utils`
- Pinia: Test stores in isolation

### Angular
- TestBed for component testing
- HttpClientTestingModule for API mocks
- RouterTestingModule for routing

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing implementation details | Breaks on refactor | Test user behavior |
| Excessive snapshots | Meaningless diffs | Specific assertions |
| Mocking everything | False confidence | Use MSW at network level |
| No loading/error states | Users see broken UI | Test all states |
| Testing only happy path | Edge cases break | Test errors, empty states |

## Visual Regression

```typescript
// Playwright visual comparison
test('button styles', async ({ page }) => {
  await page.goto('/components/button');
  await expect(page.locator('.btn-primary')).toHaveScreenshot('button.png');
});
```

Tools:
- Playwright screenshots
- Chromatic (Storybook)
- Percy
- BackstopJS

## Test Structure

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx      # Integration
│   │   └── Button.stories.tsx   # Visual + docs
│   └── UserCard/
│       ├── UserCard.tsx
│       └── UserCard.test.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts          # Unit
├── utils/
│   ├── format.ts
│   └── format.test.ts           # Unit
tests/
└── e2e/
    ├── auth.spec.ts
    └── checkout.spec.ts
```
