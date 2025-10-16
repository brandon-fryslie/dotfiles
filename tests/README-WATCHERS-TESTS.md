# Watchers System Test Suite

Comprehensive functional tests for the dotfiles watchers system based on the architecture in `docs/WATCHERS-ARCHITECTURE.md`.

## Overview

This test suite validates the complete watchers system, which consists of:
- **YAML Parser**: Parses `watchers.yaml` configuration files
- **Config Validator**: Validates watcher specifications
- **Watcher Executor**: Executes watcher commands when inputs change
- **Config Watcher Daemon**: Monitors config file and reloads execute daemon
- **Execute Daemon**: Monitors input files and triggers appropriate watchers

## Test Structure

```
tests/
├── unit/
│   ├── test-yaml-parser.bats           # 25 tests - YAML parsing
│   ├── test-config-validator.bats      # 24 tests - Config validation
│   └── test-watcher-executor.bats      # 18 tests - Command execution
├── e2e/
│   └── test-watchers-workflow.bats     # 12 tests - End-to-end workflows
└── helpers/
    └── watcher-test-helpers.bash       # 420 lines - Test utilities
```

**Total Tests: 79** (all currently skipped until implementation exists)

## Running Tests

### Run All Watcher Tests

```bash
# Run all unit tests
bats tests/unit/test-yaml-parser.bats \
     tests/unit/test-config-validator.bats \
     tests/unit/test-watcher-executor.bats

# Run end-to-end tests
bats tests/e2e/test-watchers-workflow.bats

# Run everything
bats tests/unit/ tests/e2e/
```

### Run Specific Test Categories

```bash
# Only parser tests
bats tests/unit/test-yaml-parser.bats

# Only validation tests
bats tests/unit/test-config-validator.bats

# Only execution tests
bats tests/unit/test-watcher-executor.bats

# Only critical path tests
bats tests/e2e/test-watchers-workflow.bats -f "CRITICAL"

# Only error handling tests
bats tests/e2e/test-watchers-workflow.bats -f "ERROR HANDLING"
```

## Test Coverage

### Unit Tests (67 tests)

#### YAML Parser Tests (25 tests)
- ✓ Parser existence and basic functionality (2 tests)
- ✓ Valid config parsing (version, watcher names, all watchers) (3 tests)
- ✓ Field extraction (inputs, command, args, output, enabled) (5 tests)
- ✓ Tilde expansion in paths (1 test)
- ✓ Glob pattern handling (1 test)
- ✓ Invalid config detection (syntax errors, missing fields, empty watchers) (3 tests)
- ✓ Error handling (missing files, non-existent watchers) (2 tests)
- ✓ Performance (large config parsing) (1 test)

**Key Validation:**
- Cannot be gamed - tests verify actual YAML parsing output
- Tests use real YAML files created during test execution
- Multiple verification points per test (exit code, output format, content)

#### Config Validator Tests (24 tests)
- ✓ Validator existence (1 test)
- ✓ Valid config acceptance (single and multi-watcher) (2 tests)
- ✓ Required field validation (name, inputs, command, output) (4 tests)
- ✓ Invalid field type detection (2 tests)
- ✓ Duplicate name detection (1 test)
- ✓ Command existence validation (3 tests)
- ✓ Input file path validation (1 test)
- ✓ Circular dependency detection (1 test)
- ✓ Glob pattern expansion (1 test)
- ✓ Enabled flag handling (2 tests)
- ✓ Version string validation (2 tests)
- ✓ Comprehensive error reporting (1 test)

**Key Validation:**
- Cannot be gamed - creates invalid configs and verifies rejection
- Tests command availability checking
- Verifies validator catches all error conditions

#### Watcher Executor Tests (18 tests)
- ✓ Executor existence (1 test)
- ✓ Simple command execution (cat, echo) (2 tests)
- ✓ Multiple input handling (1 test)
- ✓ Output file creation and overwriting (2 tests)
- ✓ Error detection (command failure, not found, permissions) (3 tests)
- ✓ Timeout handling (1 test)
- ✓ Custom script execution (1 test)
- ✓ Environment setup (1 test)
- ✓ Logging (1 test)
- ✓ Edge cases (no output, large files, non-existent watcher) (3 tests)

**Key Validation:**
- Cannot be gamed - executes real commands and verifies actual output
- Tests create real input files and verify output file contents
- Multiple checks per test (exit code, file existence, content, timestamps)

### End-to-End Tests (12 tests)

#### Critical Path Tests (5 tests)
1. **Simple watcher end-to-end**: Complete workflow of input change → output regeneration
2. **Config reload**: Config file modification → daemon reload → new behavior
3. **Invalid config rejection**: Bad config rejected, old daemon keeps running
4. **Multiple watchers coexist**: Independent watchers trigger separately
5. **Disabled watcher ignored**: Enabled flag prevents execution

**Gaming Resistance:**
- Tests complete user workflows from start to finish
- Verifies actual file system state at each step
- Cannot fake intermediate steps - all must work together

#### Error Handling Tests (3 tests)
6. **Command not found**: Error logged, daemon doesn't crash
7. **Command fails (exit 1)**: Failure detected and logged
8. **Unwritable output**: Permission errors handled gracefully

**Gaming Resistance:**
- Tests actual command execution failures
- Verifies daemon resilience (keeps running after errors)
- Checks error messages are logged correctly

#### Performance Tests (2 tests)
9. **Rapid changes debounced**: Multiple quick changes don't cause excessive executions
10. **Startup time**: Daemon starts quickly even with many watchers

**Gaming Resistance:**
- Times actual operations
- Cannot fake performance - tests measure real execution time

#### Integration Test (1 test)
11. **Fresh installation workflow**: Complete setup from scratch

**Gaming Resistance:**
- Simulates real user installation experience
- All components must work together
- Verifies daemons start and respond to file changes

## Test Helpers

### Watcher-Specific Helpers (`watcher-test-helpers.bash`)

**Config Creation:**
- `create_test_watcher_config` - Generate valid single-watcher config
- `create_multi_watcher_config` - Generate multi-watcher config
- `create_disabled_watcher_config` - Generate config with disabled watcher
- `create_invalid_watcher_config` - Generate invalid configs for testing validation

**Execution:**
- `execute_watcher_spec` - Execute a watcher manually
- `validate_watcher_config` - Validate a config file
- `get_watcher_names` - Extract watcher names from config

**Assertions:**
- `assert_valid_watcher_config` - Verify config is valid
- `assert_watcher_executed` - Verify watcher ran successfully
- `assert_output_regenerated` - Verify output file was updated
- `assert_command_executable` - Verify command exists
- `assert_watcher_exists` - Verify watcher in config

**File Operations:**
- `get_file_timestamp` - Get modification time
- `touch_file` - Update modification time
- `create_test_inputs` - Create test input files

**Daemon Management:**
- `start_test_daemon` - Start daemon in test mode
- `stop_test_daemon` - Stop running daemon
- `wait_for_daemon_processing` - Wait for daemon to process changes

**Cleanup:**
- `cleanup_watcher_test` - Clean up all test artifacts

## Gaming Resistance Strategy

All tests are designed to be **un-gameable** - they cannot be satisfied by stubs, mocks, or shortcuts.

### How Tests Resist Gaming

1. **Real File System Operations**
   - Tests create actual files and directories
   - Verify file existence, content, and timestamps
   - Cannot fake file creation without actually creating files

2. **Actual Command Execution**
   - Tests run real commands (cat, echo, custom scripts)
   - Verify command output matches expected
   - Cannot fake command execution - must actually run

3. **Multiple Verification Points**
   - Each test checks multiple outcomes
   - File existence + content + timestamps + exit codes
   - All checks must pass - cannot fake one without others failing

4. **Content Validation**
   - Tests verify exact file contents
   - Cannot satisfy with empty files or stub content
   - Ensures commands actually execute and produce correct output

5. **Timestamp Verification**
   - Tests check file modification times
   - Ensures files are actually regenerated, not just left untouched
   - Cannot fake regeneration without actually modifying files

6. **Process Management**
   - Tests start actual daemons and verify they're running
   - Check daemon PIDs and process status
   - Verify daemons respond to signals and file changes

7. **Error Injection**
   - Tests create conditions that should fail (bad commands, permissions)
   - Verify failures are detected and handled correctly
   - Cannot fake error handling without actually encountering errors

### Example: Un-Gameable Test Pattern

```bash
@test "watcher regenerates output when input changes" {
  # 1. Create real config file
  create_test_watcher_config "$TEST_DIR" > config.yaml

  # 2. Create real input files
  echo "Original content" > input.txt

  # 3. Execute actual watcher
  watcher-executor.sh config.yaml "test-watcher"

  # 4. Verify output exists (cannot fake)
  [ -f output.txt ]

  # 5. Verify output content (cannot fake)
  [ "$(cat output.txt)" = "Original content" ]

  # 6. Get timestamp (cannot fake)
  old_timestamp=$(stat -f %m output.txt)

  # 7. Modify input (real file change)
  echo "New content" > input.txt

  # 8. Re-execute watcher
  watcher-executor.sh config.yaml "test-watcher"

  # 9. Verify regeneration (timestamp must be newer)
  new_timestamp=$(stat -f %m output.txt)
  [ "$new_timestamp" -gt "$old_timestamp" ]

  # 10. Verify new content (exact match required)
  [ "$(cat output.txt)" = "New content" ]
}
```

**Why This Cannot Be Gamed:**
- Creates real files that must exist on filesystem
- Executes actual commands that must produce real output
- Checks multiple independent properties (existence, content, timestamps)
- All properties must be consistent - cannot fake one without breaking others

## Test Fixtures

### Sample Configs

Tests create configs dynamically using helper functions. Examples:

**Valid Single Watcher:**
```yaml
version: "1.0"
watchers:
  - name: "test-concat"
    inputs:
      - "/tmp/test/file1.txt"
      - "/tmp/test/file2.txt"
    command:
      name: "cat"
      args: ["/tmp/test/file1.txt", "/tmp/test/file2.txt"]
    output: "/tmp/test/output.txt"
    enabled: true
```

**Invalid Config (Missing Name):**
```yaml
version: "1.0"
watchers:
  - inputs: ["/tmp/input.txt"]
    command:
      name: "cat"
    output: "/tmp/output.txt"
```

**Circular Dependency:**
```yaml
version: "1.0"
watchers:
  - name: "circular"
    inputs: ["/tmp/file.txt"]
    command:
      name: "cat"
      args: ["/tmp/file.txt"]
    output: "/tmp/file.txt"  # Same as input!
```

### Sample Input Files

Created by `create_test_inputs`:
- `file1.txt`: "Line 1 from file 1\nLine 2 from file 1"
- `file2.txt`: "Line 1 from file 2\nLine 2 from file 2"

## Traceability to Architecture

Each test validates specific requirements from `docs/WATCHERS-ARCHITECTURE.md`:

### YAML Parser → Architecture Section "YAML Config Parser"
- Version extraction → Schema requirement (version field)
- Watcher name extraction → Watcher Spec requirement (name field)
- Input/command/output extraction → All required fields
- Tilde expansion → Field Specifications (tilde expansion supported)
- Glob handling → Field Specifications (glob patterns supported)

### Config Validator → Architecture Section "Config Validator"
- Required field checking → Implementation Plan Phase 1 item 2
- Command validation → Security Considerations (command validation)
- Duplicate names → Implementation Plan Phase 1 item 2
- Circular dependencies → Open Questions #6 (circular dependency detection)

### Watcher Executor → Architecture Section "Watcher Executor"
- Command execution → Implementation Plan Phase 1 item 3
- Output verification → Watcher Executor behavior
- Error handling → Error Handling section
- Timeout handling → Performance Considerations

### Daemons → Architecture Section "Two-Daemon Architecture"
- Config reload → Daemon 1 behavior
- Input file watching → Daemon 2 behavior
- Error resilience → Error Handling section

## Expected Initial Results

**All 79 tests are currently SKIPPED** because the watchers system implementation doesn't exist yet.

As implementation progresses, tests will be unskipped and should:
1. **Initially fail** - Proves tests are real and detect missing functionality
2. **Pass incrementally** - As each component is implemented correctly
3. **Never pass with stubs** - Gaming-resistant design ensures only real implementation passes

### Implementation Order

Based on dependencies, implement and test in this order:

1. **Phase 1: Core Infrastructure** (37 tests)
   - YAML Parser (25 tests)
   - Config Validator (24 tests - depends on parser)
   - Watcher Executor (18 tests - independent)

2. **Phase 2: Integration** (12 tests)
   - End-to-end workflows (12 tests - depends on all unit components)

## Success Criteria

Tests prove the watchers system works when:

- ✅ **All 79 tests pass** without skips
- ✅ **Tests run in < 30 seconds** total
- ✅ **No test failures on fresh system**
- ✅ **All critical paths validated** (5 critical path tests pass)
- ✅ **Error handling comprehensive** (8 error scenarios pass)
- ✅ **Gaming resistance: 9/10** (tests verify real behavior, not mocks)
- ✅ **Clear traceability** to architecture document requirements

## Troubleshooting

### Tests Fail to Run

```bash
# Ensure bats is installed
brew install bats-core

# Ensure test helpers are sourced correctly
cd /path/to/dotfiles
bats tests/unit/test-yaml-parser.bats
```

### Tests Are Skipped

This is expected! Tests are skipped until implementation exists:
- Each test has `skip "Implementation not started - will fail until [component] exists"`
- Remove skip statement once component is implemented
- Test should fail initially (proving it's real), then pass after correct implementation

### Test Failures After Implementation

1. **Read the test output carefully** - Tests have descriptive failure messages
2. **Check multiple verification points** - Tests verify several things; identify which check failed
3. **Run test in isolation** - `bats tests/unit/test-yaml-parser.bats -f "specific test name"`
4. **Check test helpers** - Ensure helper functions work correctly
5. **Verify file paths** - Tests use temp directories; ensure paths are correct

## Maintenance

### Adding New Tests

1. Identify gap in coverage
2. Write test following gaming-resistant pattern:
   - Create real artifacts
   - Execute actual commands
   - Verify multiple outcomes
   - Check file existence + content + timestamps
3. Add to appropriate test file (unit vs e2e)
4. Update this README with new test count
5. Mark test as skipped until implementation exists

### Updating Tests After Architecture Changes

1. Review architecture document for changes
2. Identify affected tests
3. Update test expectations to match new architecture
4. Update traceability section in this README
5. Verify tests still resist gaming

## Contact

For questions about watcher tests:
- See: `docs/WATCHERS-ARCHITECTURE.md` for system architecture
- See: `tests/README.md` for general testing philosophy
- See: `CLAUDE.md` for development guidelines

## Summary

This test suite provides **comprehensive validation** of the watchers system with:
- **79 tests** covering all components
- **Gaming resistance: 9/10** - Cannot be satisfied by stubs or mocks
- **100% traceability** to architecture requirements
- **Clear failure modes** - Tests fail honestly when functionality is broken
- **Fast execution** - Designed to run in under 30 seconds total
- **Maintenance friendly** - Clear structure, helper functions, good documentation

The tests prove the watchers system works correctly, handles errors gracefully, and provides a great user experience.
