#!/bin/bash
# Install the launchd agent that periodically saves tmux state via tmux-resurrect.
#
# This is the single, explicit owner of the periodic save. tmux-continuum's
# built-in trigger (a status-right interpolation redrawn every status-interval)
# is unreliable here — a custom status-right and continuum's own
# another_tmux_server_running heuristic both suppress it — so saves had silently
# stopped. launchd's StartInterval is render-independent and survives any future
# status-right change. The actual save work lives in
# config/tmux/scripts/tmux-resurrect-save.sh. [LAW:single-enforcer]
#
# Mirrors scripts/setup-watchers.sh: generate the plist with $HOME baked in (so
# nothing in the repo hardcodes a username) and (re)load it idempotently.
set -euo pipefail

LABEL="com.bmf.tmux-resurrect-save"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/$LABEL.plist"
WRAPPER="$HOME/.config/tmux/scripts/tmux-resurrect-save.sh"
# Mirror @continuum-save-interval (5 minutes) from config/tmux/tmux.conf.
INTERVAL_SECONDS=300

mkdir -p "$PLIST_DIR" "$HOME/Library/Logs"
chmod +x "$WRAPPER"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${WRAPPER}</string>
    </array>

    <key>StartInterval</key>
    <integer>${INTERVAL_SECONDS}</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/${LABEL}.log</string>

    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/${LABEL}.error.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "✓ Loaded $LABEL (every ${INTERVAL_SECONDS}s -> $WRAPPER)"
