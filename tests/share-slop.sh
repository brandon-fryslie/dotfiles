#!/usr/bin/env bash
# Where share-slop.sh looks for the session transcript: under $CLAUDE_CONFIG_DIR when it is
# set, under ~/.claude only when it is unset or empty, and never under ~/.claude as a
# fallback. The transcript is found by session id, whatever project dir holds it, so the
# fixture's project dir deliberately has nothing to do with the cwd the script runs from.
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

mkdir "$work/bin" "$work/cwd"
cat >"$work/bin/curl" <<'SH'
#!/bin/sh
cat >"$CURL_BODY"
echo '{"draftId":"x","url":"/?draft=x"}'
SH
printf '#!/bin/sh\n' >"$work/bin/open"
chmod +x "$work/bin/curl" "$work/bin/open"

session=11111111-2222-3333-4444-555555555555

fail() { echo "FAIL - $*" >&2; exit 1; }

# transcript ROOT [PROJECT] : writes a main transcript and one subagent transcript under
# ROOT/projects/PROJECT (default: a project dir unrelated to the cwd).
transcript() {
  local dir="$1/projects/${2:--Users-someone-elsewhere}"
  mkdir -p "$dir/$session/subagents"
  echo '{"type":"user","marker":"main-transcript"}' >"$dir/$session.jsonl"
  echo '{"agentId":"a1","isSidechain":true,"marker":"subagent-transcript"}' \
    >"$dir/$session/subagents/agent-a1.jsonl"
}

# reset : empties HOME and the config dir and forgets the last upload.
reset() {
  rm -rf "$work/home" "$work/config" "$work/body"
  mkdir "$work/home" "$work/config"
}

# run [VAR=VALUE...] : runs the script from the temp cwd, leaving status in $rc and
# output in $work/{out,err,body}.
run() {
  rc=0
  (cd "$work/cwd" && env -u CLAUDE_CONFIG_DIR PATH="$work/bin:$PATH" HOME="$work/home" \
    CLAUDE_CODE_SESSION_ID="$session" CURL_BODY="$work/body" "$@" \
    bash "$script") >"$work/out" 2>"$work/err" || rc=$?
}

# uploads CASE : the run succeeded and the POSTed body carries both transcripts.
uploads() {
  [ "$rc" -eq 0 ] || fail "$1: exit $rc: $(cat "$work/err")"
  grep -q 'main-transcript' "$work/body" || fail "$1: body lacks the main transcript"
  grep -q 'subagent-transcript' "$work/body" || fail "$1: body lacks the subagent transcript"
}

# refuses CASE TEXT : the run failed, uploaded nothing, and stderr names TEXT.
refuses() {
  [ "$rc" -ne 0 ] || fail "$1: exited 0"
  [ ! -e "$work/body" ] || fail "$1: uploaded"
  grep -qF "$2" "$work/err" || fail "$1: stderr does not name $2: $(cat "$work/err")"
}

reset; transcript "$work/config"
run CLAUDE_CONFIG_DIR="$work/config"
uploads "CLAUDE_CONFIG_DIR set"

reset; transcript "$work/home/.claude"
run
uploads "CLAUDE_CONFIG_DIR unset"

reset; transcript "$work/home/.claude"
run CLAUDE_CONFIG_DIR=
uploads "CLAUDE_CONFIG_DIR empty"

reset; transcript "$work/home/.claude"
run CLAUDE_CONFIG_DIR="$work/config"
refuses "transcript only under ~/.claude with CLAUDE_CONFIG_DIR set" "$work/config/projects"

reset; transcript "$work/config" -a; transcript "$work/config" -b
run CLAUDE_CONFIG_DIR="$work/config"
refuses "two transcripts for one session" "$work/config/projects/-a/$session.jsonl"
refuses "two transcripts for one session" "$work/config/projects/-b/$session.jsonl"

echo "PASS - share-slop transcript lookup"
