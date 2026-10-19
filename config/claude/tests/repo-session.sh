#!/usr/bin/env bash
# repo-session's contract, end to end against the live tmux server and claude:
# --session without a name is refused; the window lands in the session the
# caller names or the one derived from the directory, with '.' and ':'
# sanitized in either; the not-ready arm exits 1 with nothing on stdout, the
# window left running, and its pane id in the message; the ready arm prints the
# pane id on stdout once claude's prompt is drawn; and that id still names the
# claude pane after an earlier window in the session closes and the window
# indices renumber, resolved through the drivers' shared tmux-resolve. One
# launch boots claude to its prompt; the other is cut off by a zero deadline,
# which exercises the not-ready arm and still shows where the window landed.
#
# The scratch directory is a fixed path inside this checkout and not a git repo
# of its own: claude registers a project per root it is started in, so a fresh
# name per run would leave a new ~/.claude.json entry and transcript dir each
# time, and a fresh /tmp directory, or a nested `git init`, would stop every
# launch at the folder-trust dialog (exit 2). The checkout is already trusted
# on a machine where these tests run.
#
# Run: config/claude/tests/repo-session.sh   (needs tmux and a working claude login)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
rs="$here/../skills/repo-session/bin/repo-session"
resolve="$here/../skills/tmux-shared/bin/tmux-resolve"
repo="$(cd "$here/../../.." && pwd -P)/rs.test"

sessions=()
cleanup() {
  for s in ${sessions[@]+"${sessions[@]}"}; do tmux kill-session -t "=$s" 2>/dev/null || true; done
  rm -rf "$repo"
}
trap cleanup EXIT
rm -rf "$repo" && mkdir "$repo"

fail() { echo "FAIL - $*" >&2; exit 1; }
# The pane id repo-session announces on stderr as it creates the window.
announced() { sed -n 's/^repo-session: \(%[0-9]*\) at .*/\1/p' "$1"; }
# The session a pane is in, asked of tmux by the pane's id. list-panes errors
# on an id no pane has; display-message would answer '' and exit 0.
session_of() { tmux list-panes -t "$1" -f "#{==:#{pane_id},$1}" -F '#{session_name}'; }

# --session without a name is refused before anything is launched.
if err=$("$rs" --session 2>&1 >/dev/null); then fail "--session with no name exited 0"; fi
grep -qF -- "--session requires a name" <<<"$err" || fail "--session with no name: unexpected message: $err"
echo "ok   - --session without a name is refused"

# Derived session, sanitized; and the not-ready arm, reached by a zero deadline.
derived="rs_test"; sessions+=("$derived")
if out=$(REPO_SESSION_BOOT_TIMEOUT=0 "$rs" "$repo" 2>"$repo/err"); then
  fail "not-ready arm exited 0 with stdout: $out"
fi
[[ -z "$out" ]] || fail "not-ready arm printed on stdout: $out"
addr=$(announced "$repo/err")
[[ "$addr" == %* ]] || fail "announced handle is not a pane id: '$addr' in $(cat "$repo/err")"
[[ "$(session_of "$addr")" == "$derived" ]] || fail "derived session: expected $derived, $addr is in '$(session_of "$addr")'"
grep -qF "claude in $addr not ready" "$repo/err" || fail "not-ready arm did not name $addr: $(cat "$repo/err")"
tmux display-message -p -t "$addr" '#{pane_start_command}' | grep -q claude || fail "not-ready arm did not leave $addr running claude"
echo "ok   - no --session: window landed in $derived; not-ready arm exits 1, names the pane id, leaves the window"

# Named session, sanitized the same way; and the ready arm, booted to the prompt.
named="rs:test.$$"; named_clean=${named//[.:]/_}; sessions+=("$named_clean")
addr=$("$rs" --session "$named" "$repo" 2>"$repo/err") || fail "repo-session --session $named exited $?: $(cat "$repo/err")"
[[ "$addr" == %* ]] || fail "stdout handle is not a pane id: '$addr'"
[[ "$(session_of "$addr")" == "$named_clean" ]] || fail "named session: expected $named_clean, $addr is in '$(session_of "$addr")'"
[[ "$addr" == "$(announced "$repo/err")" ]] || fail "stdout pane id $addr differs from the announced $(announced "$repo/err")"
tmux capture-pane -p -t "$addr" | grep -q '❯' || fail "ready arm returned but no prompt on $addr's screen"
echo "ok   - --session $named: window landed in $named_clean; ready arm printed the pane id once the prompt was up"

# The handle outlives window renumbering: a window inserted before claude's
# and then closed shifts claude's window index (renumber-windows on), and the
# pane id still resolves to the pane with claude's prompt on it.
before=$("$resolve" "$addr") || fail "tmux-resolve rejected the pane id $addr"
tmux new-window -d -b -t "=$named_clean:{start}"
shifted=$("$resolve" "$addr") || fail "tmux-resolve rejected $addr with a window inserted before it"
[[ "$shifted" != "$before" ]] || fail "inserting a window before $addr left its address at $before; is renumber-windows on?"
tmux kill-window -t "=$named_clean:{start}"
after=$("$resolve" "$addr") || fail "tmux-resolve rejected $addr after the inserted window closed"
[[ "$after" == "$before" ]] || fail "closing the inserted window left $addr at $after, not back at $before"
tmux capture-pane -p -t "$addr" | grep -q '❯' || fail "after renumbering, $addr no longer shows claude's prompt"
echo "ok   - $addr stayed claude's pane while its address went $before -> $shifted -> $after"
