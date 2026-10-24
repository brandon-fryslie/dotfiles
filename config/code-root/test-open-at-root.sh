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
expect() { # expect <description> <expected calls> <open-at-root args>...
  local description="$1" expected="$2"
  shift 2
  : > "$calls"
  "$here/open-at-root" "$cli" "$@"
  if [[ "$(cat "$calls")" == "$expected" ]]; then
    echo "ok   $description"
  else
    echo "FAIL $description"
    echo "  expected: $expected"
    echo "  actual:   $(cat "$calls")"
    failures=$((failures + 1))
  fi
}

repo="$scratch/my repo"
mkdir -p "$repo/docs" "$scratch/loose"
git -C "$repo" init -q
git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
git -C "$repo" worktree add -q "$scratch/tree"
touch "$repo/docs/a b.md" "$repo/top.py" "$scratch/tree/w.go" "$scratch/loose/x.json"

expect "file in a repo subdirectory opens at the repo root" \
  "$repo|$repo/docs/a b.md|" "$repo/docs/a b.md"
expect "file in a worktree opens at the worktree root" \
  "$scratch/tree|$scratch/tree/w.go|" "$scratch/tree/w.go"
expect "file outside any repo opens alone" \
  "$scratch/loose/x.json|" "$scratch/loose/x.json"
expect "each of several files opens at its own root" \
  "$repo|$repo/top.py|
$scratch/loose/x.json|" "$repo/top.py" "$scratch/loose/x.json"

# A git failure other than "not a repository" stops loudly, opening nothing.
: > "$calls"
if out=$("$here/open-at-root" "$cli" "$scratch/no-such-dir/f.md" 2>&1); then
  echo "FAIL git failure exits non-zero"; failures=$((failures + 1))
elif [[ -s "$calls" || "$out" != *"git failed"* ]]; then
  echo "FAIL git failure opens nothing and says so (output: $out)"; failures=$((failures + 1))
else
  echo "ok   git failure exits non-zero and opens nothing"
fi

exit "$failures"
