#!/usr/bin/env bash
# Debug script to test help pane manually

echo "Testing help pane split..." > /tmp/tmux-help-debug.log
date >> /tmp/tmux-help-debug.log

HELP_PANE="$(tmux show -gv @help_pane_id 2>&1)"
echo "Current help_pane_id: [$HELP_PANE]" >> /tmp/tmux-help-debug.log

if [ -n "$HELP_PANE" ] && [ "$HELP_PANE" != "0" ]; then
  echo "Checking if pane exists..." >> /tmp/tmux-help-debug.log
  if tmux list-panes -F "#{pane_id}" 2>&1 | grep -q "^$HELP_PANE$"; then
    echo "Pane exists, killing it" >> /tmp/tmux-help-debug.log
    tmux kill-pane -t "$HELP_PANE" 2>&1 >> /tmp/tmux-help-debug.log
    tmux set -g @help_pane_id "" 2>&1 >> /tmp/tmux-help-debug.log
  else
    echo "Pane does not exist" >> /tmp/tmux-help-debug.log
  fi
else
  echo "Creating new help pane..." >> /tmp/tmux-help-debug.log
  tmux split-window -v -l 5 -d "$HOME/.config/tmux/scripts/tmux-help-pane.sh" 2>&1 >> /tmp/tmux-help-debug.log
  RESULT=$?
  echo "Split result: $RESULT" >> /tmp/tmux-help-debug.log

  NEW_PANE="$(tmux list-panes -F "#{pane_id}" | tail -1)"
  echo "New pane ID: $NEW_PANE" >> /tmp/tmux-help-debug.log
  tmux set -g @help_pane_id "$NEW_PANE" 2>&1 >> /tmp/tmux-help-debug.log
fi

echo "Done. Check /tmp/tmux-help-debug.log for details"
