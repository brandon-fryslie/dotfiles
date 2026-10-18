#!/bin/bash
# Deploy the tracked Claude Code baseline as this machine's managed settings.
#
# config/claude/settings.managed.json is canonical; the drop-in under /Library is
# a symlink to it, so an edit to the baseline is live with no re-install.
# Claude Code merges every file in managed-settings.d/ on each launch with no
# flag, ranks it above ~/.claude/settings.json, and never writes it - so the
# baseline survives the user file's constant programmatic rewrites.
# [LAW:one-source-of-truth]
#
# The link is the one thing here that needs root (the managed tier is
# administrator-owned), so sudo runs only when the link is missing or wrong.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/config/claude/settings.managed.json"
BASE="/Library/Application Support/ClaudeCode"
DIR="$BASE/managed-settings.d"
DEST="$DIR/10-dotfiles.json"
# The pre-symlink installer copied the baseline here; left in place it would be a
# second source that drifts from the repo file. [LAW:one-source-of-truth]
LEGACY="$BASE/managed-settings.json"

# A managed value outranks every other scope: a model or effort here would pin
# every session and every project, breaking /model and /effort, and a plugin set
# to false becomes an install block at every scope. The default permission mode
# is pinned here on purpose, so a repo's own defaultMode no longer takes effect.
# A parse error aborts here under set -e, with jq's own message.
# [LAW:single-enforcer]
violations=$(jq -r '
  ((["model"], ["effortLevel"]) as $p | select(getpath($p) != null)
    | "\($p | join(".")) belongs in ~/.claude/settings.json"),
  (.enabledPlugins // {} | to_entries[] | select(.value == false) | "enabledPlugins.\(.key) is false")
' "$SRC")
if [[ -n "$violations" ]]; then
  printf 'ERROR: %s: %s\n' "$SRC" "$violations" >&2
  exit 1
fi

if [[ -f "$LEGACY" && ! -L "$LEGACY" ]]; then
  sudo mv "$LEGACY" "$LEGACY.bak.$(date +%Y%m%d%H%M%S)"
  echo "✓ Moved legacy copy $LEGACY aside"
fi

if [[ "$(readlink "$DEST" 2>/dev/null || true)" == "$SRC" ]]; then
  echo "✓ $DEST is current"
else
  sudo install -d -o root -g wheel -m 755 "$DIR"
  sudo ln -sfn "$SRC" "$DEST"
  echo "✓ Linked $DEST -> $SRC"
fi
