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

# Subagent transcripts live alongside the main session, one file per agent:
#   <slug>/<session-id>/subagents/agent-<agentId>.jsonl
# Every line in those files self-identifies (top-level agentId + isSidechain),
# so the server parser reattaches them to their spawning Agent call by id-join.
# We CONCATENATE them onto the main blob losslessly: the stored origin stays one
# claude-jsonl source, no new kind, no parser-positional assumption (the join is
# by id, never order). A session with no subagents dir uploads byte-identical to
# before. [LAW:one-source-of-truth] [LAW:one-way-deps]
subdir="$HOME/.claude/projects/$slug/$CLAUDE_CODE_SESSION_ID/subagents"

# Build the JSON request body. Use Python (always present, stdlib only) to
# concatenate the transcripts and JSON-encode the result so newlines and quotes
# are escaped correctly. We could use jq -Rs '...' but Python avoids a dep.
# [LAW:no-silent-failure] An unreadable subagent file aborts loudly — we never
# ship a partial bundle that silently drops a subagent's transcript.
body="$(python3 -c '
import json, sys, glob, os

main_path, subdir = sys.argv[1], sys.argv[2]
with open(main_path, "rb") as f:
    content = f.read().decode("utf-8", errors="replace")

sub_files = sorted(glob.glob(os.path.join(subdir, "agent-*.jsonl")))
for path in sub_files:
    with open(path, "rb") as f:
        text = f.read().decode("utf-8", errors="replace")
    # One newline separates files; each file is appended verbatim otherwise, so
    # line content and within-file ordering are preserved exactly. When there
    # are zero subagents this loop never runs and content == the main blob.
    if content and not content.endswith("\n"):
        content += "\n"
    content += text

sys.stderr.write(
    "share-slop: bundling %d byte main + %d subagent file(s) = %d bytes total\n"
    % (os.path.getsize(main_path), len(sub_files), len(content.encode("utf-8")))
)
sys.stdout.write(json.dumps({"source": {"kind": "claude-jsonl", "content": content}}))
' "$jsonl" "$subdir")"

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
