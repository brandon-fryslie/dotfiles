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
from pathlib import Path

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

SDXL_VERSION = "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc"
IDEOGRAM_VERSION = "7cef9d520d672bb802588ad0d13151bc51aee9a408c270aebf25d6530045dd29"

SDXL_DEFAULT_GUIDANCE = 7.5

REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
POLL_INTERVAL_S = 2
MAX_POLLS = 30

PROVIDERS = ("fal-flux", "replicate-sdxl", "replicate-ideogram")
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


def gen_fal_flux(prompt, aspect, count):
    key, src = get_key("slopspot-fal-api-key", "SLOPSPOT_FAL_API_KEY")
    urls = []
    for _ in range(count):
        r = requests.post(
            "https://fal.run/fal-ai/flux/schnell",
            headers={"Authorization": f"Key {key}", "Content-Type": "application/json"},
            json={
                "prompt": prompt,
                "image_size": FAL_IMAGE_SIZE[aspect],
                "num_inference_steps": 4,  # schnell tops out at 4 (FIREHOSE_STEPS)
            },
            timeout=120,
        )
        if not r.ok:
            raise SystemExit(f"[slop-image] fal-flux failed: {r.status_code} {r.text}")
        images = r.json().get("images") or []
        if not images or not images[0].get("url"):
            raise SystemExit(f"[slop-image] fal-flux returned no image: {r.text}")
        urls.append(images[0]["url"])
    return urls, src


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


def gen_replicate_sdxl(prompt, aspect, count):
    key, src = get_key("slopspot-replicate-api-key", "SLOPSPOT_REPLICATE_API_KEY")
    w, h = REPLICATE_DIMS[aspect]
    urls = []
    for _ in range(count):
        output = _replicate_create_and_poll(
            SDXL_VERSION,
            {
                "prompt": prompt,
                "width": w,
                "height": h,
                "num_outputs": 1,
                "guidance_scale": SDXL_DEFAULT_GUIDANCE,
            },
            key,
        )
        if not isinstance(output, list) or not output:
            raise SystemExit(f"[slop-image] SDXL returned unexpected output: {output!r}")
        urls.append(output[0])
    return urls, src


def gen_replicate_ideogram(prompt, aspect, count):
    key, src = get_key("slopspot-replicate-api-key", "SLOPSPOT_REPLICATE_API_KEY")
    urls = []
    for _ in range(count):
        output = _replicate_create_and_poll(
            IDEOGRAM_VERSION,
            {
                "prompt": prompt,
                "aspect_ratio": IDEOGRAM_ASPECT_RATIO[aspect],
                "magic_prompt_option": "Auto",
            },
            key,
        )
        if not isinstance(output, str) or not output:
            raise SystemExit(f"[slop-image] Ideogram returned unexpected output: {output!r}")
        urls.append(output)
    return urls, src


DISPATCH = {
    "fal-flux": gen_fal_flux,
    "replicate-sdxl": gen_replicate_sdxl,
    "replicate-ideogram": gen_replicate_ideogram,
}


def slugify(prompt):
    s = re.sub(r"[^a-z0-9]+", "-", prompt.lower()).strip("-")
    return (s[:48] or "image").rstrip("-")


def ext_for(data, content_type):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    raise SystemExit(
        f"[slop-image] downloaded bytes are not a recognized image "
        f"(content-type={content_type!r}, first bytes={data[:12]!r})"
    )


def save_image(url, prompt, out, index, total):
    r = requests.get(url, timeout=60)
    if not r.ok:
        raise SystemExit(f"[slop-image] failed to download image: {r.status_code} {url}")
    data = r.content
    if not data:
        raise SystemExit(f"[slop-image] downloaded empty image from {url}")
    ext = ext_for(data, r.headers.get("Content-Type", ""))
    short = hashlib.sha256(url.encode()).hexdigest()[:8]
    suffix = f"-{index + 1}" if total > 1 else ""
    name = f"{slugify(prompt)}-{short}{suffix}{ext}"

    out_path = Path(out).expanduser()
    if out_path.suffix and total == 1:
        target = out_path
    else:
        target = out_path / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target.resolve()


def main():
    p = argparse.ArgumentParser(
        prog="slop-image",
        description="Generate an image from a prompt and save it locally.",
    )
    p.add_argument("prompt", help="the image prompt (required)")
    p.add_argument("--provider", choices=PROVIDERS, default="fal-flux",
                   help="image provider (default: fal-flux — fast + cheap)")
    p.add_argument("--aspect", choices=ASPECT_RATIOS, default="1:1",
                   help="aspect ratio (default: 1:1)")
    p.add_argument("--count", type=int, default=1, help="number of images (default: 1)")
    p.add_argument("--out", default=str(DEFAULT_OUT_DIR),
                   help="output file or directory (default: ~/Pictures/slop)")
    args = p.parse_args()

    if args.count < 1:
        raise SystemExit("[slop-image] --count must be >= 1")

    urls, src = DISPATCH[args.provider](args.prompt, args.aspect, args.count)
    print(f"[slop-image] provider={args.provider} aspect={args.aspect} "
          f"count={len(urls)} key-source={src}", file=sys.stderr)

    paths = [save_image(u, args.prompt, args.out, i, len(urls)) for i, u in enumerate(urls)]
    for path in paths:
        print(path)


if __name__ == "__main__":
    main()
