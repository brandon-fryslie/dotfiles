#!/usr/bin/env bash
# How tmux-sender-info finds the session transcript: by session id under any project dir
# of $CLAUDE_CONFIG_DIR (or ~/.claude only when that is unset or empty), the same rule
# share-slop.sh applies. A lookup that fails still prints the directory-only line and
# exits 0, since the line is advisory, but says why on stderr; several copies of one id
# are refused with every path named rather than one picked.
#
# HOME, the config dir, and the cwd are all temp dirs, so no real transcript is read.
# The script runs under both the bash on PATH and macOS /bin/bash 3.2.
#
# Run: tests/tmux-sender-info.sh
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
script="$repo/config/claude/skills/tmux-shared/bin/tmux-sender-info"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/cwd" "$work/shim"

session=11111111-2222-3333-4444-555555555555

fail() { echo "FAIL - $*" >&2; exit 1; }

# transcript ROOT [PROJECT] : writes a transcript with one main-thread assistant turn
# (12k tokens of context, model "fixture-model") under ROOT/projects/PROJECT.
transcript() {
  local dir="$1/projects/${2:--Users-someone-elsewhere}"
  mkdir -p "$dir"
  echo '{"type":"assistant","message":{"model":"fixture-model","usage":{"input_tokens":1000,"cache_read_input_tokens":9000,"cache_creation_input_tokens":1500,"output_tokens":500}}}' \
    >"$dir/$session.jsonl"
}

# reset : empties HOME and the config dir.
reset() {
  rm -rf "$work/home" "$work/config"
  mkdir "$work/home" "$work/config"
}

# run [VAR=VALUE...] : runs the script from the temp cwd under $bash, leaving status in
# $rc and output in $work/{out,err}. $bash is also first on PATH, so claude-transcript,
# which runs by its env-bash shebang, runs under the same bash.
run() {
  rc=0
  ln -sf "$(command -v "$bash")" "$work/shim/bash"
  (cd "$work/cwd" && env -u CLAUDE_CONFIG_DIR -u CLAUDE_CODE_SESSION_ID HOME="$work/home" \
    PATH="$work/shim:$PATH" "$@" "$bash" "$script") >"$work/out" 2>"$work/err" || rc=$?
}

# reads CASE : the line carries the fixture's model and context, with nothing on stderr.
reads() {
  [ "$rc" -eq 0 ] || fail "$1: exit $rc: $(cat "$work/err")"
  grep -qF 'fixture-model · 12k tokens of context · ' "$work/out" \
    || fail "$1: line lacks the usage: $(cat "$work/out")"
  [ ! -s "$work/err" ] || fail "$1: stderr not empty: $(cat "$work/err")"
}

# directory_only CASE : exit 0 and the line is the working directory alone.
directory_only() {
  [ "$rc" -eq 0 ] || fail "$1: exit $rc: $(cat "$work/err")"
  [ "$(cat "$work/out")" = "$work/cwd" ] || fail "$1: line is not the directory alone: $(cat "$work/out")"
}

# reports CASE TEXT : stderr names TEXT.
reports() {
  grep -qF "$2" "$work/err" || fail "$1: stderr does not name $2: $(cat "$work/err")"
}

for bash in bash /bin/bash; do
  reset; transcript "$work/config"
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR="$work/config"
  reads "$bash: CLAUDE_CONFIG_DIR set"

  reset; transcript "$work/home/.claude"
  run CLAUDE_CODE_SESSION_ID="$session"
  reads "$bash: CLAUDE_CONFIG_DIR unset"

  reset; transcript "$work/home/.claude"
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR=
  reads "$bash: CLAUDE_CONFIG_DIR empty"

  reset; transcript "$work/config"
  printf '%s\n' '{"type":"assistant","message":"oops"}' '{"type":"assistant","message":{"usage":"x"}}' 'half a li' \
    >>"$work/config/projects/-Users-someone-elsewhere/$session.jsonl"
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR="$work/config"
  reads "$bash: malformed and oddly shaped lines after the last good turn"

  reset; mkdir -p "$work/config/projects/-p"
  echo '{"type":"user","message":{"content":"hi"}}' >"$work/config/projects/-p/$session.jsonl"
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR="$work/config"
  directory_only "$bash: transcript with no assistant turn"
  reports "$bash: transcript with no assistant turn" "no main-thread assistant turn"

  reset; transcript "$work/config" -a; transcript "$work/config" -b
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR="$work/config"
  directory_only "$bash: two transcripts for one session"
  reports "$bash: two transcripts for one session" "$work/config/projects/-a/$session.jsonl"
  reports "$bash: two transcripts for one session" "$work/config/projects/-b/$session.jsonl"

  reset; transcript "$work/home/.claude"
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR="$work/config"
  directory_only "$bash: transcript only under ~/.claude with CLAUDE_CONFIG_DIR set"
  reports "$bash: transcript only under ~/.claude with CLAUDE_CONFIG_DIR set" "$work/config/projects"

  reset; transcript "$work/config"; chmod 000 "$work/config/projects/-Users-someone-elsewhere/$session.jsonl"
  run CLAUDE_CODE_SESSION_ID="$session" CLAUDE_CONFIG_DIR="$work/config"
  directory_only "$bash: unreadable transcript"
  reports "$bash: unreadable transcript" "$session.jsonl"
  chmod 644 "$work/config/projects/-Users-someone-elsewhere/$session.jsonl"

  reset
  run
  directory_only "$bash: no session id"
  [ ! -s "$work/err" ] || fail "$bash: no session id: stderr not empty: $(cat "$work/err")"
done

echo "PASS - tmux-sender-info transcript lookup"
