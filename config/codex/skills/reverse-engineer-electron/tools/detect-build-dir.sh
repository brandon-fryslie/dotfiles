#!/usr/bin/env bash
#
# detect-build-dir.sh — Find the JS build directory within an extracted Electron app
#
# Usage: detect-build-dir.sh <extracted-app-dir>
#
# Prefers the directory that contains the `main` entrypoint from package.json.
# Falls back to a heuristic: directory containing the most .js files.
# Outputs the relative path from the extracted app root on stdout.
# Exits 1 if no candidate is found.
#
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: detect-build-dir.sh <extracted-app-dir>" >&2
  exit 1
fi

APP_DIR="${1%/}"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: $APP_DIR not found" >&2
  exit 1
fi

# Method 1: package.json "main" entrypoint
# // [LAW:one-source-of-truth] package.json is the app's authoritative entrypoint contract.
if [ -f "$APP_DIR/package.json" ]; then
  MAIN_REL="$(node -e "
    const p = JSON.parse(require('fs').readFileSync('$APP_DIR/package.json','utf8'));
    if (typeof p.main === 'string' && p.main.trim()) console.log(p.main.trim());
  " 2>/dev/null || true)"
  if [ -n "$MAIN_REL" ] && [ -f "$APP_DIR/$MAIN_REL" ]; then
    BUILD_DIR="$(dirname "$APP_DIR/$MAIN_REL")"
  fi
fi

# Method 2: heuristic fallback (most .js files, ignoring node_modules)
if [ -z "${BUILD_DIR:-}" ]; then
  BUILD_DIR=$(find "$APP_DIR" -name "*.js" -not -path "*/node_modules/*" -print0 2>/dev/null \
    | xargs -0 -I{} dirname {} \
    | sort | uniq -c | sort -rn \
    | head -1 | awk '{print $2}' || true)
fi

if [ -z "$BUILD_DIR" ]; then
  echo "  Could not auto-detect build directory." >&2
  echo "  Found JS files:" >&2
  find "$APP_DIR" -name "*.js" -not -path "*/node_modules/*" -exec ls -lh {} \; >&2
  exit 1
fi

# Strip the app dir prefix to get the relative path
RELATIVE=""
if [ "$BUILD_DIR" = "$APP_DIR" ]; then
  RELATIVE="."
else
  RELATIVE="${BUILD_DIR#"$APP_DIR"/}"
  if [ -z "$RELATIVE" ]; then
    RELATIVE="."
  fi
fi

if [ "$RELATIVE" != "." ] && [[ "$RELATIVE" == node_modules/* ]]; then
  echo "  Warning: detected path is inside node_modules/; this can be a vendor false positive." >&2
fi
echo "  Detected: $RELATIVE" >&2
echo "$RELATIVE"
