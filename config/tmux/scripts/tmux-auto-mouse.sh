#!/usr/bin/env bash
# Toggle tmux mouse mode based on whether the active pane's application
# has enabled mouse reporting. Uses tmux's native #{mouse_any_flag}.
# [LAW:single-enforcer] Mouse mode decision enforced only here.

PANE_ID="${1:-.}"

# [LAW:dataflow-not-control-flow] Always query state; decision lives in values.
MOUSE_FLAG="$(tmux display -pt "$PANE_ID" -F '#{mouse_any_flag}')"
IN_COPY_MODE="$(tmux display -pt "$PANE_ID" -F '#{pane_in_mode}')"
CURRENT="$(tmux show -gqv mouse)"

# App has mouse → disable tmux mouse (let app handle it)
# App has no mouse → enable tmux mouse (let tmux handle it)
DESIRED="on"
[ "$MOUSE_FLAG" = "1" ] && DESIRED="off"

[ "$CURRENT" = "$DESIRED" ] && exit 0

# Exit copy mode before handing mouse to app (scrolls back to bottom)
[ "$IN_COPY_MODE" = "1" ] && [ "$DESIRED" = "off" ] && tmux send-keys -t "$PANE_ID" -X cancel

tmux set -g mouse "$DESIRED"
CMD="$(tmux display -pt "$PANE_ID" -F '#{pane_current_command}')"
APP_WANTS_MOUSE="no"
[ "$MOUSE_FLAG" = "1" ] && APP_WANTS_MOUSE="yes"
tmux display-message "mouse: $DESIRED ($CMD app_mouse=$APP_WANTS_MOUSE)"
