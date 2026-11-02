#!/usr/bin/env bash
# chain_to_local_hook hands control to the repo's own .git/hooks/<name> that the global
# core.hooksPath displaced. A repo's hooks live in its git COMMON dir, shared by every
# worktree; a linked worktree's own git dir holds none.
#
# Asserted is what a commit does [LAW:behavior-not-structure]: a repo-local pre-commit or
# commit-msg that rejects refuses the commit from the main checkout AND from a linked
# worktree, one that accepts lets it through from both, and having none is not an error.
#
# Run: config/claude/tests/chain-to-local-hook.sh   (needs git)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
real_hooks="$here/../../git/hooks"

work="$(mktemp -d)"; work="$(cd "$work" && pwd -P)"
trap 'rm -rf "$work"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail() { echo "FAIL - $*" >&2; cat "$work/last.log" >&2 2>/dev/null; exit 1; }

# local_hook <name> <verdict>: install the repo's own hook; it exits 1 (reject) or 0 (accept).
# It names itself and its argument count on stderr, so a refusal can be told from any
# other failure and argument passthrough can be seen.
local_hook() {
  printf '#!/bin/sh\necho "LOCAL-HOOK-RAN %s argc=$#" >&2\nexit %s\n' "$1" "$2" > "$repo/.git/hooks/$1"
  chmod +x "$repo/.git/hooks/$1"
}

# commit_in <dir>: commit a fresh file there.
n=0
commit_in() {
  n=$((n + 1))
  ( cd "$1" && echo "$n" > "f.$n" && git add -A && git commit -q -m c ) >"$work/last.log" 2>&1
}

# A space in the path, as under "/Library/Application Support": the hook path must stay quoted.
repo="$work/the repo"
git init -q "$repo"
git -C "$repo" config core.hooksPath "$real_hooks"
git -C "$repo" commit -q --allow-empty -m init
git -C "$repo" worktree add -q "$work/wt" -b wt

for where in "$repo" "$work/wt"; do
  label=main; [ "$where" = "$work/wt" ] && label=worktree
  # pre-commit is handed no arguments; commit-msg is handed the message file, which must
  # reach the repo's own hook.
  for hook in pre-commit commit-msg; do
    want_argc=0; [ "$hook" = commit-msg ] && want_argc=1
    rm -f "$repo/.git/hooks/pre-commit" "$repo/.git/hooks/commit-msg"
    local_hook "$hook" 1
    if commit_in "$where" || ! grep -q "LOCAL-HOOK-RAN $hook argc=$want_argc" "$work/last.log"; then
      fail "$label: the repo's own rejecting $hook did not refuse the commit"
    fi
    local_hook "$hook" 0
    commit_in "$where" || fail "$label: the repo's own accepting $hook blocked the commit"
    grep -q "LOCAL-HOOK-RAN $hook argc=$want_argc" "$work/last.log" \
      || fail "$label: the repo's own $hook did not run with $want_argc argument(s)"
  done
  # No repo-local hook at all: nothing to chain to is not an error.
  rm -f "$repo/.git/hooks/pre-commit" "$repo/.git/hooks/commit-msg"
  commit_in "$where" || fail "$label: a commit with no repo-local hooks was blocked"
done

# Every hook git can run reaches the repo's own, not just the two this directory scans for.
# The names are githooks(5); a hook missing from this directory is a repo hook silently displaced.
rm -f "$repo/.git/hooks/pre-commit" "$repo/.git/hooks/commit-msg"
forwarded=" applypatch-msg pre-applypatch post-applypatch pre-merge-commit prepare-commit-msg
  post-commit pre-rebase post-checkout post-merge pre-push pre-receive update proc-receive
  post-receive post-update reference-transaction push-to-checkout pre-auto-gc post-rewrite
  sendemail-validate fsmonitor-watchman p4-changelist p4-prepare-changelist
  p4-post-changelist p4-pre-submit post-index-change "
forwarded=$(echo $forwarded)
for hook in $forwarded; do
  printf '#!/bin/sh\necho "LOCAL-HOOK-RAN %s argc=$# stdin=$(cat)" >&2\nexit 7\n' "$hook" > "$repo/.git/hooks/$hook"
  chmod +x "$repo/.git/hooks/$hook"
  [ -x "$real_hooks/$hook" ] || fail "no forwarder for the $hook hook: the repo's own would stop running"
  rc=0
  ( cd "$repo" && echo "payload" | "$real_hooks/$hook" one two ) >"$work/last.log" 2>&1 || rc=$?
  [ "$rc" = 7 ] || fail "$hook: the repo's own hook exit code did not stand (got $rc)"
  grep -q "LOCAL-HOOK-RAN $hook argc=2 stdin=payload" "$work/last.log" \
    || fail "$hook: arguments and stdin did not reach the repo's own hook"
  rm -f "$repo/.git/hooks/$hook"
done

# The reverse drift: a hook in the directory the list above does not know is untested.
for f in "$real_hooks"/*; do
  case "${f##*/}" in
    lib.sh|claude-session-url.pattern|forward-to-local-hook|pre-commit|commit-msg) continue ;;
  esac
  case " $forwarded " in
    *" ${f##*/} "*) ;;
    *) fail "${f##*/} is in the hooks directory but not in the forwarded-hook list" ;;
  esac
done

# And through git itself: a repo-local pre-push that rejects stops a real push.
git init -q --bare "$work/remote.git"
local_hook pre-push 1
if ( cd "$repo" && git push -q "$work/remote.git" HEAD:refs/heads/x ) >"$work/last.log" 2>&1; then
  fail "the repo's own rejecting pre-push did not stop the push"
fi
grep -q "LOCAL-HOOK-RAN pre-push" "$work/last.log" || fail "the push failed, but not by the repo's own pre-push"
rm -f "$repo/.git/hooks/pre-push"

# Outside any repo the common dir cannot be located; that must be an error that says so,
# not a quiet "no local hook".
mkdir "$work/not-a-repo"
if out=$(cd "$work/not-a-repo" && . "$real_hooks/lib.sh" && chain_to_local_hook pre-commit 2>&1); then
  fail "chain_to_local_hook succeeded where the git common dir cannot be found"
fi
case "$out" in *"cannot locate"*) ;; *) fail "the failed lookup was not reported: $out" ;; esac

echo "PASS - chain_to_local_hook reaches the repo's own hooks from a worktree"
