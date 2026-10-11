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

# A managed value outranks every other scope: a model, effort or default
# permission mode here would pin every session and every project, breaking
# /model, /effort and per-repo modes, and a plugin set to false becomes an install
# block at every scope. A parse error aborts here under set -e, with jq's own
# message. [LAW:single-enforcer]
violations=$(jq -r '
  ((["model"], ["effortLevel"], ["permissions", "defaultMode"]) as $p | select(getpath($p) != null)
    | "\($p | join(".")) belongs in ~/.claude/settings.json"),
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
