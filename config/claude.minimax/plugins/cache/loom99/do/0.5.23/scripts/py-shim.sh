#!/bin/bash
# Python hook runner - executes a named Python script with hook JSON on stdin.
#
# Usage: bash py-shim.sh <script-name.py> [args...]
#
# Detects python (uv > python3 > python), changes to the script directory
# so sibling imports work, and passes stdin JSON to the script.
# Exits 0 gracefully in all error scenarios.

LOG_DIR="/tmp/do_plugin"
LOG_FILE="$LOG_DIR/py-shim.log"
INPUT_LOG_FILE="${LOG_DIR}/hooks_input.jsonl"

log_msg() {
    [ -n "$DO_PLUGIN_DEBUG" ] && mkdir -p "$LOG_DIR" && echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_input() {
    mkdir -p "$LOG_DIR" && echo "$1" >> "$INPUT_LOG_FILE"
}

# Require script name argument
SCRIPT_NAME="$1"
if [ -z "$SCRIPT_NAME" ]; then
    log_msg "ERROR: no script name provided"
    exit 0
fi
shift

# Read stdin (hooks receive JSON via stdin)
INPUT=$(cat)
log_input "${INPUT}"

# Detect python runner: prefer uv, then python3, then python
PYTHON_CMD=""
for candidate in "uv run python" "python3" "python"; do
    if $candidate --version >/dev/null 2>&1; then
        PYTHON_CMD="$candidate"
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    log_msg "WARN: no working python found (tried uv, python3, python)"
    exit 0
fi

log_msg "Using $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"

if [ ! -f "$SCRIPT_PATH" ]; then
    log_msg "WARN: script not found: $SCRIPT_PATH"
    exit 0
fi

log_msg "Running: $PYTHON_CMD -B $SCRIPT_PATH $*"

# Run from the script directory so sibling imports (from lib import ...) work
# without needing PYTHONPATH manipulation.
# -B disables .pyc bytecode caching, ensuring fresh code on every run.
OUTPUT=$(cd "$SCRIPT_DIR" && echo "$INPUT" | $PYTHON_CMD -B "$SCRIPT_PATH" "$@")
EXIT_CODE=$?

log_msg "Exit code: $EXIT_CODE"
[ -n "$DO_PLUGIN_DEBUG" ] && log_msg "Output: $OUTPUT"

[ -n "$OUTPUT" ] && echo "$OUTPUT"
exit 0
