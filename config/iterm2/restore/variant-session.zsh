#!/usr/bin/env zsh
# IDENTITY VARIANT B — exact-session.
# A tab's identity IS the specific tmux session it was attached to, whatever its
# name. That session name is captured live (cwd is kept only as a fallback for the
# case where the exact session no longer exists). [LAW:one-source-of-truth] the
# session name is the key; cwd is the recovery fallback.
#
# Diverges from variant A only when a session's name is decoupled from its dir,
# or when two tabs sit in the same dir on different sessions (B preserves both).

# Build this variant's handle from already-gathered facts. PURE (lib only): records
# the exact session name plus cwd as fallback. Shared by the in-shell recorder and
# the tmux-hook writer. [LAW:effects-at-boundaries]
restore_record_from() {  # $1=session $2=cwd -> handle
  emulate -L zsh
  print -r -- "$(restore_make_handle session "$1" "$2")"
}

# What to capture while the tab is alive: the attached tmux session name (empty if
# the tab is a plain shell, not in tmux), plus cwd as fallback.
restore_record() {
  emulate -L zsh
  local session
  session=$(tmux display-message -p '#S' 2>/dev/null)
  restore_record_from "$session" "$PWD"
}

# Map a restored handle to a target. Pure (lib only).
# Output: primary_name <TAB> fallback_name <TAB> cwd
# Primary is the captured session; fallback is the dir-derived name for when that
# exact session was not restored. The ONLY line that differs from variant A is the
# primary: the stored session vs the directory-derived name.
restore_resolve_target() {
  emulate -L zsh
  local handle=$1
  local -a reply
  restore_parse_handle "$handle" || return 1
  local session=${reply[2]} cwd=${reply[3]}
  local fallback=$(restore_derive_name "$cwd")
  local primary=${session:-$fallback}
  print -r -- "$primary	$fallback	$cwd"
}
