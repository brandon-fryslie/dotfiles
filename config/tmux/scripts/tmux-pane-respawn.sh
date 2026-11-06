#!/bin/sh
# Called by the pane-died hook (conf.d/pane-respawn.conf) with the dead pane's id.
# respawn-pane clears the visible screen, so the dead program's output would only
# survive in scrollback. Instead: capture everything (with colors), drop tmux's copy,
# and have the new shell reprint it before exec'ing the default command.
pane="$1"
dump="$(mktemp "${TMPDIR:-/tmp}/tmux-respawn.XXXXXX")"
# -e keeps colors, -J joins wrapped lines so they rewrap at the current width.
# awk drops the trailing blank rows below the last output line.
tmux capture-pane -p -e -J -S - -t "$pane" |
  awk '{ l[NR] = $0 } /[^[:space:]]/ { last = NR } END { for (i = 1; i <= last; i++) print l[i] }' > "$dump"
cmd="$(tmux show -gv default-command)"
tmux clear-history -t "$pane"
tmux respawn-pane -t "$pane" "cat '$dump'; rm -f '$dump'; exec $cmd"
