#!/usr/bin/env bats
# test-tmux-resurrect-save.bats - Functional tests for the launchd-driven periodic
# tmux-resurrect save (config/tmux/scripts/tmux-resurrect-save.sh +
# scripts/setup-tmux-resurrect-save.sh). Part of epic dotfiles-iterm2-restore-5k5.7.
#
# WHY THIS EXISTS / BUG VALIDATED:
# tmux-continuum's periodic save is triggered by a status-right interpolation
# redrawn by the status bar; this config's custom status-right and continuum's own
# another_tmux_server_running heuristic suppressed it, so saves silently stopped
# and a reboot would have restored ~2-day-stale state. The replacement owns the
# save with a launchd StartInterval agent. The non-obvious correctness property
# discovered while building it — and the regression this guards — is that the save
# MUST run against a target session: run-shell with no -t dumps panes but NOT
# windows or state, producing a file that cannot drive a restore.
#
# GAMING RESISTANCE:
# - Drives the REAL resurrect save.sh inside a REAL isolated tmux server (-L sock).
# - Asserts against the resurrect file's own line types (pane/window/state) — the
#   ground truth a restore consumes, not a self-reported status string.
#
# Note on -t: on the live machine (many sessions, attached clients) run-shell
# WITHOUT a target dumped panes but not windows/state — an unrestorable file. In a
# single-session isolated server run-shell defaults to that session and gets
# context, so "no -t is incomplete" is NOT a stable, machine-independent fact and
# is deliberately not asserted. What IS stable, and what the wrapper relies on, is
# that an EXPLICIT -t target always yields a complete save — that is the test.

load '../helpers/test-helpers'

SAVE="$BATS_TEST_DIRNAME/../../config/tmux/plugins/tmux-resurrect/scripts/save.sh"

setup() {
  require_command tmux
  [ -x "$SAVE" ] || skip "tmux-resurrect save.sh not present"

  SOCK="bats-resurrect-save-$$-$BATS_TEST_NUMBER"
  RDIR=$(create_test_dir)

  # A small but non-trivial topology: 2 sessions, the first with 2 windows, so a
  # complete save must emit multiple window lines (not just panes).
  tmux -L "$SOCK" -f /dev/null new-session -d -s alpha -x 80 -y 24 "exec bash --norc"
  tmux -L "$SOCK" new-window -t alpha "exec bash --norc"
  tmux -L "$SOCK" new-session -d -s beta -x 80 -y 24 "exec bash --norc"
  tmux -L "$SOCK" set -g @resurrect-dir "$RDIR"
}

teardown() {
  tmux -L "$SOCK" kill-server 2>/dev/null || true
  cleanup_test_dir "$RDIR"
}

saved_file() { ls -t "$RDIR"/tmux_resurrect_*.txt 2>/dev/null | head -1; }
count_type() { awk -F'\t' -v t="$1" '$1==t{n++} END{print n+0}' "$2"; }

@test "run-shell -t <session> produces a COMPLETE save (pane + window + state)" {
  run tmux -L "$SOCK" run-shell -t alpha "$SAVE quiet"
  [ "$status" -eq 0 ]

  f=$(saved_file)
  [ -n "$f" ]
  [ "$(count_type pane "$f")"   -ge 3 ]   # alpha has 2 panes, beta 1
  [ "$(count_type window "$f")" -ge 3 ]   # alpha 2 windows, beta 1
  [ "$(count_type state "$f")"  -ge 1 ]   # the state line a restore needs
}
