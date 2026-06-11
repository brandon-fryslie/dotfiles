#!/usr/bin/env bats
# test-copilot-with-sync.bats - Functional tests for copilot-with-sync argument handling
#
# Pins ticket dotfiles-script-audit-lbl.17: the --force-sync handler did
# `shift; run_sync; exit $?`, so `copilot-with-sync --force-sync -p "do stuff"`
# synced and exited — copilot never launched and the trailing args were
# silently discarded, contradicting the script's own help text which frames
# --force-sync as a modifier on a normal launch.
#
# Tests run the real script against a temp HOME with a stub `copilot` on PATH
# and a stub sync script, each recording its argv to a file — no real copilot
# session and no real sync ever run.

load '../helpers/test-helpers'

setup() {
    command -v python3 >/dev/null 2>&1 || skip "python3 not available"

    TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/copilot-sync-test.XXXXXX")
    TEST_HOME="$TEST_DIR/home"
    STUB_BIN="$TEST_DIR/bin"
    RECORD_DIR="$TEST_DIR/record"
    mkdir -p "$TEST_HOME/.copilot/skills/claude-plugin-sync" "$STUB_BIN" "$RECORD_DIR"

    SCRIPT="$DOTFILES_ROOT/config/copilot/bin/copilot-with-sync"

    # Stub copilot: records argv (one per line) instead of launching anything
    cat > "$STUB_BIN/copilot" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" > "$RECORD_DIR/copilot-args"
echo "copilot-launched"
EOF
    chmod +x "$STUB_BIN/copilot"

    # Stub sync script: records argv, succeeds
    cat > "$TEST_HOME/.copilot/skills/claude-plugin-sync/sync_enhanced.py" <<EOF
import json, sys
with open("$RECORD_DIR/sync-args", "w") as f:
    json.dump(sys.argv[1:], f)
EOF
}

teardown() {
    cleanup_test_dir "$TEST_DIR"
}

run_script() {
    run env HOME="$TEST_HOME" PATH="$STUB_BIN:$PATH" COPILOT_QUIET_SYNC=0 "$SCRIPT" "$@"
}

mark_recently_synced() {
    echo '{}' > "$TEST_HOME/.copilot/sync-manifest.json"
    date +%s > "$TEST_HOME/.copilot/.last-sync"
}

make_sync_fail() {
    cat > "$TEST_HOME/.copilot/skills/claude-plugin-sync/sync_enhanced.py" <<EOF
import sys
sys.exit(1)
EOF
}

# =============================================================================
# The bug: --force-sync must sync AND launch copilot with the remaining args
# =============================================================================

@test "copilot-with-sync: --force-sync launches copilot with remaining args" {
    run_script --force-sync -p "do stuff"

    # Pre-fix: synced and exited; copilot never started, args discarded
    [ "$status" -eq 0 ]
    [[ "$output" == *"copilot-launched"* ]]
    [ -f "$RECORD_DIR/copilot-args" ]
    [ "$(cat "$RECORD_DIR/copilot-args")" = "$(printf '%s\n' -p "do stuff")" ]
}

@test "copilot-with-sync: --force-sync syncs even when recently synced" {
    mark_recently_synced
    run_script --force-sync

    [ "$status" -eq 0 ]
    [ -f "$RECORD_DIR/sync-args" ]
    [[ "$output" == *"copilot-launched"* ]]
}

@test "copilot-with-sync: --force-sync does not forward copilot args to the sync script" {
    run_script --force-sync -p "do stuff"

    [ -f "$RECORD_DIR/sync-args" ]
    [ "$(cat "$RECORD_DIR/sync-args")" = "[]" ]
}

@test "copilot-with-sync: forced sync failure is loud but still launches copilot" {
    make_sync_fail
    run_script --force-sync -p "do stuff"

    # Pre-fix: exited 1 at run_sync; copilot never started
    [ "$status" -eq 0 ]
    [[ "$output" == *"Sync failed"* ]]
    [[ "$output" == *"copilot-launched"* ]]
    [ "$(cat "$RECORD_DIR/copilot-args")" = "$(printf '%s\n' -p "do stuff")" ]
}

# =============================================================================
# Regression pins: existing behavior unchanged
# =============================================================================

@test "copilot-with-sync: recently synced launch skips sync and passes args verbatim" {
    mark_recently_synced
    run_script -p "do stuff"

    [ "$status" -eq 0 ]
    [ ! -f "$RECORD_DIR/sync-args" ]
    [[ "$output" == *"copilot-launched"* ]]
    [ "$(cat "$RECORD_DIR/copilot-args")" = "$(printf '%s\n' -p "do stuff")" ]
}

@test "copilot-with-sync: stale sync triggers sync then launch" {
    echo '{}' > "$TEST_HOME/.copilot/sync-manifest.json"
    echo 0 > "$TEST_HOME/.copilot/.last-sync"
    run_script -p "do stuff"

    [ "$status" -eq 0 ]
    [ -f "$RECORD_DIR/sync-args" ]
    [[ "$output" == *"copilot-launched"* ]]
}

@test "copilot-with-sync: --help exits 0 without syncing or launching" {
    run_script --help

    [ "$status" -eq 0 ]
    [[ "$output" == *"Usage:"* ]]
    [ ! -f "$RECORD_DIR/sync-args" ]
    [ ! -f "$RECORD_DIR/copilot-args" ]
}
