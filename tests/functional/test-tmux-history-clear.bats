#!/usr/bin/env bats
# test-tmux-history-clear.bats - Functional tests for the scrollback clear script
#
# TICKET: dotfiles-script-audit-lbl.5
#
# BUG VALIDATED:
# tmux-history-toggle.sh set `history-limit 0` per-pane and displayed
# "history: off (cleared)". tmux applies history-limit only at pane creation,
# so the set exited 0 but was silently ignored and scrollback kept recording
# while the UI claimed it was off — a user printing secrets after M-H was
# unprotected. The script is now a pure clear that makes no "off" claim.
#
# GAMING RESISTANCE:
# - Drives the real script inside a real, isolated tmux server (-L socket)
# - Asserts against #{history_size}, the ground truth the old script's claim
#   contradicted, captured in-pane in the same compound command as the clear
#   (the full screen means any later prompt line scrolls back into history,
#   so an out-of-band poll would race)
# - Asserts recording continues after a clear — the exact state the old
#   script misrepresented as "off"
# - Asserts a second invocation clears again: the old toggle's second press
#   restored instead of clearing, so a surviving mode fails this test

load '../helpers/test-helpers'

SCRIPTS_DIR="$BATS_TEST_DIRNAME/../../config/tmux/scripts"

setup() {
  require_command tmux

  SOCK="bats-histclear-$$-$BATS_TEST_NUMBER"

  # Isolated HOME keeps the run independent of the machine's install state.
  FAKE_HOME=$(create_test_dir)
  mkdir -p "$FAKE_HOME/.config/tmux"
  ln -s "$SCRIPTS_DIR" "$FAKE_HOME/.config/tmux/scripts"

  tmux -L "$SOCK" -f /dev/null new-session -d -s t -x 80 -y 24 "exec bash --norc"
}

teardown() {
  tmux -L "$SOCK" kill-server 2>/dev/null || true
  cleanup_test_dir "$FAKE_HOME"
}

pane_history_size() {
  tmux -L "$SOCK" display -pt t:0.0 '#{history_size}'
}

# Spill well past the 24-row screen so scrollback genuinely fills.
fill_history() {
  local i
  tmux -L "$SOCK" send-keys -t t:0.0 'seq 1 300' Enter
  for i in $(seq 1 40); do
    [ "$(pane_history_size)" -gt 100 ] && return 0
    sleep 0.25
  done
  echo "history never filled (size=$(pane_history_size))"
  return 1
}

# Run the clear and record #{history_size} from inside the pane, in the same
# compound command — nothing can scroll into history between clear and read.
run_clear_recording_size() {
  local out=$1
  tmux -L "$SOCK" send-keys -t t:0.0 \
    "HOME='$FAKE_HOME' '$SCRIPTS_DIR/tmux-history-clear.sh' && tmux display -pt . '#{history_size}' > '$out'" Enter
  local i
  for i in $(seq 1 40); do
    [ -s "$out" ] && return 0
    sleep 0.25
  done
  echo "script never produced a size capture in $out"
  return 1
}

@test "clear: scrollback drops to zero" {
  fill_history
  run_clear_recording_size "$FAKE_HOME/size_after"
  [ "$(cat "$FAKE_HOME/size_after")" -eq 0 ]
}

@test "clear: scrollback keeps recording afterwards — no false off state" {
  fill_history
  run_clear_recording_size "$FAKE_HOME/size_after"
  [ "$(cat "$FAKE_HOME/size_after")" -eq 0 ]

  # New output after the clear must land in history: there is no "off".
  fill_history
}

@test "clear: second invocation clears again — no toggle mode survives" {
  fill_history
  run_clear_recording_size "$FAKE_HOME/size_first"
  [ "$(cat "$FAKE_HOME/size_first")" -eq 0 ]

  fill_history
  run_clear_recording_size "$FAKE_HOME/size_second"
  [ "$(cat "$FAKE_HOME/size_second")" -eq 0 ]
}

@test "clear: failed clear-history aborts before the success message" {
  # A dead pane target must fail loudly, not display "cleared". Run inside
  # the isolated server so the bogus id resolves against it, not the
  # machine's default tmux socket.
  tmux -L "$SOCK" send-keys -t t:0.0 \
    "HOME='$FAKE_HOME' '$SCRIPTS_DIR/tmux-history-clear.sh' '%999'; echo \$? > '$FAKE_HOME/exit_code'" Enter
  local i
  for i in $(seq 1 40); do
    [ -s "$FAKE_HOME/exit_code" ] && break
    sleep 0.25
  done
  [ -s "$FAKE_HOME/exit_code" ]
  [ "$(cat "$FAKE_HOME/exit_code")" -ne 0 ]
}
