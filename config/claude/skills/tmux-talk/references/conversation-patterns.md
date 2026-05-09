# Conversation Patterns

Reusable shell patterns for tmux-based Claude-to-Claude communication.

## Core Wait Function

Polls until pane content stabilizes and the Claude Code idle prompt appears.

```bash
wait_for_claude() {
  local target="$1"
  local timeout="${2:-120}"
  local interval=2
  local elapsed=0
  local prev=""

  while [ "$elapsed" -lt "$timeout" ]; do
    sleep "$interval"
    elapsed=$((elapsed + interval))

    local current
    current=$(tmux capture-pane -t "$target" -p -S -100)

    # Idle when content is stable AND the prompt line is present
    if [ "$current" = "$prev" ] && echo "$current" | grep -qE '^\s*>\s*$'; then
      return 0
    fi

    prev="$current"
  done

  echo "tmux-talk: timed out after ${timeout}s waiting for response in $target" >&2
  return 1
}
```

**Tuning the prompt pattern**: Claude Code's idle prompt is a bare `>` on its own line. If this doesn't match (e.g. the pane is a different tool), change the `grep -qE` pattern to whatever the idle indicator looks like. Capture the pane interactively to see the actual characters:

```bash
tmux capture-pane -t "<target>" -p | cat -A | tail -5
```

## Single Turn: Send + Wait + Extract

```bash
send_and_receive() {
  local target="$1"
  local message="$2"
  local timeout="${3:-120}"

  # Snapshot before sending
  local before
  before=$(tmux capture-pane -t "$target" -p -S -500)
  local before_lines
  before_lines=$(echo "$before" | wc -l)

  # Send
  tmux send-keys -t "$target" "$message" Enter

  # Wait
  if ! wait_for_claude "$target" "$timeout"; then
    return 1
  fi

  # Extract new content only
  tmux capture-pane -t "$target" -p -S -500 | tail -n +"$before_lines"
}
```

Usage:
```bash
response=$(send_and_receive "work:editor.0" "What is the purpose of the src/core/ directory?" 60)
echo "Remote Claude said: $response"
```

## Multi-Turn Conversation Loop

```bash
conduct_conversation() {
  local target="$1"
  shift
  local -a messages=("$@")
  local max_turns="${#messages[@]}"

  local turn=0
  for message in "${messages[@]}"; do
    turn=$((turn + 1))
    echo "=== Turn $turn / $max_turns ===" >&2
    echo "Sending: $message" >&2

    local response
    response=$(send_and_receive "$target" "$message") || {
      echo "tmux-talk: turn $turn timed out" >&2
      return 1
    }

    echo "Response:" >&2
    echo "$response"
    echo "" >&2
  done
}
```

Usage:
```bash
conduct_conversation "work:0.0" \
  "Read the file src/parser.ts and describe its responsibilities." \
  "What are the main edge cases not handled in that file?" \
  "Suggest the most important missing test case."
```

## Dynamic Conversation (Response-Driven)

When each message depends on the previous response, use a while loop with a decision function:

```bash
dynamic_conversation() {
  local target="$1"
  local initial_message="$2"
  local max_turns="${3:-10}"

  local message="$initial_message"
  local turn=0

  while [ "$turn" -lt "$max_turns" ]; do
    turn=$((turn + 1))
    echo "=== Turn $turn ===" >&2

    local response
    response=$(send_and_receive "$target" "$message" 180) || return 1

    echo "$response"

    # Detect natural end — Claude signals completion
    if echo "$response" | grep -qiE '(task complete|done\.|finished\.|no further|nothing else)'; then
      echo "tmux-talk: remote Claude signaled completion at turn $turn" >&2
      return 0
    fi

    # Derive next message from response (implement this for your use case)
    message=$(derive_next_message "$response") || {
      echo "tmux-talk: conversation complete (no follow-up needed)" >&2
      return 0
    }
  done

  echo "tmux-talk: reached max turns ($max_turns)" >&2
}
```

`derive_next_message` is a stub — implement it based on the task. Simple cases: return a fixed follow-up. Complex cases: parse the response and pick from a predefined sequence.

## Instructing the Remote Claude to Signal Done

To make response-end detection reliable, start the conversation by telling the remote Claude to use a sentinel when complete:

```bash
SENTINEL="<<<TASK_COMPLETE>>>"

send_and_receive "$TARGET" \
  "When you have fully completed the task I'm about to describe, output the exact string $SENTINEL on a line by itself. Here is the task: ..."

# Wait for sentinel instead of prompt
wait_for_sentinel() {
  local target="$1"
  local sentinel="$2"
  local timeout="${3:-300}"
  local interval=3
  local elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    sleep "$interval"
    elapsed=$((elapsed + interval))
    if tmux capture-pane -t "$target" -p -S -50 | grep -qF "$sentinel"; then
      return 0
    fi
  done
  return 1
}
```

## Multi-Pane Coordination

To coordinate multiple Claude instances in parallel:

```bash
broadcast_message() {
  local message="$1"
  shift
  local -a targets=("$@")

  for target in "${targets[@]}"; do
    tmux send-keys -t "$target" "$message" Enter
    echo "Sent to $target" >&2
  done
}

collect_responses() {
  local -a targets=("$@")
  local -A baselines

  # Snapshot all panes first
  for target in "${targets[@]}"; do
    baselines["$target"]=$(tmux capture-pane -t "$target" -p -S -500 | wc -l)
  done

  # Wait for all to finish
  for target in "${targets[@]}"; do
    wait_for_claude "$target" 180 || echo "WARNING: $target timed out" >&2
  done

  # Collect
  for target in "${targets[@]}"; do
    echo "=== Response from $target ===" 
    tmux capture-pane -t "$target" -p -S -500 | tail -n +"${baselines[$target]}"
  done
}
```

## Edge Cases

### Pane is busy (previous task still running)

Before sending, verify the remote Claude is actually idle:

```bash
is_claude_idle() {
  local target="$1"
  tmux capture-pane -t "$target" -p -S -10 | grep -qE '^\s*>\s*$'
}

if ! is_claude_idle "$TARGET"; then
  echo "tmux-talk: remote pane is not idle, waiting..." >&2
  wait_for_claude "$TARGET" 300 || { echo "never became idle"; exit 1; }
fi
```

### Long response truncated

If the response is longer than the scrollback buffer, increase `-S`:

```bash
# Try 1000 lines; bump to 2000+ for very long file edits
tmux capture-pane -t "$TARGET" -p -S -1000 > /tmp/capture.txt
```

Note that `tmux` itself has a scrollback limit (`history-limit` in tmux.conf, default 2000). If the response exceeds it, content is lost — this is a hard limit. For responses that might span thousands of lines, instruct the remote Claude to write output to a file instead.

### Target not found

```bash
verify_target() {
  local target="$1"
  if ! tmux list-panes -t "$target" &>/dev/null; then
    echo "tmux-talk: target '$target' not found. Available panes:" >&2
    tmux list-panes -a -F "  #{session_name}:#{window_index}.#{pane_index}  (#{pane_current_command})" >&2
    return 1
  fi
}
```

### Remote Claude outputs to a file instead of stdout

If the remote instance is instructed to write results to a file (better for large outputs), poll the file instead of the pane:

```bash
wait_for_file() {
  local filepath="$1"
  local sentinel_line="$2"  # e.g. "DONE"
  local timeout="${3:-300}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    sleep 3
    elapsed=$((elapsed + 3))
    if [ -f "$filepath" ] && tail -1 "$filepath" | grep -qF "$sentinel_line"; then
      return 0
    fi
  done
  return 1
}
```

## Complete Example: Delegating a Research Task

```bash
#!/usr/bin/env bash
set -euo pipefail

TARGET="research:0.0"     # session "research", window 0, pane 0
SENTINEL="<<<RESEARCH_DONE>>>"

# Verify target
verify_target "$TARGET"
is_claude_idle "$TARGET" || { echo "remote Claude is busy"; exit 1; }

# Take baseline
BEFORE_LINES=$(tmux capture-pane -t "$TARGET" -p -S -500 | wc -l)

# Kick off the task
tmux send-keys -t "$TARGET" \
  "Please summarize the key architectural patterns used in this codebase. Focus on src/core/. When done, output ${SENTINEL} on its own line." \
  Enter

# Wait for sentinel
wait_for_sentinel "$TARGET" "$SENTINEL" 300 || { echo "timed out"; exit 1; }

# Extract the response
tmux capture-pane -t "$TARGET" -p -S -500 \
  | tail -n +"$BEFORE_LINES" \
  | grep -v "$SENTINEL"
```
