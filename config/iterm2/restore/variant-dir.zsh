#!/usr/bin/env zsh
# IDENTITY VARIANT A — directory-keyed.
# A tab's identity IS its directory. The tmux session is just "the session for
# this directory", named from the basename. The session name is DERIVED, never
# stored; cwd is the only thing recorded. [LAW:one-source-of-truth] the cwd is the
# single key; the session name is a pure function of it.
#
# Diverges from variant B only when a session's name is decoupled from its dir,
# or when two tabs sit in the same dir on different sessions (A merges them).

# What to capture while the tab is alive: just the working directory.
restore_record() {
  emulate -L zsh
  print -r -- "$(restore_make_handle dir '' "$PWD")"
}

# Map a restored handle to a target. Pure (lib only).
# Output: primary_name <TAB> fallback_name <TAB> cwd
# Primary and fallback are identical here: the directory deterministically names
# the session, so there is no separate "exact session" to prefer.
restore_resolve_target() {
  emulate -L zsh
  local handle=$1
  local -a reply
  restore_parse_handle "$handle" || return 1
  local cwd=${reply[3]}
  local name=$(restore_derive_name "$cwd")
  print -r -- "$name	$name	$cwd"
}
