#!/usr/bin/env bash
# chain_to_local_hook hands control to the repo's own .git/hooks/<name> that the global
# core.hooksPath displaced. A repo's hooks live in its git COMMON dir, shared by every
# worktree; a linked worktree's own git dir holds none.
#
# Asserted is what a commit does [LAW:behavior-not-structure]: a repo-local pre-commit
# that rejects refuses the commit from the main checkout AND from a linked worktree, and
# one that accepts lets it through from both.
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

# local_hook <verdict>: install the repo's own pre-commit; it exits 1 (reject) or 0 (accept).
# It names itself on stderr so a refusal can be told from any other failure.
local_hook() {
  printf '#!/bin/sh\necho "LOCAL-HOOK-RAN" >&2\nexit %s\n' "$1" > "$repo/.git/hooks/pre-commit"
  chmod +x "$repo/.git/hooks/pre-commit"
}

# commit_in <dir>: commit a fresh file there.
commit_in() {
  ( cd "$1" && date +%s%N > "f.$RANDOM" && git add -A && git commit -q -m c ) >"$work/last.log" 2>&1
}

repo="$work/repo"
git init -q "$repo"
git -C "$repo" config core.hooksPath "$real_hooks"
git -C "$repo" commit -q --allow-empty -m init
git -C "$repo" worktree add -q "$work/wt" -b wt

for where in "$repo" "$work/wt"; do
  label=main; [ "$where" = "$work/wt" ] && label=worktree
  local_hook 1
  if commit_in "$where" || ! grep -q LOCAL-HOOK-RAN "$work/last.log"; then
    fail "$label: the repo's own rejecting pre-commit did not refuse the commit"
  fi
  local_hook 0
  commit_in "$where" || fail "$label: the repo's own accepting pre-commit blocked the commit"
  grep -q LOCAL-HOOK-RAN "$work/last.log" || fail "$label: the repo's own pre-commit never ran"
done

echo "PASS - chain_to_local_hook reaches the repo's own hooks from a worktree"
