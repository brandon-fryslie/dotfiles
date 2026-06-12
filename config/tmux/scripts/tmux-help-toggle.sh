#!/usr/bin/env bash
# Toggle help pane on/off

HELP_PANE="$(tmux show -gv @help_pane_id 2>/dev/null)"

echo "Toggle script running..." >> /tmp/tmux-help-errors.log
echo "Current help_pane_id: [$HELP_PANE]" >> /tmp/tmux-help-errors.log

if [ -n "$HELP_PANE" ] && [ "$HELP_PANE" != "0" ] && tmux list-panes -aF "#{pane_id}" 2>/dev/null | grep -q "^$HELP_PANE$"; then
  echo "Killing pane $HELP_PANE" >> /tmp/tmux-help-errors.log
  tmux kill-pane -t "$HELP_PANE" >> /tmp/tmux-help-errors.log 2>&1
  tmux set -g @help_pane_id ""
else
  echo "Creating new help pane" >> /tmp/tmux-help-errors.log
  # [LAW:one-source-of-truth] -P prints the created pane's id; a follow-up
  # list-panes|tail -1 returns the wrong pane when the active pane isn't last.
  NEW_PANE="$(tmux split-window -v -l 5 -d -PF "#{pane_id}" "$HOME/.config/tmux/scripts/tmux-help-pane.sh" 2>> /tmp/tmux-help-errors.log)"
  echo "New pane: $NEW_PANE" >> /tmp/tmux-help-errors.log
  tmux set -g @help_pane_id "$NEW_PANE"
fi
