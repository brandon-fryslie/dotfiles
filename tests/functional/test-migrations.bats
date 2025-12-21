#!/usr/bin/env bats
# test-migrations.bats - Functional tests for migration system
#
# Tests the migration lifecycle:
# - Migration scripts have required structure
# - Migration runner executes correctly
# - Markers track completion
# - Just commands work as documented

load '../helpers/test-helpers'

setup() {
    TEST_HOME=$(create_test_home)
    export HOME="$TEST_HOME"
    export DOTFILES_DIR="$DOTFILES_ROOT"

    # Create test markers directory
    TEST_MARKERS="$TEST_HOME/.local/state/dotfiles-migrations"
    mkdir -p "$TEST_MARKERS"

    require_just
}

teardown() {
    unset HOME
    unset DOTFILES_DIR
    cleanup_test_dir "$TEST_HOME"
}

# =============================================================================
# Migration Script Structure Tests
# =============================================================================

@test "migration scripts follow naming convention NNNN-name.sh" {
    cd "$DOTFILES_ROOT"

    # Find all migration scripts
    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue
        name=$(basename "$migration")

        # Must match pattern: 4 digits, dash, lowercase kebab-case, .sh
        [[ "$name" =~ ^[0-9]{4}-[a-z0-9-]+\.sh$ ]]
    done
}

@test "migration scripts have required Author header" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^# Author:" "$migration"
        [ "$status" -eq 0 ] || fail "Missing Author header in $(basename "$migration")"
    done
}

@test "migration scripts have required Created header" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^# Created:" "$migration"
        [ "$status" -eq 0 ] || fail "Missing Created header in $(basename "$migration")"
    done
}

@test "migration scripts have required Problem header" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^# Problem:" "$migration"
        [ "$status" -eq 0 ] || fail "Missing Problem header in $(basename "$migration")"
    done
}

@test "migration scripts have required Fix header" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^# Fix:" "$migration"
        [ "$status" -eq 0 ] || fail "Missing Fix header in $(basename "$migration")"
    done
}

@test "migration scripts have required Safe to delete after header" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^# Safe to delete after:" "$migration"
        [ "$status" -eq 0 ] || fail "Missing 'Safe to delete after' header in $(basename "$migration")"
    done
}

@test "migration scripts define migrate_check function" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^migrate_check()" "$migration"
        [ "$status" -eq 0 ] || fail "Missing migrate_check() in $(basename "$migration")"
    done
}

@test "migration scripts define migrate_apply function" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep -q "^migrate_apply()" "$migration"
        [ "$status" -eq 0 ] || fail "Missing migrate_apply() in $(basename "$migration")"
    done
}

@test "migration scripts have no unfilled TODO placeholders" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run grep "^#.*TODO:" "$migration"
        [ "$status" -ne 0 ] || fail "Unfilled TODO in $(basename "$migration"): $output"
    done
}

@test "migration scripts have valid bash syntax" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        run bash -n "$migration"
        [ "$status" -eq 0 ] || fail "Syntax error in $(basename "$migration"): $output"
    done
}

@test "migration scripts are executable" {
    cd "$DOTFILES_ROOT"

    for migration in migrations/[0-9][0-9][0-9][0-9]-*.sh; do
        [[ -f "$migration" ]] || continue

        [ -x "$migration" ] || fail "$(basename "$migration") is not executable"
    done
}

# =============================================================================
# Migration Runner Tests
# =============================================================================

@test "run-migrations.sh exists and is executable" {
    [ -f "$DOTFILES_ROOT/migrations/run-migrations.sh" ]
    [ -x "$DOTFILES_ROOT/migrations/run-migrations.sh" ]
}

@test "migration runner creates markers directory" {
    cd "$DOTFILES_ROOT"

    # Remove markers dir if exists
    rm -rf "$TEST_MARKERS"

    # Run migrations
    source migrations/run-migrations.sh

    # Markers directory should exist
    [ -d "$TEST_MARKERS" ]
}

@test "migration runner skips already-completed migrations" {
    cd "$DOTFILES_ROOT"

    # Create marker for first migration
    touch "$TEST_MARKERS/0001-restore-claude-plugins-config.done"

    # Capture output
    run bash -c "source migrations/run-migrations.sh"

    # Should not see "Running" message for already-done migration
    assert_not_contains "$output" "Running: 0001-restore-claude-plugins-config"
}

@test "migrate_check returning 1 marks migration as done without running apply" {
    cd "$DOTFILES_ROOT"

    # Create a test migration that doesn't need to run
    cat > "$DOTFILES_ROOT/migrations/9999-test-no-run.sh" << 'EOF'
#!/usr/bin/env bash
# Migration: 9999-test-no-run.sh
# Author: test
# Created: 2025-01-01
#
# Problem:
#   Test migration that should not run
#
# Fix:
#   Nothing
#
# Safe to delete after:
#   Immediately

migrate_check() {
    return 1  # Already done
}

migrate_apply() {
    echo "THIS SHOULD NOT PRINT"
    return 0
}
EOF
    chmod +x "$DOTFILES_ROOT/migrations/9999-test-no-run.sh"

    # Run migrations
    run bash -c "source migrations/run-migrations.sh"

    # Should not see apply output
    assert_not_contains "$output" "THIS SHOULD NOT PRINT"

    # Should have marker
    [ -f "$TEST_MARKERS/9999-test-no-run.done" ]

    # Cleanup
    rm -f "$DOTFILES_ROOT/migrations/9999-test-no-run.sh"
    rm -f "$TEST_MARKERS/9999-test-no-run.done"
}

# =============================================================================
# Just Command Tests
# =============================================================================

@test "just migrate-status shows pending and completed migrations" {
    cd "$DOTFILES_ROOT"

    # Mark one as done
    touch "$TEST_MARKERS/0001-restore-claude-plugins-config.done"

    run just migrate-status

    [ "$status" -eq 0 ]
    assert_contains "$output" "Migration Status"
    assert_contains "$output" "0001-restore-claude-plugins-config"
}

@test "just migrate-new creates new migration from template" {
    cd "$DOTFILES_ROOT"

    # Find what the next number would be
    run just migrate-new test-new-migration

    [ "$status" -eq 0 ]
    assert_contains "$output" "Created:"

    # Find the created file
    new_file=$(find migrations -name '*-test-new-migration.sh' -type f)
    [ -n "$new_file" ]
    [ -f "$new_file" ]

    # Check it has required headers
    grep -q "^# Migration:" "$new_file"
    grep -q "^# Author:" "$new_file"
    grep -q "^# Created:" "$new_file"
    grep -q "^# Problem:" "$new_file"
    grep -q "^# Fix:" "$new_file"
    grep -q "^# Safe to delete after:" "$new_file"
    grep -q "^migrate_check()" "$new_file"
    grep -q "^migrate_apply()" "$new_file"

    # Cleanup
    rm -f "$new_file"
}

@test "just migrate-new increments migration number" {
    cd "$DOTFILES_ROOT"

    # Create first test migration
    run just migrate-new first-test
    [ "$status" -eq 0 ]
    first_file=$(find migrations -name '*-first-test.sh' -type f)

    # Create second test migration
    run just migrate-new second-test
    [ "$status" -eq 0 ]
    second_file=$(find migrations -name '*-second-test.sh' -type f)

    # Extract numbers
    first_num=$(basename "$first_file" | cut -c1-4)
    second_num=$(basename "$second_file" | cut -c1-4)

    # Second should be first + 1
    [ "$((10#$second_num))" -eq "$((10#$first_num + 1))" ]

    # Cleanup
    rm -f "$first_file" "$second_file"
}

@test "validate-migrations is included in just validate recipe" {
    cd "$DOTFILES_ROOT"

    # Check that justfile includes migration validation
    run grep -A2 "^validate:" justfile

    [ "$status" -eq 0 ]
    assert_contains "$output" "validate-migrations"
}

# =============================================================================
# Template Tests
# =============================================================================

@test "migration template exists" {
    [ -f "$DOTFILES_ROOT/migrations/template.sh" ]
}

@test "migration template has all required placeholders" {
    template="$DOTFILES_ROOT/migrations/template.sh"

    grep -q "MIGRATION_NAME" "$template"
    grep -q "AUTHOR" "$template"
    grep -q "CREATED_DATE" "$template"
    grep -q "migrate_check()" "$template"
    grep -q "migrate_apply()" "$template"
}

# =============================================================================
# Documentation Tests
# =============================================================================

@test "MIGRATIONS.md exists" {
    [ -f "$DOTFILES_ROOT/MIGRATIONS.md" ]
}

@test "MIGRATIONS.md documents just migrate command" {
    grep -q "just migrate" "$DOTFILES_ROOT/MIGRATIONS.md"
}

@test "MIGRATIONS.md documents just migrate-status command" {
    grep -q "just migrate-status" "$DOTFILES_ROOT/MIGRATIONS.md"
}

@test "MIGRATIONS.md documents just migrate-new command" {
    grep -q "just migrate-new" "$DOTFILES_ROOT/MIGRATIONS.md"
}

@test "MIGRATIONS.md documents required script structure" {
    grep -q "migrate_check" "$DOTFILES_ROOT/MIGRATIONS.md"
    grep -q "migrate_apply" "$DOTFILES_ROOT/MIGRATIONS.md"
}
