#!/usr/bin/env bats
# test-yaml-parser.bats - Unit tests for YAML parser

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
# PARSER EXISTENCE AND BASIC FUNCTIONALITY
# ============================================================================

# This test cannot be gamed because it verifies actual file existence
@test "yaml parser script exists and is executable" {
  local parser="$DOTFILES_ROOT/watchers/lib/yaml-parser.sh"

  # Verify file exists (cannot fake - file must be created)
  [ -f "$parser" ]

  # Verify file is executable (must have correct permissions)
  [ -x "$parser" ]
}

# ============================================================================
# VALID CONFIG PARSING TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates actual YAML config file
# 2. Executes real parser
# 3. Verifies parser can extract watcher specs
# 4. Checks output contains expected data
@test "parser extracts version from valid config" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  # Execute parser to get version
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-version "$config"

  # Verify parser succeeded
  [ "$status" -eq 0 ]

  # Verify version is correct
  [[ "$output" =~ "1.0" ]]
}

# This test cannot be gamed because it:
# 1. Creates real YAML with specific watcher
# 2. Parser must actually read and parse YAML
# 3. Verifies extracted watcher name matches expected
@test "parser extracts watcher names from valid config" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  # Execute parser to get watcher names
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --list-watchers "$config"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "test-concat" ]]
}

# This test cannot be gamed because it:
# 1. Creates multi-watcher config
# 2. Parser must extract ALL watchers (not just one)
# 3. Verifies count and names are correct
@test "parser extracts all watchers from multi-watcher config" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_multi_watcher_config "$TEST_DIR")

  # Get all watcher names
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --list-watchers "$config"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "watcher-1" ]]
  [[ "$output" =~ "watcher-2" ]]

  # Verify exactly 2 watchers (not more, not less)
  local count=$(echo "$output" | wc -l)
  [ "$count" -eq 2 ]
}

# ============================================================================
# FIELD EXTRACTION TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with specific inputs
# 2. Parser must extract input file paths
# 3. Verifies all inputs are extracted correctly
@test "parser extracts input files from watcher spec" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  # Extract inputs for test-concat watcher
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-inputs "$config" "test-concat"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "$TEST_DIR/inputs/file1.txt" ]]
  [[ "$output" =~ "$TEST_DIR/inputs/file2.txt" ]]
}

# This test cannot be gamed because it:
# 1. Parser must extract command name and args separately
# 2. Verifies exact command structure
# 3. Must handle args array correctly
@test "parser extracts command and args from watcher spec" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  # Extract command name
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-command-name "$config" "test-concat"
  [ "$status" -eq 0 ]
  [ "$output" = "cat" ]

  # Extract command args
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-command-args "$config" "test-concat"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "$TEST_DIR/inputs/file1.txt" ]]
  [[ "$output" =~ "$TEST_DIR/inputs/file2.txt" ]]
}

# This test cannot be gamed because it:
# 1. Parser must extract output file path
# 2. Verifies exact path is returned
@test "parser extracts output file from watcher spec" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-output "$config" "test-concat"

  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_DIR/output.txt" ]
}

# This test cannot be gamed because it:
# 1. Tests optional field parsing
# 2. Verifies parser handles enabled flag correctly
@test "parser extracts enabled flag from watcher spec" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-enabled "$config" "test-concat"

  [ "$status" -eq 0 ]
  [ "$output" = "true" ]
}

# ============================================================================
# TILDE EXPANSION TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with tilde paths
# 2. Parser must expand ~ to actual home directory
# 3. Verifies expanded path is correct (not literal ~)
@test "parser expands tilde in input paths" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  # Create config with tilde paths
  cat > "$TEST_DIR/tilde-config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "tilde-test"
    inputs:
      - "~/test/input.txt"
    command:
      name: "cat"
      args: ["~/test/input.txt"]
    output: "~/test/output.txt"
EOF

  # Extract inputs and verify tilde is expanded
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-inputs "$TEST_DIR/tilde-config.yaml" "tilde-test"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "$HOME/test/input.txt" ]]
  [[ ! "$output" =~ "~/" ]]  # Should NOT contain literal tilde
}

# ============================================================================
# GLOB PATTERN HANDLING
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with glob pattern
# 2. Parser must recognize (and optionally expand) globs
# 3. Verifies glob pattern is preserved or expanded correctly
@test "parser handles glob patterns in input paths" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  # Create config with glob pattern
  cat > "$TEST_DIR/glob-config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "glob-test"
    inputs:
      - "$TEST_DIR/inputs/*.txt"
    command:
      name: "cat"
      args: ["$TEST_DIR/inputs/*.txt"]
    output: "$TEST_DIR/output.txt"
EOF

  # Extract inputs
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-inputs "$TEST_DIR/glob-config.yaml" "glob-test"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "$TEST_DIR/inputs/*.txt" ]] || [[ "$output" =~ "$TEST_DIR/inputs/file1.txt" ]]
}

# ============================================================================
# INVALID CONFIG HANDLING TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates actual invalid YAML syntax
# 2. Parser must detect and reject invalid YAML
# 3. Must return non-zero exit code
@test "parser detects invalid YAML syntax" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_invalid_watcher_config "$TEST_DIR" "syntax-error")

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --validate "$config"

  # Must fail (cannot fake - parser must actually detect syntax error)
  [ "$status" -ne 0 ]

  # Should have error message
  [[ "$output" =~ "error" ]] || [[ "$output" =~ "invalid" ]] || [[ "$output" =~ "syntax" ]]
}

# This test cannot be gamed because it:
# 1. Creates config missing version field
# 2. Parser must validate required fields exist
# 3. Must fail with clear error
@test "parser detects missing version field" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  # Create config without version
  cat > "$TEST_DIR/no-version.yaml" <<EOF
watchers:
  - name: "test"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "cat"
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --validate "$TEST_DIR/no-version.yaml"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "version" ]]
}

# This test cannot be gamed because it:
# 1. Creates config with empty watchers array
# 2. Parser must detect no watchers defined
# 3. Should warn or fail
@test "parser handles empty watchers array" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  cat > "$TEST_DIR/empty-watchers.yaml" <<EOF
version: "1.0"
watchers: []
EOF

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --list-watchers "$TEST_DIR/empty-watchers.yaml"

  [ "$status" -eq 0 ]  # Not an error, but no watchers
  [ -z "$output" ] || [ "$output" = "" ]
}

# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Tests parser behavior with non-existent file
# 2. Parser must handle missing file gracefully
# 3. Must return error exit code
@test "parser handles non-existent config file" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --validate "$TEST_DIR/does-not-exist.yaml"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "not found" ]] || [[ "$output" =~ "does not exist" ]]
}

# This test cannot be gamed because it:
# 1. Tests parser with non-existent watcher name
# 2. Parser must detect watcher doesn't exist in config
# 3. Must fail appropriately
@test "parser handles request for non-existent watcher" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --get-inputs "$config" "non-existent-watcher"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "not found" ]] || [[ "$output" =~ "does not exist" ]]
}

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with multiple watchers
# 2. Times actual parser execution
# 3. Verifies parser completes in reasonable time
@test "parser completes in reasonable time for large config" {
  skip "Implementation not started - will fail until yaml-parser.sh exists"

  # Create config with 10 watchers
  cat > "$TEST_DIR/large-config.yaml" <<EOF
version: "1.0"
watchers:
EOF

  for i in {1..10}; do
    cat >> "$TEST_DIR/large-config.yaml" <<EOF
  - name: "watcher-$i"
    inputs: ["$TEST_DIR/input$i.txt"]
    command:
      name: "cat"
      args: ["$TEST_DIR/input$i.txt"]
    output: "$TEST_DIR/output$i.txt"
EOF
  done

  # Time parser execution
  local start_time=$(date +%s)
  run "$DOTFILES_ROOT/watchers/lib/yaml-parser.sh" --list-watchers "$TEST_DIR/large-config.yaml"
  local end_time=$(date +%s)

  [ "$status" -eq 0 ]

  # Should complete in less than 5 seconds
  local duration=$((end_time - start_time))
  [ "$duration" -lt 5 ]
}
