#!/usr/bin/env bash
# Render a clips.json into the page's audio directory, as MP3, and report what came out.
#
#   voice.sh <clips.json> <out-dir> [voice]
#
# MP3 because the Artifact publisher refuses audio/mp4: an .m4a supporting file fails the
# whole publish with `contentType "audio/mp4" is not servable`, at the very end, after the
# page is built. Nothing about the page is wrong when that happens — only the container.
#
# Needs `uv` (which brings pocket-tts and torch) and `ffmpeg`. First run downloads the model
# (~1 min); after that the load is a few seconds and generation runs ~5x faster than real time
# on a laptop CPU, so a two-minute narration renders in well under a minute.
set -euo pipefail

POCKET_TTS="pocket-tts==3.1.0"          # pinned: the voices are states tied to a release
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 2 ]; then
  echo "usage: voice.sh <clips.json> <out-dir> [voice]" >&2
  exit 2
fi
CLIPS="$1"; OUT="$2"; VOICE="${3:-alba}"

[ -r "$CLIPS" ] || { echo "voice.sh: cannot read $CLIPS" >&2; exit 1; }
command -v uv >/dev/null     || { echo "voice.sh: uv is not installed" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "voice.sh: ffmpeg is not installed" >&2; exit 1; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/voiced-explainer.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

uv run --with "$POCKET_TTS" python "$HERE/render.py" "$CLIPS" "$WORK" "$VOICE"

mkdir -p "$OUT"
total=0
count=0
quiet=""
made=" "
printf '\n%-24s %8s %9s\n' "clip" "seconds" "bytes"
for wav in "$WORK"/*.wav; do
  id="$(basename "$wav" .wav)"
  made="$made$id "
  count=$((count + 1))
  mp3="$OUT/$id.mp3"
  ffmpeg -v error -y -i "$wav" -map_metadata -1 -c:a libmp3lame -b:a 56k -ac 1 "$mp3"
  secs="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$mp3")"
  bytes="$(wc -c < "$mp3" | tr -d ' ')"
  printf '%-24s %8.2f %9s\n' "$id" "$secs" "$bytes"
  total="$(awk -v a="$total" -v b="$secs" 'BEGIN{printf "%.2f", a+b}')"
  # A clip that rendered as near-silence is a failed render that still wrote a file.
  peak="$(ffmpeg -i "$mp3" -af volumedetect -f null - 2>&1 | awk -F': ' '/max_volume/{print $2+0}')"
  awk -v p="$peak" 'BEGIN{exit !(p < -30)}' && quiet="$quiet $id"
done

printf '\ntotal %.2fs across %s clips in %s\n' "$total" "$count" "$OUT"

# An earlier run against a different clips.json leaves audio behind that nothing references.
# The page's completeness check would catch it much later; say it here, while the cause is known.
stale=""
for existing in "$OUT"/*.mp3; do
  [ -e "$existing" ] || continue
  id="$(basename "$existing" .mp3)"
  case "$made" in *" $id "*) ;; *) stale="$stale $id" ;; esac
done
[ -n "$stale" ] && echo "voice.sh: note — audio in $OUT left by an earlier run, not in this clips.json:$stale" >&2

if [ -n "$quiet" ]; then
  echo "voice.sh: WARNING — these clips are near-silent and did not render properly:$quiet" >&2
  exit 1
fi
