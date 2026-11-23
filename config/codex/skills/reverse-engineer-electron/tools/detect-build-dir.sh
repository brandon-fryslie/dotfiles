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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: $APP_DIR not found" >&2
  exit 1
fi

# Method 1: package.json "main" entrypoint
# // [LAW:one-source-of-truth] package.json is the app's authoritative entrypoint contract, read by the node tools'
# own JSON reader (read-json.mjs).
# [LAW:no-silent-failure] Only a package.json that isn't there falls through to the heuristic below; one that is
# there but can't be read as JSON stops the run, and read-json.mjs has said why.
PKG_RC=0
PKG_JSON="$(node "$SCRIPT_DIR/read-json.mjs" "$APP_DIR/package.json")" || PKG_RC=$?
if [ "$PKG_RC" -ne 0 ] && [ "$PKG_RC" -ne 3 ]; then
  exit 1
fi
if [ "$PKG_RC" -eq 0 ]; then
  # The JSON travels as argv, never interpolated into JS source.
  if ! MAIN_REL="$(node -e "
    const p = JSON.parse(process.argv[1]);
    if (typeof p?.main === 'string' && p.main.trim()) console.log(p.main.trim());
  " "$PKG_JSON")"; then
    echo "Error: node could not read main from $APP_DIR/package.json" >&2
    exit 1
  fi
  if [ -n "$MAIN_REL" ]; then
    if [ -f "$APP_DIR/$MAIN_REL" ]; then
      BUILD_DIR="$(dirname "$APP_DIR/$MAIN_REL")"
    else
      echo "  Warning: package.json main '$MAIN_REL' does not exist; falling back to heuristic." >&2
    fi
  fi
fi

# Method 2: heuristic fallback (most .js files, ignoring node_modules)
if [ -z "${BUILD_DIR:-}" ]; then
  BUILD_DIR=$(find "$APP_DIR" -name "*.js" -not -path "*/node_modules/*" -print0 2>/dev/null \
    | xargs -0 -I{} dirname {} \
    | sort | uniq -c | sort -rn \
    | head -1 | sed -E 's/^ *[0-9]+ //' || true)
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
