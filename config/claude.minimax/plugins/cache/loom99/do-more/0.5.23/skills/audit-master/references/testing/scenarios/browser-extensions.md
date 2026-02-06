# Browser Extension Testing Scenario

Testing Chrome, Firefox, Safari, and Edge extensions with popup, content script, background script, and service worker components.

## Extension Architecture

```
Extension
├── Background (Service Worker / Background Page)
│   └── Long-running logic, API calls, storage
├── Content Scripts
│   └── Injected into web pages, DOM manipulation
├── Popup
│   └── UI when clicking extension icon
├── Options Page
│   └── Settings/configuration UI
└── DevTools Panel (optional)
    └── Developer tools integration
```

## Testing Pyramid for Extensions

```
         ╱╲
        ╱E2E╲          Real browser, full extension loaded
       ╱──────╲
      ╱ Integ  ╲       Component + mocked browser APIs
     ╱──────────╲
    ╱    Unit    ╲     Pure logic, message handlers
   ╱──────────────╲
```

| Level | What to Test | Environment |
|-------|--------------|-------------|
| Unit | Business logic, utilities | Node.js |
| Integration | UI components, API mocking | JSDOM/browser mocks |
| E2E | Full extension in browser | Puppeteer/Playwright |

## Critical Test Areas

### 1. Background Script Logic

```typescript
// background.ts
export async function handleMessage(message: Message): Promise<Response> {
  switch (message.type) {
    case 'FETCH_DATA':
      return await fetchData(message.url);
    case 'SAVE_SETTING':
      await chrome.storage.sync.set({ [message.key]: message.value });
      return { success: true };
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// background.test.ts
describe('Background Message Handler', () => {
  beforeEach(() => {
    // Mock chrome.storage
    global.chrome = {
      storage: {
        sync: {
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue({})
        }
      }
    } as any;
  });

  it('saves setting to storage', async () => {
    const response = await handleMessage({
      type: 'SAVE_SETTING',
      key: 'theme',
      value: 'dark'
    });

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ theme: 'dark' });
    expect(response.success).toBe(true);
  });

  it('throws on unknown message type', async () => {
    await expect(handleMessage({ type: 'UNKNOWN' }))
      .rejects.toThrow('Unknown message type');
  });
});
```

### 2. Content Script Testing

```typescript
// content.ts
export function highlightKeywords(keywords: string[]): number {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );

  let count = 0;
  let node;
  while (node = walker.nextNode()) {
    for (const keyword of keywords) {
      if (node.textContent?.includes(keyword)) {
        // Wrap in highlight span
        wrapWithHighlight(node, keyword);
        count++;
      }
    }
  }
  return count;
}

// content.test.ts
describe('Content Script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <p>This is a test paragraph with keyword inside.</p>
        <p>Another paragraph without the word.</p>
      </div>
    `;
  });

  it('highlights matching keywords', () => {
    const count = highlightKeywords(['keyword']);

    expect(count).toBe(1);
    expect(document.querySelector('.highlight')).not.toBeNull();
  });

  it('handles no matches gracefully', () => {
    const count = highlightKeywords(['nonexistent']);

    expect(count).toBe(0);
  });
});
```

### 3. Popup UI Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Popup } from './Popup';

// Mock chrome.runtime
const mockSendMessage = jest.fn();
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage
  },
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({ enabled: true })
    }
  }
} as any;

describe('Popup', () => {
  it('shows current status', async () => {
    render(<Popup />);

    expect(await screen.findByText('Enabled')).toBeInTheDocument();
  });

  it('toggles extension on button click', async () => {
    render(<Popup />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'TOGGLE' });
  });
});
```

### 4. Message Passing

```typescript
describe('Message Passing', () => {
  it('content script sends message to background', async () => {
    const mockResponse = { data: 'test' };
    chrome.runtime.sendMessage = jest.fn().mockResolvedValue(mockResponse);

    const response = await sendToBackground({ type: 'GET_DATA' });

    expect(response.data).toBe('test');
  });

  it('background responds to content script', async () => {
    const listener = jest.fn((message, sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ type: 'PONG' });
      }
    });

    chrome.runtime.onMessage.addListener(listener);

    // Simulate message
    const sendResponse = jest.fn();
    listener({ type: 'PING' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ type: 'PONG' });
  });
});
```

### 5. Storage Operations

```typescript
describe('Storage', () => {
  beforeEach(() => {
    chrome.storage.sync.get = jest.fn();
    chrome.storage.sync.set = jest.fn().mockResolvedValue(undefined);
  });

  it('saves settings', async () => {
    await saveSettings({ theme: 'dark', enabled: true });

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      settings: { theme: 'dark', enabled: true }
    });
  });

  it('loads settings with defaults', async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    const settings = await loadSettings();

    expect(settings.theme).toBe('light');  // Default
    expect(settings.enabled).toBe(true);   // Default
  });

  it('migrates old storage format', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      oldKey: 'value'  // Legacy format
    });

    const settings = await loadSettings();

    // Should migrate
    expect(chrome.storage.sync.set).toHaveBeenCalled();
  });
});
```

### 6. Permissions

```typescript
describe('Permissions', () => {
  it('requests optional permission', async () => {
    chrome.permissions.request = jest.fn().mockResolvedValue(true);

    const granted = await requestPermission('tabs');

    expect(chrome.permissions.request).toHaveBeenCalledWith({
      permissions: ['tabs']
    });
    expect(granted).toBe(true);
  });

  it('handles permission denial', async () => {
    chrome.permissions.request = jest.fn().mockResolvedValue(false);

    const granted = await requestPermission('tabs');

    expect(granted).toBe(false);
  });
});
```

### 7. E2E Testing (Playwright)

```typescript
import { chromium, BrowserContext } from 'playwright';
import path from 'path';

describe('Extension E2E', () => {
  let context: BrowserContext;

  beforeAll(async () => {
    const extensionPath = path.resolve('./dist');

    context = await chromium.launchPersistentContext('', {
      headless: false,  // Extensions require headed mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
  });

  afterAll(async () => {
    await context.close();
  });

  it('popup opens on icon click', async () => {
    // Get extension ID
    const [background] = context.serviceWorkers();
    const extensionId = background.url().split('/')[2];

    // Open popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(popup.locator('h1')).toHaveText('My Extension');
  });

  it('content script modifies page', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    // Wait for content script to execute
    await page.waitForSelector('.extension-injected');

    expect(await page.locator('.extension-injected').count()).toBeGreaterThan(0);
  });
});
```

### 8. Cross-Browser Compatibility

```typescript
// webextension-polyfill for cross-browser support
import browser from 'webextension-polyfill';

describe('Cross-Browser', () => {
  it('uses polyfill for storage', async () => {
    // Works in Chrome, Firefox, Edge
    await browser.storage.sync.set({ key: 'value' });
    const result = await browser.storage.sync.get('key');

    expect(result.key).toBe('value');
  });
});

// Test matrix in CI
// - Chrome
// - Firefox
// - Edge
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Message handlers
- [ ] Business logic
- [ ] Data transformations
- [ ] Storage operations
- [ ] Utility functions

### Integration Tests (Medium)
- [ ] Popup UI
- [ ] Options page
- [ ] Content script DOM manipulation
- [ ] Message passing between components
- [ ] Permission handling

### E2E Tests (Few)
- [ ] Extension installation
- [ ] Popup interaction
- [ ] Content script on real pages
- [ ] Cross-component workflows

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Not mocking chrome APIs | Tests depend on browser | Mock chrome.* in unit tests |
| Testing only popup | Content/background untested | Test all components |
| No message passing tests | Integration bugs | Test message flows |
| Single browser only | Cross-browser bugs | Test Chrome + Firefox minimum |
| Real network in tests | Slow, flaky | Mock fetch/XHR |

## Tools

| Tool | Purpose |
|------|---------|
| jest-webextension-mock | Mock chrome.* APIs |
| webextension-polyfill | Cross-browser compatibility |
| Playwright | E2E with extension loading |
| Puppeteer | E2E alternative |
| web-ext | Firefox extension tooling |

## Test Structure

```
extension/
├── src/
│   ├── background/
│   │   └── index.ts
│   ├── content/
│   │   └── index.ts
│   ├── popup/
│   │   ├── Popup.tsx
│   │   └── index.tsx
│   └── shared/
│       └── messages.ts
├── tests/
│   ├── unit/
│   │   ├── background.test.ts
│   │   ├── content.test.ts
│   │   └── shared.test.ts
│   ├── integration/
│   │   ├── popup.test.tsx
│   │   └── messages.test.ts
│   └── e2e/
│       └── extension.test.ts
├── jest.config.js
└── manifest.json
```

## CI Configuration

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Unit & Integration Tests
        run: npm test

      - name: Build Extension
        run: npm run build

      - name: E2E Tests (Chrome)
        run: npm run test:e2e:chrome

      - name: E2E Tests (Firefox)
        run: |
          npm install web-ext
          npm run test:e2e:firefox
```
