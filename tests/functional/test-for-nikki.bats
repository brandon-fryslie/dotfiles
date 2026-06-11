#!/usr/bin/env bats
# test-for-nikki.bats - Functional tests for for_nikki.sh copy phase
#
# Pins ticket dotfiles-script-audit-lbl.15: on an installed machine, dotbot
# symlinks ~/.claude/CLAUDE.md to config/claude/CLAUDE.md — the very file the
# script copies from. `cp src link-to-src` exits 1 "are identical" and
# set -euo pipefail kills the default invocation before anything runs.
#
# Tests execute the real script against an isolated temp repo + temp HOME so
# the live ~/.claude/CLAUDE.md symlink is never touched. The animation is cut
# short with `timeout`; the witness that the copy phase succeeded is the
# greeting the script prints immediately after it.

load '../helpers/test-helpers'

WITNESS="For you, my love"

setup() {
    command -v timeout >/dev/null 2>&1 || skip "timeout not available"

    TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/for-nikki-test.XXXXXX")
    TEST_HOME="$TEST_DIR/home"
    TEST_REPO="$TEST_DIR/repo"

    mkdir -p "$TEST_HOME/.claude" "$TEST_HOME/.codex" "$TEST_REPO/config/claude"
    echo "fixture CLAUDE.md content" > "$TEST_REPO/config/claude/CLAUDE.md"
    cp "$DOTFILES_ROOT/for_nikki.sh" "$TEST_REPO/for_nikki.sh"

    export HOME="$TEST_HOME"
    export TERM=xterm
}

teardown() {
    unset HOME
    cleanup_test_dir "$TEST_DIR"
}

run_script() {
    # Animation runs indefinitely long relative to a test; the copy phase and
    # witness greeting happen within the first moments. 124 = cut short, fine.
    run timeout 5 bash "$TEST_REPO/for_nikki.sh" "$@"
}

# =============================================================================
# The bug: destination is the dotbot symlink to SOURCE itself
# =============================================================================

@test "for_nikki.sh: default invocation survives ~/.claude/CLAUDE.md symlinked to SOURCE" {
    ln -s "$TEST_REPO/config/claude/CLAUDE.md" "$TEST_HOME/.claude/CLAUDE.md"

    run_script

    # Pre-fix: cp aborts the script with exit 1 before any output
    [ "$status" -ne 1 ]
    [[ "$output" == *"$WITNESS"* ]]
    [[ "$output" != *"identical"* ]]
}

@test "for_nikki.sh: same-file destination is left as the intact symlink" {
    ln -s "$TEST_REPO/config/claude/CLAUDE.md" "$TEST_HOME/.claude/CLAUDE.md"

    run_script

    [ -L "$TEST_HOME/.claude/CLAUDE.md" ]
    [ "$(readlink "$TEST_HOME/.claude/CLAUDE.md")" = "$TEST_REPO/config/claude/CLAUDE.md" ]
}

# =============================================================================
# Regression pins: pre-existing behavior must keep working
# =============================================================================

@test "for_nikki.sh: regular-file destinations receive SOURCE content" {
    echo "stale" > "$TEST_HOME/.claude/CLAUDE.md"
    echo "stale" > "$TEST_HOME/.codex/CODEX.md"

    run_script

    [[ "$output" == *"$WITNESS"* ]]
    [ "$(cat "$TEST_HOME/.claude/CLAUDE.md")" = "fixture CLAUDE.md content" ]
    [ "$(cat "$TEST_HOME/.codex/CODEX.md")" = "fixture CLAUDE.md content" ]
}

@test "for_nikki.sh: --no-copy leaves destinations untouched" {
    echo "stale" > "$TEST_HOME/.claude/CLAUDE.md"
    echo "stale" > "$TEST_HOME/.codex/CODEX.md"

    run_script --no-copy

    [[ "$output" == *"$WITNESS"* ]]
    [ "$(cat "$TEST_HOME/.claude/CLAUDE.md")" = "stale" ]
    [ "$(cat "$TEST_HOME/.codex/CODEX.md")" = "stale" ]
}
