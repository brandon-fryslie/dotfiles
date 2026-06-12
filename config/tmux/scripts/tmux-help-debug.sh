#!/usr/bin/env bash
# Debug script to test help pane manually

echo "Testing help pane split..." > /tmp/tmux-help-debug.log
date >> /tmp/tmux-help-debug.log

HELP_PANE="$(tmux show -gqv @help_pane_id 2>/dev/null)"
echo "Current help_pane_id: [$HELP_PANE]" >> /tmp/tmux-help-debug.log

if [ -n "$HELP_PANE" ] && [ "$HELP_PANE" != "0" ]; then
  echo "Checking if pane exists..." >> /tmp/tmux-help-debug.log
  if tmux list-panes -aF "#{pane_id}" 2>/dev/null | grep -q "^$HELP_PANE$"; then
    echo "Pane exists, killing it" >> /tmp/tmux-help-debug.log
    tmux kill-pane -t "$HELP_PANE" >> /tmp/tmux-help-debug.log 2>&1
    tmux set -g @help_pane_id "" >> /tmp/tmux-help-debug.log 2>&1
  else
    echo "Pane does not exist" >> /tmp/tmux-help-debug.log
  fi
else
  echo "Creating new help pane..." >> /tmp/tmux-help-debug.log
  # [LAW:one-source-of-truth] -P prints the created pane's id; a follow-up
  # list-panes|tail -1 returns the wrong pane when the active pane isn't last.
  NEW_PANE="$(tmux split-window -v -l 5 -d -PF "#{pane_id}" "$HOME/.config/tmux/scripts/tmux-help-pane.sh" 2>> /tmp/tmux-help-debug.log)"
  RESULT=$?
  echo "Split result: $RESULT" >> /tmp/tmux-help-debug.log
  echo "New pane ID: $NEW_PANE" >> /tmp/tmux-help-debug.log
  tmux set -g @help_pane_id "$NEW_PANE" >> /tmp/tmux-help-debug.log 2>&1
fi

echo "Done. Check /tmp/tmux-help-debug.log for details"
