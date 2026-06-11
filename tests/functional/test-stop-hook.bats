#!/usr/bin/env bats
# test-stop-hook.bats - Functional tests for the Stop-hook loop driver
#
# TICKET: dotfiles-script-audit-lbl.12
#
# BUGS VALIDATED:
# (1) A bare `exit 0` sat ABOVE the documented CLOD_LOOP_FOREVER gate, so the
#     env-var override could never fire and the entire counter/loop machinery
#     was unreachable dead code.
# (2) Two sequential `jq -r` calls both read the script's stdin; the first
#     consumed the whole JSON payload, the second got EOF, so transcript_path
#     was always empty and the "completely finished" early-exit could never
#     fire — every loop-mode session was forced through all 7 iterations.
#
# GAMING RESISTANCE:
# - Runs the real script with a real JSON payload on stdin, HOME isolated to
#   a temp dir so counter state never touches the user's ~/.claude
# - The loop-mode test asserts the counter file was written with the right
#   count — a fix that re-enables the gate but breaks the machinery fails
# - The completion-phrase test passes transcript_path as a tilde path, so it
#   fails unless stdin is captured once AND tilde expansion still works
# - The malformed-payload test pins loud failure: garbage in must not be
#   silently treated as "allow exit"

bats_require_minimum_version 1.5.0

load '../helpers/test-helpers'

SCRIPT="$BATS_TEST_DIRNAME/../../config/claude/personal-synced/bin/stop-hook.sh"

setup() {
  require_command jq "brew install jq"

  WORK=$(create_test_dir)
  HOOK_HOME="$WORK/home"
  mkdir -p "$HOOK_HOME"
}

teardown() {
  rm -rf "$WORK"
}

payload() {
  printf '{"session_id":"%s","transcript_path":"%s","hook_event_name":"Stop","stop_hook_active":true}' "$1" "$2"
}

@test "loop mode off (default): exit 0 without touching counter state" {
  run env -u CLOD_LOOP_FOREVER HOME="$HOOK_HOME" "$SCRIPT" \
    <<<"$(payload sess-off '~/transcript.jsonl')"
  [ "$status" -eq 0 ]
  [ ! -e "$HOOK_HOME/.claude/stop-hook-counters" ]
}

@test "loop mode on, first run: exit 2, counter written, continue prompt on stderr" {
  run env CLOD_LOOP_FOREVER=1 HOME="$HOOK_HOME" "$SCRIPT" \
    <<<"$(payload sess-loop '~/transcript.jsonl')"
  [ "$status" -eq 2 ]
  [ "$(cat "$HOOK_HOME/.claude/stop-hook-counters/sess-loop")" = "1" ]
  [[ "$output" == *"run 1/7"* ]]
}

@test "loop mode on, completion phrase in transcript (tilde path): exit 0" {
  printf 'We are completely finished\n' > "$HOOK_HOME/transcript.jsonl"
  run env CLOD_LOOP_FOREVER=1 HOME="$HOOK_HOME" "$SCRIPT" \
    <<<"$(payload sess-done '~/transcript.jsonl')"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Detected completion phrase"* ]]
}

@test "loop mode on, 7th run: exit 0 allowing exit" {
  mkdir -p "$HOOK_HOME/.claude/stop-hook-counters"
  echo 6 > "$HOOK_HOME/.claude/stop-hook-counters/sess-max"
  run env CLOD_LOOP_FOREVER=1 HOME="$HOOK_HOME" "$SCRIPT" \
    <<<"$(payload sess-max '~/transcript.jsonl')"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Allowing exit"* ]]
}

@test "loop mode on, malformed payload: loud nonzero failure" {
  run env CLOD_LOOP_FOREVER=1 HOME="$HOOK_HOME" "$SCRIPT" <<<'not json'
  [ "$status" -ne 0 ]
  [ "$status" -ne 2 ]
}
