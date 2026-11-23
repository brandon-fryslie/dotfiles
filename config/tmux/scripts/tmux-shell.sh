#!/bin/sh
# The default command (tmux.conf): the login shell, after marking its pane as a shell
# pane. The mark is the pane's start command as tmux holds it now. pane-died
# (tmux-pane-respawn.sh) closes a dead pane whose start command still equals its mark;
# a later respawn-pane with another command (excise does this) changes the start
# command, so the mark never outlives the shell that set it.
# -t "$TMUX_PANE": without it, a client in a detached session targets no pane.
tmux set -p -t "$TMUX_PANE" @shell-start "$(tmux display -p -t "$TMUX_PANE" '#{pane_start_command}')" ||
  echo "tmux-shell: pane $TMUX_PANE is not marked as a shell pane, so exiting will respawn it" >&2
# tmux sets SHELL to default-shell, the one place the shell is named.
exec "$SHELL" -l
