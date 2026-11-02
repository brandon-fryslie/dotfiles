#!/usr/bin/env bash
# The git pre-commit session-URL scan and its exemption for the guard's own files,
# against throwaway repos: a "guard repo" holding a copy of the real hooks (the repo the
# global core.hooksPath points into), a worktree of it, and an unrelated repo.
#
# Asserted is what a commit does [LAW:behavior-not-structure]: the guard's own files
# carrying the pattern commit from the main checkout AND from a worktree of the guard
# repo; any other file carrying it is refused in both; and a like-named path in a repo
# that is not the guard's gets no exemption.
#
# Run: config/claude/tests/session-url-hook.sh   (needs git)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
real_hooks="$here/../../git/hooks"
real_guard="$here/../hooks/guard-session-url.sh"

work="$(mktemp -d)"; work="$(cd "$work" && pwd -P)"
trap 'rm -rf "$work"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail() { echo "FAIL - $*" >&2; cat "$work/last.log" >&2 2>/dev/null; exit 1; }
url='https://claude.ai/code/session_01ABCDEF'

# commits <dir> <path>: stage <path> carrying the pattern in <dir> and commit it.
# The staged copy carries the URL; the working file is put back before the commit, so
# editing the pattern file or lib.sh does not change the regex or code the hook runs.
# A failed commit leaves its path staged; unstage it so the next call is judged alone.
commits() {
  ( cd "$1" && mkdir -p "$(dirname "$2")" && touch "$2" && cp "$2" "$work/orig" \
    && echo "# see $url" >> "$2" && git add "$2" && cp "$work/orig" "$2" \
    && { git commit -q -m "add $2" || { git reset -q; exit 1; }; } ) >"$work/last.log" 2>&1
}

# refused <dir> <path>: the commit failed AND the hook's refusal is why -- any other
# failure (identity, a crashing hook) must not read as a correct refusal.
refused() {
  ! commits "$@" && grep -q 'COMMIT REFUSED' "$work/last.log"
}

guard="$work/guard"
hooks="$guard/config/git/hooks"
mkdir -p "$guard/config/git" "$guard/config/claude/hooks"
cp -R "$real_hooks" "$hooks"
cp "$real_guard" "$guard/config/claude/hooks/guard-session-url.sh"
git init -q "$guard"
git -C "$guard" config core.hooksPath "$hooks"
git -C "$guard" add -A
git -C "$guard" commit -q -m init
git -C "$guard" worktree add -q "$work/wt" -b wt
git init -q "$work/other"
git -C "$work/other" config core.hooksPath "$hooks"
git -C "$work/other" commit -q --allow-empty -m init

for where in "$guard" "$work/wt"; do
  label=main; [ "$where" = "$work/wt" ] && label=worktree
  commits "$where" config/git/hooks/claude-session-url.pattern \
    || fail "$label: the pattern file carrying the pattern was refused"
  commits "$where" config/claude/hooks/guard-session-url.sh \
    || fail "$label: guard-session-url.sh carrying the pattern was refused"
  if ! refused "$where" notes.md; then fail "$label: an unrelated file carrying the pattern was not refused by the hook"; fi
done

for p in config/git/hooks/claude-session-url.pattern config/claude/hooks/guard-session-url.sh; do
  if ! refused "$work/other" "$p"; then fail "unrelated repo: like-named $p was not refused by the hook"; fi
done

echo "PASS - session-URL pre-commit exemption"
