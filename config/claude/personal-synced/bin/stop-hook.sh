#!/bin/bash -e

# {
#  // Common fields
#  session_id: string
#  transcript_path: string  // Path to conversation JSON
#  cwd: string              // The current working directory when the hook is invoked
#  permission_mode: string  // Current permission mode: "default", "plan", "acceptEdits", or "bypassPermissions"
#
#  // Event-specific fields
#  hook_event_name: string
#  ...
# }
#
# Example:
# {
#   "session_id": "abc123",
#   "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
#   "permission_mode": "default",
#   "hook_event_name": "Stop",
#   "stop_hook_active": true
# }
exit 0
# don't loop forever right now, unless CLOD_LOOP_FOREVER == 1
[[ $CLOD_LOOP_FOREVER == 1 ]] || exit 0

# Read JSON from stdin and parse with jq
session_id=$(jq -r '.session_id')
transcript_path=$(jq -r '.transcript_path')

# Expand tilde in transcript_path
transcript_path="${transcript_path/#\~/$HOME}"

# Counter file location
counter_dir="$HOME/.claude/stop-hook-counters"
mkdir -p "$counter_dir"
counter_file="$counter_dir/$session_id"

# Increment and read counter
if [[ -f "$counter_file" ]]; then
  count=$(cat "$counter_file")
  count=$((count + 1))
else
  count=1
fi
echo "$count" > "$counter_file"

# Check if we've hit the limit
if [[ $count -ge 7 ]]; then
  >&2 echo "Session has run 7 times. Allowing exit."
  exit 0
fi

# Check last line of transcript for completion phrase
if [[ -f "$transcript_path" ]]; then
  last_line=$(tail -n 1 "$transcript_path")
  if [[ "$last_line" == *"We are completely finished"* ]]; then
    >&2 echo "Detected completion phrase. Allowing exit."
    exit 0
  fi
fi

# Continue the session
>&2 echo "Decide on the next step for the project (run $count/7). If we have completed a feature, commit. If there is ambiguity or questions, create a branch and explore both options and pick the best one. ONLY if the work is straightforward for a TDD workflow, use '/dev-loop:test-and-implement plan-first <description of next remaining work>'. If you run out of work, run '/dev-loop:feature-proposal Generate exciting new feature ideas' to come up with fresh ideas. If there is ANY unambiguous remaining work that is not straightforward to test with automation, run '/dev-loop:implement-and-iterate plan-first <description of next remaining work>'. If you are completely finished with ALL possible work and there is nothing left to do, respond with exactly 'We are completely finished' to exit."
exit 2
