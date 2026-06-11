#!/usr/bin/env bats
# test-tmux-wrapper.bats - Functional tests for tmux-wrapper.sh argument handling
#
# Pins ticket dotfiles-script-audit-lbl.18, two bugs in the `window` action:
#
# 1. `shift 4 2>/dev/null || true` — with only 3 args (command omitted, relying
#    on the documented bash default) `shift 4` fails and shifts NOTHING, so "$@"
#    still holds `window mysess mywin` and tmux is asked to run
#    `bash window mysess mywin` — the window opens and instantly dies.
#
# 2. Window index resolved via `list-windows | grep "$WINDOW_NAME" | tail -1` —
#    an unanchored substring match, so creating window "edit" while "edit2"
#    exists returns the wrong index and every later send/capture drives the
#    wrong window.
#
# Tests run the real script with a stub `tmux` on a prepended PATH that records
# each subcommand's argv (one per line) to a file — no real tmux server is ever
# driven for these arg pins.

load '../helpers/test-helpers'

setup() {
    TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/dotfiles-test-tmux-wrapper.XXXXXX")
    STUB_BIN="$TEST_DIR/bin"
    RECORD_DIR="$TEST_DIR/record"
    mkdir -p "$STUB_BIN" "$RECORD_DIR"

    SCRIPT="$DOTFILES_ROOT/config/codex/skills/tmux/tmux-wrapper.sh"

    # Stub tmux: records each subcommand's argv, answers the wrapper's queries.
    # `new-window -P -F '#{window_index}'` printing the bare index was verified
    # against real tmux 3.6a. list-windows simulates the substring-collision
    # scenario: an existing window "edit2" alongside the just-created "edit".
    cat > "$STUB_BIN/tmux" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" > "$RECORD_DIR/\$1-args"
case "\$1" in
  has-session)
    [ -f "$RECORD_DIR/no-session" ] && exit 1
    exit 0
    ;;
  new-window)
    for arg in "\$@"; do
      if [ "\$arg" = "-P" ]; then echo "2"; break; fi
    done
    ;;
  list-windows)
    printf '2 edit\n3 edit2\n'
    ;;
  capture-pane)
    echo "captured"
    ;;
esac
EOF
    chmod +x "$STUB_BIN/tmux"
}

teardown() {
    cleanup_test_dir "$TEST_DIR"
}

run_script() {
    run env PATH="$STUB_BIN:$PATH" "$SCRIPT" "$@"
}

recorded() {
    cat "$RECORD_DIR/$1-args"
}

# =============================================================================
# Bug 1: omitting the command must default to plain `bash`, not
# `bash <stale positional args>`
# =============================================================================

@test "tmux-wrapper: window with no command runs bash with no stale args" {
    run_script window mysess mywin

    # Pre-fix: shift 4 fails with 3 args, "$@" still holds the action/session/
    # name and tmux is told to run `bash window mysess mywin`
    [ "$status" -eq 0 ]
    [ "$(recorded new-window | tail -1)" = "bash" ]
    [[ "$(recorded new-window)" != *$'bash\nwindow'* ]]
}

@test "tmux-wrapper: window forwards explicit command and args verbatim" {
    run_script window mysess mywin vim file.txt

    [ "$status" -eq 0 ]
    [ "$(recorded new-window | tail -2)" = "$(printf '%s\n' vim file.txt)" ]
}

# =============================================================================
# Bug 2: window index must come from tmux itself, not a substring grep that
# matches "edit2" when asked about "edit"
# =============================================================================

@test "tmux-wrapper: window index is the created window's, not a substring collision" {
    run_script window mysess edit

    # Pre-fix: grep "edit" matches both "2 edit" and "3 edit2"; tail -1 picks
    # index 3 and capture-pane (and the printed index) drive the wrong window
    [ "$status" -eq 0 ]
    [[ "$output" == *"Window index: 2"* ]]
    grep -qx 'mysess:2' "$RECORD_DIR/capture-pane-args"
}

# =============================================================================
# Regression pins: existing behavior unchanged
# =============================================================================

@test "tmux-wrapper: window requires a window name" {
    run_script window mysess

    [ "$status" -eq 1 ]
    [[ "$output" == *"Window name required"* ]]
    [ ! -f "$RECORD_DIR/new-window-args" ]
}

@test "tmux-wrapper: window errors when the session does not exist" {
    touch "$RECORD_DIR/no-session"
    run_script window mysess mywin

    [ "$status" -eq 1 ]
    [[ "$output" == *"does not exist"* ]]
    [ ! -f "$RECORD_DIR/new-window-args" ]
}
