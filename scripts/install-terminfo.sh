#!/bin/bash
# Give the tmux-256color terminfo entry the RGB flag, so apps inside tmux know
# they have 24-bit color.
#
# tmux's truecolor story has two halves. Outward (tmux -> the real terminal) is
# settled in config/tmux/tmux.conf by `terminal-features *:RGB`. Inward is not:
# apps read $TERM's terminfo, and ncurses ships tmux-256color with colors#256 and
# no RGB flag, so anything that trusts terminfo over $COLORTERM (Go/tcell TUIs,
# notcurses, vim's termguicolors autodetect) quantizes to 256 no matter what tmux
# can actually render. $COLORTERM=truecolor covers the apps that check it and only
# on the home profile; this covers the rest, everywhere.
#
# The system entry stays canonical: this derives from `infocmp` at install time
# and adds one flag, rather than checking in a copy that would drift as ncurses
# updates. [LAW:one-source-of-truth]
#
# ~/.terminfo precedes the system database in ncurses' search order, so the
# derived entry shadows the stock one under its own name — nothing else in the
# repo has to learn a new TERM value. Re-running is safe; tic overwrites.
set -euo pipefail

ENTRY="tmux-256color"
DEST="$HOME/.terminfo"

source_entry=$(infocmp -x "$ENTRY")

# infocmp emits a `#` comment banner, then the terminal's name line, then
# capability lines. RGB is a boolean, valid on any capability line, so hang it
# immediately off the name line.
patched=$(printf '%s\n' "$source_entry" | awk '
  /^#/ { print; next }
  !placed { print; print "\tRGB,"; placed = 1; next }
  { print }
')

mkdir -p "$DEST"
printf '%s\n' "$patched" | tic -x -o "$DEST" -

TERMINFO="$DEST" infocmp -x "$ENTRY" | grep -qE '\bRGB\b' || {
  echo "ERROR: compiled $DEST/$ENTRY but the RGB flag is not readable back" >&2
  exit 1
}

echo "✓ Installed $DEST $ENTRY with RGB (24-bit color for apps inside tmux)"
