#!/usr/bin/env python3
"""
UserPromptSubmit hook: Parse multi-command prompts and queue extras.

Input (stdin JSON):
  {"session_id": "...", "prompt": "..."}

Parses prompt for slash commands: /word or /word:word followed by space.
First command runs immediately, rest are queued for Stop hook.
"""
import sys
import json
import os
import re

from lib import log_debug, get_queue_path, encode_entry, get_script_hash, QUEUE_DIR

SCRIPT_NAME = "cmd-queue-parse.py"
SCRIPT_HASH = get_script_hash(__file__)

# Pattern: line starts with /letters-or-colons followed by space or EOL
# Matches: /do:plan , /do:it , /help , /do:status (no args), etc.
CMD_PATTERN = re.compile(r'^(/[a-zA-Z:]+)(?:\s|$)')


def log(session_id, msg):
    log_debug(session_id, SCRIPT_NAME, msg)


def parse_commands(prompt):
    """
    Parse prompt into list of (command, prompt_text) tuples.

    A command starts on a line matching /[a-zA-Z:]+ (followed by space).
    Its prompt extends to the next command or EOF.
    """
    lines = prompt.split('\n')
    commands = []
    current_cmd = None
    current_lines = []

    for line in lines:
        match = CMD_PATTERN.match(line)
        if match:
            # Save previous command if exists
            if current_cmd is not None:
                commands.append((current_cmd, '\n'.join(current_lines).strip()))

            # Start new command
            current_cmd = match.group(1)
            # Rest of line after command (skip space if present)
            rest = line[len(current_cmd):]
            if rest.startswith(' '):
                rest = rest[1:]
            current_lines = [rest] if rest else []
        else:
            # Continue current command's prompt
            current_lines.append(line)

    # Don't forget the last command
    if current_cmd is not None:
        commands.append((current_cmd, '\n'.join(current_lines).strip()))

    return commands


def main():
    session_id = "unknown"

    try:
        data = json.load(sys.stdin)
        session_id = data.get('session_id', 'unknown')
        log(session_id, f"HASH={SCRIPT_HASH} - Received input, prompt length: {len(data.get('prompt', ''))}")
    except json.JSONDecodeError as e:
        log(session_id, f"ERROR: Invalid JSON input: {e}")
        print(json.dumps({"result": "continue"}))
        return

    prompt = data.get('prompt', '')

    if not prompt:
        log(session_id, "Empty prompt, passing through")
        print(json.dumps({"result": "continue"}))
        return

    commands = parse_commands(prompt)
    log(session_id, f"Parsed {len(commands)} command(s)")

    if len(commands) == 0:
        # No commands found, pass through unchanged
        log(session_id, "No /cmd:cmd patterns found, passing through")
        print(json.dumps({"result": "continue"}))
        return

    if len(commands) == 1:
        # Single command, no queueing needed
        cmd, prompt_text = commands[0]
        new_prompt = f"{cmd} {prompt_text}" if prompt_text else cmd
        output = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": new_prompt
            }
        }
        log(session_id, f"Single command: {cmd}, no queueing needed")
        log(session_id, f"FINAL SUBMISSION TO CLAUDE: {repr(new_prompt)}")
        log(session_id, f"RETURNING JSON: {json.dumps(output)}")
        print(json.dumps(output))
        return

    # Multiple commands: first runs now, rest get queued
    first_cmd, first_prompt = commands[0]
    rest = commands[1:]

    log(session_id, f"Multiple commands: running '{first_cmd}', queueing {len(rest)} more")
    for i, (cmd, _) in enumerate(rest):
        log(session_id, f"  Queue[{i}]: {cmd}")

    # Ensure queue directory exists
    os.makedirs(QUEUE_DIR, exist_ok=True)

    # Write queued commands to file (one base64 entry per line)
    queue_path = get_queue_path(session_id)
    with open(queue_path, 'w') as f:
        for cmd, prompt_text in rest:
            f.write(encode_entry(cmd, prompt_text) + '\n')

    log(session_id, f"Wrote queue file: {queue_path}")

    # Return modified prompt with just the first command
    new_prompt = f"{first_cmd} {first_prompt}" if first_prompt else first_cmd
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": new_prompt
        }
    }
    log(session_id, f"FINAL SUBMISSION TO CLAUDE: {repr(new_prompt)}")
    log(session_id, f"RETURNING JSON: {json.dumps(output)}")
    print(json.dumps(output))


if __name__ == '__main__':
    main()
