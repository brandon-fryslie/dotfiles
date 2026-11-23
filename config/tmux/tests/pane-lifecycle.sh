#!/bin/sh
# Checks the pane lifecycle (conf.d/pane-lifecycle.conf) on a private tmux server that
# sources the shipped file from this checkout, so it tests the checkout, not ~/.config.
set -u
dir="$(cd "$(dirname "$0")/.." && pwd)"
sock="pane-lifecycle-test-$$"
work="$(mktemp -d "${TMPDIR:-/tmp}/pane-lifecycle-test.XXXXXX")"
t() { tmux -L "$sock" "$@"; }
trap 't kill-server 2>/dev/null; rm -rf "$work"' EXIT
cat > "$work/tmux.conf" <<EOF
%hidden TMUX_CONFIG_DIR="$dir"
set -g default-shell /bin/zsh
source-file "\$TMUX_CONFIG_DIR/conf.d/pane-lifecycle.conf"
EOF

# Polls the condition for up to 10s: tmux and zsh startup set the pace, not a fixed sleep.
within() { i=0; until "$@"; do i=$((i + 1)); [ "$i" -ge 100 ] && return 1; sleep 0.1; done; }
gone() { ! t has-session -t "=$1" 2>/dev/null; }
shows() { t capture-pane -p -t "=$1:" 2>/dev/null | grep -q "$2"; }
live() { [ "$(t display -p -t "=$1:" '#{pane_dead}' 2>/dev/null)" = 0 ]; }
marked() { [ -n "$(t show -pqv -t "=$1:" @shell-start 2>/dev/null)" ]; }

shell_pane_closes() {
  t new-session -d -s shell && within marked shell &&
    t send-keys -t =shell: exit Enter && within gone shell
}
command_pane_respawns_once() {
  t new-session -d -s cmd 'echo hello-output; exit 3' &&
    within shows cmd hello-output && within marked cmd && live cmd &&
    t send-keys -t =cmd: exit Enter && within gone cmd
}
stale_mark_keeps_respawned_command() {
  t new-session -d -s excise && within marked excise &&
    t respawn-pane -k -t =excise: 'echo excise-output; exit 0' &&
    within shows excise excise-output && within live excise
}
restored_pane_is_a_shell_pane() {
  echo restored-output > "$work/contents" &&
    t new-session -d -s restored "cat '$work/contents'; exec $(t show -gv default-command)" &&
    within marked restored && t send-keys -t =restored: exit Enter && within gone restored
}
launcher_opt_out_closes() {
  t new-session -d -s optout 'echo x; exit 0' \; set -p remain-on-exit off && within gone optout
}
broken_default_command_respawns_once() {
  t set -g default-command /nonexistent/tmux-shell.sh &&
    t new-session -d -s broken 'exit 0' && within gone broken
  rc=$?
  t set -g default-command "$dir/scripts/tmux-shell.sh"
  return "$rc"
}

t -f "$work/tmux.conf" new-session -d -s keep || exit 1
failures=0
for case in shell_pane_closes command_pane_respawns_once stale_mark_keeps_respawned_command \
  restored_pane_is_a_shell_pane launcher_opt_out_closes broken_default_command_respawns_once; do
  if "$case"; then echo "ok   $case"; else echo "FAIL $case"; failures=$((failures + 1)); fi
done
[ "$failures" = 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
