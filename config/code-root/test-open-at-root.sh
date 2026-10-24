#!/bin/bash
# Assert what open-at-root asks VS Code to open, using a fake CLI that records
# its arguments. Run via `just test-code-root`.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
# mktemp hands back /var/...; git reports the resolved /private/var/... root.
scratch="$(cd "$scratch" && pwd -P)"

cli="$scratch/fake-code"
calls="$scratch/calls"
printf '#!/bin/bash\nprintf "%%s|" "$@" >> %q\necho >> %q\n' "$calls" "$calls" > "$cli"
chmod +x "$cli"

failures=0
expect() { # expect <description> <expected exit> <expected calls> <open-at-root args>...
  local description="$1" expected="$2 $3" status=0
  shift 3
  : > "$calls"
  "$here/open-at-root" "$cli" "$@" 2> "$scratch/stderr" || status=$?
  if [[ "$status $(cat "$calls")" == "$expected" ]]; then
    echo "ok   $description"
  else
    echo "FAIL $description"
    echo "  expected: exit $expected"
    echo "  actual:   exit $status $(cat "$calls")"
    echo "  stderr:   $(cat "$scratch/stderr")"
    failures=$((failures + 1))
  fi
}

repo="$scratch/my repo"
mkdir -p "$repo/docs" "$scratch/loose" "$scratch/broken"
git -C "$repo" init -q
git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
git -C "$repo" worktree add -q "$scratch/tree"
touch "$repo/docs/a b.md" "$repo/top.py" "$scratch/tree/w.go" "$scratch/loose/x.json" "$scratch/broken/f.md"
ln -s "$repo/docs" "$scratch/linked-docs"
ln -s "$repo/top.py" "$scratch/loose/top-link.py"
echo "not a gitfile" > "$scratch/broken/.git"

expect "file in a repo subdirectory opens at the repo root" 0 \
  "$repo|$repo/docs/a b.md|" "$repo/docs/a b.md"
expect "file in a worktree opens at the worktree root" 0 \
  "$scratch/tree|$scratch/tree/w.go|" "$scratch/tree/w.go"
expect "file outside any repo opens alone" 0 \
  "$scratch/loose/x.json|" "$scratch/loose/x.json"
expect "each of several files opens at its own root" 0 \
  "$repo|$repo/top.py|
$scratch/loose/x.json|" "$repo/top.py" "$scratch/loose/x.json"
expect "file reached through a symlinked directory opens by its real path" 0 \
  "$repo|$repo/docs/a b.md|" "$scratch/linked-docs/a b.md"
expect "symlinked file outside any repo opens its target at the target's root" 0 \
  "$repo|$repo/top.py|" "$scratch/loose/top-link.py"
expect "git failure other than 'not a repository' still opens the file, then exits non-zero" 1 \
  "$scratch/broken/f.md|" "$scratch/broken/f.md"
if [[ "$(cat "$scratch/stderr")" == *"git failed for $scratch/broken/f.md"* ]]; then
  echo "ok   git failure names the file on stderr"
else
  echo "FAIL git failure names the file on stderr (got: $(cat "$scratch/stderr"))"; failures=$((failures + 1))
fi

exit "$failures"
