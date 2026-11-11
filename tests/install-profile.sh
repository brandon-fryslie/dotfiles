#!/usr/bin/env bash
# Which dotbot configs ./install runs for each profile argument, and that a bad one runs none.
#
# A stub `uvx` first on PATH records each call's argv instead of installing. An unknown or
# empty profile, or more than one argument, exits nonzero before any call, with the error
# and usage on stderr and nothing on stdout; -h/--help exit 0 with no call; no argument
# means home.
#
# Run: tests/install-profile.sh
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/bin"
cat >"$work/bin/uvx" <<'SH'
#!/usr/bin/env bash
echo "$*" >>"$UVX_LOG"
SH
chmod +x "$work/bin/uvx"

fail() { echo "FAIL - $*" >&2; exit 1; }

# run ARGS... : runs ./install, leaving status in $rc and output in $work/{out,err,calls}.
run() {
  : >"$work/calls"
  rc=0
  PATH="$work/bin:$PATH" UVX_LOG="$work/calls" "$repo/install" "$@" \
    >"$work/out" 2>"$work/err" || rc=$?
}

expect_calls() {
  local label=$1; shift
  local want; want=$(printf "dotbot -d $repo -c install-%s.conf.yaml\n" "$@")
  [ "$rc" -eq 0 ] || fail "$label: exit $rc: $(cat "$work/err")"
  [ "$(cat "$work/calls")" = "$want" ] || fail "$label: ran [$(tr '\n' ' ' <"$work/calls")], want [$(echo $want)]"
}

expect_rejected() {
  local label=$1
  [ "$rc" -ne 0 ] || fail "$label: exited 0"
  [ ! -s "$work/out" ] || fail "$label: wrote to stdout: $(cat "$work/out")"
  grep -q '^install: ' "$work/err" || fail "$label: stderr lacks the error: $(cat "$work/err")"
  grep -q 'Usage:' "$work/err" || fail "$label: stderr lacks usage: $(cat "$work/err")"
  [ ! -s "$work/calls" ] || fail "$label: ran dotbot: $(cat "$work/calls")"
}

run;       expect_calls "no argument" base home rad agent-cli
run home;  expect_calls "home" base home rad agent-cli
run work;  expect_calls "work" base work agent-cli
run base;  expect_calls "base" base

run hoem;  expect_rejected "hoem"
run "";    expect_rejected "empty profile"
run base home; expect_rejected "two profiles"

for flag in -h --help; do
  run "$flag"
  [ "$rc" -eq 0 ] || fail "$flag: exit $rc"
  grep -q 'Usage:' "$work/out" || fail "$flag: usage not on stdout"
  [ ! -s "$work/calls" ] || fail "$flag: ran dotbot"
done

echo "PASS - install profile selection"
