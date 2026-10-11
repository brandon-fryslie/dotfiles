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

# A managed value cannot be overridden from the user file, so a model or effort
# key here would silently pin every session and break /model and /effort.
jq -e 'has("model") or has("effortLevel") | not' "$SRC" >/dev/null || {
  echo "ERROR: $SRC sets model or effortLevel; those belong in ~/.claude/settings.json" >&2
  exit 1
}

if cmp -s "$SRC" "$DEST"; then
  echo "✓ $DEST is current"
  exit 0
fi

sudo install -d -o root -g wheel -m 755 "$DIR"
sudo install -o root -g wheel -m 644 "$SRC" "$DEST"
echo "✓ Installed $DEST"
