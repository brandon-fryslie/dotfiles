#!/usr/bin/env zsh
# Sourced from the iTerm2 Default profile's "Send text at start":
#     source ~/.config/iterm2/restore-join.zsh
#
# Two jobs, gated by launch context:
#  - iTerm2 session RESTORE (app just launched): recover this tab's prior cwd
#    from the restored scrollback and join its tmux session, coordinating with
#    tmux-resurrect so tabs never race the in-flight (background) restore.
#  - Fresh tab (cmd+t while the app is already running): do nothing. iTerm2's
#    "Recycle" setting already placed the shell in the right directory and there
#    is no prior session to rejoin.
#
# Why uptime is the discriminator: the profile recycles the directory, so a new
# tab's scrollback is indistinguishable from a restored one by content. iTerm2's
# process uptime is not ambiguous — restored sessions are created within the
# launch window; manual tabs come later. The window resets every app start,
# which is exactly when restoration happens.

() {
  emulate -L zsh

  local -r RESTORE_WINDOW_S=120   # treat sessions created within this many seconds of app launch as restoration

  # --- gate: only act during the app-launch restoration window ---
  local ipid et days secs
  local -a parts
  ipid=$(pgrep -x iTerm2 2>/dev/null | head -1)
  [[ -z $ipid ]] && return 0
  et=$(ps -o etime= -p "$ipid" 2>/dev/null | tr -d ' ')
  [[ -z $et ]] && return 0
  days=0
  [[ $et == *-* ]] && { days=${et%%-*}; et=${et#*-} }
  parts=("${(@s.:.)et}")
  case ${#parts} in
    3) secs=$(( parts[1]*3600 + parts[2]*60 + parts[3] ));;
    2) secs=$(( parts[1]*60 + parts[2] ));;
    *) secs=${parts[1]:-0};;
  esac
  (( secs += days*86400 ))
  # outside the restoration window -> manually-created tab; leave the shell alone
  (( secs > RESTORE_WINDOW_S )) && return 0

  # --- restore path ---
  local sid=${ITERM_SESSION_ID##*:} text tok d cwd name save deadline t0
  text=$(osascript -e 'on run a' -e 'tell application "iTerm2"' \
    -e 'repeat with w in windows' -e 'repeat with b in tabs of w' \
    -e 'repeat with c in sessions of b' \
    -e 'if (id of c) is (item 1 of a) then return text of c' \
    -e 'end repeat' -e 'end repeat' -e 'end repeat' \
    -e 'end tell' -e 'return ""' -e 'end run' "$sid" 2>/dev/null)

  # most-recent existing non-$HOME directory in the restored scrollback
  cwd=""
  for tok in ${(f)"$(print -r -- "$text" | grep -oE '~?/[A-Za-z0-9._@%+-]+(/[A-Za-z0-9._@%+-]+)*' | tail -r)"}; do
    d=${tok/#\~/$HOME}
    if [[ -d $d && $d != $HOME ]]; then cwd=$d; break; fi
  done
  [[ -n $cwd ]] && cd -- "$cwd"

  name=${PWD:t}; [[ $PWD == $HOME ]] && name=default; name=${name//[.:]/_}

  # resurrect coordination: raise @cwd_restoring at server start (only when a save
  # exists -> a restore will run); wait while it is set; the post-restore-all hook
  # clears it. A non-restoring server leaves it 0 -> instant join.
  save=0; [[ -s $HOME/.local/share/tmux/resurrect/last ]] && save=1
  tmux start-server 2>/dev/null
  tmux if-shell -F '#{?@cwd_booted,0,1}' "set -g @cwd_booted 1 ; set -g @cwd_restoring $save"
  t0=$(date +%s); deadline=$(( t0 + 120 ))
  until [[ "$(tmux show -gv @cwd_restoring 2>/dev/null)" != 1 ]] || (( $(date +%s) >= deadline )); do sleep 0.5; done

  local act
  if tmux has-session -t "=$name" 2>/dev/null; then act=attach; else act=create; fi
  print -r -- "$(date '+%H:%M:%S') sid=${sid:0:8} uptime=${secs}s cwd=$PWD name=$name save=$save act=$act waited=$(( $(date +%s) - t0 ))s" >> "$HOME/.iterm-restore.log"
  if [[ $act == attach ]]; then
    tmux attach-session -t "=$name"
  else
    tmux new-session -s "$name"
  fi
}
