---
name: tmux-talk
description: This skill should be used when the user asks to "send a message to another Claude instance", "talk to Claude in a tmux session", "communicate with a running Claude instance over tmux", "use tmux to coordinate with another Claude", "send keys to a tmux pane", or wants Claude to conduct a conversation with another process (Claude or otherwise) by sending messages via tmux send-keys and reading replies via tmux capture-pane. Use when the user says something like "in tmux session X window Y there is a Claude instance — go talk to it and do Z".
---

# tmux-talk

Conduct a back-and-forth conversation with another Claude instance (or any interactive process) through tmux. Use the `bin/tmux-talk` script for all tmux operations — it wraps the raw `tmux` incantations (especially the two-call send timing requirement) while leaving you in control of the flow.

```bash
TALK=~/.claude/skills/tmux-talk/bin/tmux-talk
```

## Subcommands

```bash
tmux-talk list                        # discover all panes
tmux-talk whoami                      # print this pane's tmux address
tmux-talk send   <target> <message...>  # send a message wrapped with From:/To-reply: envelope
tmux-talk read-screen <target> [N]    # capture N lines of scrollback (default 200)
tmux-talk wait   <target> [timeout]   # poll until idle prompt appears (default 120s)
tmux-talk idle   <target>             # exit 0 if idle, 1 if not — use in conditionals
```

## Target Addressing

tmux uses `session:window.pane`. When the user says "session X, window Y", map to `X:Y.0`.

Run `tmux-talk list` to see all available panes with their addresses and running commands. Verify the target shows `cmd=claude` or `cmd=node`, not `zsh`/`bash`.

## Message Envelope

Every `send` wraps the message body with a `From:` header and a `To reply:` footer:

```
From: <sender-address>
<your message>
To reply: Use /tmux-talk send <sender-address> <message...>
```

The sender's address is auto-detected from the invoking pane — no need to pass it. Run `tmux-talk whoami` if you want to print your own address explicitly (e.g. to log it). If `$TMUX` or `$TMUX_PANE` is unset, `send` and `whoami` hard-error rather than silently sending an empty `From:` line. (See `derive_self_address` in `bin/tmux-talk` for the exact derivation.)

The envelope is unconditional: every receiver sees the same shape, so reply routing is always present in the message itself.

## Typical Single-Turn Flow

```bash
TALK=~/.claude/skills/tmux-talk/bin/tmux-talk
TARGET="work:0.0"

# Check it's idle before sending
$TALK idle "$TARGET" || { echo "pane is busy"; exit 1; }

# Snapshot line count so you can extract just the new content later
BEFORE=$($TALK read-screen "$TARGET" 500 | wc -l)

# Send the message
$TALK send "$TARGET" "Please summarize the architecture of src/core/."

# Wait for the response
$TALK wait "$TARGET" 120

# Extract only the new content
$TALK read-screen "$TARGET" 500 | tail -n +"$BEFORE"
```

## Multi-Turn Conversation

Each turn is one send→wait→read cycle. The agent decides what to send next based on what it reads.

```bash
TALK=~/.claude/skills/tmux-talk/bin/tmux-talk
TARGET="work:0.0"

for message in \
  "Read src/parser.ts and describe its responsibilities." \
  "What are the main edge cases not handled there?" \
  "Suggest the most important missing test case."
do
  BEFORE=$($TALK read-screen "$TARGET" 500 | wc -l)
  $TALK send "$TARGET" "$message"
  $TALK wait "$TARGET" 120
  echo "=== Response ==="
  $TALK read-screen "$TARGET" 500 | tail -n +"$BEFORE"
done
```

## When to Use Each Subcommand Directly

**`idle`** — check before sending into a pane you didn't just watch. Exit code tells you whether to proceed or wait.

**`wait`** — after sending, or when you handed off a long task and came back. Blocks until the `>` prompt appears.

**`read-screen`** — anytime you want to see what's in the pane. Increase the line count for long responses or after instructing the remote Claude to do substantial file work.

**`send`** — the main reason to use the script at all. The two separate `send-keys` calls with a 1s sleep between them are required: a combined `send-keys ... Enter` races the target process's input handler and the Enter is silently dropped.

## Practical Tips

**Long responses**: the default 200-line scrollback may truncate. Use `read-screen "$TARGET" 1000` for large outputs. If the response might exceed tmux's `history-limit` (default 2000 lines), instruct the remote Claude to write to a file instead.

**Idle detection**: `wait` and `idle` use `ing…` as the sole working signal. Claude's activity spinner always ends in `ing…` (e.g. `✶ Baking…`, `✶ Thinking…`) — the spinner character varies but `ing…` is constant. Idle = stable content with no `ing…` visible.

**Don't send while generating**: `idle` tells you the current state. If you send into an actively-generating Claude instance, keystrokes queue and get misinterpreted.

## Additional Resources

- **`references/conversation-patterns.md`** — shell functions for sentinel-based completion, multi-pane coordination, and edge case handling
