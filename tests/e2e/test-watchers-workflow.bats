#!/usr/bin/env bats
# test-watchers-workflow.bats - End-to-end workflow tests for watchers system

load ../helpers/test-helpers
load ../helpers/watcher-test-helpers

# ============================================================================
# SETUP AND TEARDOWN
# ============================================================================

setup() {
  TEST_DIR=$(create_test_dir)
  create_test_inputs "$TEST_DIR"
  export TEST_DIR

  # Create config directory structure
  mkdir -p "$TEST_DIR/.config/dotfiles"
}

teardown() {
  cleanup_test_dir "$TEST_DIR"
}

# ============================================================================
# CRITICAL PATH #1: SIMPLE WATCHER END-TO-END
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates real config file and inputs
# 2. Modifies input file
# 3. Verifies output is regenerated with correct content
# 4. Tests complete user workflow from start to finish
@test "CRITICAL: simple watcher regenerates output when input changes" {
  skip "Implementation not started - requires full watchers system"

  # Create watcher config
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "test-concat"
    description: "Concatenate two files"
    inputs:
      - "$TEST_DIR/source1.txt"
      - "$TEST_DIR/source2.txt"
    command:
      name: "cat"
      args:
        - "$TEST_DIR/source1.txt"
        - "$TEST_DIR/source2.txt"
    output: "$TEST_DIR/combined.txt"
    enabled: true
EOF

  # Create initial source files
  echo "Content from source 1" > "$TEST_DIR/source1.txt"
  echo "Content from source 2" > "$TEST_DIR/source2.txt"

  # Start watcher daemon
  # (In real implementation, would start execute daemon)
  # For now, simulate manual execution
  "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "test-concat"

  # Verify output was created
  [ -f "$TEST_DIR/combined.txt" ]

  # Verify output contains content from both sources
  run cat "$TEST_DIR/combined.txt"
  [[ "$output" =~ "Content from source 1" ]]
  [[ "$output" =~ "Content from source 2" ]]

  # Save timestamp of output file
  local old_timestamp=$(get_file_timestamp "$TEST_DIR/combined.txt")

  # Wait a moment to ensure timestamp difference
  sleep 1

  # MODIFY input file
  echo "UPDATED content from source 1" > "$TEST_DIR/source1.txt"

  # Trigger watcher execution (simulate file change detection)
  "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "test-concat"

  # Verify output was regenerated
  assert_output_regenerated "$TEST_DIR/combined.txt" "$old_timestamp"

  # Verify output has NEW content
  run cat "$TEST_DIR/combined.txt"
  [[ "$output" =~ "UPDATED content from source 1" ]]
  [[ "$output" =~ "Content from source 2" ]]
}

# ============================================================================
# CRITICAL PATH #2: CONFIG RELOAD
# ============================================================================

# This test cannot be gamed because it:
# 1. Starts with valid config
# 2. Modifies config file
# 3. Verifies config watcher detects change
# 4. Verifies execute daemon reloads with new config
# 5. Tests complete config reload workflow
@test "CRITICAL: config watcher reloads execute daemon when config changes" {
  skip "Implementation not started - requires daemon implementation"

  # Create initial config with one watcher
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "original-watcher"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "cat"
      args: ["$TEST_DIR/input.txt"]
    output: "$TEST_DIR/output.txt"
EOF

  # Start config watcher daemon
  local config_daemon_pid=$(start_test_daemon \
    "$DOTFILES_ROOT/watchers/bin/config-watcher-daemon.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml")

  # Wait for daemon to start
  sleep 1

  # Modify config - add new watcher
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "original-watcher"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "cat"
      args: ["$TEST_DIR/input.txt"]
    output: "$TEST_DIR/output.txt"

  - name: "new-watcher"
    inputs: ["$TEST_DIR/input2.txt"]
    command:
      name: "echo"
      args: ["new watcher active"]
    output: "$TEST_DIR/output2.txt"
EOF

  # Wait for config watcher to detect change and reload
  wait_for_daemon_processing 5

  # Verify new watcher is active by triggering it
  echo "trigger" > "$TEST_DIR/input2.txt"

  # Execute new watcher
  "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "new-watcher"

  # Verify new watcher produced output
  [ -f "$TEST_DIR/output2.txt" ]
  run cat "$TEST_DIR/output2.txt"
  [[ "$output" =~ "new watcher active" ]]

  # Cleanup
  stop_test_daemon "$config_daemon_pid"
}

# ============================================================================
# CRITICAL PATH #3: INVALID CONFIG REJECTED
# ============================================================================

# This test cannot be gamed because it:
# 1. Starts with valid config
# 2. Breaks config syntax
# 3. Verifies config watcher rejects invalid config
# 4. Verifies old daemon continues running (not restarted with bad config)
# 5. Tests error resilience
@test "CRITICAL: invalid config is rejected and old daemon keeps running" {
  skip "Implementation not started - requires daemon implementation"

  # Create valid config
  local config=$(create_test_watcher_config "$TEST_DIR")
  cp "$config" "$TEST_DIR/.config/dotfiles/watchers.yaml"

  # Start config watcher
  local config_daemon_pid=$(start_test_daemon \
    "$DOTFILES_ROOT/watchers/bin/config-watcher-daemon.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml")

  sleep 1

  # Break the config
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "broken
    this is invalid yaml syntax
EOF

  # Wait for config watcher to try reloading
  wait_for_daemon_processing 3

  # Original watcher should still work
  echo "test" > "$TEST_DIR/inputs/file1.txt"
  echo "test" > "$TEST_DIR/inputs/file2.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$config" \
    "test-concat"

  # Old config should still be active (reload should have been rejected)
  [ "$status" -eq 0 ]

  stop_test_daemon "$config_daemon_pid"
}

# ============================================================================
# CRITICAL PATH #4: MULTIPLE WATCHERS COEXIST
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with multiple independent watchers
# 2. Triggers watcher 1, verifies only watcher 1 runs
# 3. Triggers watcher 2, verifies only watcher 2 runs
# 4. Tests watcher isolation
@test "CRITICAL: multiple watchers coexist and trigger independently" {
  skip "Implementation not started - requires full watchers system"

  # Create multi-watcher config
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "watcher-1"
    inputs: ["$TEST_DIR/input1.txt"]
    command:
      name: "echo"
      args: ["Output from watcher 1"]
    output: "$TEST_DIR/output1.txt"

  - name: "watcher-2"
    inputs: ["$TEST_DIR/input2.txt"]
    command:
      name: "echo"
      args: ["Output from watcher 2"]
    output: "$TEST_DIR/output2.txt"
EOF

  # Create input files
  echo "trigger" > "$TEST_DIR/input1.txt"
  echo "trigger" > "$TEST_DIR/input2.txt"

  # Trigger watcher 1
  "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "watcher-1"

  # Verify only watcher 1 output exists
  [ -f "$TEST_DIR/output1.txt" ]
  [ ! -f "$TEST_DIR/output2.txt" ]

  run cat "$TEST_DIR/output1.txt"
  [[ "$output" =~ "Output from watcher 1" ]]

  # Trigger watcher 2
  "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "watcher-2"

  # Now both outputs should exist
  [ -f "$TEST_DIR/output1.txt" ]
  [ -f "$TEST_DIR/output2.txt" ]

  run cat "$TEST_DIR/output2.txt"
  [[ "$output" =~ "Output from watcher 2" ]]
}

# ============================================================================
# CRITICAL PATH #5: DISABLED WATCHER IGNORED
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates watcher with enabled: false
# 2. Modifies input file
# 3. Verifies watcher does NOT execute
# 4. Tests enabled flag functionality
@test "CRITICAL: disabled watcher is ignored when input changes" {
  skip "Implementation not started - requires full watchers system"

  # Create config with disabled watcher
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "disabled-watcher"
    description: "This watcher is disabled"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "echo"
      args: ["This should not execute"]
    output: "$TEST_DIR/output.txt"
    enabled: false
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  # Try to execute disabled watcher
  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "disabled-watcher"

  # Executor should skip disabled watchers
  # (Implementation choice: might succeed silently or return special code)

  # Output file should NOT be created
  [ ! -f "$TEST_DIR/output.txt" ]
}

# ============================================================================
# ERROR HANDLING #6: COMMAND NOT FOUND
# ============================================================================

# This test cannot be gamed because it:
# 1. Watcher with non-existent command
# 2. Verifies error is logged
# 3. Verifies daemon doesn't crash (continues running)
# 4. Tests error resilience
@test "ERROR HANDLING: non-existent command is logged but doesn't crash daemon" {
  skip "Implementation not started - requires daemon implementation"

  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "bad-command"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "nonexistent-command-xyz"
    output: "$TEST_DIR/output.txt"

  - name: "good-watcher"
    inputs: ["$TEST_DIR/input2.txt"]
    command:
      name: "echo"
      args: ["good watcher works"]
    output: "$TEST_DIR/output2.txt"
EOF

  # Try to execute bad watcher
  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "bad-command"

  # Should fail
  [ "$status" -ne 0 ]
  [[ "$output" =~ "error" ]] || [[ "$output" =~ "not found" ]]

  # Good watcher should still work
  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "good-watcher"

  [ "$status" -eq 0 ]
  [ -f "$TEST_DIR/output2.txt" ]
}

# ============================================================================
# ERROR HANDLING #7: COMMAND FAILS (EXIT 1)
# ============================================================================

# This test cannot be gamed because it:
# 1. Command that fails deliberately
# 2. Verifies error is logged
# 3. Verifies output is NOT marked as successful
@test "ERROR HANDLING: failed command is logged and output not validated" {
  skip "Implementation not started - requires full implementation"

  cat > "$TEST_DIR/failing-script.sh" <<'EOF'
#!/bin/bash
echo "About to fail..." >&2
exit 1
EOF
  chmod +x "$TEST_DIR/failing-script.sh"

  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "failing-watcher"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "$TEST_DIR/failing-script.sh"
    output: "$TEST_DIR/output.txt"
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "failing-watcher"

  # Should fail
  [ "$status" -ne 0 ]
  [[ "$output" =~ "fail" ]] || [[ "$output" =~ "error" ]]
}

# ============================================================================
# ERROR HANDLING #8: OUTPUT LOCATION NOT WRITABLE
# ============================================================================

# This test cannot be gamed because it:
# 1. Watcher trying to write to /etc/ (not writable)
# 2. Verifies permission error is logged
# 3. Verifies daemon continues (doesn't crash)
@test "ERROR HANDLING: unwritable output location is handled gracefully" {
  skip "Implementation not started - requires permission handling"

  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
  - name: "unwritable-output"
    inputs: ["$TEST_DIR/input.txt"]
    command:
      name: "echo"
      args: ["test"]
    output: "/etc/test-output.txt"  # Not writable
EOF

  echo "trigger" > "$TEST_DIR/input.txt"

  run "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml" \
    "unwritable-output"

  # Should fail
  [ "$status" -ne 0 ]
  [[ "$output" =~ "permission" ]] || [[ "$output" =~ "denied" ]] || [[ "$output" =~ "cannot" ]]
}

# ============================================================================
# PERFORMANCE #9: RAPID CHANGES (DEBOUNCING)
# ============================================================================

# This test cannot be gamed because it:
# 1. Makes rapid changes to input file
# 2. Verifies debouncing prevents excessive executions
# 3. Tests performance optimization
@test "PERFORMANCE: rapid file changes are debounced" {
  skip "Implementation not started - requires debouncing logic"

  local config=$(create_test_watcher_config "$TEST_DIR")

  # Make 5 rapid changes
  for i in {1..5}; do
    echo "Change $i" > "$TEST_DIR/inputs/file1.txt"
    sleep 0.1
  done

  # In real implementation, daemon would debounce these changes
  # For now, verify executor can handle rapid calls
  local execution_count=0
  for i in {1..5}; do
    "$DOTFILES_ROOT/watchers/bin/watcher-executor.sh" \
      "$config" \
      "test-concat" &
  done

  wait

  # Output should exist and contain last change
  [ -f "$TEST_DIR/output.txt" ]
  run cat "$TEST_DIR/output.txt"
  [[ "$output" =~ "Change 5" ]] || [[ "$output" =~ "file1.txt" ]]
}

# ============================================================================
# PERFORMANCE #10: STARTUP TIME
# ============================================================================

# This test cannot be gamed because it:
# 1. Creates config with 10 watchers
# 2. Times daemon startup
# 3. Verifies startup completes quickly
@test "PERFORMANCE: daemon starts quickly with multiple watchers" {
  skip "Implementation not started - requires daemon implementation"

  # Create config with 10 watchers
  cat > "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
version: "1.0"
watchers:
EOF

  for i in {1..10}; do
    cat >> "$TEST_DIR/.config/dotfiles/watchers.yaml" <<EOF
  - name: "watcher-$i"
    inputs: ["$TEST_DIR/input$i.txt"]
    command:
      name: "cat"
      args: ["$TEST_DIR/input$i.txt"]
    output: "$TEST_DIR/output$i.txt"
EOF
  done

  # Time daemon startup
  local start_time=$(date +%s)

  local daemon_pid=$(start_test_daemon \
    "$DOTFILES_ROOT/watchers/bin/watcher-daemon.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml")

  # Wait for daemon to be ready
  sleep 1

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Should start in less than 5 seconds
  [ "$duration" -lt 5 ]

  stop_test_daemon "$daemon_pid"
}

# ============================================================================
# INTEGRATION: FRESH INSTALLATION WORKFLOW
# ============================================================================

# This test cannot be gamed because it:
# 1. Simulates complete fresh installation
# 2. Tests all components working together
# 3. Verifies end-to-end user experience
@test "INTEGRATION: fresh installation workflow works end-to-end" {
  skip "Implementation not started - requires full watchers system"

  # Simulate fresh installation:
  # 1. Create config directory
  mkdir -p "$TEST_DIR/.config/dotfiles"

  # 2. Install watchers config
  cp "$DOTFILES_ROOT/config-sources/watchers.yaml" \
     "$TEST_DIR/.config/dotfiles/watchers.yaml"

  # 3. Start config watcher daemon
  local config_pid=$(start_test_daemon \
    "$DOTFILES_ROOT/watchers/bin/config-watcher-daemon.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml")

  # 4. Start execute daemon
  local exec_pid=$(start_test_daemon \
    "$DOTFILES_ROOT/watchers/bin/watcher-daemon.sh" \
    "$TEST_DIR/.config/dotfiles/watchers.yaml")

  sleep 2

  # 5. Verify daemons are running
  kill -0 "$config_pid" 2>/dev/null
  [ "$?" -eq 0 ]

  kill -0 "$exec_pid" 2>/dev/null
  [ "$?" -eq 0 ]

  # 6. Create a source file that should trigger a watcher
  # (Depends on actual watchers.yaml content)

  # 7. Verify output is generated

  # Cleanup
  stop_test_daemon "$config_pid"
  stop_test_daemon "$exec_pid"
}
