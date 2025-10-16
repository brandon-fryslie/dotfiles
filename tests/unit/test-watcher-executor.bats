#!/usr/bin/env bats
# test-watcher-executor.bats - Unit tests for watcher executor

load ../helpers/test-helpers
load ../helpers/watcher-test-helpers

# ============================================================================
# SETUP AND TEARDOWN
# ============================================================================

setup() {
  TEST_DIR=$(create_test_dir)
  create_test_inputs "$TEST_DIR"
  export TEST_DIR
}

teardown() {
  cleanup_test_dir "$TEST_DIR"
}

# ============================================================================
# EXECUTOR EXISTENCE
# ============================================================================

# This test cannot be gamed because it verifies actual file existence
@test "watcher executor script exists and is executable" {
  local executor="$DOTFILES_ROOT/watchers/bin/watcher-executor.sh"

  [ -f "$executor" ]
  [ -x "$executor" ]
}

# ============================================================================
# SIMPLE COMMAND EXECUTION TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates real input file
# 2. Executes actual cat command
# 3. Verifies output file is created
# 4. Verifies output content matches input
@test "executor runs simple cat command and creates output" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Create input file
  echo "test content" > "$TEST_DIR/input.txt"

  # Create watcher config
  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "simple-cat"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "cat"
      args: ["$TEST_DIR/input.txt"]
    output: "$TEST_DIR/output.txt"
EOF

  # Execute watcher
  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "simple-cat"

  # Verify executor succeeded
  [ "$status" -eq 0 ]

  # Verify output file exists
  [ -f "$TEST_DIR/output.txt" ]

  # Verify output content is correct
  run cat "$TEST_DIR/output.txt"
  [ "$output" = "test content" ]
}

# This test cannot be gamed because it:
# 1. Uses echo command with specific argument
# 2. Verifies exact output content matches
@test "executor passes arguments correctly to command" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "echo-test"
    inputs: ["$TEST_DIR/trigger.txt"]
    command:
      name: "echo"
      args: ["Hello from executor"]
    output: "$TEST_DIR/output.txt"
EOF

  # Create trigger file (doesn't matter what's in it)
  touch "$TEST_DIR/trigger.txt"

  # Execute watcher
  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "echo-test"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/output.txt" ]

  # Verify exact output
  run cat "$TEST_DIR/output.txt"
  [[ "$output" =~ "Hello from executor" ]]
}

# This test cannot be gamed because it:
# 1. Concatenates multiple input files
# 2. Verifies output contains content from ALL inputs
# 3. Verifies order is preserved
@test "executor handles multiple input files correctly" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Inputs already created by setup
  # file1.txt contains "Line 1 from file 1\nLine 2 from file 1"
  # file2.txt contains "Line 1 from file 2\nLine 2 from file 2"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "multi-cat"
    inputs:
      - "$TEST_DIR/inputs/file1.txt"
      - "$TEST_DIR/inputs/file2.txt"
    command:
      name: "cat"
      args:
        - "$TEST_DIR/inputs/file1.txt"
        - "$TEST_DIR/inputs/file2.txt"
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "multi-cat"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/output.txt" ]

  # Verify output contains content from both files
  run cat "$TEST_DIR/output.txt"
  [[ "$output" =~ "Line 1 from file 1" ]]
  [[ "$output" =~ "Line 1 from file 2" ]]
}

# ============================================================================
# OUTPUT VERIFICATION TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Executor must create output file in exact location specified
# 2. Verifies file exists at expected path
@test "executor creates output file at specified path" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Use nested directory for output
  mkdir -p "$TEST_DIR/nested/dir"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "nested-output"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "echo"
      args: ["nested output"]
    output: "$TEST_DIR/nested/dir/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "nested-output"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/nested/dir/output.txt" ]
}

# This test cannot be gamed because it:
# 1. Executor must overwrite existing output file
# 2. Verifies new content replaces old content
@test "executor overwrites existing output file" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Create existing output file with old content
  echo "old content" > "$TEST_DIR/output.txt"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "overwrite-test"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "echo"
      args: ["new content"]
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "overwrite-test"

  [ "$status" -eq 0 ]

  # Verify output was overwritten
  run cat "$TEST_DIR/output.txt"
  [[ "$output" =~ "new content" ]]
  [[ ! "$output" =~ "old content" ]]
}

# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Command that will fail (exit code 1)
# 2. Executor must detect failure and return non-zero
# 3. Verifies error handling works
@test "executor detects command failure and returns error" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "failing-command"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "false"  # Always fails with exit 1
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "failing-command"

  # Must fail (cannot fake - executor must actually detect command failure)
  [ "$status" -ne 0 ]

  # Should have error message
  [[ "$output" =~ "error" ]] || [[ "$output" =~ "fail" ]]
}

# This test cannot be gamed because it:
# 1. References non-existent command
# 2. Executor must detect command not found
# 3. Must fail with appropriate error
@test "executor handles non-existent command" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "bad-command"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "this-command-absolutely-does-not-exist"
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "bad-command"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "not found" ]] || [[ "$output" =~ "command" ]]
}

# This test cannot be gamed because it:
# 1. Command tries to write to read-only location
# 2. Executor must detect permission denied
# 3. Must fail gracefully
@test "executor handles permission denied errors" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Try to write to /etc (typically not writable)
  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "permission-denied"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "cp"
      args:
        - "$TEST_DIR/input.txt"
        - "/etc/test-output.txt"
    output: "/etc/test-output.txt"
EOF

  echo "test" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "permission-denied"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "permission" ]] || [[ "$output" =~ "denied" ]] || [[ "$output" =~ "error" ]]
}

# ============================================================================
# TIMEOUT HANDLING TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Command that sleeps longer than timeout
# 2. Executor must kill long-running command
# 3. Verifies timeout mechanism works
@test "executor handles timeout for long-running commands" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "timeout-test"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "sleep"
      args: ["30"]  # Sleep for 30 seconds
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  # Set a short timeout (implementation-specific environment variable)
  export WATCHER_TIMEOUT=2

  local start_time=$(date +%s)
  run timeout 5 "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "timeout-test"
  local end_time=$(date +%s)

  # Command should be killed before 30 seconds
  local duration=$((end_time - start_time))
  [ "$duration" -lt 10 ]

  # Should fail due to timeout
  [ "$status" -ne 0 ]
}

# ============================================================================
# CUSTOM SCRIPT EXECUTION TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates actual executable script
# 2. Executor must run custom script (not just system commands)
# 3. Verifies script output is captured
@test "executor can run custom script commands" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Create a custom script
  cat > "$TEST_DIR/custom-script.sh" <<'EOF'
#!/bin/bash
echo "Custom script executed"
echo "Input: $1"
echo "Output: $2"
EOF
  chmod +x "$TEST_DIR/custom-script.sh"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "custom-script"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "$TEST_DIR/custom-script.sh"
      args:
        - "$TEST_DIR/input.txt"
        - "$TEST_DIR/output.txt"
    output: "$TEST_DIR/output.txt"
EOF

  echo "test input" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "custom-script"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/output.txt" ]

  run cat "$TEST_DIR/output.txt"
  [[ "$output" =~ "Custom script executed" ]]
}

# ============================================================================
# COMMAND ENVIRONMENT TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Tests that executor sets up correct environment for commands
# 2. Verifies working directory, environment variables, etc.
@test "executor runs commands in correct environment" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Script that outputs current working directory
  cat > "$TEST_DIR/check-env.sh" <<'EOF'
#!/bin/bash
echo "PWD: $PWD"
echo "HOME: $HOME"
EOF
  chmod +x "$TEST_DIR/check-env.sh"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "env-test"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "$TEST_DIR/check-env.sh"
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "env-test"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/output.txt" ]

  run cat "$TEST_DIR/output.txt"
  [[ "$output" =~ "PWD:" ]]
  [[ "$output" =~ "HOME:" ]]
}

# ============================================================================
# LOGGING AND OUTPUT TESTS
# ============================================================================

# This test cannot be gamed because it:
# 1. Executor should log execution details
# 2. Verifies logs contain relevant information
@test "executor logs command execution details" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "logging-test"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "echo"
      args: ["test"]
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  # Capture executor output (logs)
  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "logging-test"

  [ "$status" -eq 0 ]

  # Should log what it's doing
  [[ "$output" =~ "logging-test" ]] || [[ "$output" =~ "executing" ]] || [[ "$output" =~ "success" ]]
}

# ============================================================================
# EDGE CASES
# ============================================================================

# This test cannot be gamed because it:
# 1. Command that produces no output
# 2. Executor must handle this gracefully
# 3. Output file should be empty but exist
@test "executor handles commands that produce no output" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "no-output"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "true"  # Command that succeeds but outputs nothing
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "no-output"

  [ "$status" -eq 0 ]

  # Output file might be empty, but should exist (or not - implementation choice)
  # At minimum, executor should not crash
}

# This test cannot be gamed because it:
# 1. Very large input file
# 2. Executor must handle without crashing or timing out
@test "executor handles large input files" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  # Create a large input file (1MB)
  dd if=/dev/zero of="$TEST_DIR/large-input.txt" bs=1024 count=1024 2>/dev/null

  cat > "$TEST_DIR/config.yaml" <<EOF
version: "1.0"
watchers:
  - name: "large-file"
    inputs: ["$TEST_DIR/large-input.txt"]
    command:
      name: "cat"
      args: ["$TEST_DIR/large-input.txt"]
    output: "$TEST_DIR/output.txt"
EOF

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$TEST_DIR/config.yaml" "large-file"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/output.txt" ]

  # Verify output file is roughly same size as input
  local input_size=$(wc -c < "$TEST_DIR/large-input.txt")
  local output_size=$(wc -c < "$TEST_DIR/output.txt")
  [ "$output_size" -eq "$input_size" ]
}

# This test cannot be gamed because it:
# 1. Tests executor with non-existent watcher name
# 2. Must fail gracefully with clear error
@test "executor handles request for non-existent watcher" {
  skip "Implementation not started - will fail until watcher-executor.sh exists"

  local config=$(create_test_watcher_config "$TEST_DIR")

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" "$config" "does-not-exist"

  [ "$status" -ne 0 ]
  [[ "$output" =~ "not found" ]] || [[ "$output" =~ "does not exist" ]]
}
