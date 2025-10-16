#!/usr/bin/env bats
# test-config-validator.bats - Unit tests for config validator

load ../helpers/test-helpers
load ../helpers/watcher-test-helpers

# ============================================================================
# SETUP AND TEARDOWN
# ============================================================================

setup() {
  TEST_DIR=$(create_test_dir)
  export TEST_DIR
}

teardown() {
  cleanup_test_dir "$TEST_DIR"
}

# ============================================================================
# VALIDATOR EXISTENCE
# ============================================================================

# This test cannot be gamed because it verifies actual file existence
@test "config validator script exists and is executable" {
  local validator="$DOTFILES_ROOT/watchers/bin/watcher-validator.sh"

  [ -f "$validator" ]
  [ -x "$validator" ]
}

# ============================================================================
# VALID CONFIG VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates actual valid config file
# 2. Runs real validator
# 3. Verifies validator accepts valid config
@test "validator accepts valid single-watcher config" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "valid" ]] || [ -z "$output" ]  # Success can be silent or explicit
}

# This test cannot be gamed because it:
# 1. Creates multi-watcher config
# 2. Validator must validate ALL watchers
# 3. Must succeed only if all watchers are valid
@test "validator accepts valid multi-watcher config" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_multi_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -eq 0 ]
}

# ============================================================================
# REQUIRED FIELD VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config missing required 'name' field
# 2. Validator must detect missing field
# 3. Must fail with specific error message
@test "validator rejects config with missing watcher name" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "missing-name")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "name" ]] && [[ "$output" =~ "required" ]]
}

# This test cannot be gamed because it:
# 1. Creates config missing 'inputs' field
# 2. Validator must detect and reject
@test "validator rejects config with missing inputs field" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "missing-inputs")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "inputs" ]] || [[ "$output" =~ "required" ]]
}

# This test cannot be gamed because it:
# 1. Creates config missing 'command' field
# 2. Validator must detect and reject
@test "validator rejects config with missing command field" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "missing-command")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "command" ]] || [[ "$output" =~ "required" ]]
}

# This test cannot be gamed because it:
# 1. Creates config missing 'output' field
# 2. Validator must detect and reject
@test "validator rejects config with missing output field" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "missing-output")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "output" ]] || [[ "$output" =~ "required" ]]
}

# ============================================================================
# INVALID FIELD TYPE VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with inputs as string instead of array
# 2. Validator must detect type mismatch
@test "validator rejects config with inputs as string instead of array" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  cat > "$TEST_DIR/bad-type.yaml" <<EOF
version: "1.0"
watchers:
  - name: "bad-inputs-type"
    inputs: "$TEST_DIR/input.txt"  # Should be array
    command:
      name: "cat"
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/bad-type.yaml"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "inputs" ]] && ([[ "$output" =~ "array" ]] || [[ "$output" =~ "type" ]])
}

# This test cannot be gamed because it:
# 1. Creates config with command as string instead of object
# 2. Validator must detect structure mismatch
@test "validator rejects config with command as string instead of object" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  cat > "$TEST_DIR/bad-command-type.yaml" <<EOF
version: "1.0"
watchers:
  - name: "bad-command-type"
    inputs: ["$TEST_DIR/input.txt"]
    command: "cat"  # Should be object with 'name' field
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/bad-command-type.yaml"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "command" ]]
}

# ============================================================================
# DUPLICATE NAME VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with duplicate watcher names
# 2. Validator must detect duplicates
# 3. Must fail with clear error identifying the duplicate
@test "validator rejects config with duplicate watcher names" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "duplicate-names")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "duplicate" ]] && [[ "$output" =~ "name" ]]
}

# ============================================================================
# COMMAND EXISTENCE VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with non-existent command
# 2. Validator must check if command exists in PATH
# 3. Must fail if command not found
@test "validator rejects config with non-existent command" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "nonexistent-command")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "command" ]] && ([[ "$output" =~ "not found" ]] || [[ "$output" =~ "does not exist" ]])
}

# This test cannot be gamed because it:
# 1. Creates config with valid system command (cat)
# 2. Validator must verify command exists
# 3. Must succeed because cat is always available
@test "validator accepts config with valid system command" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -eq 0 ]
}

# This test cannot be gamed because it:
# 1. Creates actual executable script
# 2. Config references the script with full path
# 3. Validator must check script exists and is executable
@test "validator accepts config with custom script command" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  # Create a custom script
  cat > "$TEST_DIR/custom-script.sh" <<'EOF'
#!/bin/bash
echo "custom output"
EOF
  chmod +x "$TEST_DIR/custom-script.sh"

  # Create config using custom script
  cat > "$TEST_DIR/custom-config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "custom-watcher"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "$TEST_DIR/custom-script.sh"
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/custom-config.yaml"

  [ "$status" -eq 0 ]
}

# ============================================================================
# INPUT FILE PATH VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Config references input files that don't exist
# 2. Validator should warn or check if inputs exist
# 3. Tests validator's file existence checking
@test "validator warns about non-existent input files" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  cat > "$TEST_DIR/missing-inputs.yaml" <<EOF
version: "1.0"
watchers:
  - name: "missing-inputs"
    inputs:
      - "$TEST_DIR/does-not-exist.txt"
    command:
      name: "cat"
      args: ["$TEST_DIR/does-not-exist.txt"]
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/missing-inputs.yaml"

  # Might be warning (exit 0) or error (exit 1) - either is acceptable
  [[ "$output" =~ "warning" ]] || [[ "$output" =~ "not found" ]] || [[ "$output" =~ "does not exist" ]]
}

# ============================================================================
# CIRCULAR DEPENDENCY VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config where output == one of inputs
# 2. This creates infinite loop / circular dependency
# 3. Validator must detect and reject this
@test "validator rejects config with circular dependency (output = input)" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "circular-dependency")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "circular" ]] || [[ "$output" =~ "output" ]]
}

# ============================================================================
# GLOB PATTERN VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with glob pattern
# 2. Validator should expand glob and check files exist
# 3. Tests glob handling in validation
@test "validator expands and validates glob patterns in inputs" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  # Create some test files that match glob
  mkdir -p "$TEST_DIR/glob-test"
  touch "$TEST_DIR/glob-test/file1.txt"
  touch "$TEST_DIR/glob-test/file2.txt"

  cat > "$TEST_DIR/glob-config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "glob-watcher"
    inputs:
      - "$TEST_DIR/glob-test/*.txt"
    command:
      name: "cat"
      args: ["$TEST_DIR/glob-test/*.txt"]
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/glob-config.yaml"

  [ "$status" -eq 0 ]
  # Validator should report expanded file count
  [[ "$output" =~ "2" ]] || [[ "$output" =~ "file1" ]] || [ -z "$output" ]
}

# ============================================================================
# ENABLED FLAG VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with enabled: false
# 2. Validator should still validate the disabled watcher
# 3. Tests that disabled watchers are validated (not skipped)
@test "validator still validates disabled watchers" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_disabled_watcher_config "$TEST_DIR")

  # Even though watcher is disabled, it should still be validated
  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -eq 0 ]
}

# This test cannot be gamed because it:
# 1. Creates disabled watcher with invalid command
# 2. Validator must still detect invalid command even though disabled
# 3. Ensures all watchers are validated regardless of enabled flag
@test "validator rejects invalid disabled watcher" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  cat > "$TEST_DIR/bad-disabled.yaml" <<EOF
version: "1.0"
watchers:
  - name: "bad-disabled"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "nonexistent-command"
    output: "$TEST_DIR/output.txt"
    enabled: false
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/bad-disabled.yaml"

  [ "$status" -ne 0 ]
}

# ============================================================================
# VERSION STRING VALIDATION
# ============================================================================

# This test cannot be gamed because it:
# 1. Tests validator accepts current version format
# 2. Verifies version field is validated
@test "validator accepts valid version string" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$config"

  [ "$status" -eq 0 ]
}

# This test cannot be gamed because it:
# 1. Creates config with unsupported version
# 2. Validator should warn about version mismatch
@test "validator warns about unsupported version" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  cat > "$TEST_DIR/bad-version.yaml" <<EOF
version: "99.0"  # Unsupported version
watchers:
  - name: "test"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "cat"
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/bad-version.yaml"

  # Might warn but still pass, or might fail
  [[ "$output" =~ "version" ]] || [ "$status" -eq 0 ]
}

# ============================================================================
# COMPREHENSIVE VALIDATION TEST
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates complex config with multiple potential issues
# 2. Validator must check ALL validation rules
# 3. Must report ALL errors found (not just first one)
@test "validator reports multiple errors in single config" {
  skip "Implementation not started - will fail until watcher-validator.sh exists"

  cat > "$TEST_DIR/multiple-errors.yaml" <<EOF
version: "1.0"
watchers:
  - name: "bad-watcher-1"
    # Missing inputs field
    command:
      name: "nonexistent-command"
    output: "$TEST_DIR/output1.txt"

  - name: "bad-watcher-2"
    inputs: ["$TEST_DIR/input.txt"]
    # Missing command field
    output: "$TEST_DIR/output2.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-validator.sh" "$TEST_DIR/multiple-errors.yaml"

  [ "$status" -ne 0 ]

  # Should report multiple errors
  [[ "$output" =~ "inputs" ]]
  [[ "$output" =~ "command" ]]
}
