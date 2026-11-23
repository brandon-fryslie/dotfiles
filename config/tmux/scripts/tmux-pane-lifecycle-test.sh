#!/bin/sh
# Checks the pane lifecycle (conf.d/pane-respawn.conf) on a private tmux server built
# from the files beside this script, so it runs against a checkout, not ~/.config.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
sock="pane-lifecycle-test-$$"
work="$(mktemp -d "${TMPDIR:-/tmp}/pane-lifecycle-test.XXXXXX")"
t() { tmux -L "$sock" "$@"; }
trap 't kill-server 2>/dev/null; rm -rf "$work"' EXIT
cat > "$work/tmux.conf" <<EOF
set -g default-shell /bin/zsh
set -g default-command "$here/tmux-shell.sh"
source-file "$here/../conf.d/pane-respawn.conf"
set-hook -g pane-died "run-shell -b '$here/tmux-pane-respawn.sh #{pane_id}'"
EOF
failures=0
check() { if "$@"; then echo "ok   $name"; else echo "FAIL $name"; failures=$((failures + 1)); fi; }
# Polls the condition for up to 10s: tmux and zsh startup set the pace, not a fixed sleep.
within() { i=0; until "$@"; do i=$((i + 1)); [ "$i" -ge 100 ] && return 1; sleep 0.1; done; }
gone() { ! t has-session -t "=$1" 2>/dev/null; }
shows() { t capture-pane -p -t "=$1:" 2>/dev/null | grep -q "$2"; }
live() { [ "$(t display -p -t "=$1:" '#{pane_dead}' 2>/dev/null)" = 0 ]; }
kept_as_shell() { shows "$1" "$2" && marked "$1"; }
marked() { [ -n "$(t show -pqv -t "=$1:" @shell-start 2>/dev/null)" ]; }
t -f "$work/tmux.conf" new-session -d -s keep

name="shell pane closes on exit"
t new-session -d -s shell
within marked shell; t send-keys -t =shell: 'exit' Enter
check within gone shell

name="command pane keeps its output and drops into a shell"
t new-session -d -s cmd 'echo hello-output; exit 3'
check within kept_as_shell cmd hello-output
name="  ...and closes on that shell's exit"
t send-keys -t =cmd: 'exit' Enter
check within gone cmd

name="respawn-pane -k into a command keeps that command's output"
t new-session -d -s excise
within marked excise; t respawn-pane -k -t =excise: 'echo excise-output; exit 0'
check within shows excise excise-output
name="  ...in a live shell"
check within live excise

name="resurrect restore (cat file; exec default-command) gives a shell pane"
echo restored-output > "$work/contents"
t new-session -d -s restored "cat '$work/contents'; exec $(t show -gv default-command)"
within marked restored; t send-keys -t =restored: 'exit' Enter
check within gone restored

name="launcher opt-out closes the pane like plain tmux"
t new-session -d -s optout 'echo x; exit 0' \; set -p remain-on-exit off
check within gone optout

[ "$failures" = 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
