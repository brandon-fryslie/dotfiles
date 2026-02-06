#!/bin/bash
#
# bd-pre-compact.sh - Inject full bd context before compaction
#
# Outputs full workflow reference from skills/beads/context/pre-compact.md
# to preserve workflow context before context window is cleared during compaction.
# Safe: only runs if .beads/ exists and bd is installed.
#

# Exit early if not in a beads project
if [ ! -d ".beads" ]; then
  exit 0
fi

# Check if bd is installed
if ! command -v bd &>/dev/null; then
  exit 0
fi

# Output full workflow reference before compaction
if [ -f "${CLAUDE_PLUGIN_ROOT}/skills/beads/context/pre-compact.md" ]; then
  cat "${CLAUDE_PLUGIN_ROOT}/skills/beads/context/pre-compact.md"
  echo ""
  echo "---"
  echo ""
fi

# Append current work summary
echo "## Current Work Summary (Pre-Compaction)"
echo ""

READY_COUNT=$(bd ready --json 2>/dev/null | jq '. | length' 2>/dev/null || echo "0")
IN_PROGRESS_COUNT=$(bd list --status in_progress --json 2>/dev/null | jq '. | length' 2>/dev/null || echo "0")
OPEN_COUNT=$(bd list --status open --json 2>/dev/null | jq '. | length' 2>/dev/null || echo "0")

echo "- **Ready work**: $READY_COUNT issues"
echo "- **In progress**: $IN_PROGRESS_COUNT issues"
echo "- **Total open**: $OPEN_COUNT issues"
echo ""

if [ "$IN_PROGRESS_COUNT" -gt 0 ]; then
  echo "### Active Work"
  bd list --status in_progress --json 2>/dev/null | jq -r '.[] | "- [\(.id)] \(.title)"' 2>/dev/null || true
  echo ""
fi

if [ "$READY_COUNT" -gt 0 ] && [ "$READY_COUNT" -le 5 ]; then
  echo "### Ready to Start"
  bd ready --json 2>/dev/null | jq -r '.[] | "- [\(.id)] \(.title) (P\(.priority))"' 2>/dev/null || true
  echo ""
fi

exit 0
