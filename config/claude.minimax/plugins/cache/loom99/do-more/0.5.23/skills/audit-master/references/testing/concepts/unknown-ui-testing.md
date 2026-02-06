# Testing Unknown/Dynamic UI

How to test web applications when you don't know the exact UI implementation, focusing on behavior-based and accessibility-based testing strategies.

## The Problem

When testing UI that:
- Hasn't been built yet
- Uses dynamic/generated class names (CSS-in-JS, CSS modules)
- Is built by another team
- Changes frequently

**You can't rely on:**
- Specific CSS selectors (`.btn-primary-2x4f8`)
- Implementation-specific attributes
- Exact DOM structure
- Pixel-perfect screenshots

## Solution: Behavior-Based Selectors

### ARIA Roles and Accessibility Attributes

**Most robust** - based on accessibility semantics, not implementation:

```typescript
// Find by role (what the element IS)
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })
page.getByRole('link', { name: 'Home' })
page.getByRole('heading', { level: 1 })
page.getByRole('listitem')
page.getByRole('navigation')

// Find by label (accessible name)
page.getByLabel('Username')
page.getByLabel('Password')

// Find by placeholder
page.getByPlaceholder('Enter your email')

// Find by text content
page.getByText('Welcome back')
page.getByText(/forgot password/i)
```

### Why Roles Work

| Selector Type | Stability | Why |
|---------------|-----------|-----|
| CSS class | ❌ Low | Classes change with styling |
| ID | ⚠️ Medium | IDs can be generated/changed |
| ARIA role | ✅ High | Semantic meaning rarely changes |
| Label text | ✅ High | User-visible, intentional |
| Test ID | ✅ High | Explicit testing contract |

### Test IDs as Contracts

When roles aren't sufficient, use explicit test IDs:

```html
<!-- Implementation -->
<button data-testid="submit-order">Place Order</button>
```

```typescript
// Test
page.getByTestId('submit-order').click()
```

**Guidelines for test IDs:**
- Use sparingly (prefer semantic selectors)
- Create naming conventions (`submit-*`, `input-*`)
- Document as "testing contracts"
- Don't remove without updating tests

## Strategy: Test User Workflows, Not UI Elements

### What Users Actually Do

Instead of testing "does button exist", test "can user complete task":

```typescript
// WRONG: Testing implementation
test('submit button is blue and 200px wide', async () => {
    const button = page.locator('.submit-btn-primary');
    await expect(button).toHaveCSS('background-color', 'rgb(0, 0, 255)');
    await expect(button).toHaveCSS('width', '200px');
});

// RIGHT: Testing behavior
test('user can submit order', async () => {
    await page.getByLabel('Product').fill('Widget');
    await page.getByLabel('Quantity').fill('5');
    await page.getByRole('button', { name: /submit|order|checkout/i }).click();

    await expect(page.getByText(/order confirmed|thank you/i)).toBeVisible();
});
```

### Flexible Selectors

Handle UI variations with flexible selectors:

```typescript
// Button might say "Submit", "Send", "Go", etc.
page.getByRole('button', { name: /submit|send|go|confirm/i })

// Form might have label OR placeholder
page.getByLabel('Email').or(page.getByPlaceholder('email'))

// Success message could be anywhere
page.getByRole('alert').or(page.getByText(/success/i))
```

## Testing Framework Patterns

### Page Object Model (Flexible)

```typescript
// Abstract UI into page objects
class LoginPage {
    constructor(private page: Page) {}

    // Flexible selectors
    get emailInput() {
        return this.page.getByLabel(/email/i)
            .or(this.page.getByPlaceholder(/email/i))
            .or(this.page.getByRole('textbox', { name: /email/i }));
    }

    get passwordInput() {
        return this.page.getByLabel(/password/i)
            .or(this.page.getByPlaceholder(/password/i));
    }

    get submitButton() {
        return this.page.getByRole('button', { name: /sign in|log in|submit/i });
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }
}

// Test stays stable even if UI changes
test('user can login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/login');

    await loginPage.login('test@test.com', 'password');

    await expect(page.getByText(/welcome|dashboard/i)).toBeVisible();
});
```

### Component Testing with Abstraction

```typescript
// Test the behavior, not the implementation
class DataTable {
    constructor(private page: Page, private testId?: string) {}

    get root() {
        if (this.testId) {
            return this.page.getByTestId(this.testId);
        }
        return this.page.getByRole('table').or(this.page.locator('[role="grid"]'));
    }

    get rows() {
        return this.root.getByRole('row');
    }

    async getRowCount() {
        return await this.rows.count();
    }

    async clickRow(index: number) {
        await this.rows.nth(index).click();
    }

    async sortByColumn(name: string) {
        await this.root.getByRole('columnheader', { name }).click();
    }
}
```

## Handling Dynamic Content

### Waiting for Content

```typescript
// Don't assume content is immediate
test('data loads and displays', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for loading to complete
    await expect(page.getByText(/loading/i)).not.toBeVisible({ timeout: 10000 });

    // Or wait for content to appear
    await expect(page.getByRole('table')).toBeVisible();

    // Check data is present (not specific values)
    const rows = page.getByRole('row');
    await expect(rows).not.toHaveCount(0);
});
```

### Testing Async Operations

```typescript
test('form submission shows feedback', async ({ page }) => {
    await page.getByLabel('Name').fill('Test');
    await page.getByRole('button', { name: /submit/i }).click();

    // Wait for async operation
    await expect(
        page.getByRole('alert').or(page.getByText(/success|error|saved/i))
    ).toBeVisible({ timeout: 5000 });
});
```

## Visual Testing Without Pixel-Perfect

### Structural Screenshots

```typescript
// Screenshot specific component, not whole page
test('form layout is correct', async ({ page }) => {
    const form = page.getByRole('form', { name: /checkout/i });
    await expect(form).toHaveScreenshot('checkout-form.png', {
        maxDiffPixels: 100,  // Allow minor variations
    });
});
```

### CSS Property Assertions (Not Values)

```typescript
// Assert properties exist, not specific values
test('error state is visually distinct', async ({ page }) => {
    await page.getByLabel('Email').fill('invalid');
    await page.getByRole('button', { name: /submit/i }).click();

    const emailInput = page.getByLabel('Email');

    // Check it HAS styling, not WHAT styling
    const borderColor = await emailInput.evaluate(
        el => getComputedStyle(el).borderColor
    );

    // Just verify it's not the default
    expect(borderColor).not.toBe('rgb(0, 0, 0)');
});
```

## API Response Mocking

When UI depends on API data:

```typescript
test('displays user data', async ({ page }) => {
    // Mock API response
    await page.route('/api/user', route => {
        route.fulfill({
            json: { name: 'Alice', email: 'alice@test.com' }
        });
    });

    await page.goto('/profile');

    // Test UI displays the data (however it's displayed)
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('alice@test.com')).toBeVisible();
});
```

## Accessibility as Testing Foundation

### axe-core Integration

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('page is accessible', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
});
```

### Why Accessibility Helps Testing

| Accessibility Requirement | Testing Benefit |
|---------------------------|-----------------|
| Labeled inputs | Reliable selectors |
| Semantic HTML | Role-based queries |
| Keyboard navigation | Interaction testing |
| Focus management | State verification |

## Summary: Selector Priority

1. **Role + accessible name** (most stable)
   ```typescript
   page.getByRole('button', { name: 'Submit' })
   ```

2. **Label** (stable, semantic)
   ```typescript
   page.getByLabel('Email')
   ```

3. **Test ID** (explicit contract)
   ```typescript
   page.getByTestId('checkout-form')
   ```

4. **Text content** (user-visible)
   ```typescript
   page.getByText('Welcome')
   ```

5. **CSS selector** (last resort)
   ```typescript
   page.locator('.specific-class')  // Avoid
   ```

## Testing Without the UI

When UI doesn't exist yet:

### 1. Define Contracts

```typescript
// contracts/checkout.ts
export const CheckoutPage = {
    emailInput: 'input[type="email"], [aria-label*="email" i]',
    submitButton: 'button[type="submit"], [role="button"][name*="submit" i]',
    successMessage: '[role="alert"], .success, .confirmation',
};
```

### 2. Test Against Contracts

```typescript
test('checkout flow', async ({ page }) => {
    await page.locator(CheckoutPage.emailInput).fill('test@test.com');
    await page.locator(CheckoutPage.submitButton).click();
    await expect(page.locator(CheckoutPage.successMessage)).toBeVisible();
});
```

### 3. Implementation Fulfills Contract

Implementation team knows tests expect:
- An email input (any valid selector)
- A submit button (any valid selector)
- A success message (any valid selector)
