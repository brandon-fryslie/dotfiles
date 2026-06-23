#!/usr/bin/env zsh
# Resurrect coordination, race-free. [LAW:no-ambient-temporal-coupling]
#
# THE OLD BUG (audit dotfiles-iterm2-restore-pg4, criterion B): the consumer (a
# restored tab) RAISED @cwd_restoring=1 and resurrect's post-restore-all hook
# CLEARED it to 0. Two writers, order-dependent. continuum restores within ms of
# start-server, so the hook's clear fired BEFORE the tab's raise; the raise then
# clobbered it and nothing ever cleared it again -> stuck at 1 -> every tab hung
# the full 120s window. Confirmed live: @cwd_restoring == 1 hours after boot.
#
# THE FIX: ONE writer, monotonic signal. resurrect's hook SETS
# @cwd_restore_done=1 (set once, never cleared). The consumer only READS it. A
# set-once signal cannot be clobbered by a late writer and cannot be missed by a
# late reader — both orderings converge. [LAW:one-source-of-truth] @cwd_restore_done
# has exactly one writer: the hook in tmux.conf.

# Pure decision: given only inputs, should this tab wait, and why?
#   $1 = save_present : "1" if a resurrect save exists (a restore WILL run)
#   $2 = done_flag    : current value of @cwd_restore_done ("" or "1")
# Prints exactly one of: proceed-no-save | proceed-done | wait
# This is the whole coordination policy as a pure function — fully unit-testable.
restore_wait_decision() {
  emulate -L zsh
  local save=$1 done=$2
  [[ $save == 1 ]] || { print -r -- proceed-no-save; return }
  [[ $done == 1 ]] && { print -r -- proceed-done; return }
  print -r -- wait
}

# Effectful wait loop built from the pure decision above. Polls the real flag via
# the injected reader until the decision says proceed, or a bounded deadline hits.
# The timeout is a SAFETY NET, not the mechanism: on the healthy path this returns
# as soon as resurrect finishes (not after the full window). If the deadline IS
# hit it returns 1 so the caller can log it LOUDLY rather than pretend success.
# [LAW:no-silent-failure]
#
# Args:
#   $1 = save_present (1/0)
#   $2 = timeout seconds
#   $3 = name of a function that prints the current @cwd_restore_done value
#   $4 = name of a function that returns the current epoch seconds
#   $5 = name of a function that sleeps one poll interval
# Prints the terminal reason (proceed-no-save | proceed-done | timeout).
# Returns 0 on a clean proceed, 1 on timeout.
restore_wait_for_restore() {
  emulate -L zsh
  local save=$1 timeout=$2 read_done=$3 now=$4 nap=$5
  local start decision
  start=$($now)
  while true; do
    decision=$(restore_wait_decision "$save" "$($read_done)")
    [[ $decision == wait ]] || { print -r -- "$decision"; return 0 }
    (( $($now) - start >= timeout )) && { print -r -- timeout; return 1 }
    $nap
  done
}
