#!/usr/bin/env zsh
# Carrier: the one seam that persists a tab's handle where an iTerm2 restart will
# hand it back to the SAME tab. Both identity variants use this unchanged, and the
# pure core (lib/coordination/restore) never knows how it works. [LAW:decomposition]
#
# Backing: a sidecar WE author, one file per tab, keyed by the iTerm2 session UUID
# (the part of ITERM_SESSION_ID after the last colon). [LAW:one-source-of-truth]
# Why the UUID and not the session name or iTerm2's own state:
#   - iTerm2 does NOT persist the cwd in plaintext (the old code scraped scrollback
#     to guess it); the session NAME is a mutable display string, not authoritative.
#   - iTerm2 keys each session's restorable state BY this UUID in its SavedState DB,
#     so a restored tab MUST come back with the same UUID to find its own state —
#     verified + argued in gate dotfiles-iterm2-restore-5k5.1. So the UUID is the
#     one per-tab handle that is both authoritative and survives a restart.
# The cwd therefore comes from this sidecar (recorded live by the writer), never
# from scrollback and never from iTerm2.
#
# Fails safe: a tab with no sidecar row reads the empty string, so restore does
# NOTHING rather than acting on a guess. [LAW:no-silent-failure]

# One file per tab under a state dir; nothing else writes here. Overridable for tests.
: ${ITERM_RESTORE_STATE_DIR:=${XDG_STATE_HOME:-$HOME/.local/state}/iterm-restore/handles}

# The per-tab key: the UUID portion of ITERM_SESSION_ID. iTerm2 sets ITERM_SESSION_ID
# directly in the outer shell (where this runs), so the value is the true per-tab
# UUID, not a tmux-inherited copy. Empty (-> no key) when not under iTerm2; the
# path guard keeps a malformed value from escaping the state dir.
__carrier_key() {
  emulate -L zsh
  local sid=${ITERM_SESSION_ID##*:}
  [[ -n $sid && $sid != */* && $sid != *..* ]] || return 1
  print -r -- "$sid"
}

# Echo the raw handle stored for THIS tab; empty string if none / not iTerm2.
carrier_read() {
  emulate -L zsh
  local key
  key=$(__carrier_key) || return 0
  local f=$ITERM_RESTORE_STATE_DIR/$key
  [[ -f $f ]] || return 0
  print -r -- "$(<$f)"
}

# Persist $1 as THIS tab's handle (atomic replace, so a restore never reads a
# half-written row). No-op without a key; loud on a real IO failure.
carrier_write() {
  emulate -L zsh
  local handle=$1 key
  key=$(__carrier_key) || return 0
  mkdir -p -- "$ITERM_RESTORE_STATE_DIR" || return 1
  local f=$ITERM_RESTORE_STATE_DIR/$key tmp
  tmp=$(mktemp "$ITERM_RESTORE_STATE_DIR/.$key.XXXXXX") || return 1
  print -r -- "$handle" > "$tmp" && mv -f -- "$tmp" "$f" || { rm -f -- "$tmp"; return 1; }
}
