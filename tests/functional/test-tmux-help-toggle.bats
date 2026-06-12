#!/usr/bin/env bats
# test-tmux-help-toggle.bats - Functional tests for help-pane id capture
#
# TICKET: dotfiles-script-audit-lbl.4
#
# BUG VALIDATED:
# tmux-help-toggle.sh (and tmux-help-debug.sh) captured the new pane id with
# `tmux list-panes | tail -1` after a detached split. split-window inserts the
# new pane after the ACTIVE pane, not at the end, so in any window where the
# active pane is not last the wrong id landed in @help_pane_id and the next
# toggle killed the user's working pane.
#
# GAMING RESISTANCE:
# - Drives the real scripts inside a real, isolated tmux server (-L socket)
# - Reproduces the exact trigger topology: 2 panes, active pane NOT last
# - Asserts @help_pane_id equals the pane that genuinely appeared (set diff
#   of pane ids before/after), not any pane the script claims it created
# - Asserts toggle-off kills only the help pane and both working panes survive

load '../helpers/test-helpers'

SCRIPTS_DIR="$BATS_TEST_DIRNAME/../../config/tmux/scripts"

setup() {
  require_command tmux

  SOCK="bats-help-$$-$BATS_TEST_NUMBER"

  # Isolated HOME so the scripts' $HOME/.config/tmux/... path resolves to the
  # repo scripts under test, independent of the machine's install state.
  FAKE_HOME=$(create_test_dir)
  mkdir -p "$FAKE_HOME/.config/tmux"
  ln -s "$SCRIPTS_DIR" "$FAKE_HOME/.config/tmux/scripts"

  # Plain bash panes: fast startup, no user shell config involved.
  tmux -L "$SOCK" -f /dev/null new-session -d -s t -x 200 -y 50 "exec bash --norc"
  tmux -L "$SOCK" split-window -h -t t:0 "exec bash --norc"
  tmux -L "$SOCK" select-pane -t t:0.0
}

teardown() {
  tmux -L "$SOCK" kill-server 2>/dev/null || true
  cleanup_test_dir "$FAKE_HOME"
}

list_pane_ids() {
  tmux -L "$SOCK" list-panes -t t:0 -F '#{pane_id}'
}

run_in_pane() {
  tmux -L "$SOCK" send-keys -t t:0.0 "HOME='$FAKE_HOME' '$SCRIPTS_DIR/$1'" Enter
}

wait_for_pane_count() {
  local want=$1 i
  for i in $(seq 1 40); do
    [ "$(list_pane_ids | wc -l | tr -d ' ')" -eq "$want" ] && return 0
    sleep 0.25
  done
  return 1
}

# Runs the create-side assertion for either script: the stored @help_pane_id
# must be the pane that actually appeared, in the active-pane-not-last topology.
assert_stores_real_pane_id() {
  local script=$1
  local before after new stored

  before=$(list_pane_ids)
  run_in_pane "$script"
  wait_for_pane_count 3 || {
    echo "no new pane appeared after running $script"
    return 1
  }
  after=$(list_pane_ids)

  new=$(comm -13 <(echo "$before" | sort) <(echo "$after" | sort))
  stored=$(tmux -L "$SOCK" show -gv @help_pane_id)

  [ -n "$new" ] || { echo "could not identify new pane"; return 1; }
  if [ "$stored" != "$new" ]; then
    echo "stored @help_pane_id=$stored but the actually-created pane is $new"
    return 1
  fi
}

@test "toggle: @help_pane_id holds the actually-created pane, not tail -1" {
  assert_stores_real_pane_id tmux-help-toggle.sh
}

@test "toggle off: kills only the help pane, working panes survive" {
  local before new final p

  before=$(list_pane_ids)
  run_in_pane tmux-help-toggle.sh
  wait_for_pane_count 3
  new=$(comm -13 <(echo "$before" | sort) <(list_pane_ids | sort))

  run_in_pane tmux-help-toggle.sh
  wait_for_pane_count 2 || {
    echo "pane count never returned to 2 after toggle-off"
    return 1
  }
  final=$(list_pane_ids)

  if echo "$final" | grep -q "^$new$"; then
    echo "help pane $new survived toggle-off"
    return 1
  fi
  for p in $before; do
    if ! echo "$final" | grep -q "^$p$"; then
      echo "working pane $p was killed by toggle-off"
      return 1
    fi
  done
}

@test "debug: @help_pane_id holds the actually-created pane, not tail -1" {
  assert_stores_real_pane_id tmux-help-debug.sh
}

@test "debug: fresh server (option never set) creates a help pane instead of no-op" {
  # Bug: show -gv @help_pane_id 2>&1 captured the error text into HELP_PANE on
  # a server where the option was never set; the non-empty string routed to the
  # kill branch, which then no-oped because grep found no matching pane id.
  # Fix: show -gqv ... 2>/dev/null returns empty string when option is absent.
  local before after new stored

  before=$(list_pane_ids)
  run_in_pane tmux-help-debug.sh
  wait_for_pane_count 3 || {
    echo "no pane appeared on a fresh server — fresh-server no-op bug is back"
    return 1
  }
  after=$(list_pane_ids)
  new=$(comm -13 <(echo "$before" | sort) <(echo "$after" | sort))
  stored=$(tmux -L "$SOCK" show -gqv @help_pane_id 2>/dev/null)
  [ "$stored" = "$new" ] || {
    echo "stored @help_pane_id=$stored but new pane is $new"
    return 1
  }
}

@test "toggle: cross-window pane detected globally — toggle-off kills it, no duplicate" {
  # Bug: list-panes without -a only checked the current window; a help pane
  # open in window 0 was invisible from window 1, so toggle created a second
  # help pane in window 1 instead of killing the existing one.
  # Fix: list-panes -aF searches all windows globally.
  # Expected: toggle from window 1 kills the existing pane (total 4→3), not
  # creates a new one (total 4→5).
  local first_pane total

  # Create help pane in window 0; setup gives us 2 working panes + 1 help = 3.
  run_in_pane tmux-help-toggle.sh
  wait_for_pane_count 3 || { echo "first toggle did not create a pane"; return 1; }
  first_pane=$(tmux -L "$SOCK" show -gqv @help_pane_id 2>/dev/null)

  # Open window 1 (1 new pane) — total is now 4.
  tmux -L "$SOCK" new-window -t t "exec bash --norc"

  # Toggle from window 1 — should detect the global help pane and kill it.
  tmux -L "$SOCK" send-keys -t t:1.0 "HOME='$FAKE_HOME' '$SCRIPTS_DIR/tmux-help-toggle.sh'" Enter

  # Wait: total should drop back to 3 (help pane killed), not rise to 5 (dup).
  local i
  for i in $(seq 1 40); do
    total=$(tmux -L "$SOCK" list-panes -aF '#{pane_id}' | wc -l | tr -d ' ')
    [ "$total" -ne 4 ] && break
    sleep 0.25
  done

  [ "$total" -eq 3 ] || {
    echo "expected 3 total panes after cross-window toggle-off (help pane killed); got $total"
    echo "(5 = duplicate created, still-at-4 = timeout/no-op)"
    return 1
  }

  # Help pane is gone; the two original working panes in window 0 survive.
  local final_all
  final_all=$(tmux -L "$SOCK" list-panes -aF '#{pane_id}')
  if echo "$final_all" | grep -q "^$first_pane$"; then
    echo "help pane $first_pane survived the cross-window toggle-off"
    return 1
  fi
}
