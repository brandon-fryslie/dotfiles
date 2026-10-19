#!/usr/bin/env bash
# Reconverge the code-review workflow across every repo under a root, and report what
# each one needs next. The fleet drifts every time the template moves — each repo was
# installed at a different generation, and a repo on a stale generation breaks at the
# moment someone opens a PR, reporting zero findings exactly as a clean review does.
# This is the re-runnable pass that closes that: the SAME render install.sh uses, applied
# to every repo the installer has ever touched. [LAW:one-source-of-truth]
#
# The population is read from disk on every run, never from a list: a repo is a
# directory under the root that is a git work-tree root AND carries the workflow file.
# A directory carrying the file without being a repo was never written by the installer
# (it refuses to run anywhere else) and is not in the population. [LAW:parse-dont-validate]
#
# What this writes: the workflow file, into each repo's working tree, on whatever branch
# is checked out there (reported). What it never does: commit, push, or write a secret.
# Committing is each repo's own git policy, and a credential is synced at the moment a
# repo needs it (SKILL.md, "Rotating the reviewer account"), not fanned out ahead of
# time. Secrets and the workflow's registered state are READ and reported, so the user
# knows which repos still need install.sh or a `gh workflow enable`. A converged file is
# not a working reviewer: a secret missing from one store, or a workflow GitHub has
# disabled, reviews nothing and shows nothing. [LAW:no-silent-failure]
#
# Usage: reconverge-fleet.sh <root>      e.g. reconverge-fleet.sh ~/code
# Exit 0 when every repo converged (changed or not), 1 when any repo failed.
set -euo pipefail

# shellcheck source=template.sh
source "$(dirname "${BASH_SOURCE[0]}")/template.sh"

[ "$#" -eq 1 ] || die "usage: reconverge-fleet.sh <root>  (the directory whose immediate subdirectories are the repos)"
ROOT="$1"
[ -d "$ROOT" ] || die "root '$ROOT' is not a directory."

# --- Per-process preconditions, once. [LAW:no-silent-failure]
command -v gh >/dev/null 2>&1 || die "GitHub CLI 'gh' is not installed (https://cli.github.com)."
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"

# One repo, in the cwd: the same three reads and one write for every repo, each outcome a
# value on one line. Runs in a subshell so a `die` in any step ends this repo, not the
# pass — through the explicit `|| exit 1` arms, because the caller's `if` switches
# errexit off for everything it runs. [LAW:dataflow-not-control-flow]
#
# The write is LAST. A read that fails after the write would report `failed:` for a repo
# whose file had already changed, and the re-run after the fix would say `unchanged` — so
# the one word SKILL.md tells the operator to commit on would never be said for that repo.
# Reads first, write last: a failed repo's file is untouched, and the re-run writes it and
# says so. [LAW:no-silent-failure]
converge_one() {
  local repo status state secret_name declared_item missing secrets=""
  repo="$(resolve_repo)" || exit 1
  state="$(workflow_state "$repo")" || exit 1
  for secret_entry in "${SECRETS[@]}"; do
    IFS='|' read -r secret_name declared_item <<<"$secret_entry"
    missing="$(secret_stores_missing "$secret_name" "$repo")" || exit 1
    [ -z "$missing" ] || secrets="${secrets:+$secrets }${secret_name}(${missing// /,})"
  done
  status="$(converge_workflow "$repo")" || exit 1
  printf '%s  branch=%s  workflow=%s  secrets=%s' \
    "$status" "$(git rev-parse --abbrev-ref HEAD)" "$state" "${secrets:+missing }${secrets:-ok}"
}

unchanged=0 updated=0 failed=0
errfile="$(mktemp)"
trap 'rm -f "$errfile"' EXIT

for dir in "$ROOT"/*/; do
  ( cd "$dir" && at_work_tree_root ) && [ -f "$dir$WORKFLOW_PATH" ] || continue
  name="$(basename "$dir")"
  if line="$( (cd "$dir" && converge_one) 2>"$errfile" )"; then
    case "$line" in
      unchanged*) unchanged=$((unchanged + 1)) ;;
      updated*)   updated=$((updated + 1)) ;;
    esac
  else
    failed=$((failed + 1))
    line="failed: $(tail -n 1 "$errfile")"
  fi
  # The repo's line first, then everything the repo said on stderr under it, indented —
  # the render's notes (a conf adding patterns) on a converged repo, and on a failed one
  # the full cause (gh's own HTTP line, not only the last line the status carries).
  printf '%-32s %s\n' "$name" "$line"
  sed "s/^/    /" "$errfile" >&2
done

echo
echo "$((unchanged + updated + failed)) repos: $unchanged unchanged, $updated updated, $failed failed"
[ "$failed" -eq 0 ]
