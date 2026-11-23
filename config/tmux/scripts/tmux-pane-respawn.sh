#!/bin/sh
# Called by the pane-died hook (conf.d/pane-lifecycle.conf) with the dead pane's id.
# [LAW:single-enforcer] Decides the fate of every dead pane tmux keeps (all but the
# panes a launcher opted out). A pane that ran a shell closes: tmux-shell.sh marked
# it, or this hook respawned it. Any other pane is respawned into the default command
# with its output reprinted above it, so it is respawned once.
# Each run leaves one record in the system log:
#   log show --last 1h --predicate 'process == "logger" AND eventMessage BEGINSWITH "tmux-pane-respawn "'
set -u
pane="$1"
# Leads every command this hook respawns, so the start command says the hook started it.
signature='TMUX_PANE_RESPAWNED=1;'
# macOS logger drops -t, so the name leads the message.
log() { logger "tmux-pane-respawn pane=$pane $1"; }
fail() { log "error=$1"; tmux display-message "tmux-pane-respawn: $pane: $1"; exit 1; }

respawn() {
  cmd="$(tmux show -gv default-command)" || fail "cannot read default-command"
  # respawn-pane with no command reruns the dead program, so the respawn needs one.
  [ -n "$cmd" ] || fail "default-command is empty"
  # respawn-pane clears the visible screen, so the dead program's output would only
  # survive in scrollback. Instead: capture everything (with colors) and have the new
  # pane drop tmux's copy and reprint it before it execs the default command.
  # -e keeps colors, -J joins wrapped lines so they rewrap at the current width.
  out="$(tmux capture-pane -p -e -J -S - -t "$pane")" || fail "capture-pane failed"
  dump="$(mktemp "${TMPDIR:-/tmp}/tmux-respawn.XXXXXX")" || fail "mktemp failed"
  # awk drops the trailing blank rows below the last output line.
  printf '%s\n' "$out" |
    awk '{ l[NR] = $0 } /[^[:space:]]/ { last = NR } END { for (i = 1; i <= last; i++) print l[i] }' > "$dump" ||
    fail "writing $dump failed"
  # Ctrl-C is ignored while the dump prints, so it cannot cut the reprint short.
  tmux respawn-pane -t "$pane" "$signature trap '' INT; tmux clear-history -t \"\$TMUX_PANE\"; cat '$dump'; rm -f '$dump'; trap - INT; exec $cmd" ||
    fail "respawn-pane failed; its output is kept in $dump"
  log "fate=respawned"
}

# One read: empty when the pane is already gone, 1 when it ran a shell, 0 otherwise.
fate="$(tmux list-panes -a -f "#{==:#{pane_id},$pane}" \
  -F "#{||:#{?@shell-start,#{==:#{@shell-start},#{pane_start_command}},0},#{m:*$signature*,#{pane_start_command}}}")" ||
  fail "cannot list panes"
case "$fate" in
  '') log "fate=gone" ;;
  1) tmux kill-pane -t "$pane" || fail "kill-pane failed"; log "fate=closed" ;;
  0) respawn ;;
  *) fail "unexpected fate '$fate'" ;;
esac
