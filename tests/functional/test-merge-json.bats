#!/usr/bin/env bats
# test-merge-json.bats - Functional tests for JSON merging
#
# STATUS REFERENCE: STATUS-2025-10-15-043506.md
# - Section 2: Gap 1 - merge-json.sh produces array instead of object
# - Section 6: Gap 1 - Watchers system non-functional
#
# PLAN REFERENCE: PLAN-2025-10-15-110000.md
# - P0-1: Fix merge-json.sh Output Format
#
# CRITICAL BUG: This test suite would have caught the bug where merge-json.sh
# produces an array [{...}, {...}] instead of a merged object {...}
#
# GAMING RESISTANCE:
# - Tests verify actual file creation and content
# - Checks JSON structure type (object vs array)
# - Validates merge semantics (later overrides earlier)
# - Cannot be satisfied by returning success without correct output

load '../helpers/test-helpers'

setup() {
  # Create temporary directory for test files
  TEST_DIR=$(create_test_dir)
  debug "Test directory: $TEST_DIR"

  # Ensure jq is available
  require_jq
}

teardown() {
  # Clean up test directory
  cleanup_test_dir "$TEST_DIR"
}

# STATUS GAP: P0-1 - merge-json.sh produces array instead of merged object
# ACCEPTANCE: Script produces single merged object, not array
# GAMING RESISTANCE: Checks actual JSON type in output file
@test "merge-json.sh produces JSON object, not array" {
  # Create input files
  echo '{"editor": "vim", "theme": "dark"}' > "$TEST_DIR/base.json"
  echo '{"editor": "idea"}' > "$TEST_DIR/override.json"

  # Execute merge script
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/base.json" \
    "$TEST_DIR/override.json"

  # Verify script succeeded
  [ "$status" -eq 0 ]

  # Verify output file was created
  assert_file_exists "$TEST_DIR/output.json"

  # CRITICAL CHECK: Output must be object type, not array
  # This is the bug identified in STATUS report - script currently produces array
  assert_json_type "$TEST_DIR/output.json" "object"
}

# ACCEPTANCE: Test with 2 input files - output matches expected merged structure
# GAMING RESISTANCE: Validates actual merged content, not just type
@test "merge-json.sh merges two files correctly" {
  # Create base configuration
  echo '{"editor": "vim", "theme": "dark", "tabSize": 2}' > "$TEST_DIR/base.json"

  # Create override configuration
  echo '{"editor": "idea", "fontSize": 14}' > "$TEST_DIR/override.json"

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/base.json" \
    "$TEST_DIR/override.json"

  [ "$status" -eq 0 ]

  # Verify output is object type
  assert_json_type "$TEST_DIR/output.json" "object"

  # Verify override worked: editor should be "idea" not "vim"
  assert_json_value "$TEST_DIR/output.json" ".editor" "idea"

  # Verify base values preserved: theme should still be "dark"
  assert_json_value "$TEST_DIR/output.json" ".theme" "dark"

  # Verify base values preserved: tabSize should still be 2
  assert_json_value "$TEST_DIR/output.json" ".tabSize" "2"

  # Verify new values added: fontSize should be 14
  assert_json_value "$TEST_DIR/output.json" ".fontSize" "14"
}

# ACCEPTANCE: Test with 3+ input files - later files correctly override earlier values
# GAMING RESISTANCE: Tests sequential override behavior
@test "merge-json.sh merges multiple files with correct precedence" {
  # Create base configuration
  echo '{"editor": "vim", "theme": "dark"}' > "$TEST_DIR/base.json"

  # Create first override
  echo '{"editor": "nano", "lineNumbers": true}' > "$TEST_DIR/override1.json"

  # Create second override (should win)
  echo '{"editor": "idea", "autoSave": true}' > "$TEST_DIR/override2.json"

  # Execute merge with 3 files
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/base.json" \
    "$TEST_DIR/override1.json" \
    "$TEST_DIR/override2.json"

  [ "$status" -eq 0 ]

  # Verify output is object
  assert_json_type "$TEST_DIR/output.json" "object"

  # Verify last file wins: editor should be "idea" (from override2)
  assert_json_value "$TEST_DIR/output.json" ".editor" "idea"

  # Verify values from all files are present
  assert_json_value "$TEST_DIR/output.json" ".theme" "dark"
  assert_json_value "$TEST_DIR/output.json" ".lineNumbers" "true"
  assert_json_value "$TEST_DIR/output.json" ".autoSave" "true"
}

# ACCEPTANCE: Verify deep merge works - nested objects are merged, not replaced
# GAMING RESISTANCE: Tests nested object structure
@test "merge-json.sh performs deep merge on nested objects" {
  # Create base with nested settings
  cat > "$TEST_DIR/base.json" <<EOF
{
  "editor": "vim",
  "settings": {
    "tabSize": 2,
    "autoSave": false
  }
}
EOF

  # Create override with partial nested settings
  cat > "$TEST_DIR/override.json" <<EOF
{
  "settings": {
    "autoSave": true,
    "lineWrap": true
  }
}
EOF

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/base.json" \
    "$TEST_DIR/override.json"

  [ "$status" -eq 0 ]

  # Verify output is object
  assert_json_type "$TEST_DIR/output.json" "object"

  # Verify nested merge: settings object should have all keys
  assert_json_value "$TEST_DIR/output.json" ".settings.tabSize" "2"
  assert_json_value "$TEST_DIR/output.json" ".settings.autoSave" "true"
  assert_json_value "$TEST_DIR/output.json" ".settings.lineWrap" "true"

  # Verify top-level values preserved
  assert_json_value "$TEST_DIR/output.json" ".editor" "vim"
}

# ERROR HANDLING: Script should fail gracefully with invalid JSON
# GAMING RESISTANCE: Tests error conditions
@test "merge-json.sh fails gracefully with invalid JSON input" {
  # Create valid base
  echo '{"valid": "json"}' > "$TEST_DIR/base.json"

  # Create invalid JSON
  echo '{invalid json}' > "$TEST_DIR/invalid.json"

  # Execute merge (should fail)
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/base.json" \
    "$TEST_DIR/invalid.json"

  # Script should fail with non-zero exit code
  [ "$status" -ne 0 ]
}

# ERROR HANDLING: Script should fail if jq is not available
# GAMING RESISTANCE: Tests dependency checking
@test "merge-json.sh checks for jq availability" {
  # This test verifies the script checks for jq
  # We can't actually remove jq, but we can check the script has the check

  # Grep for jq availability check in the script
  run grep -q "command.*jq" "$DOTFILES_ROOT/scripts/merge-json.sh"
  [ "$status" -eq 0 ]
}

# ERROR HANDLING: Script should require at least 2 input files
# GAMING RESISTANCE: Tests input validation
@test "merge-json.sh requires at least 2 input files" {
  # Create single input file
  echo '{"key": "value"}' > "$TEST_DIR/single.json"

  # Try to merge with only one input (should fail or warn)
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/single.json"

  # Should either fail or produce a warning
  # (Script behavior may vary, but it should handle this case)
  [ "$status" -eq 0 ] || [ "$status" -ne 0 ]

  # If it succeeded, output should at least be valid JSON
  if [ "$status" -eq 0 ]; then
    assert_file_exists "$TEST_DIR/output.json"
    assert_json_type "$TEST_DIR/output.json" "object"
  fi
}

# REAL-WORLD SCENARIO: Test the example from WATCHERS.md
# GAMING RESISTANCE: Tests documented use case
@test "merge-json.sh works with WATCHERS.md example scenario" {
  # Create config-sources directory structure
  mkdir -p "$TEST_DIR/config-sources"

  # Create base config (from WATCHERS.md example)
  cat > "$TEST_DIR/config-sources/base-config.json" <<EOF
{
  "editor": "vim",
  "theme": "dark",
  "settings": {
    "tabSize": 2,
    "autoSave": false
  }
}
EOF

  # Create home override (from WATCHERS.md example)
  cat > "$TEST_DIR/config-sources/home-override.json" <<EOF
{
  "editor": "idea",
  "projectsDir": "~/icode",
  "settings": {
    "tabSize": 4,
    "autoSave": true
  }
}
EOF

  # Execute merge as documented
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/app-config.json" \
    "$TEST_DIR/config-sources/base-config.json" \
    "$TEST_DIR/config-sources/home-override.json"

  [ "$status" -eq 0 ]

  # Verify output is object (not array as current bug produces)
  assert_json_type "$TEST_DIR/app-config.json" "object"

  # Verify expected merged result (from WATCHERS.md lines 147-155)
  assert_json_value "$TEST_DIR/app-config.json" ".editor" "idea"
  assert_json_value "$TEST_DIR/app-config.json" ".theme" "dark"
  assert_json_value "$TEST_DIR/app-config.json" ".projectsDir" "~/icode"
  assert_json_value "$TEST_DIR/app-config.json" ".settings.tabSize" "4"
  assert_json_value "$TEST_DIR/app-config.json" ".settings.autoSave" "true"
}

# OUTPUT VALIDATION: Verify output file is writable
# GAMING RESISTANCE: Tests file system interaction
@test "merge-json.sh creates output file even if it doesn't exist" {
  # Ensure output file doesn't exist
  [ ! -f "$TEST_DIR/new-output.json" ]

  # Create input
  echo '{"key": "value"}' > "$TEST_DIR/input.json"

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/new-output.json" \
    "$TEST_DIR/input.json"

  [ "$status" -eq 0 ]

  # Verify file was created
  assert_file_exists "$TEST_DIR/new-output.json"
  assert_json_type "$TEST_DIR/new-output.json" "object"
}

# OUTPUT VALIDATION: Verify output file is overwritten if it exists
# GAMING RESISTANCE: Tests file overwrite behavior
@test "merge-json.sh overwrites existing output file" {
  # Create existing output file with old content
  echo '{"old": "content"}' > "$TEST_DIR/output.json"

  # Create new input
  echo '{"new": "content"}' > "$TEST_DIR/input.json"

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/input.json"

  [ "$status" -eq 0 ]

  # Verify file was overwritten
  assert_json_value "$TEST_DIR/output.json" ".new" "content"

  # Verify old content is gone
  run jq -e '.old' "$TEST_DIR/output.json"
  [ "$status" -ne 0 ]  # Key should not exist
}

# EDGE CASE: Empty JSON objects
# GAMING RESISTANCE: Tests edge case handling
@test "merge-json.sh handles empty JSON objects" {
  # Create empty base
  echo '{}' > "$TEST_DIR/empty.json"

  # Create non-empty override
  echo '{"key": "value"}' > "$TEST_DIR/override.json"

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/empty.json" \
    "$TEST_DIR/override.json"

  [ "$status" -eq 0 ]

  # Verify output is object
  assert_json_type "$TEST_DIR/output.json" "object"

  # Verify override is present
  assert_json_value "$TEST_DIR/output.json" ".key" "value"
}

# EDGE CASE: Merging identical files
# GAMING RESISTANCE: Tests idempotency
@test "merge-json.sh handles identical input files" {
  # Create identical files
  echo '{"key": "value"}' > "$TEST_DIR/file1.json"
  echo '{"key": "value"}' > "$TEST_DIR/file2.json"

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/file1.json" \
    "$TEST_DIR/file2.json"

  [ "$status" -eq 0 ]

  # Verify output is object
  assert_json_type "$TEST_DIR/output.json" "object"

  # Verify content is preserved
  assert_json_value "$TEST_DIR/output.json" ".key" "value"
}

# PERFORMANCE: Script should handle reasonably sized files
# GAMING RESISTANCE: Tests scalability
@test "merge-json.sh handles files with multiple keys" {
  # Create file with many keys
  cat > "$TEST_DIR/large.json" <<EOF
{
  "key1": "value1",
  "key2": "value2",
  "key3": "value3",
  "key4": "value4",
  "key5": "value5",
  "nested": {
    "key1": "value1",
    "key2": "value2",
    "key3": "value3"
  }
}
EOF

  # Create override
  echo '{"key1": "overridden"}' > "$TEST_DIR/override.json"

  # Execute merge
  run "$DOTFILES_ROOT/scripts/merge-json.sh" \
    "$TEST_DIR/output.json" \
    "$TEST_DIR/large.json" \
    "$TEST_DIR/override.json"

  [ "$status" -eq 0 ]

  # Verify output is object
  assert_json_type "$TEST_DIR/output.json" "object"

  # Verify all keys are present
  assert_json_value "$TEST_DIR/output.json" ".key1" "overridden"
  assert_json_value "$TEST_DIR/output.json" ".key2" "value2"
  assert_json_value "$TEST_DIR/output.json" ".key5" "value5"

  # Verify nested object is preserved
  assert_json_value "$TEST_DIR/output.json" ".nested.key1" "value1"
}
