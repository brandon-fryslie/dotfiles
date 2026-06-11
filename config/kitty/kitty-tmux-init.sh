#!/bin/bash
# Kitty startup script - runs as the shell for EVERY shell-launched kitty
# window/tab. The instance's first window (KITTY_WINDOW_ID=1) additionally
# creates tabs for each existing tmux session; every window then attaches to
# the first session (or 'main' if none exist).
#
# Falls back to plain zsh if tmux is missing or any tmux step fails.

set -o pipefail

# Fallback - drops to normal shell (never returns)
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
    # [LAW:no-silent-failure] no exec here: `exec cmd || fallback` can never
    # reach the fallback (success replaces the shell; exec failure exits a
    # non-interactive bash before || is evaluated)
    tmux new-session -d -s main || fallback
    tmux attach -t main || fallback
    exit 0
fi

# Convert to array (bash 4+ required, macOS has bash 3 by default)
# Use a portable method instead
session_array=()
while IFS= read -r line; do
    session_array+=("$line")
done <<< "$sessions"

# Create tabs for sessions 2+ (session 1 will be this tab)
# Only in the instance's first window: kitty re-runs this script for every
# shell-launched window (Cmd+T/Cmd+N), and an unguarded spawn would duplicate
# every session tab on each re-entry. Window ids start at 1 per instance.
if [[ "${KITTY_WINDOW_ID:-}" == "1" ]] && command -v kitty &>/dev/null; then
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
tmux new-session -A -s "$first_session" || fallback
