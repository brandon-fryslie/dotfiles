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

repo="$work/repo"
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

echo "PASS - chain_to_local_hook reaches the repo's own hooks from a worktree"
