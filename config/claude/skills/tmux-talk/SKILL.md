---
name: tmux-talk
description: This skill should be used when the user asks to "send a message to another Claude instance", "talk to Claude in a tmux session", "communicate with a running Claude instance over tmux", "use tmux to coordinate with another Claude", "send keys to a tmux pane", or wants Claude to conduct a conversation with another process (Claude or otherwise) by sending messages via tmux send-keys and reading replies via tmux capture-pane. Use when the user says something like "in tmux session X window Y there is a Claude instance — go talk to it and do Z".
---

# tmux-talk

Conduct a back-and-forth conversation with another Claude instance (or any interactive process) through tmux by sending messages with `tmux send-keys` and reading responses with `tmux capture-pane`.

## Core Concept

tmux is the IPC channel. The remote process is a black box that accepts text input and produces text output inside a pane. The workflow is always:

1. **Address** the target pane
2. **Send** a message with `tmux send-keys ... Enter`
3. **Poll** with `tmux capture-pane` until the response stabilizes
4. **Extract** the new content from the capture
5. **Repeat** for the next turn

## Target Addressing

tmux uses a three-level hierarchy — **session → window → pane** — expressed as a single target string:

```
session:window.pane
```

| Component | Type | Notes |
|-----------|------|-------|
| `session` | name or index | e.g. `work`, `0` |
| `window` | name or index | e.g. `editor`, `1` |
| `pane` | index (0-based) | almost always `0` unless split |

When the user says "session X, window Y", map to `X:Y.0`.

### Discovery commands

```bash
# All sessions
tmux list-sessions

# Windows in a session
tmux list-windows -t <session>

# Panes in a window
tmux list-panes -t <session>:<window>

# Full picture — all sessions/windows/panes with running command
tmux list-panes -a -F "#{session_name}:#{window_index}.#{pane_index}  cmd=#{pane_current_command}  title=#{pane_title}"
```

Always verify the target exists before sending. If the specified session/window doesn't appear in `list-panes -a`, tell the user before proceeding.

## Sending a Message

```bash
# Send text + Enter (submits to the running process)
tmux send-keys -t "<target>" "your message here" Enter

# Send without Enter (for multi-step construction)
tmux send-keys -t "<target>" "partial text"
```

**Quoting**: wrap the message in single quotes in the shell call to avoid unexpected expansions. If the message itself contains single quotes, use `$'...'` syntax or escape carefully.

```bash
# Safe for most content
tmux send-keys -t "work:0.0" 'Please summarize the architecture of this repo.' Enter

# Message with special characters
tmux send-keys -t "work:0.0" $'What\'s the status of the refactor?' Enter
```

For Claude Code specifically: input is submitted line-by-line on Enter, same as terminal input.

## Reading a Response

```bash
# Capture visible pane content (current screen)
tmux capture-pane -t "<target>" -p

# Capture with scrollback — last N lines of history
tmux capture-pane -t "<target>" -p -S -<N>

# Save to file (preferred for large captures)
tmux capture-pane -t "<target>" -p -S -500 > /tmp/capture.txt
```

Use `-S -200` or larger when responses might be long. The `-S` value is a negative line offset from the current position into scrollback.

## Detecting Response Completion

Poll until pane content **stops changing** and the **idle prompt is visible**.

For Claude Code, the idle state is a `>` prompt on a line by itself at the bottom of the pane. During generation, content keeps changing.

**Polling strategy**:
1. Capture content every 2 seconds
2. Compare to the previous capture
3. Declare done when: (a) content matches previous capture AND (b) the prompt indicator is present

See `references/conversation-patterns.md` for the full shell function.

**Timeouts**: Use 120 seconds for typical prompts, 300 seconds for tasks where the remote Claude might be doing substantial work (file edits, multi-step tasks).

## Extracting Only the New Response

The captured pane includes all prior content — previous turns, system messages, everything visible. To isolate the response to the most recent message:

1. Capture the pane **before** sending the message → save as baseline
2. After completion, capture again
3. The new content is everything added after the baseline's last line

```bash
# Before sending
tmux capture-pane -t "$TARGET" -p -S -500 > /tmp/before.txt
BEFORE_LINES=$(wc -l < /tmp/before.txt)

# Send message
tmux send-keys -t "$TARGET" "your question" Enter

# Wait for completion (see references/ for wait function)

# After completion — extract new content only
tmux capture-pane -t "$TARGET" -p -S -500 > /tmp/after.txt
tail -n +"$BEFORE_LINES" /tmp/after.txt
```

## Conversation Loop

A multi-turn conversation is just the single-turn loop repeated. Each iteration:

```
send → wait → capture → extract → decide next message → send → ...
```

Maintain a turn counter and stop condition. Always set an upper bound on turns (e.g. 10) to prevent infinite loops if the remote instance gets stuck or behaves unexpectedly.

See `references/conversation-patterns.md` for a complete reusable loop with error handling.

## Practical Tips

**Verify the target is a Claude instance**: run `tmux list-panes -a` and check `pane_current_command`. It should show `claude` or `node` (depending on how Claude Code was launched), not `zsh`/`bash`.

**Clear pane noise before starting**: if the pane has a lot of prior content, the baseline snapshot grows large. Consider sending a blank Enter first to push old content above the capture window, then re-establishing the baseline.

**Scroll sensitivity**: `tmux capture-pane -S -N` captures at most N lines of scrollback. If you send a message that produces a very long response, increase N or you'll miss the beginning. Start conservative (200) and increase if needed.

**Prompt detection is fuzzy**: Claude Code's prompt may vary slightly with version or context. If the `>` check isn't matching, capture the pane interactively (`tmux attach -t <session>`) and observe the actual idle state, then update the pattern.

**Don't send while generating**: always wait for the previous response to complete before sending the next message. Sending to an actively-generating Claude instance queues input that may be misinterpreted.

## Additional Resources

### Reference Files

- **`references/conversation-patterns.md`** — shell functions for waiting, extracting, and looping; edge cases; multi-pane coordination patterns
