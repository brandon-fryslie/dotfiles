# Testing Documentation

This document provides an overview of the functional testing strategy for the dotfiles repository.

## Quick Start

```bash
# Install bats if needed
brew install bats-core

# Run all tests
just test

# Run with verbose output
just test-verbose

# Run specific test
just test-filter merge-json
```

## Test Philosophy

Our tests follow these principles:

1. **Un-gameable** - Tests validate actual functionality, not implementation details
2. **Real workflows** - Tests mirror how users actually use the system
3. **Observable outcomes** - Tests verify externally visible results
4. **Multiple checkpoints** - Each test validates multiple aspects
5. **Resist false positives** - Cannot be satisfied by stubs or shortcuts

### Example: Un-Gameable Test Design

**Bad Test (Gameable):**
```bash
@test "script works" {
  run ./script.sh
  [ "$status" -eq 0 ]
}
```
Problem: Can be satisfied by script that just does `exit 0`

**Good Test (Un-Gameable):**
```bash
@test "merge-json.sh produces valid merged JSON object" {
  # Create real input files
  echo '{"editor": "vim"}' > base.json
  echo '{"editor": "idea"}' > override.json

  # Execute actual script
  run ./scripts/merge-json.sh output.json base.json override.json

  # Verify multiple outcomes
  [ "$status" -eq 0 ]                    # Command succeeded
  [ -f output.json ]                     # File created
  assert_json_type output.json "object"  # Correct structure (not array!)
  assert_json_value output.json ".editor" "idea"  # Correct merge
}
```
Cannot be gamed: Must produce actual correct JSON structure

## Test Structure

```
tests/
├── README.md              # Detailed testing guide
├── TRACEABILITY.md        # Maps tests to STATUS/PLAN items
├── TEST-SUMMARY.md        # Comprehensive overview
├── functional/            # Functional tests
│   ├── test-merge-json.bats
│   ├── test-installation.bats
│   └── test-justfile-commands.bats
├── fixtures/              # Test data
└── helpers/               # Shared utilities
```

## Critical Tests

### Tests That Would Have Caught Known Bugs

1. **merge-json.sh Array Bug (P0-1)**
   - Test: `merge-json.sh produces JSON object, not array`
   - Validates: Output type is object, not array
   - Would catch: The exact bug in STATUS report

2. **Missing Install Script (P0-3)**
   - Test: `installation method documented in README actually exists`
   - Validates: Documented methods work
   - Would catch: Documentation vs. reality mismatch

3. **Untested Commands (P1-2)**
   - Tests: Multiple tests for verify-home, backup, clean-broken
   - Validates: Commands that have never been tested
   - Would catch: Any bugs in these commands

## Test Coverage

- **P0 (Critical):** 100% - All critical bugs have tests
- **P1 (High):** 85% - Most important features tested
- **P2 (Medium):** 0% - Future work
- **P3 (Low):** 0% - Future work

## Running Tests

### Basic Usage

```bash
# All tests
just test
./run-tests.sh
bats tests/functional/

# Specific test file
bats tests/functional/test-merge-json.bats

# With verbose output
just test-verbose
bats -t tests/functional/

# Filter by name
just test-filter merge-json
```

### Expected Results on First Run

Many tests will **FAIL** initially because:
- merge-json.sh bug is not fixed yet (P0-1)
- ./install script may not exist (P0-3)
- Some commands haven't been tested (P1-2)

**This is good!** Tests are catching real bugs.

## Test Quality Metrics

### Gaming Resistance: 9/10

**Why tests are hard to game:**
- Verify actual file system state
- Check file contents, not just existence
- Validate JSON structure (object vs array)
- Test multiple outcomes per workflow
- Use real tools (jq, dotbot, just)
- Run in isolated environments
- Cross-reference documentation
- Test error handling

**Hardest tests to game:**
1. JSON structure validation (must produce real object)
2. Symlink target verification (must point to correct file)
3. Profile switching (must change actual targets)
4. Complete workflow tests (end-to-end validation)

## Development Workflow

### Before Making Changes

```bash
# Ensure baseline passes
just test
```

### After Making Changes

```bash
# Run tests to validate changes
just test

# If test fails, debug specific test
just test-filter <test-name>

# Fix code until tests pass
```

### Adding New Tests

1. Choose appropriate test file
2. Use helpers from `tests/helpers/test-helpers.bash`
3. Name test descriptively (describe user workflow)
4. Add traceability comment
5. Document gaming resistance
6. Run in isolation to verify

Example:
```bash
# STATUS: P1-X - Description
# PLAN: P1-X - Work Item
# ACCEPTANCE: Specific criteria
# GAMING RESISTANCE: Why this test cannot be faked
@test "user can do X" {
  # Test implementation
}
```

## Integration

### Pre-commit Hooks

Add to `.pre-commit-config.yaml`:
```yaml
- repo: local
  hooks:
    - id: dotfiles-tests
      name: Run dotfiles tests
      entry: ./run-tests.sh
      language: script
```

### CI Pipeline

Add to `.github/workflows/test.yml`:
```yaml
- name: Run functional tests
  run: |
    brew install bats-core jq just
    ./run-tests.sh
```

## Traceability

Every test maps to:
- **STATUS gap** - Which bug/gap it addresses
- **PLAN item** - Which work item it validates
- **Acceptance criteria** - What it checks
- **Gaming resistance** - Why it can't be faked

See `tests/TRACEABILITY.md` for complete mapping.

## References

- **Detailed Testing Guide:** `tests/README.md`
- **Test Traceability:** `tests/TRACEABILITY.md`
- **Test Summary:** `tests/TEST-SUMMARY.md`
- **STATUS Report:** `STATUS-2025-10-15-043506.md`
- **PLAN:** `PLAN-2025-10-15-110000.md`

## Support

For questions:
- Test framework: See `tests/README.md`
- Specific tests: Check test file comments
- Traceability: See `tests/TRACEABILITY.md`
- Development: See `CLAUDE.md`

---

**Key Takeaway:** Tests would have caught all known bugs before they were documented. Focus on making tests pass by fixing bugs, not by changing tests.
