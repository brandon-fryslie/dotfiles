#!/usr/bin/env bash
# What the codex screenshot skill's ensure_macos_permissions.sh reports for each answer its
# permission helper can give, and that a failing helper is never reported as "not granted".
#
# A stub `swift` first on PATH stands in for macos_permissions.swift, answering per
# $SWIFT_MODE; a stub `uname` says Darwin so the test runs anywhere python3 does. The script
# is run as `bash <script>`, the way SKILL.md and take_screenshot.py run it.
#
# Run: tests/screenshot-permissions.sh
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd -P)
script="$repo/config/codex/skills/screenshot/scripts/ensure_macos_permissions.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/bin"
printf '#!/bin/sh\necho Darwin\n' >"$work/bin/uname"
cat >"$work/bin/swift" <<'SH'
#!/usr/bin/env bash
requested=false
for a in "$@"; do [ "$a" != --request ] || requested=true; done
case "$SWIFT_MODE" in
  fail) echo "swift-stub: helper failed to compile" >&2; exit 1 ;;
  granted) granted=true ;;
  denied) granted=false ;;
  # Granted from the --request call on, as when the user approves the system prompt.
  after-request)
    if $requested; then : >"$SWIFT_STATE"; fi
    if [ -e "$SWIFT_STATE" ]; then granted=true; else granted=false; fi ;;
esac
printf '{"requested":%s,"screenCapture":%s}\n' "$requested" "$granted"
SH
chmod +x "$work/bin/uname" "$work/bin/swift"

fail() { echo "FAIL - $*" >&2; exit 1; }

# run MODE : runs the script against the stub, leaving status in $rc and output in $work/{out,err}.
run() {
  rm -f "$work/state"
  rc=0
  env -u CODEX_SANDBOX PATH="$work/bin:$PATH" SWIFT_MODE="$1" SWIFT_STATE="$work/state" \
    bash "$script" >"$work/out" 2>"$work/err" || rc=$?
}

run fail
[ "$rc" -ne 0 ] || fail "failing helper: exited 0"
grep -q 'swift-stub: helper failed to compile' "$work/err" || fail "failing helper: stderr lacks the helper's error: $(cat "$work/err")"
! grep -qi 'not granted' "$work/out" "$work/err" || fail "failing helper: reported as not granted"

run granted
[ "$rc" -eq 0 ] || fail "granted: exit $rc: $(cat "$work/err")"
grep -q 'already granted' "$work/out" || fail "granted: stdout: $(cat "$work/out")"

run denied
[ "$rc" -eq 2 ] || fail "denied: exit $rc, want 2: $(cat "$work/err")"
grep -q 'still not granted' "$work/out" || fail "denied: stdout: $(cat "$work/out")"

run after-request
[ "$rc" -eq 0 ] || fail "after-request: exit $rc: $(cat "$work/err")"
grep -q '^Screen Recording permission granted.$' "$work/out" || fail "after-request: stdout: $(cat "$work/out")"

echo "PASS - screenshot permission check"
