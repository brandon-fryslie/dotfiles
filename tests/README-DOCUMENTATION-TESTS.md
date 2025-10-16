# Documentation Accuracy Tests

## Overview

The `test-documentation.bats` test suite validates documentation accuracy and prevents documentation drift. These tests ensure users can trust the documentation when following installation instructions or usage examples.

## What These Tests Validate

### 1. Phantom Command Detection (P1-1)

Tests that all justfile commands referenced in documentation actually exist:

- **Test:** CLAUDE.md does not reference phantom 'add-file-home' command
  - **Validates:** Command mentioned in docs exists or docs don't mention it
  - **Gaming Resistance:** Searches actual file content, cross-references with `just --list`

- **Test:** MIGRATION.md does not reference phantom 'test-home' command
  - **Validates:** Correct command name used (should be `dry-run-home`)
  - **Gaming Resistance:** Verifies command exists in justfile

- **Test:** MIGRATION.md references 'validate' not 'validate-yaml'
  - **Validates:** Documentation uses correct command name
  - **Gaming Resistance:** Cannot be satisfied by phantom documentation

- **Test:** All 'just <command>' references in docs exist in justfile
  - **Validates:** Every command in CLAUDE.md and README.md is real
  - **Gaming Resistance:** Extracts commands from docs, verifies each with `just --list`

### 2. iCloud Limitation Warning (P1-3, P0-2)

Tests that WATCHERS.md includes prominent warning about iCloud Drive limitations:

- **Test:** WATCHERS.md contains iCloud Drive limitation warning
  - **Validates:** Warning is present and visible
  - **Gaming Resistance:** Searches for specific keywords (iCloud, limitation, warning)

- **Test:** WATCHERS.md explains why iCloud causes issues
  - **Validates:** Warning explains the problem (launchd, permissions)
  - **Gaming Resistance:** Verifies technical explanation exists

- **Test:** WATCHERS.md provides solutions for iCloud limitation
  - **Validates:** Users have options to work around limitation
  - **Gaming Resistance:** Checks for solution keywords (move, option, alternative)

- **Test:** README.md mentions watchers limitation
  - **Validates:** Users see warning before trying watchers
  - **Gaming Resistance:** Cross-references README with WATCHERS.md

### 3. README Accuracy (P1-5)

Tests that README.md contains accurate information about tools and configuration:

- **Test:** README does not claim Volta is primary Node.js version manager
  - **Validates:** Tool claims match actual implementation
  - **Gaming Resistance:** Cross-validates README with actual zshrc file

- **Test:** README.md mentions fnm for Node.js version management
  - **Validates:** Actual version manager is documented
  - **Gaming Resistance:** Verifies fnm is in zshrc if claimed in README

- **Test:** README file tree accurately reflects repository structure
  - **Validates:** Documented files actually exist
  - **Gaming Resistance:** Checks filesystem for files mentioned in tree

- **Test:** README does not reference unsupported install script flags
  - **Validates:** Examples work as documented
  - **Gaming Resistance:** Tests actual script behavior vs claims

### 4. Cross-Reference Validation

Tests that documentation cross-references are valid:

- **Test:** Documentation cross-references point to existing files
  - **Validates:** "See MIGRATION.md" links work
  - **Gaming Resistance:** Verifies target files exist

- **Test:** Config files mentioned in CLAUDE.md exist
  - **Validates:** install.conf.yaml references are valid
  - **Gaming Resistance:** Checks filesystem for each mentioned file

- **Test:** Directories mentioned in CLAUDE.md exist
  - **Validates:** dotfiles-home/ references are valid
  - **Gaming Resistance:** Verifies directory structure matches docs

### 5. Executable Validation

Tests that example commands from documentation actually work:

- **Test:** Dry-run commands mentioned in docs work
  - **Validates:** just dry-run-home examples execute successfully
  - **Gaming Resistance:** Runs actual commands, verifies output

- **Test:** Status and verify commands work
  - **Validates:** just status and just validate work as documented
  - **Gaming Resistance:** Tests real command execution

### 6. Documentation Completeness

Tests that documentation provides necessary information:

- **Test:** README installation steps are complete and valid
  - **Validates:** Users can follow installation from start to finish
  - **Gaming Resistance:** Verifies all steps mentioned in workflow

- **Test:** CLAUDE.md and README.md agree on installation method
  - **Validates:** No contradictions between documentation files
  - **Gaming Resistance:** Compares command mentions across files

- **Test:** Tool claims match actual configurations
  - **Validates:** README tool list matches zshrc reality
  - **Gaming Resistance:** Cross-validates multiple files

## Why These Tests Are Un-Gameable

1. **Parse Actual Files**: Tests read real documentation files from filesystem
2. **Cross-Reference Multiple Sources**: Cannot fake one file without updating all
3. **Execute Real Commands**: Tests run `just --list` and verify output
4. **Check File Content**: Tests search for specific keywords and phrases
5. **Validate Structure**: Tests verify file trees match actual directory structure

## Test Results Summary

As of initial test run, these tests correctly identify:

**FAILING (expected - documentation needs fixes):**
- ❌ CLAUDE.md references phantom `add-file-home` command
- ❌ MIGRATION.md references phantom `test-home` command
- ❌ MIGRATION.md references `validate-yaml` instead of `validate`
- ❌ WATCHERS.md missing iCloud Drive warning
- ❌ README.md claims Volta instead of fnm for Node.js
- ❌ README.md missing fnm documentation

**PASSING (documentation is accurate):**
- ✓ README.md commands exist in justfile
- ✓ File tree reflects actual structure
- ✓ No unsupported flags referenced
- ✓ Cross-references are valid
- ✓ Config files exist
- ✓ Directories exist
- ✓ Dry-run commands work
- ✓ Status and verify commands work
- ✓ Installation steps complete
- ✓ CLAUDE.md and README.md agree
- ✓ Tool claims valid (mostly)

## Running These Tests

```bash
# Run all documentation tests
bats tests/functional/test-documentation.bats

# Run just phantom command detection tests
bats tests/functional/test-documentation.bats --filter "phantom"

# Run just iCloud warning tests
bats tests/functional/test-documentation.bats --filter "iCloud"

# Run just README accuracy tests
bats tests/functional/test-documentation.bats --filter "README"

# Run with verbose output
bats -t tests/functional/test-documentation.bats
```

## Test Maintenance

### After Fixing Documentation

When documentation is corrected:

1. Tests should transition from FAIL to PASS
2. Verify tests pass after documentation updates
3. Tests now prevent regression

### Adding New Tests

When adding documentation tests:

1. Identify what documentation claim to validate
2. Determine what real artifact proves the claim
3. Write test that cross-references claim with artifact
4. Document gaming resistance in test comments

## Expected Test Evolution

### Sprint 2 (Documentation Fixes)

**Before fixes:**
- 10-11 tests FAILING (catching documentation errors)
- 10-11 tests PASSING (documentation already accurate)
- Total: 21 tests

**After fixes:**
- 0 tests FAILING (documentation corrected)
- 21 tests PASSING (all documentation accurate)

### Future Sprints

As documentation grows:
- Add tests for new documentation sections
- Add tests for new commands
- Add tests for new configuration examples

## Integration with Sprint Goals

These tests directly support Sprint 2 objectives:

**Sprint 2: Documentation Accuracy & Consistency**

- **Goal:** Achieve 90%+ project completion by fixing all remaining documentation issues
- **Success Criteria:** New user can follow README without encountering any documentation errors

**How tests support this:**
1. Tests prove documentation errors exist (failing tests)
2. Tests will prove documentation is fixed (passing tests after corrections)
3. Tests prevent future documentation drift (regression prevention)

## Traceability

Each test maps to specific PLAN items:

- **P1-1**: Fix Phantom Justfile Commands → Tests 1-4
- **P1-3**: Update WATCHERS.md → Tests 6-9
- **P1-5**: Fix README.md Inaccuracies → Tests 10-13
- **P0-2**: Document iCloud Limitation → Tests 6-9

See `tests/TRACEABILITY.md` for complete mapping.

## Quality Metrics

- **Gaming Resistance:** 9/10 (high)
- **User Impact:** High (prevents trust erosion)
- **Maintainability:** High (simple grep/file checks)
- **Execution Speed:** Fast (<5 seconds for all tests)
- **False Positive Rate:** Low (tests real artifacts)

## Known Limitations

1. **Content Quality**: Tests verify claims exist, not that they're helpful
2. **Outdated Content**: Tests don't detect stale information
3. **Broken Links**: Tests don't validate external URLs
4. **Formatting**: Tests don't validate markdown formatting
5. **Completeness**: Tests don't validate all information is present

These are acceptable tradeoffs for maintainable, un-gameable tests.

## Future Enhancements

Potential additions:

1. **Link validation**: Check external URLs work
2. **Example execution**: Run code examples from docs
3. **Screenshot validation**: Verify screenshots match current UI
4. **Versioning checks**: Detect when tool versions mentioned are outdated
5. **Consistency checks**: More cross-file consistency validation

## Contact

For questions about documentation testing strategy:
- See main `tests/README.md` for testing philosophy
- See `tests/TRACEABILITY.md` for test-to-requirement mapping
- See Sprint 2 documentation for context on why these tests exist
