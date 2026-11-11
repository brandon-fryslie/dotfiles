#!/usr/bin/env bash
# Where share-slop.sh looks for the session transcript: under $CLAUDE_CONFIG_DIR when it is
# set, under ~/.claude only when it is not, and never under ~/.claude as a fallback.
#
# A stub `curl` first on PATH records the POSTed body and answers like /api/draft; a stub
# `open` does nothing. HOME, the config dir, and the cwd are all temp dirs, so no real
# transcript is read and nothing is uploaded.
#
# Run: tests/share-slop.sh
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
script="$repo/config/claude/skills/share-slop/share-slop.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/bin" "$work/project"
cat >"$work/bin/curl" <<'SH'
#!/bin/sh
cat >"$CURL_BODY"
echo '{"draftId":"x","url":"/?draft=x"}'
SH
printf '#!/bin/sh\n' >"$work/bin/open"
chmod +x "$work/bin/curl" "$work/bin/open"

session=11111111-2222-3333-4444-555555555555
slug=$(cd "$work/project" && pwd | sed 's|[^A-Za-z0-9]|-|g')

fail() { echo "FAIL - $*" >&2; exit 1; }

# transcript ROOT : writes a main transcript and one subagent transcript under ROOT/projects/<slug>.
transcript() {
  mkdir -p "$1/projects/$slug/$session/subagents"
  echo '{"type":"user","marker":"main-transcript"}' >"$1/projects/$slug/$session.jsonl"
  echo '{"agentId":"a1","isSidechain":true,"marker":"subagent-transcript"}' \
    >"$1/projects/$slug/$session/subagents/agent-a1.jsonl"
}

# run [VAR=VALUE...] : runs the script from the temp project, leaving status in $rc and
# output in $work/{out,err,body}.
run() {
  rm -rf "$work/home" "$work/config" "$work/body"
  mkdir "$work/home" "$work/config"
  "${setup[@]}"
  rc=0
  (cd "$work/project" && env -u CLAUDE_CONFIG_DIR PATH="$work/bin:$PATH" HOME="$work/home" \
    CLAUDE_CODE_SESSION_ID="$session" CURL_BODY="$work/body" "$@" \
    bash "$script") >"$work/out" 2>"$work/err" || rc=$?
}

# uploads CASE : the run succeeded and the POSTed body carries both transcripts.
uploads() {
  [ "$rc" -eq 0 ] || fail "$1: exit $rc: $(cat "$work/err")"
  grep -q 'main-transcript' "$work/body" || fail "$1: body lacks the main transcript"
  grep -q 'subagent-transcript' "$work/body" || fail "$1: body lacks the subagent transcript"
}

setup=(transcript "$work/config")
run CLAUDE_CONFIG_DIR="$work/config"
uploads "CLAUDE_CONFIG_DIR set"

setup=(transcript "$work/home/.claude")
run
uploads "CLAUDE_CONFIG_DIR unset"

setup=(transcript "$work/home/.claude")
run CLAUDE_CONFIG_DIR="$work/config"
[ "$rc" -ne 0 ] || fail "transcript only under ~/.claude with CLAUDE_CONFIG_DIR set: exited 0"
[ ! -e "$work/body" ] || fail "transcript only under ~/.claude with CLAUDE_CONFIG_DIR set: uploaded"
grep -qF "$work/config/projects/$slug/$session.jsonl" "$work/err" \
  || fail "not-found error does not name the CLAUDE_CONFIG_DIR path: $(cat "$work/err")"

echo "PASS - share-slop transcript lookup"
