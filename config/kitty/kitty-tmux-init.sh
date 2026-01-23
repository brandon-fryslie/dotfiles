#!/bin/bash
# Kitty startup script - creates tabs for all tmux sessions
# This runs as the shell for the FIRST kitty window, then:
# 1. Creates additional tabs for each existing tmux session
# 2. Attaches itself to the first session (or 'main' if none exist)
#
# Robust: falls back to plain zsh if anything fails

set -o pipefail

# Fallback function - drops to normal shell
fallback() {
    exec /bin/zsh -l
}

# Ensure tmux is available
if ! command -v tmux &>/dev/null; then
    fallback
fi

# Get existing tmux sessions
sessions=$(tmux list-sessions -F "#{session_name}" 2>/dev/null | head -20) || true

if [[ -z "$sessions" ]]; then
    # No sessions - create 'main' (try tmux, fallback to zsh)
    tmux new-session -d -s main || fallback
    exec tmux attach -t main || fallback
fi

# Convert to array (bash 4+ required, macOS has bash 3 by default)
# Use a portable method instead
session_array=()
while IFS= read -r line; do
    session_array+=("$line")
done <<< "$sessions"

# Create tabs for sessions 2+ (session 1 will be this tab)
# Only if kitty remote control is available
if command -v kitty &>/dev/null; then
    for ((i=1; i<${#session_array[@]}; i++)); do
        session="${session_array[$i]}"

        kitty @ launch --type=tab --tab-title "$session" tmux new-session -A -s "$session" 2>/dev/null &
    done

    # Small delay to let tabs spawn
    sleep 0.3

    # Set this tab's title
    first_session="${session_array[0]}"
    kitty @ set-tab-title "$first_session" 2>/dev/null
fi

# Attach to first session
first_session="${session_array[0]:-main}"
exec tmux new-session -A -s "$first_session" || fallback
