---
name: tmux
description: "Use only when you need to run interactive CLI tools (Python REPL, etc.) that require real-time input/output OR when asked to use tmux"
---

# Using tmux for Interactive Commands

## CRITICAL SAFETY RULES

**NEVER kill a tmux session without EXPLICIT permission from the user.**

You may ONLY kill a session if BOTH conditions are met:
1. You created the session in the current conversation
2. The user explicitly grants permission to kill it

**Default behavior: ALWAYS detach, NEVER kill.**

Existing sessions may contain important work. Destroying them can cause data loss.

## Overview

Interactive CLI tools (vim, interactive git rebase, REPLs, etc.) cannot be controlled through standard bash because they require a real terminal. tmux provides detached sessions that can be controlled programmatically via `send-keys` and `capture-pane`.

## When to Use

**Use tmux when:**
- Running vim, nano, or other text editors programmatically
- Controlling interactive REPLs (Python, Node, etc.)
- Handling interactive git commands (`git rebase -i`, `git add -p`)
- Working with full-screen terminal apps (htop, etc.)
- Commands that require terminal control codes or readline

**Don't use for:**
- Simple non-interactive commands (use regular Bash tool)
- Commands that accept input via stdin redirection
- One-shot commands that don't need interaction

## Quick Reference

| Task | Command |
|------|---------|
| List sessions | `tmux list-sessions` |
| List windows | `tmux list-windows -t <session>` |
| Attach to session | `tmux attach -t <session>` |
| Create window | `tmux new-window -t <session>: -n <name> <command>` |
| Switch window | `tmux select-window -t <session>:<index>` |
| Send input | `tmux send-keys -t <session>:<index> 'text' Enter` |
| Capture output | `tmux capture-pane -t <session>:<index> -p` |
| Detach | `tmux detach-client -s <session>` |

## Core Pattern

### Before (Won't Work)
```bash
# This hangs because vim expects interactive terminal
bash -c "vim file.txt"
```

### After (Works)
```bash
# Check for existing session, create if needed
if ! tmux has-session -t mywork 2>/dev/null; then
  tmux new-session -d -s mywork
fi

# Create window (numbered 1, 2, 3, etc.)
tmux new-window -t mywork: -n editor vim file.txt
sleep 0.3

# Get window index (windows are numbered, not named)
INDEX=$(tmux list-windows -t mywork -F '#{window_index} #{window_name}' | grep editor | cut -d' ' -f1)

# Send commands using window index
tmux send-keys -t mywork:$INDEX 'i' 'Hello World' Escape ':wq' Enter

# Capture output
tmux capture-pane -t mywork:$INDEX -p

# Detach when done (session persists)
tmux detach-client -s mywork
```

## Implementation

### Basic Workflow

1. **List existing sessions** to see what's available
2. **Connect to or create session** - reuse existing sessions when possible
3. **Create window** - each window gets a numbered index (1, 2, 3...)
4. **Wait briefly** for initialization (100-500ms depending on command)
5. **Send input** using window index `session:N`
6. **Capture output** using window index
7. **Detach** when done - session stays alive for later

### Special Keys

Common tmux key names:
- `Enter` - Return/newline
- `Escape` - ESC key
- `C-c` - Ctrl+C
- `C-l` - Ctrl+L (clear screen)
- `C-b` - tmux prefix (for manual navigation)
- `Up`, `Down`, `Left`, `Right` - Arrow keys
- `Space` - Space bar
- `BSpace` - Backspace

### Session Management

**List all sessions:**
```bash
tmux list-sessions
# Output: session_name: N windows (created ...) (attached)
```

**Connect to existing or create:**
```bash
if ! tmux has-session -t dev 2>/dev/null; then
  tmux new-session -d -s dev
fi
```

### Window Management

**Windows are numbered starting from 0 or 1.** Names are labels, not unique identifiers.

**Create window:**
```bash
# Creates a numbered window with optional name
tmux new-window -t mysession: -n myname vim file.txt
```

**List windows:**
```bash
tmux list-windows -t mysession
# Output: 1: zsh (1 panes) ...
#         2: vim- (1 panes) ...
#         3: python* (1 panes) ... (active)
```

**Get window index:**
```bash
# By name (if you know it)
tmux list-windows -t mysession -F '#{window_index} #{window_name}' | grep vim

# Active window
tmux list-windows -t mysession -F '#{window_index} #{?window_active,(active),}' | grep active
```

**Target windows by index:**
```bash
# Always use index, never assume name is unique
tmux send-keys -t mysession:2 'echo hello' Enter
tmux capture-pane -t mysession:2 -p
```

**Switch to window:**
```bash
# Programmatically select window
tmux select-window -t mysession:2

# Or send prefix + number (if interacting)
tmux send-keys -t mysession C-b 2
```

### Working Directory

Specify working directory when creating session or window:
```bash
# For session
tmux new-session -d -s git -c /path/to/repo

# For window
tmux new-window -t git: -n status -c /path/to/repo git status
```

### Helper Wrapper

See `tmux-wrapper.sh` for simplified commands:

```bash
# List all sessions and windows
./tmux-wrapper.sh list

# Connect to existing or create new
./tmux-wrapper.sh connect dev

# Create window, returns its index
./tmux-wrapper.sh window dev editor vim file.txt
# Output: Window index: 2

# Send to window by index
./tmux-wrapper.sh send dev 2 'i' 'Hello' Escape ':wq' Enter

# Capture from window
./tmux-wrapper.sh capture dev 2

# Detach (recommended)
./tmux-wrapper.sh detach dev
```

## Common Patterns

### Multi-Window Development Session
```bash
# Connect to or create
if ! tmux has-session -t dev 2>/dev/null; then
  tmux new-session -d -s dev
fi

# Create windows (get their indices)
tmux new-window -t dev: -n editor vim file.txt
tmux new-window -t dev: -n repl python3 -i
tmux new-window -t dev: -n shell bash

# List windows to see indices
tmux list-windows -t dev -F '#{window_index}: #{window_name}'
# 1: editor
# 2: repl
# 3: shell

# Work in python window (index 2)
tmux send-keys -t dev:2 'import math' Enter
tmux send-keys -t dev:2 'print(math.pi)' Enter
tmux capture-pane -t dev:2 -p

# Switch to editor (index 1)
tmux select-window -t dev:1
tmux send-keys -t dev:1 'i' 'Code here' Escape ':wq' Enter

# Detach
tmux detach-client -s dev
```

### Python REPL
```bash
if ! tmux has-session -t python 2>/dev/null; then
  tmux new-session -d -s python
fi

tmux new-window -t python: -n repl python3 -i
sleep 0.3

# Get window index
IDX=$(tmux list-windows -t python -F '#{window_index} #{window_name}' | grep repl | cut -d' ' -f1)

tmux send-keys -t python:$IDX 'import math' Enter
tmux send-keys -t python:$IDX 'print(math.pi)' Enter
tmux capture-pane -t python:$IDX -p

tmux detach-client -s python
```

### Vim Editing
```bash
if ! tmux has-session -t edit 2>/dev/null; then
  tmux new-session -d -s edit
fi

tmux new-window -t edit: -n file1 vim /tmp/file.txt
sleep 0.3

IDX=$(tmux list-windows -t edit -F '#{window_index} #{window_name}' | grep file1 | cut -d' ' -f1)

tmux send-keys -t edit:$IDX 'i' 'New content' Escape ':wq' Enter
tmux detach-client -s edit
```

## Common Mistakes

### Using Window Names Instead of Indices
**Problem:** Window names are not unique identifiers

**Fix:** Always use window index
```bash
# ✗ Wrong - name might not be unique
tmux send-keys -t sess:editor 'text' Enter

# ✓ Correct - use index
IDX=$(tmux list-windows -t sess -F '#{window_index} #{window_name}' | grep editor | cut -d' ' -f1)
tmux send-keys -t sess:$IDX 'text' Enter
```

### Not Waiting After Window Creation
**Problem:** Capturing immediately shows blank screen

**Fix:** Add brief sleep
```bash
tmux new-window -t sess: -n vim vim file.txt
sleep 0.3  # Let vim initialize
```

### Forgetting Enter Key
**Problem:** Commands typed but not executed

**Fix:** Explicitly send Enter
```bash
tmux send-keys -t sess:2 'print("hello")' Enter
```

### Killing Instead of Detaching
**Problem:** Session destroyed, can't reconnect, data loss

**Fix:** ALWAYS detach, NEVER kill without explicit permission
```bash
tmux detach-client -s sess    # ✓ ALWAYS do this
tmux kill-session -t sess     # ✗ FORBIDDEN without explicit permission
```

**Remember:** You may ONLY kill a session if:
1. You created it in this conversation, AND
2. User explicitly granted permission to kill it

When in doubt, detach.

### Not Checking Session Exists
**Problem:** Creating duplicate sessions fails

**Fix:** Check first
```bash
if ! tmux has-session -t dev 2>/dev/null; then
  tmux new-session -d -s dev
fi
```

## Real-World Impact

- Enables programmatic control of vim/nano for file editing
- Allows automation of interactive git workflows (rebase, add -p)
- Makes REPL-based testing/debugging possible
- Unblocks any tool that requires terminal interaction
- Sessions persist - can work across multiple windows and tasks
- No need to build custom PTY management - tmux handles it all

## Session Lifecycle Management

**Default workflow:**
1. List existing sessions to see what's available
2. Connect to existing session OR create new one
3. Create windows for your work
4. Do your work
5. **Detach** when done (session stays alive)

**Never kill sessions unless:**
- You created it in this conversation, AND
- User explicitly said "kill the session" or "destroy the session"

**When user says "I'm done" or "clean up":**
- Detach from the session
- Inform user the session is still running
- DO NOT kill it
