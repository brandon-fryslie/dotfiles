#!/usr/bin/env bash
# What the custom_git_taculous prompt segment shows for stashes and the repo's user.name.
#
# Asserted is the rendered segment [LAW:behavior-not-structure]: real zsh with no rc files
# sources config/p10k/active/10-git-taculous.zsh and renders vcs_info in throwaway repos.
# A stash shows after its ref is packed and from a linked worktree, where .git is a file.
# The user name shows only when the repo sets one locally, cut to 40 characters, and a repo
# without one gets no empty "()".
#
# Run: tests/git-taculous-prompt.sh   (needs zsh and git)
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
segment="$repo/config/p10k/active/10-git-taculous.zsh"
work=$(mktemp -d); work=$(cd "$work" && pwd -P)
trap 'rm -rf "$work"' EXIT

# git sees none of the user's own config: a global user.name would hide the empty "()".
export HOME="$work/home" GIT_CONFIG_GLOBAL="$work/gitconfig" GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=Tester GIT_AUTHOR_EMAIL=t@example.com
export GIT_COMMITTER_NAME=Tester GIT_COMMITTER_EMAIL=t@example.com
mkdir -p "$HOME"; : >"$GIT_CONFIG_GLOBAL"

failures=0
fail() { echo "FAIL - $*" >&2; failures=$((failures + 1)); }

# The segment as the prompt renders it in directory $1. p10k loads first and defines its own
# +vi-git-stash; the decoys stand in for it, so a segment that defers to them shows "DECOY".
render() {
  (cd "$1" && zsh -f -c '
    for h in st stash username; do functions[+vi-git-$h]="hook_com[misc]+=\" DECOY\""; done
    source "$1"; vcs_info; print -r -- "$vcs_info_msg_0_"' zsh "$segment")
}

new_repo() {
  git init -q -b main "$1"
  git -C "$1" commit -q --allow-empty -m init
}

expect_has() { case "$2" in *"$3"*) ;; *) fail "$1: expected '$3' in: $2" ;; esac; }
expect_lacks() { case "$2" in *"$3"*) fail "$1: unexpected '$3' in: $2" ;; esac; }

# A stash whose ref is packed, seen from the repo and from a linked worktree.
new_repo "$work/stashed"
echo dirty >"$work/stashed/file"
git -C "$work/stashed" stash push -q -u -m wip
git -C "$work/stashed" pack-refs --all
[ ! -e "$work/stashed/.git/refs/stash" ] || fail "setup: refs/stash is still a loose file"
out=$(render "$work/stashed")
expect_has "packed stash" "$out" "(1 stashed)"
git -C "$work/stashed" worktree add -q "$work/linked" -b linked
out=$(render "$work/linked")
expect_has "linked worktree" "$out" "(1 stashed)"
expect_lacks "hooks of the same name loaded first" "$out" "DECOY"

# No stash and no local user.name: neither part shows.
new_repo "$work/plain"
out=$(render "$work/plain")
expect_lacks "no stash" "$out" "stashed"
expect_lacks "no local user.name" "$out" "()"

# A local user.name set to the empty string shows nothing either.
git -C "$work/plain" config --local user.name ''
out=$(render "$work/plain")
expect_lacks "empty local user.name" "$out" "()"

# A local user.name shows, cut to 40 characters.
git -C "$work/plain" config --local user.name Alice
out=$(render "$work/plain")
expect_has "local user.name" "$out" "(Alice)"
exact=$(printf 'n%.0s' $(seq 40))
git -C "$work/plain" config --local user.name "$exact"
out=$(render "$work/plain")
expect_has "40-character user.name" "$out" "($exact)"
long=$(printf 'n%.0s' $(seq 50))
git -C "$work/plain" config --local user.name "$long"
out=$(render "$work/plain")
expect_has "long user.name" "$out" "(${long:0:40}...)"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed" >&2
  exit 1
fi
echo "ok - git-taculous segment"
