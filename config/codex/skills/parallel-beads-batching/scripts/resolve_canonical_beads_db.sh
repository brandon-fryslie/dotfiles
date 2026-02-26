#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git work tree" >&2
  exit 1
fi

common_dir_raw="$(git rev-parse --git-common-dir)"
common_dir="$(cd "$common_dir_raw" && pwd)"

# In both normal repos and worktrees, git-common-dir should end with .git.
if [[ "$(basename "$common_dir")" != ".git" ]]; then
  echo "Unexpected git common dir: $common_dir" >&2
  exit 1
fi

canonical_repo_root="$(dirname "$common_dir")"
db="$canonical_repo_root/.beads/beads.db"

if [[ ! -f "$db" ]]; then
  echo "Canonical beads DB not found at: $db" >&2
  exit 1
fi

printf '%s\n' "$db"
