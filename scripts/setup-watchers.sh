#!/bin/bash
# Setup launchd watchers for auto-regenerating config files
# This script creates launchd plists that watch source files and regenerate targets

set -euo pipefail

PLIST_DIR="$HOME/Library/LaunchAgents"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure plist directory exists
mkdir -p "$PLIST_DIR"

# Function to create a watcher plist
create_watcher() {
    local label="$1"
    local merge_script="$2"
    local output_file="$3"
    shift 3
    local watch_paths=("$@")

    local plist_file="${PLIST_DIR}/${label}.plist"

    echo "Creating watcher: $label"
    echo "  Output: $output_file"
    echo "  Watching: ${watch_paths[*]}"

    cat > "$plist_file" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${merge_script}</string>
        <string>${output_file}</string>
EOF

    # Add all watch paths as arguments to the merge script
    for path in "${watch_paths[@]}"; do
        cat >> "$plist_file" <<EOF
        <string>${path}</string>
EOF
    done

    cat >> "$plist_file" <<EOF
    </array>

    <key>WatchPaths</key>
    <array>
EOF

    # Add all watch paths to WatchPaths array
    for path in "${watch_paths[@]}"; do
        cat >> "$plist_file" <<EOF
        <string>${path}</string>
EOF
    done

    cat >> "$plist_file" <<EOF
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/${label}.log</string>

    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/${label}.error.log</string>
</dict>
</plist>
EOF

    # Load the plist
    launchctl unload "$plist_file" 2>/dev/null || true
    launchctl load "$plist_file"

    echo "  ✓ Watcher loaded: $label"
}

# Make merge script executable
chmod +x "${SCRIPT_DIR}/merge-json.sh"

echo "Setting up file watchers..."
echo ""

# Example: Setup a watcher for merged config
# Uncomment and customize this example:
#
# create_watcher \
#     "com.user.merge-config" \
#     "${SCRIPT_DIR}/merge-json.sh" \
#     "$HOME/.config/merged-config.json" \
#     "$HOME/.config/base-config.json" \
#     "$HOME/.config/override-config.json"

echo ""
echo "✓ All watchers configured!"
echo ""
echo "To add a new watcher, edit this script and add a create_watcher call."
echo "Example usage:"
echo "  create_watcher \\"
echo "    \"com.user.my-watcher\" \\"
echo "    \"\${SCRIPT_DIR}/merge-json.sh\" \\"
echo "    \"\$HOME/.config/output.json\" \\"
echo "    \"\$HOME/.config/source1.json\" \\"
echo "    \"\$HOME/.config/source2.json\""
