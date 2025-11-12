#!/usr/bin/env bash
# Automated test for tmux help pane functionality
# Does not interfere with existing sessions

set -e

TEST_SESSION="tmux-auto-test-$$"
TEST_LOG="/tmp/tmux-test-$$.log"

echo "=== Automated Tmux Help Pane Test ===" | tee "$TEST_LOG"
echo "Test session: $TEST_SESSION" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Cleanup function
cleanup() {
  echo "Cleaning up test session..." | tee -a "$TEST_LOG"
  tmux kill-session -t "$TEST_SESSION" 2>/dev/null || true
  echo "Test log saved to: $TEST_LOG"
}

trap cleanup EXIT

# Step 1: Create test session
echo "[1/6] Creating test session..." | tee -a "$TEST_LOG"
tmux new-session -d -s "$TEST_SESSION" -c "$HOME" 2>&1 | tee -a "$TEST_LOG"
sleep 0.5

# Step 2: Verify session exists
echo "[2/6] Verifying session exists..." | tee -a "$TEST_LOG"
if tmux has-session -t "$TEST_SESSION" 2>/dev/null; then
  echo "  ✓ Session created successfully" | tee -a "$TEST_LOG"
else
  echo "  ✗ FAIL: Session not created" | tee -a "$TEST_LOG"
  exit 1
fi

# Step 3: Count initial panes
echo "[3/6] Counting initial panes..." | tee -a "$TEST_LOG"
INITIAL_PANES=$(tmux list-panes -t "$TEST_SESSION" | wc -l | tr -d ' ')
echo "  Initial panes: $INITIAL_PANES" | tee -a "$TEST_LOG"

# Step 4: Trigger help pane (call toggle script directly - send-keys doesn't work for bindings)
echo "[4/6] Triggering help pane (via toggle script)..." | tee -a "$TEST_LOG"
rm -f /tmp/tmux-help-errors.log
tmux run-shell -t "$TEST_SESSION" '$HOME/.config/tmux/scripts/tmux-help-toggle.sh'
sleep 1

# Step 5: Check if help pane was created
echo "[5/6] Checking if help pane was created..." | tee -a "$TEST_LOG"
AFTER_PANES=$(tmux list-panes -t "$TEST_SESSION" | wc -l | tr -d ' ')
echo "  Panes after toggle: $AFTER_PANES" | tee -a "$TEST_LOG"

if [ "$AFTER_PANES" -gt "$INITIAL_PANES" ]; then
  echo "  ✓ Help pane created!" | tee -a "$TEST_LOG"

  # Check if it's the right height
  HELP_HEIGHT=$(tmux list-panes -t "$TEST_SESSION" -F "#{pane_height}" | tail -1)
  echo "  Help pane height: $HELP_HEIGHT" | tee -a "$TEST_LOG"

  if [ "$HELP_HEIGHT" = "5" ]; then
    echo "  ✓ Correct height (5 lines)" | tee -a "$TEST_LOG"
  else
    echo "  ⚠ Warning: Expected height 5, got $HELP_HEIGHT" | tee -a "$TEST_LOG"
  fi
else
  echo "  ✗ FAIL: Help pane not created" | tee -a "$TEST_LOG"
  echo "" | tee -a "$TEST_LOG"
  echo "Errors from /tmp/tmux-help-errors.log:" | tee -a "$TEST_LOG"
  cat /tmp/tmux-help-errors.log 2>&1 | tee -a "$TEST_LOG" || echo "  (no error log found)" | tee -a "$TEST_LOG"
  exit 1
fi

# Step 6: Toggle help pane off
echo "[6/6] Toggling help pane off..." | tee -a "$TEST_LOG"
tmux run-shell -t "$TEST_SESSION" '$HOME/.config/tmux/scripts/tmux-help-toggle.sh'
sleep 1

FINAL_PANES=$(tmux list-panes -t "$TEST_SESSION" | wc -l | tr -d ' ')
echo "  Panes after second toggle: $FINAL_PANES" | tee -a "$TEST_LOG"

if [ "$FINAL_PANES" = "$INITIAL_PANES" ]; then
  echo "  ✓ Help pane removed successfully" | tee -a "$TEST_LOG"
else
  echo "  ✗ FAIL: Help pane not removed (expected $INITIAL_PANES, got $FINAL_PANES)" | tee -a "$TEST_LOG"
  exit 1
fi

echo "" | tee -a "$TEST_LOG"
echo "=== ALL TESTS PASSED ===" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Show test session for manual inspection (optional)
if [ "$1" = "--inspect" ]; then
  echo "Test session left running for inspection: $TEST_SESSION"
  echo "Attach with: tmux attach -t $TEST_SESSION"
  trap - EXIT  # Don't cleanup
else
  echo "Test session will be cleaned up automatically"
fi
