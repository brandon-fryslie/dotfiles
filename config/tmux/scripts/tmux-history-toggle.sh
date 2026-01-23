#!/usr/bin/env bash
# Toggle history on/off for the current tmux pane
#
# First press: saves current history-limit, clears history, sets limit to 0
# Second press: restores previous history-limit

PANE_ID="${1:-.}"
DEFAULT_LIMIT=5000

# Check if history is currently disabled for this pane
DISABLED="$(tmux show -pqv -t "$PANE_ID" @history_disabled 2>/dev/null)"

if [ "$DISABLED" = "1" ]; then
  # Re-enable history for this pane
  SAVED="$(tmux show -pqv -t "$PANE_ID" @saved_history_limit 2>/dev/null)"
  [ -z "$SAVED" ] && SAVED="$DEFAULT_LIMIT"
  tmux set -pt "$PANE_ID" history-limit "$SAVED"
  tmux set -pt "$PANE_ID" @history_disabled ""
  tmux display-message -t "$PANE_ID" "history: on (limit $SAVED)"
else
  # Disable history for this pane
  CURRENT="$(tmux show -pqv -t "$PANE_ID" history-limit 2>/dev/null)"
  [ -z "$CURRENT" ] && CURRENT="$DEFAULT_LIMIT"
  tmux set -pt "$PANE_ID" @saved_history_limit "$CURRENT"
  tmux clear-history -t "$PANE_ID" 2>/dev/null
  tmux set -pt "$PANE_ID" history-limit 0
  tmux set -pt "$PANE_ID" @history_disabled 1
  tmux display-message -t "$PANE_ID" "history: off (cleared)"
fi
