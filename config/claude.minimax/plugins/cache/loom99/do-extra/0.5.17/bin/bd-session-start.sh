#!/bin/bash
#
# bd-session-start.sh - Initialize bd and inject workflow context at session start
#
# Self-healing: Automatically cleans up stale daemon locks, syncs out-of-date
# databases, and gracefully handles all failure modes.
#
# Auto-initializes bd if:
#   - bd is installed
#   - .beads/ doesn't exist
#   - Current directory is a git repo
#
# Then outputs workflow context from skills/beads/context/session-start.md
# and shows current ready work from bd.
#

BD_TIMEOUT=5  # seconds for bd commands

# Check if bd is installed
if ! command -v bd &>/dev/null; then
  exit 0
fi

# Clean up stale daemon lock if process is dead
cleanup_stale_daemon() {
  local lock_file=".beads/daemon.lock"
  [ -f "$lock_file" ] || return 0

  local pid
  pid=$(jq -r '.pid // empty' "$lock_file" 2>/dev/null)
  [ -n "$pid" ] || return 0

  # Check if process is alive
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$lock_file" ".beads/beads.db-shm" ".beads/beads.db-wal" 2>/dev/null
  fi
}

# Run bd command with timeout in sandbox mode (bypasses daemon, much faster)
run_bd() {
  timeout "$BD_TIMEOUT" bd --sandbox "$@" 2>/dev/null || echo ""
}

# Auto-sync database if out of sync (uses regular mode for writes)
ensure_db_synced() {
  # Try a simple command; if it fails with sync error, fix it
  local result
  result=$(timeout "$BD_TIMEOUT" bd --sandbox stats --json 2>&1)

  if echo "$result" | grep -q "out of sync\|import-only"; then
    timeout "$BD_TIMEOUT" bd sync --import-only 2>/dev/null || true
  fi
}

# Auto-init if not initialized and in a git repo
if [ ! -d ".beads" ] && [ -d ".git" ]; then
  timeout "$BD_TIMEOUT" bd init --quiet 2>/dev/null || true
  timeout "$BD_TIMEOUT" bd hooks install 2>/dev/null || true
fi

# Output context if bd is initialized
if [ -d ".beads" ]; then
  # Self-healing: clean up stale daemon and sync db
  cleanup_stale_daemon
  ensure_db_synced

  # Output workflow reminders from context file
  if [ -f "${CLAUDE_PLUGIN_ROOT}/skills/beads/context/session-start.md" ]; then
    cat "${CLAUDE_PLUGIN_ROOT}/skills/beads/context/session-start.md"
    echo ""
  fi

  # Append live status - ready work
  echo "## Current Ready Work"
  echo ""

  READY_JSON=$(run_bd ready --json)
  if [ -n "$READY_JSON" ]; then
    READY_COUNT=$(echo "$READY_JSON" | jq '. | length' 2>/dev/null || echo "0")
    if [ "$READY_COUNT" -gt 0 ]; then
      echo "$READY_JSON" | jq -r '.[] | "- **[\(.id)]** \(.title) (P\(.priority), \(.type))"' 2>/dev/null || true
    else
      echo "*No ready work - all issues are blocked or completed*"
    fi
  else
    echo "*bd unavailable - check beads status*"
  fi
  echo ""

  # Append in-progress work
  IN_PROGRESS_JSON=$(run_bd list --status in_progress --json)
  if [ -n "$IN_PROGRESS_JSON" ]; then
    IN_PROGRESS_COUNT=$(echo "$IN_PROGRESS_JSON" | jq '. | length' 2>/dev/null || echo "0")
    if [ "$IN_PROGRESS_COUNT" -gt 0 ]; then
      echo "## In Progress"
      echo ""
      echo "$IN_PROGRESS_JSON" | jq -r '.[] | "- **[\(.id)]** \(.title)"' 2>/dev/null || true
      echo ""
    fi
  fi
fi

exit 0
