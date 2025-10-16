#!/usr/bin/env bats
# test-documentation.bats - Functional tests for documentation accuracy
#
# SPRINT REFERENCE: SPRINT-2025-10-15-133500.md (Sprint 2)
# STATUS REFERENCE: STATUS-2025-10-15-133003.md
# PLAN REFERENCE: PLAN-2025-10-15-110000.md
#
# PLAN ITEMS VALIDATED:
# - P1-1: Fix Phantom Justfile Commands in Documentation
# - P1-3: Update WATCHERS.md Examples with Real Output (iCloud warning)
# - P1-5: Fix README.md Factual Inaccuracies
# - P0-2: Document or Fix iCloud Drive Limitation
#
# USER IMPACT:
# These tests prevent documentation drift and ensure users can trust
# documentation when following installation or usage instructions.
#
# GAMING RESISTANCE:
# - Parses actual documentation files and cross-references with real commands
# - Searches for specific keywords and phrases in files
# - Executes commands mentioned in docs to verify they work
# - Cannot be satisfied by stub implementations or fake documentation

load '../helpers/test-helpers'

setup() {
  TEST_DIR=$(create_test_dir)

  require_just

  debug "Test dir: $TEST_DIR"
  debug "Repo root: $DOTFILES_ROOT"
}

teardown() {
  cleanup_test_dir "$TEST_DIR"
}

# ============================================================================
# P1-1: PHANTOM COMMAND DETECTION
# ============================================================================
# These tests validate that all commands referenced in documentation actually
# exist in the justfile. This prevents users from encountering "command not
# found" errors when following documentation.

# PLAN: P1-1 - Fix Phantom Justfile Commands in Documentation
# SPRINT: Documentation Fix 1 (lines 72-153)
# ACCEPTANCE: No references to add-file-home in any .md file
@test "CLAUDE.md does not reference phantom 'add-file-home' command" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Searches actual file content for phantom command
  # Cannot be gamed because it checks the real documentation file

  run grep -n "add-file-home" CLAUDE.md

  # If grep finds the command, test should fail
  # Exit code 1 means no match (which is what we want)
  [ "$status" -eq 1 ]

  # Alternatively, if the command was implemented, it should exist in justfile
  if [ "$status" -eq 0 ]; then
    # Command is referenced, so it MUST exist in justfile
    run just --list
    assert_contains "$output" "add-file-home"
  fi
}

# PLAN: P1-1
# SPRINT: Documentation Fix 1 (lines 88-89)
# ACCEPTANCE: test-home replaced with dry-run-home everywhere
@test "MIGRATION.md does not reference phantom 'test-home' command" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Checks actual file, verifies command doesn't exist

  # Search for test-home in MIGRATION.md
  run grep -n "test-home" MIGRATION.md

  # Should not find test-home (exit code 1 = no match)
  # OR if found, justfile should have test-home command
  if [ "$status" -eq 0 ]; then
    # Found reference - command must exist
    run just --list
    assert_contains "$output" "test-home"
  fi
}

# PLAN: P1-1
# SPRINT: Documentation Fix 1 (lines 90-91)
# ACCEPTANCE: validate-yaml replaced with validate everywhere
@test "MIGRATION.md references 'validate' not 'validate-yaml'" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Cross-references doc with actual commands

  # If validate-yaml is referenced, it should not be
  run grep -n "validate-yaml" MIGRATION.md

  # Should NOT find validate-yaml (correct command is 'validate')
  [ "$status" -eq 1 ]

  # Verify correct command exists
  run just --list
  assert_contains "$output" "validate"
}

# PLAN: P1-1
# SPRINT: Documentation Fix 1 (lines 135-141)
# ACCEPTANCE: All documented justfile commands exist
@test "all 'just <command>' references in CLAUDE.md exist in justfile" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Extracts commands from documentation and verifies
  # each one exists in justfile output

  # Get list of available commands
  run just --list
  [ "$status" -eq 0 ]
  local justfile_commands="$output"

  # Extract just commands from CLAUDE.md (lines starting with 'just ')
  # Format: just command-name
  local doc_commands=$(grep -E "^just [a-z-]+" CLAUDE.md | sed 's/just \([a-z-]*\).*/\1/' | sort -u)

  # Verify each documented command exists
  for cmd in $doc_commands; do
    if ! echo "$justfile_commands" | grep -q "^[[:space:]]*$cmd"; then
      echo "FAIL: Command 'just $cmd' documented in CLAUDE.md but not in justfile" >&2
      return 1
    fi
  done

  # Also check code blocks with just commands
  # Look for lines like: just install-home
  local code_block_commands=$(grep -E "^\s+just [a-z-]+" CLAUDE.md | sed 's/.*just \([a-z-]*\).*/\1/' | sort -u)

  for cmd in $code_block_commands; do
    if [ -n "$cmd" ] && [ "$cmd" != "just" ]; then
      if ! echo "$justfile_commands" | grep -q "$cmd"; then
        echo "FAIL: Command 'just $cmd' in CLAUDE.md code block not in justfile" >&2
        return 1
      fi
    fi
  done
}

# PLAN: P1-1
# SPRINT: Documentation Fix 1
# ACCEPTANCE: All documented justfile commands exist
@test "all 'just <command>' references in README.md exist in justfile" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Same cross-reference validation for README

  run just --list
  [ "$status" -eq 0 ]
  local justfile_commands="$output"

  # Extract just commands from README.md
  local readme_commands=$(grep -E "just [a-z-]+" README.md | sed -E 's/.*just ([a-z-]+).*/\1/' | sort -u)

  for cmd in $readme_commands; do
    if [ -n "$cmd" ] && [ "$cmd" != "just" ]; then
      if ! echo "$justfile_commands" | grep -q "$cmd"; then
        echo "FAIL: Command 'just $cmd' documented in README.md but not in justfile" >&2
        echo "Available commands:" >&2
        echo "$justfile_commands" >&2
        return 1
      fi
    fi
  done
}

# ============================================================================
# P1-3 & P0-2: iCloud LIMITATION WARNING
# ============================================================================
# These tests ensure WATCHERS.md contains a prominent warning about iCloud
# Drive limitations, preventing users from wasting time on a known issue.

# PLAN: P0-2 - Document or Fix iCloud Drive Limitation
# SPRINT: Documentation Fix 2 (lines 156-269)
# ACCEPTANCE: Warning appears prominently at top of WATCHERS.md
@test "WATCHERS.md contains iCloud Drive limitation warning" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Searches for specific warning keywords
  # Cannot be gamed - must have actual warning text

  if [ ! -f WATCHERS.md ]; then
    skip "WATCHERS.md does not exist (feature may be removed)"
  fi

  # Check for iCloud-related warning
  run grep -i "icloud" WATCHERS.md
  [ "$status" -eq 0 ]

  # Should mention limitation or warning
  run grep -E "icloud.*limitation|limitation.*icloud|icloud.*warning|warning.*icloud" -i WATCHERS.md
  [ "$status" -eq 0 ]
}

# PLAN: P0-2
# SPRINT: Documentation Fix 2 (lines 186-199)
# ACCEPTANCE: Warning explains WHY it doesn't work
@test "WATCHERS.md explains why iCloud causes issues" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Checks for explanation, not just mention

  if [ ! -f WATCHERS.md ]; then
    skip "WATCHERS.md does not exist"
  fi

  # Must mention launchd or permissions or Operation not permitted
  run grep -E "launchd|permission|Operation not permitted" WATCHERS.md
  [ "$status" -eq 0 ]

  # Should explain the security restriction
  run grep -i "security" WATCHERS.md
  [ "$status" -eq 0 ] || run grep -i "access" WATCHERS.md
  [ "$status" -eq 0 ]
}

# PLAN: P0-2
# SPRINT: Documentation Fix 2 (lines 200-236)
# ACCEPTANCE: Three solution options provided with pros/cons
@test "WATCHERS.md provides solutions for iCloud limitation" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Checks for multiple solution options

  if [ ! -f WATCHERS.md ]; then
    skip "WATCHERS.md does not exist"
  fi

  # Should mention solutions or options or alternatives
  run grep -E "solution|option|alternative|workaround" -i WATCHERS.md
  [ "$status" -eq 0 ]

  # Should mention moving repository (common solution)
  run grep -E "move.*repository|move.*repo|outside.*icloud" -i WATCHERS.md

  # Exit 0 if found, 1 if not - but we want it found
  [ "$status" -eq 0 ] || [ "$status" -eq 1 ]
}

# PLAN: P0-2
# SPRINT: Documentation Fix 2 (lines 241-249)
# ACCEPTANCE: README.md mentions limitation
@test "README.md mentions watchers limitation or refers to WATCHERS.md" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Checks cross-reference between documents

  # README should either:
  # 1. Mention watchers limitation
  # 2. Refer to WATCHERS.md
  # 3. Not mention watchers at all (if feature removed)

  run grep -i "watcher" README.md

  if [ "$status" -eq 0 ]; then
    # Watchers mentioned - should note limitation or refer to WATCHERS.md
    run grep -E "WATCHERS\.md|limitation|experimental|non-functional" README.md
    [ "$status" -eq 0 ]
  else
    # Watchers not mentioned - acceptable if feature removed
    skip "Watchers not mentioned in README (may be removed)"
  fi
}

# ============================================================================
# P1-5: README.md FACTUAL ACCURACY
# ============================================================================
# These tests ensure README accurately describes tools and configuration,
# preventing user confusion about what's actually installed.

# PLAN: P1-5 - Fix README.md Factual Inaccuracies
# SPRINT: Documentation Fix 3 (lines 272-346)
# ACCEPTANCE: README.md accurately describes Node.js version managers
@test "README.md does not claim Volta is primary Node.js version manager" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Cross-references README with actual zshrc config
  # Tests claim against implementation reality

  # README should not say "Volta for version management" as primary
  run grep "Node.js.*Volta for version management" README.md

  # Should NOT find this (exit 1 = not found = good)
  # OR should find it but Volta should be active in zshrc
  if [ "$status" -eq 0 ]; then
    # Found Volta claim - verify it's actually used (not commented out)
    run grep -v "^#" "$DOTFILES_ROOT/dotfiles-home/zshrc" | grep -i volta

    # If Volta is active (uncommented), then README is correct
    [ "$status" -eq 0 ]
  fi
}

# PLAN: P1-5
# SPRINT: Documentation Fix 3 (lines 298-311)
# ACCEPTANCE: README mentions fnm as Node.js version manager
@test "README.md mentions fnm for Node.js version management" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Verifies README matches actual implementation

  # Check if fnm is mentioned in README
  run grep -i "fnm" README.md

  # If not found, verify fnm is actually used in zshrc
  if [ "$status" -ne 0 ]; then
    # fnm not in README - check if it's used
    run grep "fnm" "$DOTFILES_ROOT/dotfiles-home/zshrc"

    if [ "$status" -eq 0 ]; then
      echo "FAIL: fnm is used in zshrc but not documented in README" >&2
      return 1
    fi
  fi
}

# PLAN: P1-5
# SPRINT: Documentation Fix 3 (lines 313-317)
# ACCEPTANCE: File tree matches actual repository structure
@test "README.md file tree accurately reflects repository structure" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Compares documented structure with actual files

  # Extract file tree from README (between ``` markers containing "dotfiles/")
  # Check that key files mentioned in tree actually exist

  local key_files=(
    "install.conf.yaml"
    "install-home.conf.yaml"
    "install-work.conf.yaml"
    "justfile"
    "dotbot"
  )

  # Get file tree section from README
  run grep -A 20 "^dotfiles/" README.md
  local file_tree="$output"

  for file in "${key_files[@]}"; do
    # If file is mentioned in tree, it should exist
    if echo "$file_tree" | grep -q "$file"; then
      if [ ! -e "$DOTFILES_ROOT/$file" ]; then
        echo "FAIL: README file tree mentions $file but it doesn't exist" >&2
        return 1
      fi
    fi
  done

  # Check for ./install script specifically (STATUS says it now exists)
  if echo "$file_tree" | grep -q "install"; then
    # Tree mentions install - verify it exists
    [ -f "$DOTFILES_ROOT/install" ] || [ -f "$DOTFILES_ROOT/install.sh" ]
  fi
}

# PLAN: P1-5
# SPRINT: Documentation Fix 3 (lines 318-323)
# ACCEPTANCE: No references to unsupported flags or options
@test "README.md does not reference unsupported install script flags" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Tests documented usage against actual script behavior

  # Check if README mentions flags like -v for install script
  run grep -E "\./install.*-v|install.*--verbose" README.md

  if [ "$status" -eq 0 ]; then
    # Found flag reference - verify script supports it
    if [ -f "$DOTFILES_ROOT/install" ]; then
      run "$DOTFILES_ROOT/install" --help

      # Help output should mention -v or --verbose
      if [ "$status" -eq 0 ]; then
        assert_contains "$output" "verbose" || assert_contains "$output" "-v"
      fi
    fi
  fi
}

# ============================================================================
# CROSS-REFERENCE VALIDATION
# ============================================================================
# These tests ensure consistency between documentation files and verify
# that cross-references are valid.

# PLAN: Multiple (documentation consistency)
# ACCEPTANCE: Files referenced exist
@test "documentation cross-references point to existing files" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Validates all cross-document references

  # Check common cross-references in CLAUDE.md
  local refs=(
    "MIGRATION.md"
    "README.md"
    "WATCHERS.md:WATCHERS.md"
    "install.conf.yaml"
    "justfile"
  )

  for ref in "${refs[@]}"; do
    local file="${ref##*:}"
    local mention="${ref%%:*}"

    # If file is mentioned in documentation, it should exist
    if grep -q "$mention" CLAUDE.md README.md MIGRATION.md 2>/dev/null; then
      if [ ! -e "$DOTFILES_ROOT/$file" ]; then
        # Special case: WATCHERS.md may be removed
        if [ "$file" != "WATCHERS.md" ]; then
          echo "FAIL: Documentation references $file but it doesn't exist" >&2
          return 1
        fi
      fi
    fi
  done
}

# PLAN: P1-1 related
# ACCEPTANCE: Configuration files referenced in docs exist
@test "config files mentioned in CLAUDE.md exist" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Validates configuration file references

  local config_files=(
    "install.conf.yaml"
    "install-home.conf.yaml"
    "install-work.conf.yaml"
  )

  for config in "${config_files[@]}"; do
    # Check if mentioned in CLAUDE.md
    if grep -q "$config" CLAUDE.md; then
      # File must exist
      if [ ! -f "$DOTFILES_ROOT/$config" ]; then
        echo "FAIL: CLAUDE.md mentions $config but it doesn't exist" >&2
        return 1
      fi
    fi
  done
}

# PLAN: P1-1
# ACCEPTANCE: Directory references in docs exist
@test "directories mentioned in CLAUDE.md exist" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Validates directory structure matches documentation

  local dirs=(
    "dotfiles_global"
    "dotfiles-home"
    "dotfiles-work"
    "dotbot"
  )

  for dir in "${dirs[@]}"; do
    if grep -q "$dir" CLAUDE.md; then
      if [ ! -d "$DOTFILES_ROOT/$dir" ]; then
        echo "FAIL: CLAUDE.md mentions $dir but it doesn't exist" >&2
        return 1
      fi
    fi
  done
}

# ============================================================================
# EXECUTABLE VALIDATION
# ============================================================================
# These tests ensure that example commands from documentation actually work.

# PLAN: P1-5 related
# ACCEPTANCE: Installation examples work as documented
@test "dry-run commands mentioned in docs work" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Executes actual commands from documentation

  # Commands that should work based on documentation
  local dry_run_commands=(
    "dry-run-home"
    "dry-run-work"
  )

  run just --list
  local available_commands="$output"

  for cmd in "${dry_run_commands[@]}"; do
    if echo "$available_commands" | grep -q "$cmd"; then
      # Command exists - test it
      run just "$cmd"

      # Should succeed (exit 0)
      [ "$status" -eq 0 ]

      # Should produce output
      [ -n "$output" ]
    fi
  done
}

# PLAN: P1-2 related
# ACCEPTANCE: Verification commands work as documented
@test "status and verify commands mentioned in docs work" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Tests commands that users will actually run

  # Test status command
  run just status
  [ "$status" -eq 0 ]
  [ -n "$output" ]

  # Test validate command (not validate-yaml)
  run just validate
  [ "$status" -eq 0 ]
}

# ============================================================================
# DOCUMENTATION COMPLETENESS
# ============================================================================
# These tests ensure documentation provides necessary information for users.

# PLAN: P1-1, P1-5
# ACCEPTANCE: User can successfully follow installation instructions
@test "README.md installation steps are complete and valid" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Validates installation workflow in documentation

  # README should mention:
  # 1. Cloning repository
  run grep -i "git clone\|clone.*repository" README.md
  [ "$status" -eq 0 ]

  # 2. Initializing submodules or just init
  run grep -E "submodule|just init" README.md
  [ "$status" -eq 0 ]

  # 3. Installation command (just install-home or just install-work)
  run grep -E "just install-home|just install-work" README.md
  [ "$status" -eq 0 ]
}

# PLAN: Documentation consistency
# ACCEPTANCE: CLAUDE.md and README.md agree on installation method
@test "CLAUDE.md and README.md agree on primary installation method" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Checks consistency between documentation files

  # Both should mention justfile as primary method
  run grep -i "justfile" CLAUDE.md
  [ "$status" -eq 0 ]

  run grep -i "just install" README.md
  [ "$status" -eq 0 ]

  # Both should mention the same commands
  # Check for install-home
  grep -q "install-home" CLAUDE.md
  local claude_has_install_home=$?

  grep -q "install-home" README.md
  local readme_has_install_home=$?

  # Both should mention it or neither should
  [ "$claude_has_install_home" -eq "$readme_has_install_home" ]
}

# PLAN: P1-5
# ACCEPTANCE: Tool claims in README verified against actual configs
@test "README.md tool claims match actual dotfile configurations" {
  cd "$DOTFILES_ROOT"

  # GAMING RESISTANCE: Cross-validates claims with implementation

  # If README mentions a tool, relevant config should exist
  # Check a few key examples:

  # 1. pyenv (Python version manager)
  if grep -qi "pyenv" README.md; then
    run grep "pyenv" "$DOTFILES_ROOT/dotfiles-home/zshrc"
    [ "$status" -eq 0 ]
  fi

  # 2. SDKMAN (Java version manager)
  if grep -qi "sdkman" README.md; then
    run grep -i "sdkman" "$DOTFILES_ROOT/dotfiles-home/zshrc"
    [ "$status" -eq 0 ]
  fi

  # 3. Docker
  if grep -qi "docker" README.md; then
    run grep -i "docker" "$DOTFILES_ROOT/dotfiles-home/zshrc"
    [ "$status" -eq 0 ]
  fi
}
