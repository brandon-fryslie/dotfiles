# Testing Interactive and User-Input Systems

How to test systems that require user input, including terminal applications, shell completions, full-screen apps, and device-specific interactions.

## Categories of Interactive Testing

| Category | Examples | Challenge |
|----------|----------|-----------|
| Terminal I/O | CLI prompts, confirmations | stdin/stdout coordination |
| Shell integration | Tab completions, aliases | Shell environment setup |
| Full-screen TUI | vim, htop, tmux | Screen buffer, key sequences |
| Desktop GUI | Electron, native apps | Window management, OS events |
| Mobile touch | Gestures, swipes | Sensor data, no simulator support |
| Device-specific | Vision Pro, wearables | Hardware-only features |

## Terminal Input/Output Testing

### PTY (Pseudo-Terminal) Testing

For testing CLI applications that read from stdin:

```python
import pexpect

def test_interactive_prompt():
    """Test CLI that asks for user input."""
    child = pexpect.spawn("python mycli.py init")

    # Wait for prompt
    child.expect("Project name:")
    child.sendline("my-project")

    child.expect("Description:")
    child.sendline("A test project")

    child.expect("Created successfully")
    child.wait()

    assert child.exitstatus == 0
```

### Testing Confirmation Dialogs

```python
def test_dangerous_operation_confirms():
    child = pexpect.spawn("mycli delete-all")

    child.expect("Are you sure.*\\[y/N\\]")
    child.sendline("n")

    child.expect("Cancelled")
    assert child.exitstatus == 0

def test_dangerous_operation_proceeds():
    child = pexpect.spawn("mycli delete-all")

    child.expect("Are you sure.*\\[y/N\\]")
    child.sendline("y")

    child.expect("Deleted")
    assert child.exitstatus == 0
```

### Testing Password Input

```python
def test_password_not_echoed():
    child = pexpect.spawn("mycli login")

    child.expect("Password:")
    child.sendline("secret123")

    # Verify password wasn't echoed
    output = child.before.decode()
    assert "secret123" not in output
```

## Shell Completion Testing

### Bash Completion Testing

```bash
#!/bin/bash
# test_completions.sh

# Source completion script
source ./completions/mycli.bash

# Test completion function
test_completion() {
    local cmd="$1"
    local expected="$2"

    COMP_WORDS=($cmd)
    COMP_CWORD=$((${#COMP_WORDS[@]} - 1))

    _mycli_completions

    if [[ " ${COMPREPLY[*]} " =~ " $expected " ]]; then
        echo "PASS: '$cmd' completes to '$expected'"
    else
        echo "FAIL: '$cmd' -> got '${COMPREPLY[*]}', expected '$expected'"
        exit 1
    fi
}

# Run tests
test_completion "mycli " "init"
test_completion "mycli " "build"
test_completion "mycli init --" "--name"
test_completion "mycli init --template " "basic"
```

### Zsh Completion Testing

```zsh
#!/bin/zsh
# test_completions.zsh

# Load completion system
autoload -Uz compinit
compinit -u

# Source our completions
source ./completions/_mycli

# Capture completions
test_completion() {
    local input="$1"
    local expected="$2"

    # Get completions for input
    local -a completions
    completions=(${(f)"$(mycli --generate-completions "$input" 2>/dev/null)"})

    if (( ${completions[(I)$expected]} )); then
        echo "PASS: '$input' includes '$expected'"
    else
        echo "FAIL: '$input' missing '$expected'"
        echo "Got: $completions"
        return 1
    fi
}

test_completion "mycli " "init"
test_completion "mycli init -" "--name"
```

### Programmatic Completion Testing

```python
# Test completion generation logic directly
def test_subcommand_completions():
    completions = get_completions("mycli ", cursor_pos=6)
    assert "init" in completions
    assert "build" in completions
    assert "deploy" in completions

def test_flag_completions():
    completions = get_completions("mycli init --", cursor_pos=13)
    assert "--name" in completions
    assert "--template" in completions

def test_value_completions():
    completions = get_completions("mycli init --template ", cursor_pos=22)
    assert "basic" in completions
    assert "advanced" in completions
```

## Full-Screen TUI Testing

### Testing with pyte (Terminal Emulator)

```python
import pyte
import subprocess

def test_fullscreen_app():
    # Create virtual terminal
    screen = pyte.Screen(80, 24)
    stream = pyte.Stream(screen)

    # Run app
    proc = subprocess.Popen(
        ["./myapp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Feed output to virtual terminal
    output = proc.stdout.read(1000)
    stream.feed(output.decode())

    # Check screen content
    display = "\n".join(screen.display)
    assert "Main Menu" in display
    assert "1. Option One" in display

def test_navigation():
    # Send key sequences
    proc.stdin.write(b"j")  # Down
    proc.stdin.write(b"j")  # Down
    proc.stdin.write(b"\r") # Enter
    proc.stdin.flush()

    output = proc.stdout.read(1000)
    stream.feed(output.decode())

    display = "\n".join(screen.display)
    assert "Option Three Selected" in display
```

### Testing ncurses/curses Apps

```python
import curses
from unittest.mock import patch

def test_curses_app():
    # Create fake screen
    fake_screen = FakeScreen(80, 24)

    with patch('curses.initscr', return_value=fake_screen):
        with patch('curses.newwin', return_value=fake_screen):
            app = MyTUIApp()
            app.run_once()  # Single iteration

            # Check what was drawn
            assert fake_screen.get_text(0, 0, 10) == "Main Menu"

class FakeScreen:
    def __init__(self, width, height):
        self.buffer = [[' '] * width for _ in range(height)]

    def addstr(self, y, x, text, attr=0):
        for i, c in enumerate(text):
            if x + i < len(self.buffer[0]):
                self.buffer[y][x + i] = c

    def get_text(self, y, x, length):
        return ''.join(self.buffer[y][x:x+length])
```

### Testing vim/tmux-style Apps

```python
def test_vim_like_editor():
    child = pexpect.spawn("./myeditor test.txt", encoding='utf-8')
    child.setwinsize(24, 80)

    # Wait for editor to load
    time.sleep(0.5)

    # Enter insert mode
    child.send("i")

    # Type text
    child.send("Hello, World!")

    # Exit insert mode
    child.send("\x1b")  # Escape

    # Save and quit
    child.send(":wq\r")

    child.wait()

    # Verify file content
    with open("test.txt") as f:
        assert f.read() == "Hello, World!"
```

## Desktop GUI Testing

### Electron Apps (Playwright)

```typescript
import { _electron as electron } from 'playwright';

test('main window interaction', async () => {
    const app = await electron.launch({ args: ['./main.js'] });
    const window = await app.firstWindow();

    // Interact with UI
    await window.click('button#submit');
    await window.fill('input#name', 'Test');

    // Verify result
    await expect(window.locator('.result')).toHaveText('Success');

    await app.close();
});
```

### Native macOS Apps (XCUITest)

```swift
func testMainWindow() {
    let app = XCUIApplication()
    app.launch()

    let mainWindow = app.windows["Main Window"]
    XCTAssertTrue(mainWindow.exists)

    mainWindow.buttons["Action"].click()

    XCTAssertTrue(app.alerts["Confirmation"].exists)
}
```

### Native Windows Apps (WinAppDriver)

```csharp
[TestMethod]
public void TestMainWindow()
{
    var options = new AppiumOptions();
    options.AddAdditionalCapability("app", @"C:\App\MyApp.exe");

    var driver = new WindowsDriver<WindowsElement>(
        new Uri("http://127.0.0.1:4723"), options);

    var button = driver.FindElementByName("Submit");
    button.Click();

    var result = driver.FindElementByName("Result");
    Assert.AreEqual("Success", result.Text);
}
```

## Mobile Device-Specific Testing

### Touch Gestures (Appium)

```python
from appium.webdriver.common.touch_action import TouchAction

def test_swipe_gesture(driver):
    action = TouchAction(driver)

    # Swipe from right to left
    action.press(x=500, y=500).move_to(x=100, y=500).release().perform()

    # Verify page changed
    assert driver.find_element_by_id("page2").is_displayed()

def test_pinch_zoom(driver):
    # Multi-touch gesture
    action1 = TouchAction(driver)
    action2 = TouchAction(driver)

    # Pinch out (zoom in)
    action1.press(x=300, y=400).move_to(x=100, y=200).release()
    action2.press(x=500, y=400).move_to(x=700, y=600).release()

    multi = MultiAction(driver)
    multi.add(action1, action2)
    multi.perform()

    # Verify zoom level changed
    assert get_zoom_level() > 1.0
```

### Device-Only Features (No Simulator)

Some features cannot be tested in simulators:

| Feature | Platform | Testing Approach |
|---------|----------|-----------------|
| Hand gestures | Vision Pro | Physical device CI farm |
| Face ID | iOS | Mock auth, test on device |
| Haptic feedback | iOS/Android | Manual verification |
| NFC | Both | Hardware test rig |
| Barometer | Both | Mock sensor data |

**Strategy for untestable features:**

```swift
// 1. Abstract the feature
protocol GestureRecognizer {
    func recognizeHandGesture() -> Gesture?
}

// 2. Create real and mock implementations
class VisionProGestureRecognizer: GestureRecognizer {
    func recognizeHandGesture() -> Gesture? {
        // Real Vision Pro implementation
    }
}

class MockGestureRecognizer: GestureRecognizer {
    var nextGesture: Gesture?

    func recognizeHandGesture() -> Gesture? {
        return nextGesture
    }
}

// 3. Test business logic with mock
func testPinchGestureTriggersAction() {
    let mock = MockGestureRecognizer()
    mock.nextGesture = .pinch
    let app = MyApp(gestureRecognizer: mock)

    app.processGesture()

    XCTAssertTrue(app.menuOpened)
}

// 4. Manual device test for actual gesture recognition
```

## Hardware Test Farms

For device-specific testing:

| Service | Platforms | Features |
|---------|-----------|----------|
| AWS Device Farm | iOS, Android | Real devices, Appium |
| Firebase Test Lab | Android | Robo tests, instrumentation |
| BrowserStack | iOS, Android, Desktop | Real devices |
| Sauce Labs | All | Real devices, VMs |

### CI Integration

```yaml
# GitHub Actions with Device Farm
jobs:
  device-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Run on Device Farm
        uses: aws-actions/aws-devicefarm-appium@v1
        with:
          app-file: app.apk
          test-package: tests.zip
          project-arn: ${{ secrets.DEVICE_FARM_PROJECT }}
          device-pool-arn: ${{ secrets.DEVICE_POOL }}
```

## Best Practices Summary

### 1. Separate Layers

```
┌─────────────────────────────────────┐
│  Input Layer (can't test in CI)     │  ← Mock this
├─────────────────────────────────────┤
│  Business Logic (can test anywhere) │  ← Test this thoroughly
├─────────────────────────────────────┤
│  Output Layer (can't test in CI)    │  ← Mock this
└─────────────────────────────────────┘
```

### 2. Abstract Hardware Dependencies

```python
class InputSource(Protocol):
    def get_input(self) -> str: ...

class TerminalInput(InputSource):
    def get_input(self) -> str:
        return input()  # Real terminal

class TestInput(InputSource):
    def __init__(self, responses: list[str]):
        self.responses = iter(responses)

    def get_input(self) -> str:
        return next(self.responses)
```

### 3. Test at Multiple Levels

| Level | What to Test | How |
|-------|--------------|-----|
| Unit | Logic response to input | Mock input source |
| Integration | Terminal interaction | pexpect/PTY |
| E2E | Full workflow | Real device/farm |
