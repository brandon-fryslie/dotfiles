# Full Stack Application Testing Scenario

Testing applications with both frontend and backend components.

## Testing Strategy

Full stack apps require coordinated testing across layers:

```
┌─────────────────────────────────────────┐
│  E2E (Playwright/Cypress)               │  ← Full browser + real API
├─────────────────────────────────────────┤
│  Frontend Integration                    │  ← Components + mocked API
│  Backend Integration                     │  ← API + test DB
├─────────────────────────────────────────┤
│  Frontend Unit    │  Backend Unit        │  ← Isolated logic
└───────────────────┴─────────────────────┘
```

## Layer-by-Layer Coverage

### Backend Testing (See: web-backend.md)

**Unit:**
- Business logic
- Validators
- Service methods

**Integration:**
- API endpoints
- Database operations
- Auth/authz

### Frontend Testing (See: web-frontend.md)

**Unit:**
- Utility functions
- Custom hooks
- State reducers

**Integration:**
- Component interactions
- Form handling
- API response handling (mocked)

### Cross-Stack E2E

Full user journeys that exercise both frontend and backend:

```typescript
test('user registration and first login', async ({ page }) => {
  // Frontend: Navigate
  await page.goto('/register');

  // Frontend: Fill form
  await page.fill('#email', 'new@user.com');
  await page.fill('#password', 'SecurePass123');
  await page.click('text=Create Account');

  // Backend: Creates user, sends email
  // Frontend: Shows success
  await expect(page.locator('.success')).toBeVisible();

  // Full flow: Login with new account
  await page.goto('/login');
  await page.fill('#email', 'new@user.com');
  await page.fill('#password', 'SecurePass123');
  await page.click('text=Sign In');

  // Frontend + Backend: Auth works
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('.welcome')).toContainText('new@user.com');
});
```

## Critical Cross-Stack Scenarios

### 1. Authentication Flow

```typescript
test('auth token lifecycle', async ({ page, request }) => {
  // Login
  await page.goto('/login');
  await page.fill('#email', 'test@test.com');
  await page.fill('#password', 'password');
  await page.click('text=Sign In');

  // Verify frontend has token
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  // Verify token works with API
  const response = await request.get('/api/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(response.ok()).toBeTruthy();
});
```

### 2. Data Flow (Create → View → Edit → Delete)

```typescript
test('full CRUD workflow', async ({ page }) => {
  // Create
  await page.goto('/items/new');
  await page.fill('#name', 'Test Item');
  await page.click('text=Save');
  await expect(page.locator('.success')).toBeVisible();

  // View in list
  await page.goto('/items');
  await expect(page.locator('text=Test Item')).toBeVisible();

  // Edit
  await page.click('text=Test Item');
  await page.fill('#name', 'Updated Item');
  await page.click('text=Save');

  // Verify edit persisted
  await page.goto('/items');
  await expect(page.locator('text=Updated Item')).toBeVisible();
  await expect(page.locator('text=Test Item')).not.toBeVisible();

  // Delete
  await page.click('text=Updated Item');
  await page.click('text=Delete');
  await page.click('text=Confirm');

  // Verify deleted
  await page.goto('/items');
  await expect(page.locator('text=Updated Item')).not.toBeVisible();
});
```

### 3. Real-time Features (WebSockets)

```typescript
test('real-time updates', async ({ browser }) => {
  // Two browser contexts simulating two users
  const user1 = await browser.newPage();
  const user2 = await browser.newPage();

  await user1.goto('/chat/room1');
  await user2.goto('/chat/room1');

  // User 1 sends message
  await user1.fill('#message', 'Hello from User 1');
  await user1.click('text=Send');

  // User 2 should see it in real-time
  await expect(user2.locator('text=Hello from User 1')).toBeVisible();
});
```

### 4. File Upload

```typescript
test('file upload and processing', async ({ page }) => {
  await page.goto('/upload');

  // Upload file
  await page.setInputFiles('#file', 'test-data/sample.pdf');
  await page.click('text=Upload');

  // Wait for backend processing
  await expect(page.locator('.processing')).toBeVisible();
  await expect(page.locator('.complete')).toBeVisible({ timeout: 30000 });

  // Verify file accessible
  const downloadLink = page.locator('a[download]');
  const href = await downloadLink.getAttribute('href');
  expect(href).toContain('/files/');
});
```

### 5. Error Handling Across Layers

```typescript
test('backend error shown in frontend', async ({ page }) => {
  // Trigger backend error
  await page.goto('/items/create');
  await page.fill('#name', '');  // Invalid: empty name
  await page.click('text=Save');

  // Frontend should show backend validation error
  await expect(page.locator('.error')).toContainText('Name is required');
});

test('network error handled gracefully', async ({ page, context }) => {
  await page.goto('/items');

  // Simulate network failure
  await context.setOffline(true);
  await page.click('text=Refresh');

  // Frontend should show helpful error
  await expect(page.locator('.error')).toContainText('Unable to connect');
});
```

## Coverage Matrix

| Area | Unit | Integration | E2E |
|------|------|-------------|-----|
| Backend logic | ✅ Backend | | |
| API endpoints | | ✅ Backend | |
| Component rendering | | ✅ Frontend | |
| API data flow | | ✅ Frontend (mocked) | ✅ Real |
| Auth/sessions | | ✅ Both | ✅ |
| Full user journeys | | | ✅ |

## Test Environment

### Local Development
```yaml
# docker-compose.test.yml
services:
  app:
    build: .
    environment:
      - DATABASE_URL=postgres://test:test@db/testdb
  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=test
  e2e:
    build:
      context: .
      dockerfile: Dockerfile.e2e
    depends_on:
      - app
```

### CI Pipeline
```yaml
jobs:
  test:
    steps:
      - name: Backend Unit
        run: pytest tests/unit

      - name: Backend Integration
        run: pytest tests/integration

      - name: Frontend Unit
        run: pnpm test:unit

      - name: Frontend Integration
        run: pnpm test:integration

      - name: E2E
        run: |
          docker-compose -f docker-compose.test.yml up -d
          pnpm playwright test
```

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| All tests at E2E level | Slow, flaky | Most tests at unit/integration |
| Frontend mocks don't match backend | Tests pass, integration fails | Contract testing |
| Shared test database | Tests affect each other | Isolated per test |
| E2E tests for every edge case | Slow CI, maintenance burden | Edge cases at unit level |

## Contract Testing

Ensure frontend mocks match actual backend:

```typescript
// Generate contract from backend
// api/openapi.json

// Frontend tests validate against contract
import { validateResponse } from './contract-validator';

test('user response matches contract', async () => {
  const response = await mockServer.get('/users/1');
  expect(validateResponse('GET /users/{id}', response)).toBeValid();
});
```

Tools: Pact, OpenAPI validation, JSON Schema

## Test Structure

```
project/
├── backend/
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   └── components/**/*.test.tsx
│   └── vitest.config.ts
├── e2e/
│   ├── tests/
│   │   ├── auth.spec.ts
│   │   ├── crud.spec.ts
│   │   └── realtime.spec.ts
│   └── playwright.config.ts
└── contracts/
    └── openapi.json
```
