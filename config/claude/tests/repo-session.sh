#!/usr/bin/env bash
# repo-session's contract, end to end against the live tmux server and claude:
# the window lands in the session the caller names or the one derived from the
# directory, with '.' and ':' sanitized in either; --session without a name is
# refused; and the not-ready arm exits 1 with the window left running and its
# address in the message. The tmux server is the real one: sessions are created
# with names unique to this run and killed on exit.
#
# The scratch directory lives inside this checkout and is not a git repo of its
# own: claude's folder-trust dialog is answered per project root, so a fresh
# /tmp directory, or a nested `git init`, would stop every launch at it
# (exit 2); the checkout is already trusted on a machine where these tests run.
#
# Run: config/claude/tests/repo-session.sh   (needs tmux and a working claude login)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
rs="$here/../skills/repo-session/bin/repo-session"

repo=$(mktemp -d "$here/../../../rs.test.$$.XXXX")
sessions=()
cleanup() {
  for s in ${sessions[@]+"${sessions[@]}"}; do tmux kill-session -t "=$s" 2>/dev/null || true; done
  rm -rf "$repo"
}
trap cleanup EXIT

fail() { echo "FAIL - $*" >&2; exit 1; }

# --session without a name is refused before anything is launched.
if err=$("$rs" --session 2>&1 >/dev/null); then fail "--session with no name exited 0"; fi
grep -qF -- "--session requires a name" <<<"$err" || fail "--session with no name: unexpected message: $err"
echo "ok   - --session without a name is refused"

# Derived path: the directory's basename, sanitized.
derived=$(basename "$repo"); derived=${derived//[.:]/_}
sessions+=("$derived")
addr=$("$rs" "$repo") || fail "repo-session $repo exited $?"
[[ "${addr%%:*}" == "$derived" ]] || fail "derived session: expected $derived, address was $addr"
tmux display-message -p -t "$addr" '#{pane_start_command}' | grep -q 'claude' || fail "pane $addr is not running claude"
echo "ok   - no --session: window landed in $derived"

# Named path: the caller's name, sanitized the same way.
named="rs:test.$$"; named_clean=${named//[.:]/_}
sessions+=("$named_clean")
addr=$("$rs" --session "$named" "$repo") || fail "repo-session --session $named exited $?"
[[ "${addr%%:*}" == "$named_clean" ]] || fail "named session: expected $named_clean, address was $addr"
echo "ok   - --session $named: window landed in $named_clean"

# Not-ready arm: exit 1, nothing on stdout, the window left running and its
# address in the message. A zero deadline makes the loop never run, so this is
# the arm itself, not a 90s wait.
slow="rs-slow-$$"; sessions+=("$slow")
if addr=$(REPO_SESSION_BOOT_TIMEOUT=0 "$rs" --session "$slow" "$repo" 2>/tmp/rs-test-$$.err); then
  fail "not-ready arm exited 0 with address $addr"
fi
[[ -z "$addr" ]] || fail "not-ready arm printed an address on stdout: $addr"
grep -qF "claude in $slow:1.1 not ready" "/tmp/rs-test-$$.err" || fail "not-ready arm did not name the address: $(cat /tmp/rs-test-$$.err)"
rm -f "/tmp/rs-test-$$.err"
tmux has-session -t "=$slow" 2>/dev/null || fail "not-ready arm removed session $slow"
echo "ok   - not-ready arm exits 1, names the address, leaves the window"
