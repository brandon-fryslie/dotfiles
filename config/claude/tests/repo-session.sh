#!/usr/bin/env bash
# repo-session's contract, end to end against the live tmux server and claude:
# --session without a name is refused; the window lands in the session the
# caller names or the one derived from the directory, with '.' and ':'
# sanitized in either; the not-ready arm exits 1 with nothing on stdout, the
# window left running, and its pane id in the message; the ready arm prints the
# pane id on stdout once claude's prompt is drawn; and that id still names the
# claude pane after an earlier window in the session closes and the window
# indices renumber, while the drivers' shared tmux-resolve turns both the id and
# the pane's address of the moment into that same id. One
# launch boots the real claude to its prompt; the other launches a stand-in
# claude, first on PATH, that never draws a prompt, so the not-ready arm is
# reached on every run rather than only when the real claude boots slower than
# the first poll, and the window still shows where it landed. The stand-in
# records the argv it was started with, which is checked for --worktree; the real
# launch names its worktree, which must then exist, and is removed on exit.
#
# The scratch directory and the worktree name are fixed: claude registers a
# project per root it is started in, so a fresh name per run would leave a new
# ~/.claude.json entry and transcript dir each time, and a fresh /tmp directory,
# or a nested `git init`, would stop every launch at the folder-trust dialog
# (exit 2). The checkout is already trusted on a machine where these tests run.
#
# Run: config/claude/tests/repo-session.sh   (needs tmux and a working claude login)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
rs="$here/../skills/repo-session/bin/repo-session"
resolve="$here/../skills/tmux-shared/bin/tmux-resolve"
panes="$here/../skills/tmux-shared/bin/tmux-panes"
repo="$(cd "$here/../../.." && pwd -P)/rs.test"

sessions=()
# The real-claude launch below runs with --worktree, which makes a worktree of
# this checkout; the test names it so it can remove exactly that one. Where it
# lands is git's to say (the branch claude makes for it), not assumed here.
# claude holds a lock on it while running, hence the sessions die first.
wtname="rs-test"
wt_path() {
  git -C "$here" worktree list --porcelain |
    awk -v b="refs/heads/worktree-$wtname" '/^worktree /{p=substr($0,10)} $1=="branch" && $2==b {print p}'
}
cleanup() {
  for s in ${sessions[@]+"${sessions[@]}"}; do tmux kill-session -t "=$s" 2>/dev/null || true; done
  wtpath=$(wt_path)
  if [[ -n "$wtpath" ]]; then
    git -C "$here" worktree unlock "$wtpath" 2>/dev/null || true
    git -C "$here" worktree remove --force "$wtpath" || echo "cleanup: could not remove worktree $wtpath" >&2
    git -C "$here" branch -D "worktree-$wtname" >/dev/null || echo "cleanup: could not delete branch worktree-$wtname" >&2
  fi
  rm -rf "$repo"
}
trap cleanup EXIT
rm -rf "$repo" && mkdir "$repo"

fail() { echo "FAIL - $*" >&2; exit 1; }
# The pane id repo-session announces on stderr as it creates the window.
announced() { sed -n 's/^repo-session: \(%[0-9]*\) at .*/\1/p' "$1"; }
# Whether session $1 holds pane $2, asked of tmux rather than of the stderr line.
in_session() { tmux list-panes -s -t "=$1" -F '#{pane_id}' | grep -qx "$2"; }
# Where pane $1 sits right now, through the drivers' shared exact-id lookup.
where() { "$panes" "$1" '#{session_name}:#{window_index}.#{pane_index}'; }

# --session without a name is refused before anything is launched.
if err=$("$rs" --session 2>&1 >/dev/null); then fail "--session with no name exited 0"; fi
grep -qF -- "--session requires a name" <<<"$err" || fail "--session with no name: unexpected message: $err"
echo "ok   - --session without a name is refused"

# --worktree needs a name when given, and the flag has one home: a second
# --worktree after the '--' is refused rather than sent to claude beside ours.
if err=$("$rs" --worktree 2>&1 >/dev/null); then fail "--worktree with no name exited 0"; fi
grep -qF -- "--worktree requires a name" <<<"$err" || fail "--worktree with no name: unexpected message: $err"
for dup in --worktree -w; do
  if err=$("$rs" "$repo" -- "$dup" other 2>&1 >/dev/null); then fail "$dup after -- exited 0"; fi
  grep -qF -- "not after --" <<<"$err" || fail "$dup after --: unexpected message: $err"
done
echo "ok   - --worktree without a name, and --worktree/-w after --, are refused"

# Derived session, sanitized; and the not-ready arm, reached through a claude
# that never gets ready. repo-session runs the claude on PATH, so a stand-in
# first on PATH is the launcher's own seam, not a hook inside it.
mkdir "$repo/bin"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@" >"$(dirname "$0")/argv"\necho "stand-in claude: booting, no prompt"\nexec sleep 100000\n' >"$repo/bin/claude"
chmod +x "$repo/bin/claude"
derived="rs_test"; sessions+=("$derived")
if out=$(PATH="$repo/bin:$PATH" REPO_SESSION_BOOT_TIMEOUT=0 "$rs" "$repo" -- --model sonnet 2>"$repo/err"); then
  fail "not-ready arm exited 0 with stdout: $out"
fi
[[ -z "$out" ]] || fail "not-ready arm printed on stdout: $out"
addr=$(announced "$repo/err")
[[ "$addr" == %* ]] || fail "announced handle is not a pane id: '$addr' in $(cat "$repo/err")"
in_session "$derived" "$addr" || fail "derived session: expected $addr in $derived, it is at $(where "$addr")"
grep -qF "claude in $addr not ready" "$repo/err" || fail "not-ready arm did not name $addr: $(cat "$repo/err")"
tmux display-message -p -t "$addr" '#{pane_start_command}' | grep -q claude || fail "not-ready arm did not leave $addr running claude"
[[ "$(cat "$repo/bin/argv")" == $'--worktree\n--dangerously-skip-permissions\n--model\nsonnet' ]] || fail "claude argv: expected --worktree first, then the extra args, got: $(cat "$repo/bin/argv")"
echo "ok   - no --session: window landed in $derived; not-ready arm exits 1, names the pane id, leaves the window; claude got --worktree before the extra args"

# Named session, sanitized the same way; and the ready arm, booted to the prompt.
named="rs:test.$$"; named_clean=${named//[.:]/_}; sessions+=("$named_clean")
addr=$("$rs" --session "$named" --worktree "$wtname" "$repo" 2>"$repo/err") || fail "repo-session --session $named exited $?: $(cat "$repo/err")"
[[ "$addr" == %* ]] || fail "stdout handle is not a pane id: '$addr'"
in_session "$named_clean" "$addr" || fail "named session: expected $addr in $named_clean, it is at $(where "$addr")"
[[ "$addr" == "$(announced "$repo/err")" ]] || fail "stdout pane id $addr differs from the announced $(announced "$repo/err")"
tmux capture-pane -p -t "$addr" | grep -q '❯' || fail "ready arm returned but no prompt on $addr's screen"
[[ -n "$(wt_path)" ]] || fail "--worktree $wtname made no worktree"
echo "ok   - --session $named: window landed in $named_clean; ready arm printed the pane id once the prompt was up"

# The handle outlives window renumbering: a window inserted before claude's
# shifts claude's window index, and closing it shifts the index back under
# renumber-windows, which the test sets on its own session rather than relying
# on the server's config; the pane id names the pane with claude's prompt on
# it throughout, and the resolver maps both the id and whatever address the
# pane has at the moment to that id. The inserted window runs a fixed command,
# so its lifetime is the test's and not a login shell's.
tmux set-option -t "=$named_clean:" renumber-windows on
[[ "$("$resolve" "$addr")" == "$addr" ]] || fail "tmux-resolve did not return $addr for itself"
before=$(where "$addr")
[[ "$("$resolve" "$before")" == "$addr" ]] || fail "tmux-resolve did not map $before to $addr"
tmux new-window -d -b -t "=$named_clean:{start}" 'sleep 100000'
shifted=$(where "$addr")
[[ "$shifted" != "$before" ]] || fail "inserting a window before $addr left its address at $before"
[[ "$("$resolve" "$addr")" == "$addr" ]] || fail "tmux-resolve did not return $addr after a window was inserted before it"
[[ "$("$resolve" "$shifted")" == "$addr" ]] || fail "tmux-resolve did not map the shifted $shifted to $addr"
if out=$("$resolve" "$before" 2>&1); then
  [[ "$out" != "$addr" ]] || fail "the stale address $before still resolved to $addr after the shift"
fi
tmux kill-window -t "=$named_clean:{start}"
after=$(where "$addr")
[[ "$after" == "$before" ]] || fail "closing the inserted window left $addr at $after, not back at $before; renumber-windows did not apply"
tmux capture-pane -p -t "$addr" | grep -q '❯' || fail "after renumbering, $addr no longer shows claude's prompt"
echo "ok   - $addr stayed claude's pane while its address went $before -> $shifted -> $after"
