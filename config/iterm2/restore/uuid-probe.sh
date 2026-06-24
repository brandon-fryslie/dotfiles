#!/usr/bin/env bash
# GATE probe for dotfiles-iterm2-restore-5k5.1: is the iTerm2 session UUID
# (ITERM_SESSION_ID, the part after the last colon) stable across an iTerm2
# quit+reopen? The whole UUID-keyed carrier design (5k5.3) rides on YES.
#
# Why a probe instead of a one-shot check: the verifier runs *inside* iTerm2, so
# it cannot force the quit+reopen without killing itself. Instead it records a
# snapshot of (iTerm2 launch epoch, live session UUIDs) each run. iTerm2's launch
# epoch changes on every quit+reopen and every reboot, so it tags "which life of
# the app" a UUID was seen in. A UUID observed under TWO distinct launch epochs
# survived a restart -> the answer is YES, recorded, no forced reboot needed.
# [LAW:verifiable-goals] deterministic, re-runnable, self-recording.
#
# Usage:
#   uuid-probe.sh record   # snapshot current launch's live UUIDs (idempotent per launch)
#   uuid-probe.sh check    # report YES/NO/INCONCLUSIVE from the accumulated log
#   uuid-probe.sh show     # dump the raw log grouped by launch
set -euo pipefail

LOG="${ITERM_UUID_PROBE_LOG:-$HOME/.local/state/iterm-restore/uuid-probe.tsv}"

die() { printf 'uuid-probe: %s\n' "$*" >&2; exit 1; }

# Effect boundary: the current iTerm2 launch epoch (seconds). Empty => not running.
iterm_launch_epoch() {
  local pid lstart
  pid=$(pgrep -x iTerm2 | head -1) || true
  [[ -n $pid ]] || die "iTerm2 is not running; cannot probe"
  lstart=$(ps -o lstart= -p "$pid") || die "could not read iTerm2 start time"
  date -j -f "%c" "$lstart" +%s 2>/dev/null || die "could not parse iTerm2 start time: $lstart"
}

# Effect boundary: live iTerm2 session GUIDs (one per line), via AppleScript.
live_uuids() {
  osascript -e 'tell application "iTerm2"
    set out to ""
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          set out to out & (id of s) & linefeed
        end repeat
      end repeat
    end repeat
    return out
  end tell' 2>/dev/null || die "AppleScript query to iTerm2 failed"
}

cmd_record() {
  local epoch uuids n
  epoch=$(iterm_launch_epoch)
  uuids=$(live_uuids)
  [[ -n ${uuids//[[:space:]]/} ]] || die "no live iTerm2 sessions found (refusing to record an empty snapshot)"
  mkdir -p "$(dirname "$LOG")"
  n=0
  while IFS= read -r u; do
    [[ -n $u ]] || continue
    # idempotent per (launch,uuid): skip if this pair is already logged
    if ! grep -qF "	$epoch	$u" "$LOG" 2>/dev/null; then
      printf '%s\t%s\t%s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$epoch" "$u" >> "$LOG"
    fi
    n=$((n+1))
  done <<< "$uuids"
  printf 'recorded %d live UUID(s) under iTerm2 launch epoch %s\n' "$n" "$epoch"
  printf 'log: %s\n' "$LOG"
}

cmd_check() {
  [[ -f $LOG ]] || die "no probe log yet at $LOG (run: uuid-probe.sh record)"
  local n_launches survivors
  n_launches=$(cut -f2 "$LOG" | sort -u | grep -c . || true)
  # A UUID seen under >=2 distinct launch epochs survived a restart.
  survivors=$(
    awk -F'\t' '
      { key=$3 SUBSEP $2; if(!(key in pair)){ pair[key]=1; cnt[$3]++ } }
      END{ for(u in cnt) if(cnt[u]>=2) print u" (seen in "cnt[u]" launches)" }' "$LOG"
  )
  printf 'distinct iTerm2 launches recorded: %s\n' "$n_launches"
  if [[ -n $survivors ]]; then
    printf 'RESULT: YES — UUID survives iTerm2 restart. Recorded survivors:\n%s\n' "$survivors"
    return 0
  fi
  if [[ ${n_launches:-0} -lt 2 ]]; then
    printf 'RESULT: INCONCLUSIVE — only %s launch recorded. Re-run `record` after the next iTerm2 quit+reopen.\n' "$n_launches"
    return 2
  fi
  printf 'RESULT: NO — across %s launches, no UUID reappeared. The carrier must NOT key on ITERM_SESSION_ID.\n' "$n_launches"
  return 1
}

cmd_show() {
  [[ -f $LOG ]] || die "no probe log yet at $LOG"
  sort -t'	' -k2,2 -k1,1 "$LOG"
}

case "${1:-}" in
  record) cmd_record ;;
  check)  cmd_check ;;
  show)   cmd_show ;;
  *) die "usage: uuid-probe.sh {record|check|show}" ;;
esac
