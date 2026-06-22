#!/usr/bin/env bash
# Idempotently set the iTerm2 Default profile's "Send text at start" to source the
# restore-join script. This is the one part of the feature that can't be a symlink
# (iTerm2 keeps profiles in a binary plist), so dotbot applies it via this shell
# step. Stock tools only (python3) — no dependency on any other repo.
#
# Run with iTerm2 quit: iTerm2 caches prefs in memory and rewrites the plist on
# quit, which would clobber a live edit. The script is idempotent, so re-running
# after quitting iTerm2 is safe.
#
# Part of the feature documented in config/iterm2/README.md.
set -euo pipefail

INITIAL='source ~/.config/iterm2/restore-join.zsh'
PLIST="$HOME/Library/Preferences/com.googlecode.iterm2.plist"

if [ ! -f "$PLIST" ]; then
  echo "iTerm2 prefs not found ($PLIST). Launch iTerm2 once, then re-run." >&2
  exit 1
fi

result=$(python3 - "$PLIST" "$INITIAL" <<'PY'
import sys, plistlib
plist_path, initial = sys.argv[1], sys.argv[2]
with open(plist_path, 'rb') as f:
    d = plistlib.load(f)
guid = d.get('Default Bookmark Guid')
prof = next((b for b in d.get('New Bookmarks', []) if b.get('Guid') == guid), None)
if prof is None:
    sys.exit('Default profile (%s) not found in plist' % guid)
if prof.get('Initial Text') == initial:
    print('unchanged')
else:
    prof['Initial Text'] = initial
    with open(plist_path, 'wb') as f:
        plistlib.dump(d, f)
    print('updated')
PY
)

if [ "$result" = updated ]; then
  echo "iTerm2 Default profile 'Send text at start' set to: $INITIAL"
  if pgrep -xq iTerm2; then
    echo "NOTE: iTerm2 is running — quit and relaunch so it doesn't overwrite this on quit."
  fi
else
  echo "iTerm2 Default profile 'Send text at start' already correct."
fi
