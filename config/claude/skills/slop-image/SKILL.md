---
name: slop-image
description: Generate an image from a text prompt and save it as a local file. Use this skill whenever the user asks to "generate an image", "make an image of", "create a picture", "I need an image", "render an image locally", "generate a picture of X", "make me an image", "produce an image", or wants an AI-generated image saved to disk. Runs directly from this machine against fal.ai / Replicate — no application backend, nothing posted anywhere — and prints the absolute path(s) of the saved file(s). Encapsulates the API keys and the knowledge of which image-gen APIs exist and how to call them, so the calling project never has to learn image generation.
---

# slop-image

Generate an image from a prompt and save it to a local file. One script, three
providers, selected by flag. Default provider is fast and cheap. The image is
**never** posted anywhere — it is downloaded and written to disk, and the
absolute path is printed.

```bash
SLOP_IMAGE=~/.claude/skills/slop-image/bin/slop-image
```

## Usage

```bash
slop-image "<prompt>" \
  [--provider fal-flux|replicate-sdxl|replicate-ideogram] \
  [--aspect 1:1|16:9|9:16|4:3|3:4] \
  [--count N] \
  [--out FILE_OR_DIR]
```

- **prompt** (required) — the image description.
- **--provider** (default `fal-flux`) — see table below.
- **--aspect** (default `1:1`) — one of the 5 supported ratios.
- **--count** (default `1`) — how many images to generate.
- **--out** (default `~/Pictures/slop`) — a directory (filename auto-named from
  prompt + short hash + extension) or, for a single image, an explicit file path.

The script prints each saved absolute path to **stdout**, one per line. A short
status line (provider, aspect, key source) goes to **stderr**. On any provider
or download failure it exits non-zero with the real upstream error — no silent
fallback to another provider, no swallowed errors.

### Examples

```bash
slop-image "a neon-lit ramen stall in the rain, cinematic"

slop-image "brutalist concrete library at golden hour" \
  --provider replicate-sdxl --aspect 16:9 --out ~/Desktop/library.png

slop-image "vintage travel poster that says GREETINGS FROM MARS" \
  --provider replicate-ideogram --aspect 4:3 --count 2 --out ./out
```

## Providers

The call patterns are reproduced faithfully from SlopSpot's provider
implementations (`/Users/bmf/code/slopspot-web/app/providers/`). Callers never
need to know any of this — it is encapsulated in the script.

| `--provider`         | Model                     | Mechanism                                   | Aspect mapping                  | ~cost  |
|----------------------|---------------------------|---------------------------------------------|----------------------------------|--------|
| `fal-flux` (default) | fal.ai FLUX schnell       | `fal.run/<id>` synchronous REST             | canonical → fal `image_size` enum| ~$0.003|
| `replicate-sdxl`     | Replicate SDXL            | `/v1/predictions` + `Prefer:wait` + poll    | canonical → explicit `width`/`height` | ~$0.0035|
| `replicate-ideogram` | Replicate Ideogram v2 Turbo | `/v1/predictions` + `Prefer:wait` + poll  | canonical → native `aspect_ratio` enum | ~$0.025|

- **fal-flux** — fast, cheap, photographic. The good default. 4 inference steps
  (schnell's max). Synchronous endpoint returns the image URL directly.
- **replicate-sdxl** — painterly. Sends explicit pixel dims per ratio; pinned
  model version; output is a one-element URL array.
- **replicate-ideogram** — strong typography / designed-flat aesthetics. Pinned
  version; output is a single URL string.

Replicate providers create a prediction (with `Prefer: wait=60` for the common
fast case), then poll `urls.get` every 2s up to 30 times until terminal.

## Keys

Read from the macOS Keychain (canonical), never hardcoded, never printed:

- fal: `security find-generic-password -s slopspot-fal-api-key -w`
- replicate: `security find-generic-password -s slopspot-replicate-api-key -w`

If a Keychain lookup fails, the script falls back to
`/Users/bmf/code/slopspot-web/.dev.vars` (`SLOPSPOT_FAL_API_KEY` /
`SLOPSPOT_REPLICATE_API_KEY`) and prints a WARNING to stderr saying it did so.
If neither source has the key, it exits with a clear fatal error.

## Runtime & setup

- Python via **`uv`**. The wrapper runs `uv run` with an inline dependency
  declaration (`requests`), so the only one-time requirement is that `uv` is
  installed (`/opt/homebrew/bin/uv`). No virtualenv to manage, no
  `pip install`, no JS toolchain.
- Optional: add `~/.claude/skills/slop-image/bin` to `PATH`, or call the wrapper
  by its full path.

## How to invoke from a session

```bash
~/.claude/skills/slop-image/bin/slop-image "your prompt here"
```

Capture the printed path to use the file downstream (attach, open, move, etc.).
