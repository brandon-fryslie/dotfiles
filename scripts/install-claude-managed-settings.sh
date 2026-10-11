#!/bin/bash
# Deploy the tracked Claude Code baseline as this machine's managed settings.
#
# config/claude/settings.managed.json is canonical; the copy under /Library is
# derived from it here and nowhere else. Claude Code reads that path on every
# launch with no flag, ranks it above ~/.claude/settings.json, and never writes
# it - so the baseline survives the user file's constant programmatic rewrites.
# [LAW:one-source-of-truth]
#
# A copy, not a symlink: Claude Code refuses to read a managed settings file
# through a link on its route ("boundRead: not reading ..."), and the managed
# tier is meant to be administrator-owned. Hence sudo, once per baseline change;
# an unchanged baseline never prompts.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/config/claude/settings.managed.json"
DIR="/Library/Application Support/ClaudeCode"
DEST="$DIR/managed-settings.json"
USER_SETTINGS="$HOME/.claude/settings.json"

# A managed value cannot be overridden from the user file: a model or effort key
# would pin every session and break /model and /effort, and a plugin set to false
# becomes an install block at every scope. A parse error aborts here under set -e,
# with jq's own message. [LAW:single-enforcer]
violations=$(jq -r '
  (("model", "effortLevel") as $k | select(has($k)) | "\($k) belongs in ~/.claude/settings.json"),
  (.enabledPlugins // {} | to_entries[] | select(.value == false) | "enabledPlugins.\(.key) is false")
' "$SRC")
if [[ -n "$violations" ]]; then
  printf 'ERROR: %s: %s\n' "$SRC" "$violations" >&2
  exit 1
fi

if cmp -s "$SRC" "$DEST"; then
  echo "✓ $DEST is current"
else
  sudo install -d -o root -g wheel -m 755 "$DIR"
  sudo install -o root -g wheel -m 644 "$SRC" "$DEST"
  echo "✓ Installed $DEST"
fi

# With the baseline live, a copy of it in the user file is a second source that
# drifts: a rule deleted from the baseline would live on there, because lists
# union across tiers. Remove what the baseline already says - scalars outright
# (the managed value wins anyway), list elements the baseline already holds -
# then drop the containers that emptied, so no husk like "statusLine": {} is
# left to fail schema validation. [LAW:one-source-of-truth]
if [[ -f "$USER_SETTINGS" ]]; then
  stripped=$(jq --slurpfile m "$SRC" '
    [$m[0] | paths(type != "object") | select(all(.[]; type == "string"))] as $paths
    | reduce $paths[] as $p (.;
        if getpath($p) == null then .
        elif ($m[0] | getpath($p) | type) == "array" then setpath($p; getpath($p) - ($m[0] | getpath($p)))
        else delpaths([$p]) end)
    | reduce ($paths[] as $p | range($p | length; 0; -1) | $p[:.]) as $q (.;
        if getpath($q) == {} or getpath($q) == [] then delpaths([$q]) else . end)
  ' "$USER_SETTINGS")
  printf '%s\n' "$stripped" > "$USER_SETTINGS"
  echo "✓ Removed baseline duplicates from $USER_SETTINGS"
fi
