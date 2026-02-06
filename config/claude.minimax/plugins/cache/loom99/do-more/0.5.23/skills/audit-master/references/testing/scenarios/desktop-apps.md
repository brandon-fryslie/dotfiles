# Desktop Application Testing Scenario

Testing Electron apps, native GUI applications (Qt, WPF, GTK, Cocoa), and cross-platform desktop software.

## Unique Challenges

Desktop applications require testing:
- **Native UI frameworks**: Platform-specific APIs and behaviors
- **File system access**: Local files, configuration, persistence
- **System integration**: Notifications, tray icons, keyboard shortcuts
- **Multiple platforms**: Windows, macOS, Linux variations
- **Long-running processes**: Memory leaks, state accumulation

## Testing Pyramid for Desktop Apps

```
         ╱╲
        ╱E2E╲          Full app automation, screenshots
       ╱──────╲
      ╱ Integ  ╲       Component + platform APIs
     ╱──────────╲
    ╱    Unit    ╲     Business logic, state management
   ╱──────────────╲
```

| Level | What to Test | Tools |
|-------|--------------|-------|
| Unit | Core logic, models, state | Jest/pytest/xUnit |
| Integration | UI components, file operations | Framework-specific |
| E2E | Full user workflows | Playwright/Spectron/platform tools |

## Electron App Testing

### Unit Tests (Main Process)

```typescript
// Pure business logic
describe('FileManager', () => {
  it('parses project file correctly', () => {
    const content = '{"name": "test", "version": "1.0"}';
    const project = parseProjectFile(content);

    expect(project.name).toBe('test');
    expect(project.version).toBe('1.0');
  });

  it('handles corrupted files', () => {
    const corrupt = '{invalid json';

    expect(() => parseProjectFile(corrupt)).toThrow(ParseError);
  });
});
```

### Integration Tests (Renderer Process)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

describe('Settings Panel', () => {
  it('saves settings to electron store', async () => {
    const mockStore = { set: jest.fn(), get: jest.fn() };
    render(<SettingsPanel store={mockStore} />);

    fireEvent.change(screen.getByLabelText('Theme'), {
      target: { value: 'dark' }
    });
    fireEvent.click(screen.getByText('Save'));

    expect(mockStore.set).toHaveBeenCalledWith('theme', 'dark');
  });
});
```

### E2E Tests (Playwright + Electron)

```typescript
import { _electron as electron } from 'playwright';

describe('App E2E', () => {
  let app;
  let window;

  beforeAll(async () => {
    app = await electron.launch({ args: ['./dist/main.js'] });
    window = await app.firstWindow();
  });

  afterAll(async () => {
    await app.close();
  });

  it('opens file from menu', async () => {
    // Trigger menu action via keyboard
    await window.keyboard.press('Control+O');

    // Dialog handling (mocked or intercepted)
    await app.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = () => ({
        filePaths: ['/test/file.txt'],
        canceled: false
      });
    });

    await expect(window.locator('.file-name')).toHaveText('file.txt');
  });

  it('persists window position on restart', async () => {
    await window.setViewportSize({ width: 800, height: 600 });

    // Close and reopen
    await app.close();
    app = await electron.launch({ args: ['./dist/main.js'] });
    window = await app.firstWindow();

    const size = await window.viewportSize();
    expect(size.width).toBe(800);
  });
});
```

## Qt Application Testing (C++/Python)

### Unit Tests (Qt Test)

```cpp
#include <QtTest>
#include "datamodel.h"

class TestDataModel : public QObject {
    Q_OBJECT

private slots:
    void testAddItem() {
        DataModel model;
        model.addItem("Test Item");

        QCOMPARE(model.rowCount(), 1);
        QCOMPARE(model.data(model.index(0), Qt::DisplayRole).toString(),
                 QString("Test Item"));
    }

    void testRemoveItem() {
        DataModel model;
        model.addItem("Item 1");
        model.addItem("Item 2");

        model.removeItem(0);

        QCOMPARE(model.rowCount(), 1);
    }
};

QTEST_MAIN(TestDataModel)
```

### Widget Testing

```cpp
void TestMainWindow::testButtonClick() {
    MainWindow window;
    QPushButton* btn = window.findChild<QPushButton*>("submitButton");
    QLineEdit* input = window.findChild<QLineEdit*>("nameInput");

    input->setText("Test Name");
    QTest::mouseClick(btn, Qt::LeftButton);

    QLabel* result = window.findChild<QLabel*>("resultLabel");
    QCOMPARE(result->text(), QString("Hello, Test Name"));
}
```

### Python Qt (pytest-qt)

```python
import pytest
from PyQt6.QtWidgets import QApplication
from myapp import MainWindow

@pytest.fixture
def app(qtbot):
    window = MainWindow()
    qtbot.addWidget(window)
    return window

def test_button_click(app, qtbot):
    qtbot.mouseClick(app.submit_button, Qt.LeftButton)
    assert app.result_label.text() == "Submitted"

def test_keyboard_shortcut(app, qtbot):
    qtbot.keyClick(app, 'S', Qt.ControlModifier)
    assert app.saved  # Save triggered
```

## WPF Application Testing (.NET)

### Unit Tests (xUnit)

```csharp
public class ViewModelTests {
    [Fact]
    public void SaveCommand_WhenValid_SavesData() {
        var mockRepo = new Mock<IRepository>();
        var vm = new MainViewModel(mockRepo.Object);
        vm.Name = "Test";

        vm.SaveCommand.Execute(null);

        mockRepo.Verify(r => r.Save(It.Is<Item>(i => i.Name == "Test")));
    }

    [Fact]
    public void SaveCommand_WhenInvalid_IsDisabled() {
        var vm = new MainViewModel(Mock.Of<IRepository>());
        vm.Name = "";  // Invalid

        Assert.False(vm.SaveCommand.CanExecute(null));
    }
}
```

### UI Automation (WinAppDriver)

```csharp
[TestClass]
public class MainWindowTests {
    private static WindowsDriver<WindowsElement> driver;

    [ClassInitialize]
    public static void Setup(TestContext context) {
        var options = new AppiumOptions();
        options.AddAdditionalCapability("app", @"C:\App\MyApp.exe");
        driver = new WindowsDriver<WindowsElement>(
            new Uri("http://127.0.0.1:4723"), options);
    }

    [TestMethod]
    public void TestLogin() {
        driver.FindElementByAccessibilityId("UsernameBox").SendKeys("user");
        driver.FindElementByAccessibilityId("PasswordBox").SendKeys("pass");
        driver.FindElementByAccessibilityId("LoginButton").Click();

        var welcome = driver.FindElementByAccessibilityId("WelcomeLabel");
        Assert.IsTrue(welcome.Text.Contains("Welcome"));
    }
}
```

## macOS App Testing (Swift/Cocoa)

### Unit Tests (XCTest)

```swift
import XCTest
@testable import MyApp

class DocumentTests: XCTestCase {
    func testDocumentLoading() throws {
        let url = Bundle(for: type(of: self)).url(
            forResource: "sample", withExtension: "myapp")!
        let doc = try Document(contentsOf: url, ofType: "myapp")

        XCTAssertEqual(doc.title, "Sample Document")
        XCTAssertEqual(doc.items.count, 3)
    }
}
```

### UI Testing (XCUITest)

```swift
class MyAppUITests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() {
        app.launch()
    }

    func testCreateNewDocument() {
        app.menuBars.menuItems["File"].click()
        app.menuItems["New"].click()

        XCTAssertTrue(app.windows["Untitled"].exists)
    }

    func testPreferencesWindow() {
        app.typeKey(",", modifierFlags: .command)  // Cmd+,

        let prefs = app.windows["Preferences"]
        XCTAssertTrue(prefs.waitForExistence(timeout: 5))
    }
}
```

## Critical Test Areas

### 1. File Operations

```typescript
describe('File Operations', () => {
  it('saves file to disk', async () => {
    const content = 'test content';
    await app.saveFile('/tmp/test.txt', content);

    const saved = await fs.readFile('/tmp/test.txt', 'utf8');
    expect(saved).toBe(content);
  });

  it('handles permission errors', async () => {
    await expect(app.saveFile('/root/test.txt', 'content'))
      .rejects.toThrow(/permission/i);
  });

  it('creates backup before overwriting', async () => {
    await app.saveFile('/tmp/test.txt', 'original');
    await app.saveFile('/tmp/test.txt', 'new');

    expect(await fs.exists('/tmp/test.txt.bak')).toBe(true);
  });
});
```

### 2. System Integration

```typescript
describe('System Integration', () => {
  it('shows notification', async () => {
    const notificationSpy = jest.spyOn(Notification, 'constructor');

    await app.notify('Task Complete');

    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Task Complete' })
    );
  });

  it('registers global shortcut', async () => {
    await app.registerShortcut('CommandOrControl+Shift+P', 'openPalette');

    // Simulate global key press
    await robot.keyTap('p', ['command', 'shift']);

    expect(await window.locator('.command-palette')).toBeVisible();
  });
});
```

### 3. Cross-Platform Behavior

```typescript
describe('Cross-Platform', () => {
  it('uses correct path separator', () => {
    const path = app.getConfigPath();

    if (process.platform === 'win32') {
      expect(path).toMatch(/\\/);
    } else {
      expect(path).toMatch(/\//);
    }
  });

  it('handles platform-specific shortcuts', async () => {
    const saveShortcut = process.platform === 'darwin'
      ? 'Meta+S'
      : 'Control+S';

    await window.keyboard.press(saveShortcut);

    expect(mockSave).toHaveBeenCalled();
  });
});
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Models and data structures
- [ ] Business logic
- [ ] State management
- [ ] File parsing/serialization
- [ ] Platform detection logic

### Integration Tests (Medium)
- [ ] UI components
- [ ] File operations
- [ ] Database/storage
- [ ] IPC (main/renderer in Electron)

### E2E Tests (Few)
- [ ] Critical user workflows
- [ ] Window management
- [ ] Menu actions
- [ ] Cross-platform behavior

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing only on one platform | Platform bugs | CI matrix for all platforms |
| Mocking all system APIs | Miss integration issues | Test real file/system ops |
| No window state tests | UX bugs | Test minimize/restore/resize |
| Ignoring memory leaks | Crashes over time | Monitor memory in long tests |

## Test Structure

```
app/
├── src/
│   ├── main/           # Electron main / native entry
│   ├── renderer/       # UI code
│   └── shared/         # Cross-process code
├── tests/
│   ├── unit/
│   │   ├── main/
│   │   └── renderer/
│   ├── integration/
│   │   └── components/
│   └── e2e/
│       └── workflows/
└── playwright.config.ts
```

## CI Matrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]

steps:
  - name: Unit Tests
    run: npm test

  - name: E2E Tests
    run: npm run test:e2e
    env:
      DISPLAY: ':99'  # Linux virtual display
```
