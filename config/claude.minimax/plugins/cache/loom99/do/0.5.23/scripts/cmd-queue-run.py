#!/usr/bin/env python3
"""
Stop hook: Pop queued command and continue, or allow stop.

Input (stdin JSON):
  {"session_id": "...", "stop_reason": "..."}

If queue has entries, pops first and injects as new prompt.
If queue is empty, allows stop to proceed.
"""
import sys
import json
import os

from lib import log_debug, get_queue_path, decode_entry, get_script_hash

SCRIPT_NAME = "cmd-queue-run.py"
SCRIPT_HASH = get_script_hash(__file__)


def log(session_id, msg):
    log_debug(session_id, SCRIPT_NAME, msg)


def main():
    session_id = "unknown"

    try:
        data = json.load(sys.stdin)
        session_id = data.get('session_id', 'unknown')
        log(session_id, f"HASH={SCRIPT_HASH} - Stop hook triggered, reason: {data.get('stop_reason', 'unknown')}")
    except json.JSONDecodeError as e:
        log(session_id, f"ERROR: Invalid JSON input: {e}")
        sys.exit(0)

    queue_path = get_queue_path(session_id)

    if not os.path.exists(queue_path):
        log(session_id, "No queue file, allowing stop")
        sys.exit(0)

    # Read queue
    with open(queue_path, 'r') as f:
        lines = f.readlines()

    # Filter empty lines
    lines = [l.strip() for l in lines if l.strip()]

    if not lines:
        log(session_id, "Queue empty, cleaning up and allowing stop")
        os.remove(queue_path)
        sys.exit(0)

    # Pop first entry
    first = lines[0]
    rest = lines[1:]

    log(session_id, f"Queue has {len(lines)} entries, popping first")
    log(session_id, f"POPPING ENTRY (base64): {first}")

    # Update queue file (or delete if empty)
    if rest:
        with open(queue_path, 'w') as f:
            for line in rest:
                f.write(line + '\n')
        log(session_id, f"Updated queue, {len(rest)} remaining")
    else:
        os.remove(queue_path)
        log(session_id, "Queue now empty, deleted file")

    # Decode and inject as new prompt
    try:
        prompt = decode_entry(first)
        log(session_id, f"Decoded prompt: {prompt[:50]}{'...' if len(prompt) > 50 else ''}")
    except Exception as e:
        log(session_id, f"ERROR: Failed to decode entry: {e}")
        sys.exit(0)

    # Block stop and instruct Claude to run the next command
    log(session_id, f"Blocking stop, next command: {prompt}")
    # Try both formats to see which works
    output = {
        "decision": "block",
        "reason": prompt,
        "continue": True
    }
    log(session_id, f"POPPED COMMAND: {repr(prompt)}")
    log(session_id, f"RETURNING JSON TO CLAUDE: {json.dumps(output)}")
    print(json.dumps(output))
    sys.exit(0)


if __name__ == '__main__':
    main()
