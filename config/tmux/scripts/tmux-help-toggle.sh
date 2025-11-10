#!/usr/bin/env bash
# Toggle help pane on/off

HELP_PANE="$(tmux show -gv @help_pane_id 2>/dev/null)"

echo "Toggle script running..." >> /tmp/tmux-help-errors.log
echo "Current help_pane_id: [$HELP_PANE]" >> /tmp/tmux-help-errors.log

if [ -n "$HELP_PANE" ] && [ "$HELP_PANE" != "0" ] && tmux list-panes -F "#{pane_id}" 2>/dev/null | grep -q "^$HELP_PANE$"; then
  echo "Killing pane $HELP_PANE" >> /tmp/tmux-help-errors.log
  tmux kill-pane -t "$HELP_PANE" 2>&1 >> /tmp/tmux-help-errors.log
  tmux set -g @help_pane_id ""
else
  echo "Creating new help pane" >> /tmp/tmux-help-errors.log
  tmux split-window -v -l 5 -d "$HOME/.config/tmux/scripts/tmux-help-pane.sh" 2>&1 >> /tmp/tmux-help-errors.log
  NEW_PANE="$(tmux list-panes -F "#{pane_id}" | tail -1)"
  echo "New pane: $NEW_PANE" >> /tmp/tmux-help-errors.log
  tmux set -g @help_pane_id "$NEW_PANE"
fi
