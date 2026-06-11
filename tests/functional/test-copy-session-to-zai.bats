#!/usr/bin/env bats
# test-copy-session-to-zai.bats - Functional tests for session_copy.py target resolution
#
# Pins ticket dotfiles-script-audit-lbl.16: with CLAUDE_CONFIG_DIR unset, the
# script fell back to Path(__file__).resolve().parents[2]. On an installed
# machine the skill lives behind a dotbot symlink (~/.claude.zai/skills ->
# <repo>/config/claude.zai/skills), so .resolve() follows the link into the
# git checkout and private session transcripts are copied into the repo
# working tree — reported as success.
#
# Tests execute the real script against an isolated temp repo + temp HOME so
# real transcripts and the live repo are never touched.

load '../helpers/test-helpers'

setup() {
    command -v python3 >/dev/null 2>&1 || skip "python3 not available"

    TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/copy-session-test.XXXXXX")
    TEST_HOME="$TEST_DIR/home"
    TEST_REPO="$TEST_DIR/repo"
    TEST_PROJ="$TEST_DIR/proj"

    SKILL_REL="config/claude.zai/skills/copy-session-to-zai"
    mkdir -p "$TEST_HOME/.claude.zai" "$TEST_REPO/$SKILL_REL" "$TEST_PROJ"
    cp "$DOTFILES_ROOT/$SKILL_REL/session_copy.py" "$TEST_REPO/$SKILL_REL/"

    # Dotbot layout: the skill is reached through a symlink out of $HOME
    ln -s "$TEST_REPO/config/claude.zai/skills" "$TEST_HOME/.claude.zai/skills"
    SCRIPT="$TEST_HOME/.claude.zai/skills/copy-session-to-zai/session_copy.py"

    # Source transcript under the temp HOME's ~/.claude, keyed by project slug
    SLUG=$(python3 -c 'import re,sys;from pathlib import Path;print(re.sub(r"[/.]","-",str(Path(sys.argv[1]).resolve())))' "$TEST_PROJ")
    mkdir -p "$TEST_HOME/.claude/projects/$SLUG"
    printf '{"type":"user","cwd":"%s","timestamp":"2026-06-11T00:00:00Z","message":{"role":"user","content":"private transcript content"}}\n' \
        "$(cd "$TEST_PROJ" && pwd -P)" > "$TEST_HOME/.claude/projects/$SLUG/sess-1234.jsonl"

    export HOME="$TEST_HOME"
}

teardown() {
    unset HOME
    cleanup_test_dir "$TEST_DIR"
}

# =============================================================================
# The bug: CLAUDE_CONFIG_DIR unset must fail loudly, never guess the repo
# =============================================================================

@test "session_copy.py: copy without CLAUDE_CONFIG_DIR fails loudly" {
    run env -u CLAUDE_CONFIG_DIR python3 "$SCRIPT" copy "$TEST_PROJ" sess-1234

    # Pre-fix: exit 0, transcript silently copied into the repo checkout
    [ "$status" -ne 0 ]
    [[ "$output" == *"CLAUDE_CONFIG_DIR"* ]]
    [[ "$output" != *"copied:"* ]]
}

@test "session_copy.py: copy without CLAUDE_CONFIG_DIR writes nothing into the repo tree" {
    run env -u CLAUDE_CONFIG_DIR python3 "$SCRIPT" copy "$TEST_PROJ" sess-1234

    [ ! -e "$TEST_REPO/config/claude.zai/projects" ]
}

@test "session_copy.py: list without CLAUDE_CONFIG_DIR fails loudly" {
    run env -u CLAUDE_CONFIG_DIR python3 "$SCRIPT" list "$TEST_PROJ"

    [ "$status" -ne 0 ]
    [[ "$output" == *"CLAUDE_CONFIG_DIR"* ]]
}

# =============================================================================
# Regression pins: declared target keeps working; source==target still refused
# =============================================================================

@test "session_copy.py: copy lands in CLAUDE_CONFIG_DIR/projects when set" {
    run env CLAUDE_CONFIG_DIR="$TEST_HOME/.claude.zai" python3 "$SCRIPT" copy "$TEST_PROJ" sess-1234

    [ "$status" -eq 0 ]
    [[ "$output" == *"copied:"* ]]
    [ -f "$TEST_HOME/.claude.zai/projects/$SLUG/sess-1234.jsonl" ]
    [ ! -e "$TEST_REPO/config/claude.zai/projects" ]
}

@test "session_copy.py: CLAUDE_CONFIG_DIR pointing at the source dir is refused" {
    run env CLAUDE_CONFIG_DIR="$TEST_HOME/.claude" python3 "$SCRIPT" copy "$TEST_PROJ" sess-1234

    [ "$status" -ne 0 ]
    [[ "$output" == *"identical"* ]]
}
