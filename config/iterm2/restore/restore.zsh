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

# Install the live writer so the handle stays current for the NEXT restore. In the
# common config tmux's title integration already names the iTerm2 session after the
# tmux session, so this is reinforcement; it matters when the handle must differ
# from that title. Harmless and cheap (a printf escape, no subprocess on the hot path).
restore_install_writer() {
  emulate -L zsh
  autoload -Uz add-zsh-hook
  __restore_arm() { carrier_write "$(restore_record)" }
  add-zsh-hook precmd __restore_arm
}
