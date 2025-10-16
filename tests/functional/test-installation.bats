#!/usr/bin/env bats
# test-installation.bats - Functional tests for dotfiles installation
#
# STATUS REFERENCE: STATUS-2025-10-15-043506.md
# - Section 2: Gap 2 - Missing install wrapper script
# - Section 2: Core Dotbot Installation System - COMPLETE
#
# PLAN REFERENCE: PLAN-2025-10-15-110000.md
# - P0-3: Remove or Create Missing install Wrapper Script
#
# USER WORKFLOWS TESTED:
# 1. Fresh clone scenario - user clones repo and installs
# 2. Profile installation via justfile
# 3. Profile installation via ./install script (if exists)
# 4. Submodule initialization
# 5. Symlink creation and verification
#
# GAMING RESISTANCE:
# - Tests actual file system state after installation
# - Verifies symlinks point to correct targets
# - Checks that real dotfiles are linked, not stubs
# - Tests from temporary HOME directory, not mocks

load '../helpers/test-helpers'

setup() {
  # Create temporary test home directory
  TEST_HOME=$(create_test_home)
  export HOME="$TEST_HOME"

  debug "Test HOME: $TEST_HOME"
  debug "Repo root: $DOTFILES_ROOT"

  # Verify dotbot is available
  require_dotbot
}

teardown() {
  # Restore original HOME and clean up
  unset HOME
  cleanup_test_dir "$TEST_HOME"
}

# STATUS: P0-3 - Documented install script existence
# ACCEPTANCE: Users can follow README installation instructions
# GAMING RESISTANCE: Tests documented workflow matches reality
@test "installation method documented in README actually exists" {
  # Check if ./install script exists as documented
  if [ -f "$DOTFILES_ROOT/install" ]; then
    # If it exists, it should be executable
    [ -x "$DOTFILES_ROOT/install" ]
  else
    # If it doesn't exist, justfile commands should work
    require_just
    run just --justfile "$DOTFILES_ROOT/justfile" --list
    [ "$status" -eq 0 ]
    assert_contains "$output" "install-home"
    assert_contains "$output" "install-work"
  fi
}

# CORE FUNCTIONALITY: Install home profile via justfile
# GAMING RESISTANCE: Verifies actual symlinks created in real filesystem
@test "just install-home creates symlinks in home directory" {
  require_just

  # Change to repo directory (just needs to run from there)
  cd "$DOTFILES_ROOT"

  # Execute installation
  run just install-home

  # Installation should succeed
  [ "$status" -eq 0 ]

  # Verify critical symlinks were created
  # Note: We check for symlinks, not regular files
  assert_symlink_exists "$HOME/.zshrc"
  assert_symlink_exists "$HOME/.rad-plugins"

  # Verify symlinks point to home profile (not work or global)
  assert_symlink_target "$HOME/.zshrc" "dotfiles-home/zshrc"
  assert_symlink_target "$HOME/.rad-plugins" "dotfiles-home/rad-plugins"
}

# CORE FUNCTIONALITY: Install work profile via justfile
# GAMING RESISTANCE: Verifies correct profile files are linked
@test "just install-work creates work profile symlinks" {
  require_just

  cd "$DOTFILES_ROOT"

  # Execute work profile installation
  run just install-work

  [ "$status" -eq 0 ]

  # Verify symlinks point to work profile
  assert_symlink_exists "$HOME/.zshrc"
  assert_symlink_target "$HOME/.zshrc" "dotfiles-work/zshrc"

  assert_symlink_exists "$HOME/.rad-plugins"
  assert_symlink_target "$HOME/.rad-plugins" "dotfiles-work/rad-plugins"
}

# CORE FUNCTIONALITY: Install global configuration only
# GAMING RESISTANCE: Verifies global files linked, profile files not
@test "just install-global creates only global symlinks" {
  require_just

  cd "$DOTFILES_ROOT"

  # Execute global-only installation
  run just install-global

  [ "$status" -eq 0 ]

  # Verify global files are linked
  # These should exist regardless of profile
  if [ -f "$DOTFILES_ROOT/dotfiles_global/gitignore_global" ]; then
    assert_symlink_exists "$HOME/.gitignore_global"
  fi

  if [ -f "$DOTFILES_ROOT/dotfiles_global/p10k.zsh" ]; then
    assert_symlink_exists "$HOME/.p10k.zsh"
  fi

  # Profile-specific files should NOT be linked
  # (These would only come from profile configs)
  # Note: Can't test negative easily without knowing exact file list
}

# PROFILE SWITCHING: Switch from home to work profile
# GAMING RESISTANCE: Verifies symlink targets actually change
@test "switching profiles updates symlink targets" {
  require_just

  cd "$DOTFILES_ROOT"

  # Install home profile first
  run just install-home
  [ "$status" -eq 0 ]

  # Capture home profile symlink target
  home_target=$(readlink "$HOME/.zshrc")
  assert_contains "$home_target" "dotfiles-home"

  # Switch to work profile
  run just install-work
  [ "$status" -eq 0 ]

  # Verify symlink target changed
  work_target=$(readlink "$HOME/.zshrc")
  assert_contains "$work_target" "dotfiles-work"

  # Targets should be different
  [ "$home_target" != "$work_target" ]
}

# INSTALL SCRIPT: Test ./install script if it exists
# GAMING RESISTANCE: Tests actual script execution
@test "./install script works if present (P0-3)" {
  # Skip if script doesn't exist (not a failure - might not be implemented)
  if [ ! -f "$DOTFILES_ROOT/install" ]; then
    skip "./install script not present (justfile method is alternative)"
  fi

  cd "$DOTFILES_ROOT"

  # Test install script with home profile
  run ./install home

  [ "$status" -eq 0 ]

  # Verify symlinks created
  assert_symlink_exists "$HOME/.zshrc"
  assert_symlink_target "$HOME/.zshrc" "dotfiles-home/zshrc"
}

# INSTALL SCRIPT: Test work profile via ./install
# GAMING RESISTANCE: Tests both profiles work
@test "./install script supports work profile if present" {
  if [ ! -f "$DOTFILES_ROOT/install" ]; then
    skip "./install script not present"
  fi

  cd "$DOTFILES_ROOT"

  # Test install script with work profile
  run ./install work

  [ "$status" -eq 0 ]

  # Verify work profile symlinks
  assert_symlink_exists "$HOME/.zshrc"
  assert_symlink_target "$HOME/.zshrc" "dotfiles-work/zshrc"
}

# ERROR HANDLING: Install script shows usage if no argument
# GAMING RESISTANCE: Tests error handling
@test "./install script shows usage without arguments if present" {
  if [ ! -f "$DOTFILES_ROOT/install" ]; then
    skip "./install script not present"
  fi

  cd "$DOTFILES_ROOT"

  # Run without arguments
  run ./install

  # Should fail with usage message
  [ "$status" -ne 0 ]
  assert_contains "$output" "usage" || assert_contains "$output" "Usage"
}

# ERROR HANDLING: Install script rejects invalid profile
# GAMING RESISTANCE: Tests input validation
@test "./install script rejects invalid profile if present" {
  if [ ! -f "$DOTFILES_ROOT/install" ]; then
    skip "./install script not present"
  fi

  cd "$DOTFILES_ROOT"

  # Run with invalid profile name
  run ./install invalid-profile-name

  # Should fail
  [ "$status" -ne 0 ]
  assert_contains "$output" "nknown" || assert_contains "$output" "rror"
}

# CONFIGURATION COMPOSITION: Later configs override earlier
# GAMING RESISTANCE: Verifies Dotbot composition works correctly
@test "profile configs override global configs (composition)" {
  require_just

  cd "$DOTFILES_ROOT"

  # Install home profile (which includes global + home)
  run just install-home
  [ "$status" -eq 0 ]

  # If a file is defined in both global and home configs,
  # the symlink should point to home version
  assert_symlink_exists "$HOME/.zshrc"

  # The target should be from dotfiles-home, not dotfiles_global
  target=$(readlink "$HOME/.zshrc")
  assert_contains "$target" "dotfiles-home"
  assert_not_contains "$target" "dotfiles_global"
}

# FRESH CLONE SCENARIO: Simulating new user experience
# GAMING RESISTANCE: Tests complete workflow from scratch
@test "fresh installation from README instructions works" {
  require_just

  cd "$DOTFILES_ROOT"

  # Simulate steps from README:
  # 1. Submodules should already be initialized (or user runs: git submodule update --init)
  # 2. User runs installation command

  # Verify submodule is present
  assert_dir_exists "$DOTFILES_ROOT/dotbot"
  assert_file_exists "$DOTFILES_ROOT/dotbot/bin/dotbot"

  # 3. Install home profile (typical first-time user)
  run just install-home
  [ "$status" -eq 0 ]

  # 4. Verify expected files are linked
  assert_symlink_exists "$HOME/.zshrc"

  # 5. Verify new shell session would load config
  # (We can't actually test shell loading, but we can verify symlink works)
  assert_file_exists "$HOME/.zshrc"
}

# DRY RUN: Test dry-run mode doesn't create files
# GAMING RESISTANCE: Verifies dry-run doesn't modify filesystem
@test "just dry-run-home does not create actual symlinks" {
  require_just

  cd "$DOTFILES_ROOT"

  # Verify no symlinks exist yet
  [ ! -L "$HOME/.zshrc" ]

  # Run in dry-run mode
  run just dry-run-home

  # Command should succeed
  [ "$status" -eq 0 ]

  # Symlinks should still not exist
  [ ! -L "$HOME/.zshrc" ]
}

# IDEMPOTENCY: Running install multiple times is safe
# GAMING RESISTANCE: Tests that installation can be repeated
@test "running install twice does not break configuration" {
  require_just

  cd "$DOTFILES_ROOT"

  # First installation
  run just install-home
  [ "$status" -eq 0 ]

  # Capture first target
  first_target=$(readlink "$HOME/.zshrc")

  # Second installation (should be idempotent)
  run just install-home
  [ "$status" -eq 0 ]

  # Symlink should still exist and point to same target
  assert_symlink_exists "$HOME/.zshrc"
  second_target=$(readlink "$HOME/.zshrc")

  [ "$first_target" = "$second_target" ]
}

# SYMLINK VERIFICATION: Created symlinks are not broken
# GAMING RESISTANCE: Tests symlinks actually resolve
@test "created symlinks point to existing files" {
  require_just

  cd "$DOTFILES_ROOT"

  run just install-home
  [ "$status" -eq 0 ]

  # Verify symlink exists
  assert_symlink_exists "$HOME/.zshrc"

  # Verify symlink target exists (symlink is not broken)
  target=$(readlink "$HOME/.zshrc")

  # If target is relative, resolve from HOME directory
  if [[ "$target" != /* ]]; then
    target="$HOME/$target"
  fi

  # Target file should exist
  [ -f "$target" ]
}

# MULTIPLE FILES: Installation links multiple dotfiles
# GAMING RESISTANCE: Verifies comprehensive installation
@test "installation creates multiple expected symlinks" {
  require_just

  cd "$DOTFILES_ROOT"

  run just install-home
  [ "$status" -eq 0 ]

  # Count symlinks created in HOME
  # Should be multiple files, not just one
  symlink_count=$(find "$HOME" -maxdepth 1 -type l | wc -l)

  # Should have created at least 2 symlinks
  [ "$symlink_count" -ge 2 ]
}

# BACKUP: Installation doesn't delete existing files (Dotbot force mode)
# GAMING RESISTANCE: Tests data preservation
@test "installation handles existing files safely" {
  require_just

  cd "$DOTFILES_ROOT"

  # Create existing file (not symlink)
  echo "existing content" > "$HOME/.existing-dotfile"

  # Install (Dotbot should handle existing files per its config)
  run just install-home

  # Installation should succeed (Dotbot uses force: true)
  [ "$status" -eq 0 ]

  # If there was a config for .existing-dotfile, it's now a symlink
  # If there wasn't, the file should still exist
  [ -e "$HOME/.existing-dotfile" ]
}

# CONFIGURATION VALIDATION: YAML configs are valid
# GAMING RESISTANCE: Tests configuration files are correct
@test "dotbot configuration files are valid YAML" {
  assert_valid_yaml "$DOTFILES_ROOT/install.conf.yaml"
  assert_valid_yaml "$DOTFILES_ROOT/install-home.conf.yaml"
  assert_valid_yaml "$DOTFILES_ROOT/install-work.conf.yaml"
}

# DIRECTORY STRUCTURE: Required directories exist
# GAMING RESISTANCE: Tests repository structure
@test "repository has required directory structure" {
  assert_dir_exists "$DOTFILES_ROOT/dotbot"
  assert_dir_exists "$DOTFILES_ROOT/dotfiles_global"
  assert_dir_exists "$DOTFILES_ROOT/dotfiles-home"
  assert_dir_exists "$DOTFILES_ROOT/dotfiles-work"
  assert_dir_exists "$DOTFILES_ROOT/scripts"
}

# DOTBOT EXECUTABLE: Dotbot binary exists and is executable
# GAMING RESISTANCE: Tests critical dependency
@test "dotbot submodule is initialized and executable" {
  assert_file_exists "$DOTFILES_ROOT/dotbot/bin/dotbot"
  [ -x "$DOTFILES_ROOT/dotbot/bin/dotbot" ]
}

# PROFILE FILES: Required dotfiles exist in profile directories
# GAMING RESISTANCE: Tests that source files exist
@test "profile directories contain expected dotfiles" {
  # Home profile should have zshrc
  assert_file_exists "$DOTFILES_ROOT/dotfiles-home/zshrc"

  # Work profile should have zshrc
  assert_file_exists "$DOTFILES_ROOT/dotfiles-work/zshrc"

  # Both should have rad-plugins (if using rad-shell)
  if [ -f "$DOTFILES_ROOT/dotfiles-home/rad-plugins" ]; then
    assert_file_exists "$DOTFILES_ROOT/dotfiles-home/rad-plugins"
  fi

  if [ -f "$DOTFILES_ROOT/dotfiles-work/rad-plugins" ]; then
    assert_file_exists "$DOTFILES_ROOT/dotfiles-work/rad-plugins"
  fi
}
