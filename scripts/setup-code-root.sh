#!/bin/bash
# Make Finder open coding files in VS Code at their git root.
#
# Builds ~/Applications/Code Root.app, a droplet that hands the files it is
# opened with to config/code-root/open-at-root, then makes it the default app
# for every extension in config/code-root/extensions. The extension table is
# the one list both the app's document claims and the defaults are derived
# from. [LAW:one-source-of-truth]
#
# The app must live under ~/Applications: LaunchServices ignores a default
# handler under /tmp. VS Code's CLI path is baked in at build time, so if VS
# Code moves, re-run the install.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../config/code-root" && pwd)"
APP="$HOME/Applications/Code Root.app"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
launchservices() { swift "$SRC/launchservices.swift" "$@"; }

cli="$(launchservices app-path com.microsoft.VSCode)/Contents/Resources/app/bin/code"
[[ -x "$cli" ]] || { echo "ERROR: VS Code CLI not found at $cli" >&2; exit 1; }

extensions=()
while read -r ext; do extensions+=("$ext"); done < <(grep -v -e '^#' -e '^$' "$SRC/extensions")

mkdir -p "$HOME/Applications"
osacompile -o "$APP" <<EOF
on open theItems
	set args to ""
	repeat with f in theItems
		set args to args & " " & quoted form of POSIX path of f
	end repeat
	do shell script quoted form of (POSIX path of (path to me) & "Contents/Resources/open-at-root") & " " & quoted form of "$(sed 's/[\\"]/\\&/g' <<<"$cli")" & args
end open
EOF
cp "$SRC/open-at-root" "$APP/Contents/Resources/open-at-root"
chmod +x "$APP/Contents/Resources/open-at-root"

plist="$APP/Contents/Info.plist"
plutil -replace CFBundleIdentifier -string com.bmf.code-root "$plist"
# No Dock icon: the droplet only lives for the instant it takes to call VS Code.
plutil -replace LSUIElement -bool true "$plist"
plutil -replace CFBundleDocumentTypes -json "$(printf '%s\n' "${extensions[@]}" | python3 -c '
import json, sys
print(json.dumps([{"CFBundleTypeRole": "Editor", "LSHandlerRank": "Alternate",
                   "CFBundleTypeExtensions": sys.stdin.read().split()}]))')" "$plist"
# Editing Info.plist breaks the signature osacompile applied; an applet with a
# broken seal won't launch.
codesign --force --sign - "$APP"
"$LSREGISTER" -f "$APP"

launchservices set-default "$APP" "${extensions[@]}"
echo "✓ Code Root.app -> $cli"
