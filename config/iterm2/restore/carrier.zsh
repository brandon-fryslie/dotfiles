#!/usr/bin/env zsh
# Carrier: the one seam that knows about iTerm2. It stores a tab's handle where an
# iTerm2 restart will hand it back to the restored tab. Both identity variants use
# this unchanged — swapping the carrier never touches variant logic. [LAW:decomposition]
#
# Chosen backing: the iTerm2 SESSION NAME.
#   - VERIFIED (this machine, iTerm2 3.6.11, inside tmux): osascript can read a
#     session's `name` by matching iTerm2 session id, and in this setup tmux's
#     title integration already populates that name with the tmux session name —
#     so the read path works today with zero new write code in the common case.
#   - The handle therefore doubles as a useful tab title (you WANT to see which
#     session a tab holds), so the carrier is non-intrusive.
#
# UNVERIFIED WITHOUT A RELAUNCH (NOT a reboot): that the name survives an actual
# iTerm2 quit+reopen. carrier_read returns empty on any tab whose name is not a
# valid handle, so if the assumption is wrong the feature does NOTHING (fails
# safe) rather than cd-ing somewhere wrong. [LAW:no-silent-failure]
# To confirm: quit+reopen iTerm2, then check ~/.iterm-restore.log.

# Read the raw handle stored for THIS tab (empty string if none / not iTerm2).
carrier_read() {
  emulate -L zsh
  local sid=${ITERM_SESSION_ID##*:}
  [[ -n $sid ]] || return 0
  osascript - "$sid" 2>/dev/null <<'OSA'
on run argv
  set sid to item 1 of argv
  tell application "iTerm2"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if (id of s) is sid then return name of s
        end repeat
      end repeat
    end repeat
  end tell
  return ""
end run
OSA
}

# Persist $1 as THIS tab's handle. In the common config tmux's title integration
# already names the iTerm2 session after the tmux session, so an explicit write is
# only needed when the handle must differ from that title (e.g. a directory-keyed
# name while attached to a differently-named session). DCS-wrapped so it crosses
# the tmux layer to iTerm2. [LAW:no-ambient-temporal-coupling] this just sets
# state; it imposes no ordering on anything.
carrier_write() {
  emulate -L zsh
  local handle=$1
  [[ -n $ITERM_SESSION_ID ]] || return 0
  # OSC 1337 SetUserVar rides in the title channel; tmux passthrough = \ePtmux;..\e\\
  printf '\ePtmux;\e\e]1337;SetUserVar=%s=%s\a\e\\' cwdrestore "$(print -rn -- "$handle" | base64)"
}
