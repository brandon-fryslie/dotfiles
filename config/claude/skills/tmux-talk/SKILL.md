---
name: tmux-talk
description: This skill should be used when the user asks to "send a message to another Claude instance", "talk to Claude in a tmux session", "communicate with a running Claude instance over tmux", "use tmux to coordinate with another Claude", "send keys to a tmux pane", or wants Claude to conduct a conversation with another process (Claude or otherwise) by sending messages via tmux send-keys and reading replies via tmux capture-pane. Use when the user says something like "in tmux session X window Y there is a Claude instance — go talk to it and do Z".
---

# tmux-talk

Conduct a back-and-forth conversation with another Claude instance (or any interactive process) through tmux. Use the `bin/tmux-talk` script — it handles sending, waiting, and extracting so you don't have to manage the raw tmux calls.

## Quick Start

```bash
SKILL=~/.claude/skills/tmux-talk

# Discover available panes
$SKILL/bin/tmux-talk list

# Send a message and get the response
$SKILL/bin/tmux-talk "work:0.0" "Please summarize the architecture of src/core/."

# With a longer timeout (seconds, default 120)
$SKILL/bin/tmux-talk "work:0.0" "Run the full test suite and report failures." 300
```

The script:
1. Verifies the target pane exists and is idle
2. Snapshots the pane before sending
3. Sends the message (two `send-keys` calls with a 1s gap — required to prevent Enter from being dropped)
4. Polls until the response stabilizes and the idle prompt returns
5. Extracts and prints only the new content

## Target Addressing

tmux uses `session:window.pane`:

| Component | Notes |
|-----------|-------|
| `session` | name or index — e.g. `work`, `0` |
| `window`  | name or index — e.g. `editor`, `1` |
| `pane`    | 0-based index — almost always `0` unless split |

When the user says "session X, window Y", map to `X:Y.0`.

Use `tmux-talk list` to see all available targets with their running command.

## Multi-Turn Conversation

Each call to `tmux-talk` is one turn. Chain them for multi-turn conversations:

```bash
SKILL=~/.claude/skills/tmux-talk
TARGET="work:0.0"

turn1=$($SKILL/bin/tmux-talk "$TARGET" "Read src/parser.ts and describe its responsibilities.")
echo "Turn 1: $turn1"

turn2=$($SKILL/bin/tmux-talk "$TARGET" "What are the main edge cases not handled there?")
echo "Turn 2: $turn2"

turn3=$($SKILL/bin/tmux-talk "$TARGET" "Suggest the most important missing test case.")
echo "Turn 3: $turn3"
```

Cap turns at a reasonable bound (10 is usually enough). If the remote instance gets stuck, the script will time out and exit non-zero.

## Practical Tips

**Verify the target is a Claude instance**: `tmux-talk list` shows `pane_current_command`. It should be `claude` or `node`, not `zsh`/`bash`.

**Scroll sensitivity**: the script captures 500 lines of scrollback. For very long responses (large file edits, test runs), instruct the remote Claude to write output to a file and read that instead.

**Long tasks**: pass an explicit timeout. The default 120s is enough for typical prompts; for tasks involving file edits or multi-step work, use 300s or more.

**Don't send while generating**: the script checks for idle before sending and will wait up to 30s. If the remote pane never becomes idle, it aborts rather than sending into an active generation.

---

## Reference: Raw tmux Commands

For edge cases beyond what the script handles.

### Discovery

```bash
tmux list-sessions
tmux list-windows -t <session>
tmux list-panes -t <session>:<window>
tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index}  cmd=#{pane_current_command}"
```

### Sending (always two calls)

```bash
# Text then Enter — never combine into one call
tmux send-keys -t "<target>" "your message"
sleep 1
tmux send-keys -t "<target>" Enter
```

### Capturing

```bash
tmux capture-pane -t "<target>" -p          # visible screen
tmux capture-pane -t "<target>" -p -S -500  # last 500 lines of scrollback
tmux capture-pane -t "<target>" -p -S -500 > /tmp/capture.txt
```

### Idle detection

Claude Code's idle state is a bare `>` on its own line. To observe the actual characters:

```bash
tmux capture-pane -t "<target>" -p | cat -A | tail -5
```

## Additional Resources

- **`references/conversation-patterns.md`** — shell functions for waiting, sentinel-based completion detection, multi-pane coordination, and edge case handling
