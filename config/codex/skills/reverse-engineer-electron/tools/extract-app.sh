#!/usr/bin/env bash
#
# extract-app.sh — Copy app Resources + extract app.asar into workspace
#
# Usage: extract-app.sh <path-to-app> <resources-output-dir>
#
# Copies the full Contents/Resources directory into the workspace (assets, extra
# .asar files, locales, etc.), then extracts app.asar into <resources-output-dir>/app.
# // [LAW:one-source-of-truth] Keep upstream Resources as the canonical runtime layout.
#
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: extract-app.sh <path-to-app> <resources-output-dir>"
  echo "  path-to-app   Path to .app bundle (e.g., /Applications/GitKraken.app)"
  echo "  resources-output-dir  Where to copy Resources (e.g., resources/)"
  exit 1
fi

APP_PATH="$1"
OUTPUT_RESOURCES_DIR="$2"
UPSTREAM_RESOURCES="$APP_PATH/Contents/Resources"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH not found" >&2
  exit 1
fi

if [ ! -f "$UPSTREAM_RESOURCES/app.asar" ]; then
  echo "Error: No app.asar found in $UPSTREAM_RESOURCES" >&2
  exit 1
fi

mkdir -p "$OUTPUT_RESOURCES_DIR"

echo "Copying Contents/Resources into workspace..."
# Prefer rsync for repeatability and speed across re-runs.
# We intentionally copy the entire directory so runtime dependencies are not missed.
rsync -a "$UPSTREAM_RESOURCES/" "$OUTPUT_RESOURCES_DIR/"

echo "Extracting app.asar into $OUTPUT_RESOURCES_DIR/app ..."
if [ -e "$OUTPUT_RESOURCES_DIR/app" ]; then
  echo "Error: $OUTPUT_RESOURCES_DIR/app already exists; refusing to overwrite." >&2
  echo "  Move it aside or delete it, then re-run extract-app.sh." >&2
  exit 1
fi
ASAR_BIN="${ASAR_BIN:-}"
if [ -n "$ASAR_BIN" ]; then
  "$ASAR_BIN" extract "$OUTPUT_RESOURCES_DIR/app.asar" "$OUTPUT_RESOURCES_DIR/app"
else
  npx asar extract "$OUTPUT_RESOURCES_DIR/app.asar" "$OUTPUT_RESOURCES_DIR/app"
fi

echo "Resources copied to $OUTPUT_RESOURCES_DIR"
echo "App extracted to $OUTPUT_RESOURCES_DIR/app"
