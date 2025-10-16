#!/bin/bash
# Example: Setup a watcher for merged config files
# This demonstrates how to auto-regenerate files on change

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_DIR="$HOME/Library/LaunchAgents"

# Ensure directories exist
mkdir -p "$PLIST_DIR"
mkdir -p "$HOME/.config"

# Make merge script executable
chmod +x "${SCRIPT_DIR}/merge-json.sh"

# Define the watcher
LABEL="com.user.dotfiles-config-merge"
OUTPUT_FILE="$HOME/.config/app-config.json"
BASE_FILE="${REPO_ROOT}/config-sources/base-config.json"
PROFILE_FILE="${REPO_ROOT}/config-sources/home-override.json"  # or work-override.json

echo "Setting up watcher: $LABEL"
echo "  Base: $BASE_FILE"
echo "  Override: $PROFILE_FILE"
echo "  Output: $OUTPUT_FILE"

# Create the launchd plist
cat > "${PLIST_DIR}/${LABEL}.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_DIR}/merge-json.sh</string>
        <string>${OUTPUT_FILE}</string>
        <string>${BASE_FILE}</string>
        <string>${PROFILE_FILE}</string>
    </array>

    <key>WatchPaths</key>
    <array>
        <string>${BASE_FILE}</string>
        <string>${PROFILE_FILE}</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/${LABEL}.log</string>

    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/${LABEL}.error.log</string>
</dict>
</plist>
EOF

# Unload if already loaded, then load
launchctl unload "${PLIST_DIR}/${LABEL}.plist" 2>/dev/null || true
launchctl load "${PLIST_DIR}/${LABEL}.plist"

echo "✓ Watcher configured and loaded!"
echo ""
echo "The merged config will be at: $OUTPUT_FILE"
echo "Edit either source file and the output will auto-update"
echo ""
echo "To view logs: tail -f ~/Library/Logs/${LABEL}.log"
echo "To unload: launchctl unload ${PLIST_DIR}/${LABEL}.plist"
