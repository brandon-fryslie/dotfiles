#!/usr/bin/env bats
# test-extract-functions.bats - Functional tests for the finding-duplicate-functions scripts
#
# TICKETS: dotfiles-script-audit-lbl.11, dotfiles-script-audit-lbl.19
#
# BUG VALIDATED (.11):
# extract-functions.sh ran rg with `2>/dev/null || true`, so an rg failure
# (not installed → 127, bad glob → 2) produced an empty catalog, the message
# "Extracted 0 function definitions", and exit 0 — a silent total failure the
# downstream duplicate analysis read as "no functions in the codebase".
# rg's exit contract is three-valued: 0 = matches, 1 = no matches, ≥2 = error.
# Only 0 and 1 are success; everything else must be fatal with stderr visible.
#
# GAMING RESISTANCE:
# - Runs the real script against real fixture trees with the system rg
# - The rg-missing case strips rg from PATH rather than mocking exit codes
# - Failure cases assert the catalog file does NOT exist — a fix that exits
#   nonzero but still writes the lying empty [] fails the test
# - The no-matches case pins exit 0 with a [] catalog, so a fix that treats
#   rg exit 1 as fatal (over-correcting) also fails
#
# BUG VALIDATED (.19):
# All three scripts in the skill (extract-functions.sh, generate-report.sh,
# prepare-category-analysis.sh) routed the missing-required-argument error
# through usage(), which unconditionally exited 0 — "Error: ... required" on
# stderr but success to any set -e harness or && chain. Exit codes are the
# CLI contract: error paths must exit nonzero, -h must still exit 0, and the
# error-path usage text must land on stderr, not the data stream.
#
# GAMING RESISTANCE (.19):
# - Asserts stdout is EMPTY on the error path (separate-stderr), so a fix
#   that exits 1 but dumps usage into the data stream fails
# - Pins -h exit 0 per script, so a fix that makes usage always exit 1
#   (over-correcting) also fails

bats_require_minimum_version 1.5.0

load '../helpers/test-helpers'

SCRIPTS_DIR="$BATS_TEST_DIRNAME/../../config/codex/skills/finding-duplicate-functions/scripts"
SCRIPT="$SCRIPTS_DIR/extract-functions.sh"

setup() {
  require_command rg "brew install ripgrep"
  require_command jq "brew install jq"

  WORK=$(create_test_dir)
  mkdir -p "$WORK/src" "$WORK/empty"
  printf 'export function fooBar(x) {\n  return x + 1;\n}\n' > "$WORK/src/a.ts"
  printf '// no functions here\n' > "$WORK/empty/b.ts"
}

teardown() {
  rm -rf "$WORK"
}

@test "matches found: exit 0 and catalog contains the function" {
  run "$SCRIPT" -o "$WORK/out.json" "$WORK/src"
  [ "$status" -eq 0 ]
  run jq -r '.[0].name' "$WORK/out.json"
  [ "$output" = "fooBar" ]
}

@test "no matches (rg exit 1): exit 0 with an empty catalog" {
  run "$SCRIPT" -o "$WORK/out.json" "$WORK/empty"
  [ "$status" -eq 0 ]
  run jq -c '.' "$WORK/out.json"
  [ "$output" = "[]" ]
}

@test "rg error (bad glob): nonzero exit, stderr surfaced, no catalog written" {
  run "$SCRIPT" -t '{{' -o "$WORK/out.json" "$WORK/src"
  [ "$status" -ne 0 ]
  [[ "$output" == *"rg failed"* ]]
  [ ! -e "$WORK/out.json" ]
}

@test "rg missing from PATH: nonzero exit, no catalog written" {
  run -127 env PATH=/usr/bin:/bin "$SCRIPT" -o "$WORK/out.json" "$WORK/src"
  [ ! -e "$WORK/out.json" ]
}

# --- .19: missing required argument must exit nonzero (all three scripts) ---

@test "extract-functions: missing source dir exits nonzero, error+usage on stderr, stdout empty" {
  run --separate-stderr "$SCRIPT"
  [ "$status" -ne 0 ]
  [ -z "$output" ]
  [[ "$stderr" == *"source directory required"* ]]
  [[ "$stderr" == *"Usage:"* ]]
}

@test "extract-functions: -h exits 0 with usage on stdout" {
  run --separate-stderr "$SCRIPT" -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "generate-report: missing duplicates dir exits nonzero, error+usage on stderr, stdout empty" {
  run --separate-stderr "$SCRIPTS_DIR/generate-report.sh"
  [ "$status" -ne 0 ]
  [ -z "$output" ]
  [[ "$stderr" == *"duplicates directory required"* ]]
  [[ "$stderr" == *"Usage:"* ]]
}

@test "generate-report: -h exits 0 with usage on stdout" {
  run --separate-stderr "$SCRIPTS_DIR/generate-report.sh" -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "prepare-category-analysis: missing categorized.json exits nonzero, error+usage on stderr, stdout empty" {
  run --separate-stderr "$SCRIPTS_DIR/prepare-category-analysis.sh"
  [ "$status" -ne 0 ]
  [ -z "$output" ]
  [[ "$stderr" == *"categorized.json required"* ]]
  [[ "$stderr" == *"Usage:"* ]]
}

@test "prepare-category-analysis: -h exits 0 with usage on stdout" {
  run --separate-stderr "$SCRIPTS_DIR/prepare-category-analysis.sh" -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}
