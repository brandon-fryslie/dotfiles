#!/usr/bin/env bats
# test-sync-worktree.bats - Functional tests for bin/sync-worktree.sh
#
# TICKET: dotfiles-script-audit-lbl.13
#
# BUG VALIDATED:
# The same-repo sanity check compared raw `git rev-parse --git-common-dir`
# output, but git prints the relative string `.git` when asked from the
# primary worktree and an absolute path when asked from a linked worktree.
# In the standard layout (main branch in the primary checkout, feature
# branch in a linked worktree, script run from the feature worktree) the
# string compare failed and the script died "worktrees are not from the
# same repo" — the primary use case aborted incorrectly.
#
# GAMING RESISTANCE:
# - Runs the real script against real git repos with real linked worktrees
#   built in a temp dir; git identity/config isolated via env so the user's
#   gitconfig (hooks, aliases, rebase settings) cannot affect outcomes
# - The standard-layout test asserts the cross-branch commits actually
#   landed after the dual rebase — a fix that passes the check but breaks
#   the rebase flow fails
# - The reverse-layout test runs from the primary worktree, so both
#   relative-here/absolute-there orderings of the comparison are pinned

bats_require_minimum_version 1.5.0

load '../helpers/test-helpers'

SCRIPT="$BATS_TEST_DIRNAME/../../bin/sync-worktree.sh"

setup() {
  WORK=$(create_test_dir)

  # Isolate from the user's git identity and config
  export GIT_CONFIG_GLOBAL="$WORK/gitconfig"
  export GIT_CONFIG_SYSTEM=/dev/null
  export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@test
  export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@test
  touch "$WORK/gitconfig"
}

teardown() {
  rm -rf "$WORK"
}

# Build a repo at $WORK/repo: primary worktree on $1, linked worktree
# at $WORK/linked-wt on $2. Each branch gets one unique commit.
make_repo() {
  local primary_branch="$1" linked_branch="$2"
  git init -q -b "$primary_branch" "$WORK/repo"
  git -C "$WORK/repo" commit -q --allow-empty -m "base"
  git -C "$WORK/repo" branch "$linked_branch"
  git -C "$WORK/repo" worktree add -q "$WORK/linked-wt" "$linked_branch"
  git -C "$WORK/repo" commit -q --allow-empty -m "on-$primary_branch"
  git -C "$WORK/linked-wt" commit -q --allow-empty -m "on-$linked_branch"
}

@test "standard layout: main in primary, feature in linked worktree, run from linked" {
  make_repo main feature

  cd "$WORK/linked-wt"
  run env MAIN_BRANCH=main "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"not from the same repo"* ]]

  # Both rebases really ran: each branch now contains the other's commit
  git -C "$WORK/linked-wt" log --format=%s feature | grep -qx "on-main"
  git -C "$WORK/repo" log --format=%s main | grep -qx "on-feature"
}

@test "reverse layout: feature in primary, main in linked worktree, run from primary" {
  make_repo feature main

  cd "$WORK/repo"
  run env MAIN_BRANCH=main "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"not from the same repo"* ]]

  git -C "$WORK/repo" log --format=%s feature | grep -qx "on-main"
  git -C "$WORK/linked-wt" log --format=%s main | grep -qx "on-feature"
}

@test "run from the main-branch worktree itself: dies with guidance, no rebase" {
  make_repo main feature

  cd "$WORK/repo"
  run env MAIN_BRANCH=main "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"run this from the other branch worktree"* ]]
}
