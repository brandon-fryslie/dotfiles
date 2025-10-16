# Functional Test Suite

This directory contains functional tests for the dotfiles repository that validate real user workflows and prevent regressions.

## Test Philosophy

These tests are designed to be **un-gameable** - they validate actual functionality, not implementation details. They:
- Test through the real user interface (CLI commands, file system state)
- Verify observable outcomes (files created, symlinks correct, JSON structure valid)
- Check side effects and state persistence
- Test error handling and edge cases
- Cannot be satisfied by stubs or shortcuts

## Test Framework

We use **bats** (Bash Automated Testing System) for functional testing because:
- Tests real shell script execution
- Simple syntax that reads like documentation
- Built-in assertion helpers
- Widely used in shell script testing

## Installation

Install bats via Homebrew:

```bash
brew install bats-core
```

Or use npm:

```bash
npm install -g bats
```

## Running Tests

Run all functional tests:

```bash
bats tests/functional/
```

Run a specific test file:

```bash
bats tests/functional/test-merge-json.bats
```

Run with verbose output:

```bash
bats -t tests/functional/
```

## Test Structure

```
tests/
├── README.md                          # This file
├── functional/                        # High-level workflow tests
│   ├── test-merge-json.bats          # JSON merging functionality (catches P0-1 bug)
│   ├── test-installation.bats        # Complete installation workflows
│   ├── test-profile-switching.bats   # Profile composition and switching
│   ├── test-justfile-commands.bats   # Justfile command validation
│   └── test-symlinks.bats            # Symlink creation and verification
├── fixtures/                          # Test data and configurations
│   ├── test-configs/                 # Sample config files
│   └── test-dotfiles/                # Sample dotfile sources
└── helpers/                           # Shared test utilities
    └── test-helpers.bash             # Common setup/teardown functions
```

## Test Coverage

### Critical User Workflows Tested

1. **JSON Merging (P0-1)** - `test-merge-json.bats`
   - Tests that merge-json.sh produces objects, not arrays
   - Validates deep merge with 2+ files
   - Checks that later files override earlier ones
   - Would have caught the current bug

2. **Installation from Scratch (P0-3)** - `test-installation.bats`
   - Tests fresh repository clone scenario
   - Validates submodule initialization
   - Tests both profile installation methods (justfile and ./install if exists)
   - Verifies symlinks are created correctly

3. **Profile Switching (P1)** - `test-profile-switching.bats`
   - Tests switching between home and work profiles
   - Validates configuration composition (later overrides earlier)
   - Checks that correct files are linked after switching

4. **Justfile Commands (P1-2)** - `test-justfile-commands.bats`
   - Tests documented commands actually exist
   - Validates critical commands: install-home, status, verify-home, backup
   - Tests error handling for invalid commands

5. **Symlink Management** - `test-symlinks.bats`
   - Tests symlink creation and verification
   - Tests broken symlink detection
   - Validates symlink targets point to correct profile files

## Test Design Principles

### Un-Gameable Tests

Each test is designed to resist AI shortcuts and gaming:

**Example: Testing merge-json.sh**
```bash
# BAD: Can be gamed with a stub that returns success
@test "merge-json.sh runs without error" {
  run ./scripts/merge-json.sh output.json input.json
  [ "$status" -eq 0 ]
}

# GOOD: Cannot be faked - validates actual file structure
@test "merge-json.sh produces valid JSON object, not array" {
  # Create real input files
  echo '{"editor": "vim"}' > "$TEST_DIR/base.json"
  echo '{"editor": "idea"}' > "$TEST_DIR/override.json"

  # Execute actual script
  run ./scripts/merge-json.sh "$TEST_DIR/output.json" "$TEST_DIR/base.json" "$TEST_DIR/override.json"

  # Verify multiple observable outcomes
  [ "$status" -eq 0 ]                              # Script succeeded
  [ -f "$TEST_DIR/output.json" ]                   # File was created

  # Check JSON structure (catches current bug)
  run jq 'type' "$TEST_DIR/output.json"
  [ "$output" = '"object"' ]                       # NOT "array"

  # Verify merge logic
  run jq '.editor' "$TEST_DIR/output.json"
  [ "$output" = '"idea"' ]                         # Override worked
}
```

### Real Artifacts, Not Mocks

Tests create and verify actual files, symlinks, and system state:

```bash
# Test creates real temporary directory
setup() {
  TEST_HOME=$(mktemp -d)
  export HOME="$TEST_HOME"
}

# Test invokes real Dotbot with real configs
@test "install-home creates zshrc symlink" {
  cd "$REPO_DIR"
  ./dotbot/bin/dotbot -d . -c install.conf.yaml -c install-home.conf.yaml

  # Verify actual symlink exists
  [ -L "$HOME/.zshrc" ]

  # Verify symlink target is correct
  target=$(readlink "$HOME/.zshrc")
  [[ "$target" =~ "dotfiles-home/zshrc" ]]
}
```

### Multiple Verification Points

Each test checks multiple outcomes:

```bash
@test "profile switching updates all files" {
  # Install home profile
  just install-home

  # Verify primary outcome
  [ -L "$HOME/.zshrc" ]

  # Verify side effects
  target=$(readlink "$HOME/.zshrc")
  [[ "$target" =~ "dotfiles-home/zshrc" ]]

  # Verify state persistence
  run just status
  [[ "$output" =~ "HOME" ]]

  # Switch to work profile
  just install-work

  # Verify switch occurred
  target=$(readlink "$HOME/.zshrc")
  [[ "$target" =~ "dotfiles-work/zshrc" ]]

  # Verify new state
  run just status
  [[ "$output" =~ "WORK" ]]
}
```

## Traceability to STATUS and PLAN

Each test file includes comments mapping tests to specific STATUS gaps and PLAN items:

```bash
# STATUS GAP: P0-1 - merge-json.sh produces array instead of object
# PLAN ITEM: P0-1 - Fix merge-json.sh Output Format
# ACCEPTANCE: Script produces single merged object, not array
@test "merge-json.sh produces object not array" {
  # Test implementation
}
```

## Test Data Management

### Fixtures

Test fixtures are minimal, realistic samples:
- `fixtures/test-configs/`: Sample YAML configurations
- `fixtures/test-dotfiles/`: Sample dotfiles for testing

### Temporary Directories

Tests use temporary directories for isolation:
```bash
setup() {
  TEST_DIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TEST_DIR"
}
```

### Cleanup

All tests clean up after themselves, even on failure:
- Temporary files removed in teardown()
- Test HOME directories deleted
- Symlinks created during tests are cleaned up

## Adding New Tests

When adding new tests:

1. **Name tests descriptively**: Describe the user workflow
   ```bash
   # Good
   @test "user can install home profile from fresh clone"

   # Bad
   @test "test install function"
   ```

2. **Test through user interface**: Use actual commands
   ```bash
   # Good
   run just install-home

   # Bad
   source justfile && call_internal_function
   ```

3. **Verify multiple outcomes**: Check all observable effects
   ```bash
   [ "$status" -eq 0 ]           # Command succeeded
   [ -f "$output_file" ]         # File was created
   [ "$(cat $output_file)" = "expected" ]  # Content is correct
   ```

4. **Document gaming resistance**: Add comment explaining why test is un-gameable
   ```bash
   # This test cannot be gamed because it:
   # 1. Creates actual files on filesystem
   # 2. Invokes real Dotbot binary
   # 3. Verifies symlink targets match expected profile
   # 4. Checks file content, not just existence
   ```

5. **Map to STATUS/PLAN**: Reference which gaps the test addresses
   ```bash
   # STATUS: Section 6, Gap 1 - Watchers system non-functional
   # PLAN: P0-1 - Fix merge-json.sh output format
   ```

## CI Integration

Tests are designed to run in CI environments:

```yaml
# .github/workflows/test.yml
- name: Run functional tests
  run: bats tests/functional/
```

Tests avoid:
- Modifying the user's actual home directory
- Requiring interactive input
- Depending on specific machine configuration
- Long-running operations (target: <30s per test)

## Known Limitations

1. **macOS-specific**: Some tests assume macOS (launchd, etc.)
2. **iCloud issues**: Tests avoid iCloud directories due to permission issues
3. **Submodule requirement**: Tests assume dotbot submodule is initialized
4. **Tool dependencies**: Tests require jq, bash, standard Unix tools

## Maintenance

- Run tests after every change: `bats tests/functional/`
- Update tests before changing functionality (TDD)
- Keep test data minimal and realistic
- Document any new test patterns in this README
- Review test coverage periodically

## Success Metrics

The test suite is successful if:
- All tests pass on a fresh system
- Tests catch known bugs (merge-json.sh array bug, etc.)
- Tests resist false positives (cannot be gamed)
- Tests run in <5 minutes total
- Tests can run in CI without modification
- New contributors can understand and extend tests

## Contact

For questions about testing strategy or adding new tests, see CLAUDE.md for development guidelines.
