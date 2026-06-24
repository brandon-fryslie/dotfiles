#!/usr/bin/env zsh
# Entry point, sourced by the iTerm2 Default profile's "Send text at start":
#     source ~/.config/iterm2/restore/restore.zsh
#
# Shared across both identity variants. The variant is selected by sourcing
# exactly one of variant-dir.zsh / variant-session.zsh (a symlink chooses which);
# this file never branches on the variant. [LAW:dataflow-not-control-flow] the
# choice is a value (which file is linked), not an `if` here.
#
# Flow (one straight line, same every launch):
#   1. read this tab's handle from the carrier
#   2. a fresh tab has no valid handle -> do nothing (this REPLACES the old
#      process-uptime gate: presence of a real handle is a fact, not a timing guess)
#   3. resolve the handle to a target (variant decides how)
#   4. cd to the recovered cwd
#   5. wait for resurrect to FINISH (positive evidence, race-free) — not a poll on
#      a flag we ourselves raised
#   6. attach the target session, or create it

ITERM_RESTORE_DIR=${0:A:h}
source "$ITERM_RESTORE_DIR/lib.zsh"
source "$ITERM_RESTORE_DIR/coordination.zsh"
source "$ITERM_RESTORE_DIR/carrier.zsh"
# The selected variant (symlink ./variant.zsh -> variant-dir.zsh|variant-session.zsh)
source "$ITERM_RESTORE_DIR/variant.zsh"

# --- effect adapters (the only impure bits; everything above is pure) ---
__restore_now()       { date +%s }
__restore_nap()       { sleep 0.2 }
__restore_done_flag() { tmux show -gv @cwd_restore_done 2>/dev/null }
__restore_save_present() { [[ -s $HOME/.local/share/tmux/resurrect/last ]] && print 1 || print 0 }
__restore_has_session()  { tmux has-session -t "=$1" 2>/dev/null }

restore_run() {
  emulate -L zsh
  local -r TIMEOUT=120

  # 1+2: gate on a real handle, not a clock.
  local handle target
  handle=$(carrier_read)
  local -a reply
  restore_parse_handle "$handle" || return 0     # fresh tab / no handle -> leave shell alone

  # 3: variant maps handle -> primary<TAB>fallback<TAB>cwd
  target=$(restore_resolve_target "$handle") || return 0
  local -a t; t=("${(@s.	.)target}")
  local primary=${t[1]} fallback=${t[2]} cwd=${t[3]}

  # 4: recover the directory (never forced to $HOME — empty cwd means "stay put").
  [[ -n $cwd && -d $cwd && $cwd != $HOME ]] && cd -- "$cwd"

  # 5: wait for restore to actually finish (race-free positive signal).
  local save reason
  save=$(__restore_save_present)
  reason=$(restore_wait_for_restore "$save" "$TIMEOUT" __restore_done_flag __restore_now __restore_nap)
  local waited_ok=$?

  # 6: attach exact -> attach fallback -> create fallback. Log loudly, incl. timeout.
  local act name
  if __restore_has_session "$primary";  then act=attach; name=$primary
  elif __restore_has_session "$fallback"; then act=attach; name=$fallback
  else act=create; name=$fallback
  fi
  print -r -- "$(date '+%H:%M:%S') target=$primary fallback=$fallback cwd=$PWD save=$save wait=$reason act=$act name=$name" >> "$HOME/.iterm-restore.log"
  [[ $waited_ok -ne 0 ]] && print -r -- "  WARNING: restore wait hit ${TIMEOUT}s timeout (resurrect never signalled done)" >> "$HOME/.iterm-restore.log"

  if [[ $act == attach ]]; then tmux attach-session -t "=$name"; else tmux new-session -s "$name"; fi
}

# Register this iTerm2 tab so the tmux-hook writer (record-handle.zsh) can map a
# tmux client back to its iTerm2 UUID. The bridge is keyed by the client's tty:
# the outer iTerm2 shell's tty IS the tty tmux sees as #{client_tty} when this
# shell runs `tmux attach`. Only the OUTER shell knows the true ITERM_SESSION_ID
# UUID (inside tmux it is a stale inherited copy), which is exactly why the mapping
# must be written here, before attaching. [LAW:no-ambient-temporal-coupling] this
# runs before the attach it enables; the hook only reads what this wrote.
restore_register_client() {  # $1 = this shell's tty (e.g. /dev/ttys008)
  emulate -L zsh
  local tty=$1 uuid=${ITERM_SESSION_ID##*:}
  [[ -n $uuid && $uuid != */* && $uuid != *..* ]] || return 0
  [[ $tty == /dev/* ]] || return 0
  local dir=${ITERM_RESTORE_CLIENTS_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/iterm-restore/clients}
  mkdir -p -- "$dir" || return 1
  print -r -- "$uuid" > "$dir/${tty//\//_}"
}

# The entry point the iTerm2 "Send text at start" calls after sourcing this file:
# register the client (so future session switches are recorded), then run the
# restore. The tty is read here at the boundary and handed to the (pure-of-effects)
# registrar. Sourcing alone defines functions and does nothing, so tests can drive
# the parts in isolation. [LAW:dataflow-not-control-flow] [LAW:effects-at-boundaries]
restore_main() {
  emulate -L zsh
  restore_register_client "${TTY:-$(tty 2>/dev/null)}"
  restore_run
}
