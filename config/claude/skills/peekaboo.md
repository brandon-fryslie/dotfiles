# Peekaboo GUI Automation Skill

Use this skill when you need to automate macOS GUI interactions, take screenshots, or analyze application interfaces.

## What is Peekaboo?

Peekaboo is a macOS CLI tool that enables AI agents to:
- Capture screenshots with AI-powered UI element detection
- Automate GUI interactions (click, type, scroll, drag)
- Analyze application interfaces using vision models
- Execute natural language automation tasks
- Extract menu structures and keyboard shortcuts

## Prerequisites & Installation

**Check if installed:**
```bash
which peekaboo
```

**Install via Homebrew (recommended):**
```bash
brew tap steipete/tap
brew install peekaboo
```

**Required Permissions:**
Peekaboo requires macOS Accessibility permissions. Check status:
```bash
peekaboo permissions
```

**Configuration:**
```bash
# Initialize config
peekaboo config init

# Set API key for AI analysis (optional)
peekaboo config set-credential OPENAI_API_KEY sk-...
# or for Anthropic
peekaboo config set-credential ANTHROPIC_API_KEY sk-ant-...
```

## Core Commands

### 1. See (Capture UI Map)
Captures an annotated UI map with clickable element IDs:

```bash
# Capture specific app
peekaboo see --app "Safari"

# Capture specific window
peekaboo see --window "Untitled"

# Capture entire screen
peekaboo see --screen 0

# With AI analysis
peekaboo see --app "Finder" --analyze "What files are visible?"
```

**Output:** Creates a session ID and shows UI elements labeled as T1, B1, I1, etc.

### 2. Click
Click on UI elements identified by 'see':

```bash
# Click element by ID (from see output)
peekaboo click --on B1

# Click by coordinates
peekaboo click --x 100 --y 200

# Double-click
peekaboo click --on B1 --count 2

# Right-click
peekaboo click --on B1 --button right
```

### 3. Type
Type text into focused elements:

```bash
# Type text
peekaboo type "Hello, World!"

# Type with special characters
peekaboo type "user@example.com"
```

### 4. Press
Press keyboard keys:

```bash
# Single key
peekaboo press return
peekaboo press tab
peekaboo press escape

# Common keys: return, tab, escape, delete, backspace, space
```

### 5. Hotkey
Execute keyboard shortcuts:

```bash
# Command+S (save)
peekaboo hotkey --keys cmd+s

# Command+Shift+N (new window in many apps)
peekaboo hotkey --keys cmd+shift+n

# Complex shortcuts
peekaboo hotkey --keys ctrl+alt+cmd+e
```

### 6. Scroll & Swipe
Scroll content:

```bash
# Scroll down
peekaboo scroll --dy 100

# Scroll up
peekaboo scroll --dy -100

# Scroll right/left
peekaboo scroll --dx 50
```

### 7. Move & Drag
Move cursor or drag elements:

```bash
# Move cursor
peekaboo move --x 500 --y 300

# Drag from element to coordinates
peekaboo drag --on B1 --to-x 600 --to-y 400
```

## Session Management

Peekaboo automatically tracks sessions—recent `see` command creates context for subsequent actions:

```bash
# Workflow (automatic session)
peekaboo see --app "MyApp"          # Creates session
peekaboo click --on T1              # Uses same session
peekaboo type "username"            # Still same session
peekaboo press tab                  # Still same session
```

**Explicit session (optional):**
```bash
SESSION=$(peekaboo see --app Safari --json-output | jq -r '.data.session_id')
peekaboo click --on B1 --session $SESSION
```

## Common Workflows

### Login Automation
```bash
# Capture login screen
peekaboo see --app "MyApp"

# Identify username field (e.g., T1), password field (e.g., T2), button (e.g., B1)
# Click username field
peekaboo click --on T1
peekaboo type "user@example.com"

# Move to password
peekaboo press tab
peekaboo type "mypassword"

# Click login button
peekaboo click --on B1
```

### Form Filling
```bash
peekaboo see --app "Safari"
peekaboo click --on T1
peekaboo type "John Doe"
peekaboo press tab
peekaboo type "john@example.com"
peekaboo press tab
peekaboo type "555-1234"
peekaboo click --on B3  # Submit button
```

### Menu Navigation
```bash
# List all menus
peekaboo menubar --app "Finder"

# Discover keyboard shortcuts
peekaboo menu --app "Finder" --path "File > New Finder Window"
```

### Screenshot & Analysis
```bash
# Take screenshot with AI analysis
peekaboo image --app "Safari" --analyze "What is the main heading on this page?"

# Save screenshot to file
peekaboo image --app "Terminal" --output ~/Desktop/screenshot.png

# Analyze without display
peekaboo see --app "MyApp" --analyze "Is the login successful?" --no-display
```

### Window Management
```bash
# List all windows
peekaboo list windows

# List windows for specific app
peekaboo list windows --app "Safari"

# Focus specific window
peekaboo window --title "Untitled" --app "TextEdit"
```

## Automation Scripts

Create reusable automation scripts in `.peekaboo.json` format:

**Example: `login.peekaboo.json`**
```json
{
  "name": "Login Automation",
  "steps": [
    {"command": "see", "args": {"app": "MyApp"}},
    {"command": "click", "args": {"on": "T1"}},
    {"command": "type", "args": {"text": "username"}},
    {"command": "press", "args": {"key": "tab"}},
    {"command": "type", "args": {"text": "password"}},
    {"command": "click", "args": {"on": "B1"}},
    {"command": "sleep", "args": {"ms": 2000}}
  ]
}
```

**Run script:**
```bash
peekaboo run login.peekaboo.json
```

## Natural Language Agent (v3)

Execute tasks using natural language:

```bash
# Dry-run to see planned actions
peekaboo agent --task "Open Safari and navigate to github.com" --dry-run

# Execute task
peekaboo agent --task "Fill the login form with username 'test@example.com'"

# Resume failed task
peekaboo agent --task "Complete the checkout process" --resume
```

## Best Practices

1. **Always use 'see' first**: Capture UI state before interacting
2. **Verify element IDs**: Check the annotated screenshot to ensure you're clicking the right element
3. **Add delays**: Use `peekaboo sleep 1000` between actions if apps need time to respond
4. **Use verbose mode**: Add `--verbose` or `-v` for debugging
5. **Check permissions**: Run `peekaboo permissions` if commands fail
6. **Session awareness**: Remember sessions auto-expire; re-run 'see' if context is lost
7. **Test incrementally**: Build complex automations step-by-step

## Debugging

```bash
# Verbose output
peekaboo see --app "MyApp" --verbose

# Check what apps are running
peekaboo list apps

# Verify permissions
peekaboo permissions

# Validate config
peekaboo config validate
```

## Integration with Claude Code

When using Peekaboo in Claude Code workflows:

1. **Capture First**: Always start with `peekaboo see` to understand UI state
2. **Analyze Screenshots**: Use the image output to verify element positions
3. **Sequential Execution**: Run commands sequentially, checking output between steps
4. **Error Handling**: If a click fails, re-run 'see' to get fresh UI map
5. **Timing**: Add sleep commands between actions for UI updates

## Common Pitfalls

- **Stale sessions**: UI changes after 'see' make element IDs invalid → Re-run 'see'
- **Missing permissions**: Accessibility must be granted in System Settings
- **Wrong element**: Check the annotated screenshot, not just the ID
- **App focus**: Ensure target app is frontmost before automation
- **Timing issues**: Add appropriate sleep delays for async UI updates

## MCP Server (Optional)

For persistent Peekaboo integration with Claude Desktop, install the MCP server:

```bash
npm install -g @steipete/peekaboo-mcp
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "peekaboo": {
      "command": "npx",
      "args": ["-y", "@steipete/peekaboo-mcp@beta"],
      "env": {
        "PEEKABOO_AI_PROVIDERS": "anthropic/claude-opus-4",
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Quick Reference

| Task | Command |
|------|---------|
| Capture UI | `peekaboo see --app "AppName"` |
| Click element | `peekaboo click --on B1` |
| Type text | `peekaboo type "text"` |
| Press key | `peekaboo press return` |
| Keyboard shortcut | `peekaboo hotkey --keys cmd+s` |
| Scroll | `peekaboo scroll --dy 100` |
| Wait | `peekaboo sleep 1000` |
| List apps | `peekaboo list apps` |
| List windows | `peekaboo list windows` |
| Check permissions | `peekaboo permissions` |
| AI analysis | `peekaboo image --app "App" --analyze "question?"` |

## Example: Complete Workflow

```bash
# 1. Capture application state
peekaboo see --app "Safari"

# Output shows: T1 (address bar), B1 (back button), B2 (forward button), etc.

# 2. Interact with elements
peekaboo click --on T1                    # Click address bar
peekaboo type "https://github.com"        # Type URL
peekaboo press return                     # Navigate

# 3. Wait for page load
peekaboo sleep 2000

# 4. Capture new state
peekaboo see --app "Safari"

# 5. Analyze result
peekaboo image --app "Safari" --analyze "Did the page load successfully?"
```

## When to Use This Skill

Invoke this skill when you need to:
- Automate repetitive macOS GUI tasks
- Test application UI workflows
- Fill forms across applications
- Capture and analyze application screenshots
- Extract menu structures and keyboard shortcuts
- Perform complex multi-step GUI interactions
- Debug or verify visual application state

## Limitations

- **macOS only**: Peekaboo requires macOS 14.0+
- **Accessibility required**: Must grant accessibility permissions
- **App-specific quirks**: Some apps may have non-standard UI elements
- **Dynamic UIs**: Element IDs change when UI updates (re-run 'see')
- **No iOS/iPadOS**: macOS automation frameworks only

---

**Remember**: Always start with `peekaboo see` to understand the current UI state before attempting automation.
