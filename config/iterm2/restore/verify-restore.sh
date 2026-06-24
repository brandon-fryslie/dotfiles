#!/usr/bin/env bash
# Post-restore acceptance check for the iTerm2->tmux reconnect feature
# (dotfiles-iterm2-restore-5k5.6 / re-runs audit dotfiles-iterm2-restore-pg4).
# Run this AFTER a real iTerm2 quit+reopen or a full reboot. It turns the manual
# acceptance criteria into a deterministic pass/fail so "did the restore work" is
# a checked fact, not a vibe. [LAW:verifiable-goals] Each check is loud; any
# failure exits non-zero. [LAW:no-silent-failure]
#
# Overridable for testing: HOME (log + resurrect paths), PATH (stub tmux).
set -uo pipefail

LOG="$HOME/.iterm-restore.log"
RESURRECT_DIR="$HOME/.local/share/tmux/resurrect"
FRESH_SECS="${VERIFY_FRESH_SECS:-1800}"   # a save older than this is "stale"

fails=0
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; fails=$((fails+1)); }
hdr()  { printf '\n== %s ==\n' "$1"; }

hdr "1. continuum save is fresh (prerequisite — see 5k5.7)"
newest=$(ls -t "$RESURRECT_DIR"/tmux_resurrect_*.txt 2>/dev/null | head -1)
if [ -z "$newest" ]; then
  fail "no resurrect save found in $RESURRECT_DIR"
else
  now=$(date +%s); mtime=$(stat -f %m "$newest" 2>/dev/null || stat -c %Y "$newest")
  age=$(( now - mtime ))
  if [ "$age" -le "$FRESH_SECS" ]; then pass "newest save is ${age}s old ($newest)"
  else fail "newest save is ${age}s old (> ${FRESH_SECS}s) — continuum likely not saving (5k5.7); restore would be stale"; fi
fi

hdr "2. race fix: @cwd_restore_done was set (no stuck flag)"
done_flag=$(tmux show -gv @cwd_restore_done 2>/dev/null)
if [ "$done_flag" = 1 ]; then pass "@cwd_restore_done == 1"
else fail "@cwd_restore_done == '${done_flag}' (expected 1; the post-restore-all hook did not fire)"; fi
# The OLD broken flag must be gone entirely.
old_flag=$(tmux show -gv @cwd_restoring 2>/dev/null)
if [ -z "$old_flag" ]; then pass "old @cwd_restoring is gone (no dual flag)"
else fail "old @cwd_restoring still present ('${old_flag}') — stale config"; fi

hdr "3. no tab hung: every restore proceeded, none timed out"
if [ ! -f "$LOG" ]; then
  fail "no restore log at $LOG (did any restored tab run restore_main?)"
else
  # grep -c always prints a count (0 if none); its non-zero exit on 0 matches is
  # expected, so do NOT add a fallback echo (that would double-print).
  n=$(grep -c 'wait=' "$LOG" 2>/dev/null); n=${n:-0}
  timeouts=$(grep -c 'wait=timeout' "$LOG" 2>/dev/null); timeouts=${timeouts:-0}
  warnings=$(grep -c 'WARNING' "$LOG" 2>/dev/null); warnings=${warnings:-0}
  [ "$n" -ge 1 ] && pass "$n restore line(s) logged" || fail "no 'wait=' lines logged"
  [ "$timeouts" -eq 0 ] && pass "0 timeouts (the original 120s hang did not recur)" || fail "$timeouts tab(s) hit the timeout"
  [ "$warnings" -eq 0 ] && pass "0 WARNING lines" || fail "$warnings WARNING line(s) in log"
fi

hdr "4. no project tab stranded in \$HOME"
if [ -f "$LOG" ]; then
  # A tab whose target is a real project (not 'default') must not have cd'd to $HOME.
  stranded=$(awk -v home="$HOME" '/target=/{ if (index($0,"cwd="home" ") && $0 !~ /target=default /) c++ } END{print c+0}' "$LOG")
  [ "$stranded" -eq 0 ] && pass "no project tab landed in \$HOME" || fail "$stranded project tab(s) stranded in \$HOME"
else
  printf '  SKIP  (no log)\n'
fi

hdr "5. restored session count is plausible vs the save"
if [ -n "${newest:-}" ]; then
  saved=$(awk -F'\t' '$1=="window"{print $2}' "$newest" | sort -u | grep -c .)
  live=$(tmux list-sessions 2>/dev/null | grep -c .)
  printf '  INFO  saved sessions=%s  live sessions=%s\n' "$saved" "$live"
  if [ "$live" -ge "$saved" ] && [ "$saved" -gt 0 ]; then pass "live ($live) >= saved ($saved)"
  else fail "live ($live) < saved ($saved) — sessions missing after restore"; fi
else
  printf '  SKIP  (no save to compare)\n'
fi

printf '\n========================================\n'
if [ "$fails" -eq 0 ]; then
  printf 'RESULT: PASS — restore verified. Safe to remove the old restore-join.zsh and close 5k5.6 / audit pg4.\n'
  exit 0
fi
printf 'RESULT: FAIL — %s check(s) failed. Do NOT delete the old implementation; file follow-ups.\n' "$fails"
exit 1
