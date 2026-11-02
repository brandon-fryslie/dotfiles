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

work="$(mktemp -d)"; work="$(cd "$work" && pwd -P)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/home/.config"
ln -s "$real_git" "$work/home/.config/git"
export HOME="$work/home"
unset GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM GIT_CONFIG_PARAMETERS GIT_DIR
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

echo "ok"
