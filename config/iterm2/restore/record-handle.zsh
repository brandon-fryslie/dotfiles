#!/usr/bin/env zsh
# tmux-hook writer: keeps a tab's sidecar handle current. Invoked by the
# client-attached / client-session-changed hooks (see config/tmux/tmux.conf):
#
#   run-shell -b "~/.config/iterm2/restore/record-handle.zsh \
#       #{client_tty} #{client_session} #{pane_current_path}"
#
# WHY a tmux hook and not a shell precmd: the outer iTerm2 shell is blocked inside
# `tmux attach` during normal use, so a precmd there never sees the user switch
# tmux sessions and the sidecar goes stale. A client hook fires on every attach and
# every session change, so the handle always reflects the session the tab is really
# showing. [LAW:no-ambient-temporal-coupling] the writer is driven by the actual
# switch event, not by incidental prompt timing.
#
# It maps the tmux client back to an iTerm2 UUID via the tty bridge the outer shell
# wrote (restore_register_client): #{client_tty} equals that outer shell's tty. A
# client with no bridge entry is not an iTerm2 tab we track -> no-op, fail safe.
# [LAW:no-silent-failure]

# $0 is the script path here (at top level); inside a function it would be the
# function name, so capture the dir now.
typeset -g __RH_DIR=${0:A:h}

__record_handle() {
  emulate -L zsh
  local client_tty=$1 session=$2 cwd=$3
  local here=$__RH_DIR
  source "$here/lib.zsh"
  source "$here/carrier.zsh"
  source "$here/variant.zsh"    # selected variant: provides restore_record_from

  local clients_dir=${ITERM_RESTORE_CLIENTS_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/iterm-restore/clients}
  [[ $client_tty == /dev/* ]] || return 0
  local bridge=$clients_dir/${client_tty//\//_}
  [[ -f $bridge ]] || return 0                 # not a tracked iTerm2 tab
  local uuid=$(<$bridge)
  [[ -n $uuid && $uuid != */* && $uuid != *..* ]] || return 0

  local handle=$(restore_record_from "$session" "$cwd")
  # carrier_write keys on ITERM_SESSION_ID's UUID; bridge the resolved uuid in.
  export ITERM_SESSION_ID="ttybridge:$uuid"
  carrier_write "$handle"
}

__record_handle "$@"
