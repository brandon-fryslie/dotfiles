#!/bin/sh
# Called by the pane-died hook (conf.d/pane-respawn.conf) with the dead pane's id.
# [LAW:single-enforcer] The one place a dead pane's fate is decided. A shell pane
# (tmux-shell.sh marked it) closes. Any other pane is respawned into the default
# command with its output reprinted above it, which makes it a shell pane, so it
# respawns once.
set -u
pane="$1"
fail() { tmux display-message "tmux-pane-respawn: $pane: $1"; exit 1; }
start="$(tmux display -p -t "$pane" '#{pane_start_command}')" || fail "cannot read the pane"
mark="$(tmux show -pqv -t "$pane" @shell-start)" || fail "cannot read the pane's shell mark"
if [ "$start" = "$mark" ]; then
  tmux kill-pane -t "$pane" || fail "kill-pane failed"
  exit 0
fi
cmd="$(tmux show -gv default-command)" || fail "cannot read default-command"
# respawn-pane with no command reruns the dead program, so the respawn needs one.
[ -n "$cmd" ] || fail "default-command is empty"
# respawn-pane clears the visible screen, so the dead program's output would only
# survive in scrollback. Instead: capture everything (with colors), drop tmux's copy,
# and have the new pane reprint it before it execs the default command.
dump="$(mktemp "${TMPDIR:-/tmp}/tmux-respawn.XXXXXX")" || fail "mktemp failed"
# -e keeps colors, -J joins wrapped lines so they rewrap at the current width.
# awk drops the trailing blank rows below the last output line.
tmux capture-pane -p -e -J -S - -t "$pane" |
  awk '{ l[NR] = $0 } /[^[:space:]]/ { last = NR } END { for (i = 1; i <= last; i++) print l[i] }' > "$dump" ||
  { rm -f "$dump"; fail "capture-pane failed"; }
tmux clear-history -t "$pane"
# Ctrl-C is ignored while the dump prints, so an interrupted reprint cannot kill the
# pane before the default command marks it, or skip the rm.
tmux respawn-pane -t "$pane" "trap '' INT; cat '$dump'; rm -f '$dump'; trap - INT; exec $cmd" ||
  { rm -f "$dump"; fail "respawn-pane failed"; }
