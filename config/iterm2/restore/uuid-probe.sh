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
# The two verdicts do not rest on the same footing, and the tool must not pretend
# they do. A UUID appearing under two launches can only have been restored, so YES
# stands on its own. Absence proves nothing by itself: a tab closed by hand in June
# is equally absent today. A NO therefore means something only when the snapshot it
# is measured against WAS the state at the moment iTerm2 quit — so `check` reports
# NO only when the previous snapshot was armed just before this launch began, and
# says INCONCLUSIVE otherwise instead of guessing. (Before this rule existed the
# check compared a June snapshot to a September launch across 8 reboots and printed
# a confident NO, which by the carrier's own gate would have killed a sound design.)
#
# Usage:
#   uuid-probe.sh record   # snapshot current launch's live UUIDs (idempotent per launch)
#                          # ARM: run this immediately before quitting iTerm2
#   uuid-probe.sh check    # report YES/NO/INCONCLUSIVE from the accumulated log
#   uuid-probe.sh show     # dump the raw log grouped by launch
set -euo pipefail

LOG="${ITERM_UUID_PROBE_LOG:-$HOME/.local/state/iterm-restore/uuid-probe.tsv}"
# How long before this launch started a snapshot may have been taken and still count
# as "armed": the gap between running `record` and iTerm2 coming back up.
ARM_WINDOW="${ITERM_UUID_PROBE_ARM_WINDOW:-1800}"

die() { printf 'uuid-probe: %s\n' "$*" >&2; exit 1; }

# Epoch seconds for a log row's ISO-8601 record time (column 1).
iso_to_epoch() {
  date -j -f "%Y-%m-%dT%H:%M:%S" "$1" +%s 2>/dev/null || die "unparseable log timestamp: $1"
}

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
  local cur n_launches survivors armed_iso armed_epoch gap
  cur=$(iterm_launch_epoch)
  n_launches=$(cut -f2 "$LOG" | sort -u | grep -c . || true)
  printf 'distinct iTerm2 launches recorded: %s\n' "$n_launches"

  # A UUID under two launch epochs can only have got there by being restored, so
  # this arm needs no assumption about which launches those were.
  survivors=$(
    awk -F'\t' '
      { key=$3 SUBSEP $2; if(!(key in pair)){ pair[key]=1; cnt[$3]++ } }
      END{ for(u in cnt) if(cnt[u]>=2) print u" (seen in "cnt[u]" launches)" }' "$LOG"
  )
  if [[ -n $survivors ]]; then
    printf 'RESULT: YES — UUID survives iTerm2 restart. Recorded survivors:\n%s\n' "$survivors"
    return 0
  fi

  # Nothing reappeared. Whether that is evidence depends entirely on when the
  # newest earlier snapshot was taken, so establish that before naming a verdict.
  armed_iso=$(awk -F'\t' -v cur="$cur" '$2 != cur {print $1}' "$LOG" | sort | tail -1)
  if [[ -z $armed_iso ]]; then
    printf 'RESULT: INCONCLUSIVE — this launch (%s) is the only one recorded.\n' "$cur"
    printf '  Arm it: `record` immediately before quitting iTerm2, then `record` && `check` in the next launch.\n'
    return 2
  fi
  armed_epoch=$(iso_to_epoch "$armed_iso")
  gap=$(( cur - armed_epoch ))
  if (( gap < 0 || gap > ARM_WINDOW )); then
    printf 'RESULT: INCONCLUSIVE — newest earlier snapshot (%s) predates this launch by %ss, outside the %ss arming window.\n' \
      "$armed_iso" "$gap" "$ARM_WINDOW"
    printf '  Those tabs were closed normally somewhere in between, so their absence now says nothing about UUID stability.\n'
    printf '  Arm it: `record` immediately before quitting iTerm2, then `record` && `check` in the next launch.\n'
    return 2
  fi
  printf 'RESULT: NO — snapshot armed %ss before this launch and no UUID reappeared. The carrier must NOT key on ITERM_SESSION_ID.\n' "$gap"
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
