#!/usr/bin/env bash
#
# Open this repo on GitHub in the browser: the open PR for the current branch if one
# exists, otherwise the branch's tree view. A fresh implementation of the behavior of
# the shell `gh-open` function — not a copy — with its bugs left behind (see below).
#
# [LAW:effects-at-boundaries] the only side effect (`open`) happens once, at the very
# end, on a URL the pure logic above has already decided. Everything before it is
# reads and string work.
set -euo pipefail

die() { printf 'gh-open: %s\n' "$1" >&2; exit 1; }

# [LAW:no-silent-failure] hard dependencies are asserted up front, loudly, instead of
# failing cryptically halfway through.
command -v git >/dev/null 2>&1 || die "git not found on PATH"
command -v gh  >/dev/null 2>&1 || die "gh (GitHub CLI) not found on PATH"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "not inside a git repository"

# Branch name; empty on a detached HEAD. The shell `gh-open` used
# `rev-parse --abbrev-ref HEAD`, which returns the literal "HEAD" when detached and
# then opens a bogus `/tree/HEAD`. `symbolic-ref` reports the true absence instead, so
# a detached checkout with no PR becomes an explicit error further down, not a lie.
# The `|| true` records that absence as an empty string — an expected state to handle,
# not a failure to swallow.
branch="$(git symbolic-ref --quiet --short HEAD || true)"

# --- The one real discriminator: is there an OPEN PR for this branch? ---
# [LAW:dataflow-not-control-flow] PR-vs-branch is the domain's genuine fork; it picks a
# *value* (target_url) rather than gating whether the final `open` runs.
#
# `gh pr view` (no argument) resolves the PR for the *current* branch and is fork-aware
# — for this checkout it looks up `<fork-owner>:<branch>`. `gh pr list --head <branch>`
# was rejected: it matches any same-named head branch in the base repo and will happily
# return an unrelated contributor's PR.
pr_err="$(mktemp)"
trap 'rm -f "$pr_err"' EXIT

# --jq uses gh's built-in engine, so no external `jq` is required. `select` drops
# merged/closed PRs, leaving pr_url empty unless the PR is genuinely OPEN.
if pr_url="$(gh pr view --json state,url --jq 'select(.state=="OPEN") | .url' 2>"$pr_err")"; then
  : # exit 0: pr_url is the open PR's URL, or empty if the PR is merged/closed
else
  # [LAW:no-silent-failure] `gh pr view` exits non-zero for "no PR on this branch" —
  # the expected path — but also for real errors (no auth, no network). Recognize the
  # benign case explicitly and fall through to the branch view; re-raise anything else
  # loudly rather than masking a broken lookup as "no PR".
  grep -q "no pull requests found" "$pr_err" || { cat "$pr_err" >&2; exit 1; }
  pr_url=""
fi

# --- Branch tree URL, derived from `origin` only when no open PR won. ---
target_url="$pr_url"
if [ -z "$target_url" ]; then
  [ -n "$branch" ] || die "detached HEAD and no open PR — nothing to open"

  remote_url="$(git remote get-url origin)" \
    || die "no 'origin' remote to derive a GitHub URL from"

  # Normalize the SSH/HTTPS/ssh:// remote forms to an https web URL. The shell
  # `gh-open` hardcoded `http://`; GitHub is https, so this always yields https.
  web="$(printf '%s' "$remote_url" \
    | sed -E 's#^ssh://git@#https://#; s#^git@([^:]+):#https://\1/#; s#\.git$##')"
  case "$web" in
    https://*) : ;;
    *) die "cannot build an https URL from origin remote: $remote_url" ;;
  esac

  target_url="$web/tree/$branch"
fi

# [LAW:no-silent-failure] never hand `open` an empty string and call it success.
[ -n "$target_url" ] || die "could not determine a URL to open"

printf 'gh-open: opening %s\n' "$target_url"
open "$target_url"
