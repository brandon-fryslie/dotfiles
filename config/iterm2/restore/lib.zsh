#!/usr/bin/env zsh
# Pure helpers for the iTerm2 restore feature. NO effects here — no tmux, no
# osascript, no cd, no clock. Every function is a pure function of its arguments,
# which is exactly what makes the whole feature testable without a reboot.
# [LAW:effects-at-boundaries]

# Derive a tmux-safe session name from a directory path.
#   $HOME (or empty) -> "default"; otherwise the basename with tmux-illegal
#   characters (. and :) replaced by _.
restore_derive_name() {
  emulate -L zsh
  local dir=$1 name
  if [[ -z $dir || $dir == $HOME ]]; then
    name=default
  else
    name=${dir:t}
  fi
  print -r -- "${name//[.:]/_}"
}

# A handle is the single authoritative record of a tab's identity, written while
# the tab is alive and read back after restore. One line, TAB-separated:
#   v1 <TAB> kind <TAB> session <TAB> cwd
# kind is the authoring variant ("dir" | "session"); session and/or cwd may be
# empty. Versioned so the format can change without silently misreading old data.
# [LAW:one-source-of-truth] this record — not scraped scrollback — is the truth.

restore_make_handle() {  # $1=kind $2=session $3=cwd  -> prints the handle line
  emulate -L zsh
  print -r -- "v1	$1	$2	$3"
}

# Parse a handle line into reply=(kind session cwd). Returns 1 (and leaves reply
# untouched) on anything that is not a well-formed v1 handle, so a fresh tab's
# empty/garbage name can never be mistaken for a real handle. [LAW:no-silent-failure]
restore_parse_handle() {  # $1=handle line
  emulate -L zsh
  local line=$1
  local -a f
  f=("${(@s.	.)line}")        # split on TAB
  [[ ${f[1]} == v1 && ${#f} -ge 4 ]] || return 1
  reply=("${f[2]}" "${f[3]}" "${f[4]}")
  return 0
}
