#!/usr/bin/env bats
# test-extract-functions.bats - Functional tests for the function-catalog extractor
#
# TICKET: dotfiles-script-audit-lbl.11
#
# BUG VALIDATED:
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

bats_require_minimum_version 1.5.0

load '../helpers/test-helpers'

SCRIPT="$BATS_TEST_DIRNAME/../../config/codex/skills/finding-duplicate-functions/scripts/extract-functions.sh"

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
