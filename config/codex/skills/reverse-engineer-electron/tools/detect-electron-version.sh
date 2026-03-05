#!/usr/bin/env bash
#
# detect-electron-version.sh — Detect the Electron version from an installed .app
#
# Usage: detect-electron-version.sh <path-to-app> [extracted-app-dir]
#
# Tries three methods in order:
#   1. Electron Framework Info.plist (preferred, no heuristics)
#   2. package.json in the extracted app (if extracted-app-dir provided)
#
# Outputs: <version> <major> on stdout (e.g., "32.4.1 32")
# Exits 1 if version cannot be determined.
#
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: detect-electron-version.sh <path-to-app> [extracted-app-dir]" >&2
  exit 1
fi

APP_PATH="$1"
EXTRACTED_DIR="${2:-}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH not found" >&2
  exit 1
fi

# Method 1: Electron Framework Info.plist
# // [LAW:verifiable-goals] Prefer deterministic metadata over heuristic string scraping.
FRAMEWORK_PLIST="$APP_PATH/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist"
if [ -f "$FRAMEWORK_PLIST" ]; then
  VERSION="$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$FRAMEWORK_PLIST" 2>/dev/null || true)"
  if [ -z "$VERSION" ]; then
    VERSION="$(/usr/bin/plutil -extract CFBundleVersion raw -o - "$FRAMEWORK_PLIST" 2>/dev/null || true)"
  fi
  if [ -n "$VERSION" ]; then
    MAJOR="${VERSION%%.*}"
    echo "  Found in Electron Framework Info.plist: $VERSION" >&2
    echo "$VERSION $MAJOR"
    exit 0
  fi
fi

# Method 2: package.json in extracted app
if [ -n "$EXTRACTED_DIR" ] && [ -f "$EXTRACTED_DIR/package.json" ]; then
  DETECTED=$(node -e "
    const p=JSON.parse(require('fs').readFileSync('$EXTRACTED_DIR/package.json','utf8'));
    const v = p.devDependencies?.electron || p.dependencies?.electron || '';
    if (!v) process.exit(0);
    let s = String(v).trim();
    while (s.length > 0) {
      const c = s[0];
      if (c >= '0' && c <= '9') break;
      s = s.slice(1);
    }
    if (s) console.log(s);
  " 2>/dev/null || true)
  if [ -n "$DETECTED" ]; then
    MAJOR="${DETECTED%%.*}"
    echo "  Found in package.json: $DETECTED" >&2
    echo "$DETECTED $MAJOR"
    exit 0
  fi
fi

echo "  Could not determine Electron version" >&2
exit 1
