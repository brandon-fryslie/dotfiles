#!/usr/bin/env bash
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

is_clean() {
  local wt="$1"
  [[ -d "$wt" ]] || die "not a directory: $wt"
  git -C "$wt" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git worktree: $wt"
  [[ -z "$(git -C "$wt" status --porcelain)" ]] || die "worktree not clean: $wt"
}

current_branch() {
  git -C "$1" symbolic-ref --quiet --short HEAD 2>/dev/null || die "detached HEAD in: $1"
}

find_worktree_for_branch() {
  # prints path of worktree that has refs/heads/<branch> checked out
  local target="$1"
  local want="refs/heads/$target"
  local wt="" br=""

  while IFS= read -r line; do
    case "$line" in
      worktree\ *) wt="${line#worktree }"; br="";;
      branch\ *)   br="${line#branch }"
                   [[ "$br" == "$want" ]] && { echo "$wt"; return 0; }
                   ;;
    esac
  done < <(git worktree list --porcelain)

  return 1
}

run_rebase() {
  local wt="$1" onto="$2"
  echo
  echo "==> [$wt] git rebase $onto"
  if ! git -C "$wt" rebase "$onto"; then
    cat >&2 <<EOF

Rebase stopped due to conflicts in:
  $wt

Resolve, then:
  git -C "$wt" rebase --continue
or:
  git -C "$wt" rebase --abort

Re-run this script after you finish.
EOF
    exit 2
  fi
}

need git

MAIN_BRANCH="${MAIN_BRANCH:-main}"

BRANCH_WT="$(pwd -P)"
git -C "$BRANCH_WT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "run from inside a git worktree"

BRANCH="$(current_branch "$BRANCH_WT")"
[[ "$BRANCH" != "$MAIN_BRANCH" ]] || die "you are on '$MAIN_BRANCH' — run this from the other branch worktree"

MAIN_WT="$(find_worktree_for_branch "$MAIN_BRANCH" || true)"
[[ -n "$MAIN_WT" ]] || die "could not find a worktree with branch '$MAIN_BRANCH' checked out"

# same repo sanity
CD1="$(git -C "$BRANCH_WT" rev-parse --git-common-dir)"
CD2="$(git -C "$MAIN_WT"   rev-parse --git-common-dir)"
[[ "$CD1" == "$CD2" ]] || die "worktrees are not from the same repo"

is_clean "$BRANCH_WT"
is_clean "$MAIN_WT"

echo "Branch worktree: $BRANCH_WT  (branch: $BRANCH)"
echo "Main worktree:   $MAIN_WT    (branch: $MAIN_BRANCH)"

# Order matching your workflow:
# 1) branch <- rebase onto main  (branch now includes main)
run_rebase "$BRANCH_WT" "$MAIN_BRANCH"

# 2) main <- rebase onto branch  (main catches up; rewrites main)
run_rebase "$MAIN_WT" "$BRANCH"

echo
echo "Done."