#!/usr/bin/env bash
# share-slop: upload the current Claude Code session JSONL to paste.slopspot.ai
# and print the resulting public URL.
#
# This script is a thin uploader. ALL parsing/rendering knowledge lives on the
# slopspot side (claude-jsonl source kind). If the JSONL schema changes,
# update the server parser — not this script.
#
# Design laws:
#   [LAW:single-enforcer] One POST. One URL constructor. No fallback chain.
#   [LAW:no-defensive-null-guards] Missing prerequisites fail loudly with a
#     remediation hint, never with a silent default that hides the bug.

set -euo pipefail

# [LAW:no-defensive-null-guards] CLAUDE_CODE_SESSION_ID is the trust boundary
# input — if it's missing we are NOT in a CC session and continuing would just
# guess at a session, which is worse than failing.
: "${CLAUDE_CODE_SESSION_ID:?CLAUDE_CODE_SESSION_ID is not set — share-slop must run inside a Claude Code session.}"

base_url="${SLOPSPOT_URL:-https://paste.slopspot.ai}"

# Project slug: pwd with every "/" and "." replaced by "-".
# Mirrors how CC names project dirs under ~/.claude/projects.
slug="$(pwd | sed 's|[/.]|-|g')"
jsonl="$HOME/.claude/projects/$slug/$CLAUDE_CODE_SESSION_ID.jsonl"

if [ ! -f "$jsonl" ]; then
  echo "share-slop: session file not found: $jsonl" >&2
  echo "  Expected project slug: $slug" >&2
  echo "  Check that the project dir matches CC's expectation (sometimes a" >&2
  echo "  recent project rename leaves the slug stale)." >&2
  exit 1
fi

size="$(wc -c < "$jsonl" | tr -d ' ')"
echo "share-slop: uploading $size bytes from $jsonl" >&2

# Build the JSON request body. Use Python (always present, stdlib only) to
# JSON-encode the JSONL text so newlines and quotes are escaped correctly.
# We could use jq -Rs '...' but Python avoids a dep we'd otherwise require.
body="$(python3 -c '
import json, sys
with open(sys.argv[1], "rb") as f:
    raw = f.read().decode("utf-8", errors="replace")
sys.stdout.write(json.dumps({"source": {"kind": "claude-jsonl", "content": raw}}))
' "$jsonl")"

# curl: -sS = silent but show errors; --fail-with-body = non-2xx exits non-0
# but still gives us the response body for the error message.
response="$(printf '%s' "$body" | curl -sS --fail-with-body \
  -X POST "$base_url/api/paste" \
  -H 'content-type: application/json' \
  --data-binary @-)" || {
  echo "share-slop: server returned an error:" >&2
  echo "$response" >&2
  exit 1
}

# Extract the slug from { "slug": "..." } and print the public URL.
result_slug="$(printf '%s' "$response" | python3 -c '
import json, sys
r = json.loads(sys.stdin.read())
if "slug" not in r:
    sys.exit("share-slop: server response missing slug: " + json.dumps(r))
print(r["slug"])
')"

echo "$base_url/$result_slug"
