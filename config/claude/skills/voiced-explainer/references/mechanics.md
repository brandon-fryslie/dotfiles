# Mechanics

Lookup material for building and shipping a voiced explainer. Read the section you need.

## Rendering the audio

```
scripts/voice.sh <clips.json> <out-dir> [voice]
```

`clips.json` is `[["clip-id", "text as it should be SPOKEN"], ...]`. The script loads the model
once for the whole file, renders to WAV, encodes to MP3, and prints a duration/size table. It
exits non-zero and names the clips if any rendered as near-silence.

Pinned to `pocket-tts==3.1.0`, seeded, and the voice state is encoded once — the same
`clips.json` and voice give the same audio every run.

**Spoken text is not displayed text.** The model reads what is written, so digits, symbols and
abbreviations are spelled out in `clips.json` while the page shows the short form:

| page shows | clips.json holds |
|---|---|
| `Tap 14` | `Tap fourteen.` |
| `macOS 10.15` | `macOS ten point fifteen.` |
| `~40ms` | `about forty milliseconds.` |

Straight sentences with commas and periods read best. Quotation marks, em dashes and
parentheses inside the spoken text produce odd prosody — write the pause as punctuation the
model understands, or split the clip.

Voices (English): `alba` (default), `cosette`, `marius`, `javert`, `jean`, `anna`, `vera`,
`fantine`, `charles`, `paul`, `eponine`, `azelma`, `george`, `mary`, `jane`, `michael`, `eve`,
`bill_boerst`, `peter_yearsley`, `stuart_bell`, `caro_davy`. One voice per page unless two
speakers carry meaning (a contrast, a dialogue) — a voice change the subject does not justify
reads as a glitch.

Cost: first run downloads the model (about a minute). After that, load is a few seconds and
generation runs ~5x faster than real time on a laptop CPU.

## Shipping the audio with the page

**MP3 only.** The Artifact publisher refuses `audio/mp4`, and the whole publish fails:

```
supporting file "a/x.m4a": contentType "audio/mp4" is not servable (nothing was published)
```

`voice.sh` already writes MP3. If you re-encode by hand, keep it MP3 — the failure lands after
the page is finished and says nothing about what to use instead.

Publish the audio as supporting files, referenced by relative path with no leading slash:

```
Artifact(
  file_path = "<page>.html",
  root      = "<build dir>",
  files     = {"a/n-open.mp3": "mp3/n-open.mp3", ...},   # published path: source path
  favicon   = "<emoji>",
  description = "<one sentence>",
)
```

Do **not** inline the audio as `data:` URIs. Base64 costs a third more bytes against the page's
own 16MB cap, and a two-minute narration plus twenty phrases is already over a megabyte as
files. Do **not** fetch audio from a CDN either — the artifact CSP blocks every external media
request, silently.

## The page's audio contract

One `<audio>` element, and every playable thing carries `data-clip="<clip-id>"`:

```html
<audio id="au" preload="none"></audio>
<button class="say"    data-clip="c-tap-send">Tap Send</button>
<button class="listen" data-clip="n-ladder" aria-pressed="false">Listen</button>
```

```js
au.src = 'a/' + clip + '.mp3';
au.play().catch(function(){ stop(); /* browser wants a gesture first — say so in the UI */ });
```

A blocked autoplay must reset whatever queue is running, or a "play all" sequence stalls with
no way to finish. Give every clip button a real accessible name (`Hear the command: Tap Send`),
and drive the play-all queue off the `ended` event.

## Artifact CSP, in one place

- **Fonts**: stylesheets only from `fonts.googleapis.com`, files from `fonts.gstatic.com`.
- **Scripts**: only `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com`,
  `code.jquery.com` — UMD builds, pinned versions, placed before the inline script that uses them.
- **Everything else is blocked with no visible error**: other hosts, all external images, media,
  stylesheets, fetch/XHR/WebSocket. Ship it with the page or inline it.

## Checks before delivering

```bash
# every clip the page references has audio, and every file is referenced
# the character class is not [^"]* on purpose: that also matches the script's own
# data-clip="' + clip + '" selector strings and reports two phantom clips.
grep -o 'data-clip="[a-z0-9-]\{1,\}"' page.html | sed 's/.*"\(.*\)"/\1/' | sort -u > /tmp/want
ls a/*.mp3 | xargs -n1 basename | sed 's/\.mp3$//' | sort -u > /tmp/have
diff /tmp/want /tmp/have && echo "audio complete"
```

Then confirm the narration total matches whatever duration the page claims in its own copy.
