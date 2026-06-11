#!/usr/bin/env bats
# test-kitty-tmux-init.bats - Functional tests for kitty tmux startup script
#
# TICKET: dotfiles-script-audit-lbl.26
#
# BUGS VALIDATED:
# 1. `exec tmux ... || fallback` is dead code in both directions: if exec
#    succeeds the shell is replaced and || ceases to exist; if exec itself
#    fails, non-interactive bash exits without evaluating ||. The header's
#    promise "falls back to plain zsh if anything fails" was false — a failing
#    `tmux attach` (e.g. client/server protocol mismatch after a brew upgrade)
#    killed every new kitty window, and since this script IS kitty's configured
#    shell, the user could not open any working terminal. The kitty.conf shell
#    wrapper had the identical dead pattern.
# 2. kitty's `shell` option runs this script for EVERY shell-launched
#    window/tab, not just the first — with N tmux sessions, each Cmd+T
#    re-ran the tab-spawn block and created N-1 duplicate tabs.
#
# GAMING RESISTANCE:
# - Fallback detection is provenance-based: a temp ZDOTDIR whose .zprofile
#   writes a marker proves /bin/zsh -l genuinely ran as a login shell. Exit
#   codes alone can't distinguish "fallback ran" from "process died".
# - Tab spawning is asserted from a stub-invocation log written by the fake
#   kitty binary — what was actually launched, not what the script claims.
# - The kitty.conf wrapper test executes the literal `shell` command string
#   extracted from the conf, so the conf line itself is under test.

load '../helpers/test-helpers'

SCRIPT="$BATS_TEST_DIRNAME/../../config/kitty/kitty-tmux-init.sh"
KITTY_CONF="$BATS_TEST_DIRNAME/../../config/kitty/kitty.conf"

setup() {
  TEST_DIR=$(create_test_dir)
  STUB_DIR="$TEST_DIR/stubs"
  LOG_DIR="$TEST_DIR/logs"
  mkdir -p "$STUB_DIR" "$LOG_DIR"

  # Provenance marker for the zsh fallback: zsh sources $ZDOTDIR/.zprofile as
  # a login shell even when non-interactive.
  ZDOT="$TEST_DIR/zdot"
  mkdir -p "$ZDOT"
  cat > "$ZDOT/.zprofile" <<EOF
echo zsh-login-shell-ran > "$LOG_DIR/zsh-fallback-marker"
exit 0
EOF

  # tmux stub: behavior driven by STUB_* env vars, invocations logged.
  cat > "$STUB_DIR/tmux" <<'EOF'
#!/bin/bash
echo "$*" >> "$STUB_LOG_DIR/tmux.log"
case "$1" in
  list-sessions)
    [[ -n "$STUB_TMUX_SESSIONS" ]] || exit 1
    printf '%s\n' "$STUB_TMUX_SESSIONS"
    ;;
  new-session)
    # detached creation (-d) vs attach-or-create (-A) have separate knobs
    if [[ "$2" == "-d" ]]; then
      exit "${STUB_TMUX_NEW_EXIT:-0}"
    fi
    exit "${STUB_TMUX_ATTACH_EXIT:-0}"
    ;;
  attach|attach-session)
    exit "${STUB_TMUX_ATTACH_EXIT:-0}"
    ;;
esac
exit 0
EOF

  # kitty stub: log remote-control invocations, always succeed.
  cat > "$STUB_DIR/kitty" <<'EOF'
#!/bin/bash
echo "$*" >> "$STUB_LOG_DIR/kitty.log"
exit 0
EOF
  chmod +x "$STUB_DIR/tmux" "$STUB_DIR/kitty"
}

teardown() {
  cleanup_test_dir "$TEST_DIR"
}

# Run the script under test with stubs first on PATH and the zsh provenance
# marker armed. Callers set STUB_* / KITTY_WINDOW_ID in their environment.
run_script() {
  run env \
    PATH="$STUB_DIR:/usr/bin:/bin" \
    STUB_LOG_DIR="$LOG_DIR" \
    ZDOTDIR="$ZDOT" \
    STUB_TMUX_SESSIONS="${STUB_TMUX_SESSIONS:-}" \
    STUB_TMUX_NEW_EXIT="${STUB_TMUX_NEW_EXIT:-0}" \
    STUB_TMUX_ATTACH_EXIT="${STUB_TMUX_ATTACH_EXIT:-0}" \
    KITTY_WINDOW_ID="${KITTY_WINDOW_ID:-1}" \
    bash "$SCRIPT" < /dev/null
}

launch_calls() {
  # no log file means the stub was never invoked at all
  [[ -f "$LOG_DIR/kitty.log" ]] || { echo 0; return 0; }
  # grep -c prints the count (including 0) but exits 1 on zero matches
  grep -c '^@ launch' "$LOG_DIR/kitty.log" || true
}

@test "tmux attach failure falls back to zsh (no-sessions path)" {
  STUB_TMUX_SESSIONS=""
  STUB_TMUX_ATTACH_EXIT=1
  run_script

  [ "$status" -eq 0 ]
  assert_file_exists "$LOG_DIR/zsh-fallback-marker"
}

@test "tmux attach failure falls back to zsh (existing-sessions path)" {
  STUB_TMUX_SESSIONS=$'work\nmain'
  STUB_TMUX_ATTACH_EXIT=1
  run_script

  [ "$status" -eq 0 ]
  assert_file_exists "$LOG_DIR/zsh-fallback-marker"
}

@test "missing tmux falls back to zsh" {
  rm "$STUB_DIR/tmux"
  run_script

  [ "$status" -eq 0 ]
  assert_file_exists "$LOG_DIR/zsh-fallback-marker"
}

@test "first window spawns one tab per additional session" {
  STUB_TMUX_SESSIONS=$'alpha\nbeta\ngamma'
  KITTY_WINDOW_ID=1
  run_script

  [ "$status" -eq 0 ]
  # background-spawned stub invocations may land just after the script exits
  sleep 0.5
  [ "$(launch_calls)" -eq 2 ]
  grep -q 'beta' "$LOG_DIR/kitty.log"
  grep -q 'gamma' "$LOG_DIR/kitty.log"
}

@test "re-entry window (Cmd+T) does not duplicate session tabs" {
  STUB_TMUX_SESSIONS=$'alpha\nbeta\ngamma'
  KITTY_WINDOW_ID=4
  run_script

  [ "$status" -eq 0 ]
  sleep 0.5
  [ "$(launch_calls)" -eq 0 ]
}

@test "successful attach exits cleanly without invoking the fallback" {
  STUB_TMUX_SESSIONS=$'alpha'
  run_script

  [ "$status" -eq 0 ]
  [ ! -e "$LOG_DIR/zsh-fallback-marker" ]
  grep -q '^new-session -A -s alpha' "$LOG_DIR/tmux.log"
}

@test "kitty.conf shell wrapper reaches zsh when the init script is missing" {
  # Execute the literal command kitty.conf configures as the shell, in a HOME
  # where the init script does not exist.
  local shell_cmd
  shell_cmd=$(sed -n 's/^shell //p' "$KITTY_CONF")
  [ -n "$shell_cmd" ]

  # eval indirection via env var avoids quoting collisions with the conf line
  run env HOME="$TEST_DIR" ZDOTDIR="$ZDOT" SHELL_CMD="$shell_cmd" \
    bash -c 'eval "$SHELL_CMD" < /dev/null'

  [ "$status" -eq 0 ]
  assert_file_exists "$LOG_DIR/zsh-fallback-marker"
}
