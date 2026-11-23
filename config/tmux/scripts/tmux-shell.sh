#!/bin/sh
# The default command (conf.d/pane-lifecycle.conf): the login shell, after marking its
# pane as a shell pane. The mark is a copy of the pane's start command, the command
# tmux started there. The pane-died hook (tmux-pane-respawn.sh) closes a dead pane
# whose start command still equals the mark. Once respawn-pane starts another command
# (excise does), the two no longer match and the mark is stale. `exec` inside this
# shell leaves the start command alone, so a program exec'd from it counts as the
# shell, and its pane closes on exit as in plain tmux.
# -t "$TMUX_PANE": without it, a client in a detached session targets no pane.
tmux set -p -t "$TMUX_PANE" @shell-start "$(tmux display -p -t "$TMUX_PANE" '#{pane_start_command}')" ||
  echo "tmux-shell: pane $TMUX_PANE is not marked as a shell pane, so exiting will respawn it" >&2
# tmux sets SHELL to default-shell, the one place the shell is named.
exec "$SHELL" -l
