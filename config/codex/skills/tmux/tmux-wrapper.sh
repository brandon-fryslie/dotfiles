#!/bin/bash
# Wrapper around tmux for Claude Code to interact with interactive programs
# Works with real tmux window indices, not names

set -euo pipefail

ACTION="${1:-}"
SESSION_NAME="${2:-}"

case "$ACTION" in
  list)
    echo "=== Active tmux sessions ==="
    if tmux list-sessions 2>/dev/null; then
      echo ""
      echo "=== Windows per session ==="
      tmux list-sessions -F '#{session_name}' 2>/dev/null | while read -r sess; do
        echo "Session: $sess"
        tmux list-windows -t "$sess" -F '  #{window_index}: #{window_name} #{?window_active,(active),}' 2>/dev/null || true
        echo ""
      done
    else
      echo "No active sessions"
    fi
    ;;

  connect)
    COMMAND="${3:-bash}"
    shift 3 2>/dev/null || shift 2 2>/dev/null || true

    # Connect to existing session or create new one
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "Session '$SESSION_NAME' already exists"
      tmux list-windows -t "$SESSION_NAME" -F '  #{window_index}: #{window_name} #{?window_active,(active),}'
    else
      # Create new detached session
      if [ $# -gt 0 ]; then
        tmux new-session -d -s "$SESSION_NAME" "$COMMAND" "$@"
      else
        tmux new-session -d -s "$SESSION_NAME" "$COMMAND"
      fi
      sleep 0.3
      echo "Created session: $SESSION_NAME"
      tmux list-windows -t "$SESSION_NAME" -F '  #{window_index}: #{window_name}'
    fi
    ;;

  window)
    WINDOW_NAME="${3:-}"
    COMMAND="${4:-bash}"
    shift 4 2>/dev/null || true

    if [ -z "$WINDOW_NAME" ]; then
      echo "Error: Window name required" >&2
      exit 1
    fi

    # Ensure session exists
    if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "Error: Session '$SESSION_NAME' does not exist. Use 'connect' first." >&2
      exit 1
    fi

    # Create new window in session
    if [ $# -gt 0 ]; then
      tmux new-window -t "$SESSION_NAME:" -n "$WINDOW_NAME" "$COMMAND" "$@"
    else
      tmux new-window -t "$SESSION_NAME:" -n "$WINDOW_NAME" "$COMMAND"
    fi

    sleep 0.3

    # Get the window index that was just created
    INDEX=$(tmux list-windows -t "$SESSION_NAME" -F '#{window_index} #{window_name}' | grep "$WINDOW_NAME" | tail -1 | cut -d' ' -f1)

    echo "Created window '$WINDOW_NAME' in session '$SESSION_NAME'"
    echo "Window index: $INDEX"
    echo "---"
    tmux capture-pane -t "$SESSION_NAME:$INDEX" -p
    ;;

  send)
    WINDOW_INDEX="${3:-}"
    shift 3 2>/dev/null || true

    if [ -z "$WINDOW_INDEX" ]; then
      echo "Error: Window index required" >&2
      exit 1
    fi

    if [ $# -eq 0 ]; then
      echo "Error: No input provided" >&2
      exit 1
    fi

    TARGET="$SESSION_NAME:$WINDOW_INDEX"

    # Send all arguments as separate keys
    tmux send-keys -t "$TARGET" "$@"
    sleep 0.2

    echo "Session: $TARGET"
    echo "---"
    tmux capture-pane -t "$TARGET" -p
    ;;

  capture)
    WINDOW_INDEX="${3:-}"

    if [ -z "$WINDOW_INDEX" ]; then
      echo "Error: Window index required" >&2
      exit 1
    fi

    TARGET="$SESSION_NAME:$WINDOW_INDEX"

    echo "Session: $TARGET"
    echo "---"
    tmux capture-pane -t "$TARGET" -p
    ;;

  detach)
    if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "Error: Session '$SESSION_NAME' does not exist" >&2
      exit 1
    fi

    echo "Session '$SESSION_NAME' is still running in background"
    echo "Use 'list' to see it, or 'tmux attach -t $SESSION_NAME' to attach manually"
    ;;

  kill)
    echo "ERROR: Killing tmux sessions requires explicit user permission" >&2
    echo "You may ONLY use this command if:" >&2
    echo "  1. You created the session in this conversation, AND" >&2
    echo "  2. User explicitly granted permission to kill it" >&2
    echo "" >&2
    echo "Default behavior: Use 'detach' instead" >&2
    exit 1

    # Unreachable code - kept for reference
    # if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    #   echo "Error: Session '$SESSION_NAME' does not exist" >&2
    #   exit 1
    # fi
    # tmux kill-session -t "$SESSION_NAME"
    # echo "Session '$SESSION_NAME' killed permanently"
    ;;

  *)
    cat <<EOF
Usage: $0 <action> <session-name> [args...]

Actions:
  list                                      - List all sessions and their windows with indices
  connect <session> [command] [args...]     - Connect to existing or create new session
  window <session> <name> <cmd> [args...]   - Create window, prints its index
  send <session> <index> <input...>         - Send input to window by index
  capture <session> <index>                 - Capture pane output from window by index
  detach <session>                          - Note session as detached (recommended)
  kill <session>                            - FORBIDDEN without explicit user permission

CRITICAL: NEVER kill sessions without explicit permission. ALWAYS use detach instead.

Important: Windows are identified by INDEX (number), not name.
Use 'list' to see window indices, then use that index with send/capture.

Examples:
  # List all sessions and window indices
  $0 list

  # Create/connect to session
  $0 connect dev

  # Create window (note the returned index)
  $0 window dev editor vim file.txt
  # Output: Window index: 2

  # Send to window by INDEX
  $0 send dev 2 'i' 'Hello' Escape ':wq' Enter

  # Capture from window by INDEX
  $0 capture dev 2

  # Detach (session keeps running)
  $0 detach dev
EOF
    exit 1
    ;;
esac
