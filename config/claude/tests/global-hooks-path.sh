#!/usr/bin/env bash
# The global git config this repo installs points git at the session-URL hooks, so a commit
# message carrying a session URL is refused in a repo that sets nothing itself.
#
# Asserted is what a commit does [LAW:behavior-not-structure]: HOME is a throwaway whose
# ~/.config/git is linked to config/git, as install-base.conf.yaml links it, and the commit is
# made in a fresh repo through that config alone.
#
# Run: config/claude/tests/global-hooks-path.sh   (needs git)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
real_git="$here/../../git"
check="$here/../../../bin/check-hooks-path"

work="$(mktemp -d)"; work="$(cd "$work" && pwd -P)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/home/.config"
ln -s "$real_git" "$work/home/.config/git"
export HOME="$work/home"
unset GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM GIT_CONFIG_PARAMETERS GIT_DIR XDG_CONFIG_HOME
export GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail() { echo "FAIL - $*" >&2; cat "$work/last.log" >&2 2>/dev/null; exit 1; }

git init -q "$work/repo"
cd "$work/repo"

[ "$(git config --type=path --get core.hooksPath)" = "$HOME/.config/git/hooks" ] \
  || fail "the installed git config does not set core.hooksPath to the hooks directory"

git commit -q --allow-empty -m "plain message" >"$work/last.log" 2>&1 \
  || fail "a clean commit was refused"

if git commit -q --allow-empty -m "see https://claude.ai/code/session_01ABCDEF" >"$work/last.log" 2>&1; then
  fail "a commit message carrying a session URL was accepted"
fi
grep -q 'COMMIT REFUSED' "$work/last.log" || fail "the commit failed, but not by the hook's refusal"

# Every other hook now routes through this directory too; none of git's ordinary repository
# operations may break on the way.
git clone -q "$work/repo" "$work/clone" >"$work/last.log" 2>&1 || fail "git clone failed under the installed config"
git worktree add -q "$work/wt" -b wt >"$work/last.log" 2>&1 || fail "git worktree add failed under the installed config"
git init -q --bare "$work/bare.git" >"$work/last.log" 2>&1 || fail "git init --bare failed under the installed config"
git push -q "$work/bare.git" HEAD:refs/heads/x >"$work/last.log" 2>&1 || fail "git push failed under the installed config"

# The reporter says so when the effective value is not the installed one: silent when the
# installed config sets it, loud for a repo-local override and for an unset value.
"$check" >"$work/last.log" 2>&1 || fail "the reporter flagged the installed config"

mkdir "$work/elsewhere"
git config --local core.hooksPath "$work/elsewhere"
if "$check" >"$work/last.log" 2>&1; then fail "the reporter accepted a repo-local hooksPath override"; fi
grep -q "$work/elsewhere" "$work/last.log" || fail "the reporter did not name the value in effect"
git config --local --unset core.hooksPath

# Asked about a repo from outside it, the answer is that repo's, not the caller's.
( cd "$work" && "$check" "$work/repo" ) >"$work/last.log" 2>&1 || fail "the reporter flagged the installed config when asked from outside the repo"

# An install that sets nothing: the hooks directory exists, the config that points at it does not.
rm "$HOME/.config/git"
mkdir -p "$HOME/.config/git/hooks"
if "$check" >"$work/last.log" 2>&1; then fail "the reporter accepted an unset hooksPath"; fi
grep -q "unset" "$work/last.log" || fail "the reporter did not say hooksPath is unset"

rmdir "$HOME/.config/git/hooks" "$HOME/.config/git"
if "$check" >"$work/last.log" 2>&1; then fail "the reporter accepted a machine with no hooks installed"; fi
grep -q "no session-URL hooks installed" "$work/last.log" || fail "the reporter did not say nothing is installed"

echo "ok"
