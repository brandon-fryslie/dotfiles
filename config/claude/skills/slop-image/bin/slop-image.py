#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
import argparse
import hashlib
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import requests

# [LAW:one-source-of-truth] SlopSpot owns the provider contract; this script mirrors it.
ASPECT_RATIOS = ("1:1", "16:9", "9:16", "4:3", "3:4")

FAL_IMAGE_SIZE = {
    "1:1": "square_hd",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
}

REPLICATE_DIMS = {
    "1:1": (1024, 1024),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "4:3": (1152, 896),
    "3:4": (896, 1152),
}

IDEOGRAM_ASPECT_RATIO = {r: r for r in ASPECT_RATIOS}

# nano-banana (Gemini 2.5 Flash Image) takes a native aspect_ratio enum;
# verified our 5 canonical ratios pass through unchanged (1:1->1024^2, 16:9->1344x768).
NANO_ASPECT_RATIO = {r: r for r in ASPECT_RATIOS}

SDXL_VERSION = "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc"
IDEOGRAM_VERSION = "7cef9d520d672bb802588ad0d13151bc51aee9a408c270aebf25d6530045dd29"

SDXL_DEFAULT_GUIDANCE = 7.5

REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
POLL_INTERVAL_S = 2
MAX_POLLS = 30

DEFAULT_OUT_DIR = Path.home() / "Pictures" / "slop"


def _dev_vars_lookup(env_key):
    dv = Path("/Users/bmf/code/slopspot-web/.dev.vars")
    if not dv.exists():
        return None
    for line in dv.read_text().splitlines():
        line = line.strip()
        if line.startswith(f"{env_key}="):
            val = line.split("=", 1)[1].strip().strip('"').strip("'")
            return val or None
    return None


def get_key(keychain_service, dev_vars_key):
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", keychain_service, "-w"],
            capture_output=True, text=True, check=True,
        )
        key = out.stdout.strip()
        if key:
            return key, "keychain"
    except subprocess.CalledProcessError:
        pass
    val = _dev_vars_lookup(dev_vars_key)
    if val:
        print(
            f"[slop-image] WARNING: Keychain lookup for '{keychain_service}' failed; "
            f"using .dev.vars fallback ({dev_vars_key}).",
            file=sys.stderr,
        )
        return val, "dev.vars"
    raise SystemExit(
        f"[slop-image] FATAL: no API key. Keychain service '{keychain_service}' "
        f"not found and .dev.vars has no '{dev_vars_key}'."
    )


@dataclass(frozen=True)
class ImageFormat:
    name: str  # the value a provider's output_format option takes
    suffixes: tuple  # canonical first
    matches: Callable[[bytes], bool]  # magic bytes


# [LAW:one-source-of-truth] every image format slop-image knows: --out parsing, the
# provider request, and the downloaded-bytes check all read this table. gif is here
# though no provider produces it, so `--out x.gif` parses as a file and is refused.
PNG = ImageFormat("png", (".png",), lambda d: d[:8] == b"\x89PNG\r\n\x1a\n")
JPEG = ImageFormat("jpeg", (".jpg", ".jpeg"), lambda d: d[:3] == b"\xff\xd8\xff")
WEBP = ImageFormat("webp", (".webp",), lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP")
GIF = ImageFormat("gif", (".gif",), lambda d: d[:6] in (b"GIF87a", b"GIF89a"))
FORMAT_BY_SUFFIX = {s: f for f in (PNG, JPEG, WEBP, GIF) for s in f.suffixes}


@dataclass(frozen=True)
class Provider:
    name: str
    key: tuple  # (keychain service, .dev.vars key)
    formats: tuple  # ImageFormats it can produce; the first is the default for a directory --out
    generate: Callable  # (key, prompt, aspect, fmt) -> image URL


FAL_KEY = ("slopspot-fal-api-key", "SLOPSPOT_FAL_API_KEY")
REPLICATE_KEY = ("slopspot-replicate-api-key", "SLOPSPOT_REPLICATE_API_KEY")


def fal(name, endpoint, formats, input_for):
    # formats is the endpoint's output_format enum; each request names the one it wants.
    def generate(key, prompt, aspect, fmt):
        r = requests.post(
            f"https://fal.run/{endpoint}",
            headers={"Authorization": f"Key {key}", "Content-Type": "application/json"},
            json={"prompt": prompt, **input_for(aspect), "output_format": fmt.name},
            timeout=120,
        )
        if not r.ok:
            raise SystemExit(f"[slop-image] {name} failed: {r.status_code} {r.text}")
        images = r.json().get("images") or []
        if not images or not images[0].get("url"):
            raise SystemExit(f"[slop-image] {name} returned no image: {r.text}")
        return images[0]["url"]
    return Provider(name, FAL_KEY, formats, generate)


def _replicate_create_and_poll(version, input_obj, token):
    r = requests.post(
        REPLICATE_PREDICTIONS_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "wait=60",
        },
        json={"version": version, "input": input_obj},
        timeout=90,
    )
    if not r.ok:
        raise SystemExit(f"[slop-image] Replicate create failed: {r.status_code} {r.text}")
    pred = r.json()
    polls = 0
    while pred.get("status") in ("starting", "processing"):
        if polls >= MAX_POLLS:
            raise SystemExit(
                f"[slop-image] Replicate prediction {pred.get('id')} did not terminate "
                f"within {MAX_POLLS * POLL_INTERVAL_S}s of polling"
            )
        get_url = (pred.get("urls") or {}).get("get")
        if not get_url:
            raise SystemExit(
                f"[slop-image] Replicate prediction {pred.get('id')} missing urls.get for polling"
            )
        time.sleep(POLL_INTERVAL_S)
        pr = requests.get(get_url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if not pr.ok:
            raise SystemExit(f"[slop-image] Replicate poll failed: {pr.status_code} {pr.text}")
        pred = pr.json()
        polls += 1
    if pred.get("status") != "succeeded":
        raise SystemExit(
            f"[slop-image] Replicate prediction {pred.get('id')} not succeeded: "
            f"status={pred.get('status')} error={pred.get('error')}"
        )
    return pred["output"]


def replicate(name, version, fmt, input_for, url_of):
    # [LAW:types-are-the-program] a Replicate version takes no format option, so it
    # produces exactly one: the signature admits one, and the request ignores fmt.
    def generate(key, prompt, aspect, _fmt):
        output = _replicate_create_and_poll(version, {"prompt": prompt, **input_for(aspect)}, key)
        url = url_of(output)
        if not isinstance(url, str) or not url:
            raise SystemExit(f"[slop-image] {name} returned unexpected output: {output!r}")
        return url
    return Provider(name, REPLICATE_KEY, (fmt,), generate)


def _sdxl_input(aspect):
    w, h = REPLICATE_DIMS[aspect]
    return {"width": w, "height": h, "num_outputs": 1, "guidance_scale": SDXL_DEFAULT_GUIDANCE}


# [LAW:one-type-per-behavior] four providers, one type; what differs is data.
# fal formats are each endpoint's output_format enum (fal OpenAPI schema, defaults
# first); the Replicate versions produce PNG (their model pages' example outputs).
PROVIDERS = {p.name: p for p in (
    fal("fal-flux", "fal-ai/flux/schnell", (JPEG, PNG),
        # schnell tops out at 4 inference steps (FIREHOSE_STEPS)
        lambda a: {"image_size": FAL_IMAGE_SIZE[a], "num_inference_steps": 4}),
    fal("fal-nano-banana", "fal-ai/nano-banana", (PNG, JPEG, WEBP),
        lambda a: {"aspect_ratio": NANO_ASPECT_RATIO[a], "num_images": 1}),
    replicate("replicate-sdxl", SDXL_VERSION, PNG, _sdxl_input,
              lambda out: out[0] if isinstance(out, list) and out else None),
    replicate("replicate-ideogram", IDEOGRAM_VERSION, PNG,
              lambda a: {"aspect_ratio": IDEOGRAM_ASPECT_RATIO[a], "magic_prompt_option": "Auto"},
              lambda out: out),
)}


def slugify(prompt):
    s = re.sub(r"[^a-z0-9]+", "-", prompt.lower()).strip("-")
    return (s[:48] or "image").rstrip("-")


@dataclass(frozen=True)
class OutFile:
    path: Path
    format: ImageFormat

    @property
    def directory(self):
        return self.path.parent

    def target(self, name):
        return self.path


@dataclass(frozen=True)
class OutDir:
    path: Path
    format: ImageFormat

    @property
    def directory(self):
        return self.path

    def target(self, name):
        return self.path / name


def parse_out(raw, count, provider):
    # [LAW:parse-dont-validate] --out is resolved once, before any provider spend, into
    # a destination and the format the provider will be asked for: its directory
    # exists on return, and a file's suffix names a format this provider produces.
    path = Path(raw).expanduser()
    fmt = None if raw.endswith(os.sep) or path.is_dir() else FORMAT_BY_SUFFIX.get(path.suffix.lower())
    if fmt is None:
        out = OutDir(path, provider.formats[0])
    elif count > 1:
        raise SystemExit(
            f"[slop-image] --out {raw} is a file path, but --count is {count}; "
            f"pass a directory to save multiple images (end it with / to name a new "
            f"directory {raw.rstrip(os.sep)}{os.sep})"
        )
    elif fmt not in provider.formats:
        raise SystemExit(
            f"[slop-image] --out {raw} asks for {fmt.name}, but {provider.name} can produce "
            f"only {', '.join(f.name for f in provider.formats)}"
        )
    else:
        out = OutFile(path, fmt)
    try:
        out.directory.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise SystemExit(f"[slop-image] --out {raw}: cannot create directory {e.filename}: {e.strerror}")
    return out


def save_image(url, prompt, out, index, total):
    r = requests.get(url, timeout=60)
    if not r.ok:
        raise SystemExit(f"[slop-image] failed to download image: {r.status_code} {url}")
    data = r.content
    if not out.format.matches(data):
        raise SystemExit(
            f"[slop-image] asked for {out.format.name} but {url} is not {out.format.name} "
            f"(content-type={r.headers.get('Content-Type', '')!r}, first bytes={data[:12]!r}); "
            f"nothing written"
        )
    short = hashlib.sha256(url.encode()).hexdigest()[:8]
    suffix = f"-{index + 1}" if total > 1 else ""
    name = f"{slugify(prompt)}-{short}{suffix}{out.format.suffixes[0]}"

    target = out.target(name)
    target.write_bytes(data)
    return target.resolve()


def main():
    p = argparse.ArgumentParser(
        prog="slop-image",
        description="Generate an image from a prompt and save it locally.",
    )
    p.add_argument("prompt", help="the image prompt (required)")
    p.add_argument("--provider", choices=list(PROVIDERS), default="fal-flux",
                   help="image provider (default: fal-flux — fast + cheap)")
    p.add_argument("--aspect", choices=ASPECT_RATIOS, default="1:1",
                   help="aspect ratio (default: 1:1)")
    p.add_argument("--count", type=int, default=1, help="number of images (default: 1)")
    p.add_argument("--out", default=str(DEFAULT_OUT_DIR),
                   help="output directory, or for one image a file whose extension picks "
                        "the format (default: ~/Pictures/slop)")
    args = p.parse_args()

    if args.count < 1:
        raise SystemExit("[slop-image] --count must be >= 1")
    provider = PROVIDERS[args.provider]
    out = parse_out(args.out, args.count, provider)

    key, src = get_key(*provider.key)
    print(f"[slop-image] provider={provider.name} aspect={args.aspect} format={out.format.name} "
          f"count={args.count} key-source={src}", file=sys.stderr)

    # Each image is saved before the next is paid for, so a format mismatch costs one
    # image, and a later failure still reports the paths already on disk.
    for i in range(args.count):
        url = provider.generate(key, args.prompt, args.aspect, out.format)
        print(save_image(url, args.prompt, out, i, args.count), flush=True)


if __name__ == "__main__":
    main()
