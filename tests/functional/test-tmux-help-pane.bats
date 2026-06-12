#!/usr/bin/env bats
# test-tmux-help-pane.bats - Functional tests for help-pane color rendering
#
# TICKET: dotfiles-script-audit-lbl.27
#
# BUG VALIDATED:
# tmux-help-pane.sh defined its color variables with ordinary single quotes
# (CYAN='\033[0;36m'), so each \033 was four literal characters, and the body
# was emitted through `cat << EOF`, a heredoc that performs no escape
# interpretation. Every invocation therefore printed visible "\033[0;36m" /
# "\033[0m" text into the pane instead of colors.
#
# GAMING RESISTANCE:
# - Drives the real script and inspects its actual stdout, not its source
# - Asserts the rendered bytes: the literal 4-char sequence \033 must be ABSENT
#   (the bug) and a real ESC byte (0x1b) must be PRESENT (colors emitted)
# - A source-grep would pass on either quoting style; only running the script
#   distinguishes a real escape sequence from literal backslash text

load '../helpers/test-helpers'

SCRIPT="$BATS_TEST_DIRNAME/../../config/tmux/scripts/tmux-help-pane.sh"

# The script emits its heredoc immediately, then loops forever to keep the pane
# alive. Capture the early stdout, then stop it. Returns the captured output.
#
# [LAW:no-ambient-temporal-coupling] the keep-alive loop spawns a `sleep` child,
# so tearing down only the script's bash orphans that sleep. `set -m` makes the
# job its own process group; killing the group (-$pid) takes the loop and its
# sleep together — no leaked process survives the test.
# `3>&-` closes bats's status fd in the child: an inherited fd 3 held open by any
# straggler makes bats block forever waiting for TAP output to drain.
capture_help_output() {
  local out_file pid i
  out_file=$(create_test_dir)/out

  set -m
  bash "$SCRIPT" >"$out_file" 2>&1 3>&- </dev/null &
  pid=$!
  set +m

  # Wait for the heredoc to land, then stop the keep-alive loop.
  for i in $(seq 1 40); do
    [ -s "$out_file" ] && break
    sleep 0.1
  done
  kill -TERM -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true

  cat "$out_file"
}

@test "help pane: emits real ANSI escapes, not literal backslash text" {
  local out
  out=$(capture_help_output)

  [ -n "$out" ] || { echo "help pane produced no output"; return 1; }

  if printf '%s' "$out" | grep -q '\\033'; then
    echo "rendered output contains literal escape-code text:"
    printf '%s\n' "$out" | grep '\\033'
    return 1
  fi

  if ! printf '%s' "$out" | grep -q "$(printf '\033')"; then
    echo "rendered output contains no real ESC byte — colors not emitted"
    return 1
  fi
}
