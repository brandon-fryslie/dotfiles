# shellcheck shell=bash
# tmux-powerline configuration
# See: https://github.com/erikw/tmux-powerline

# General settings
export TMUX_POWERLINE_DEBUG_MODE_ENABLED="false"
export TMUX_POWERLINE_PATCHED_FONT_IN_USE="true"

# Use custom theme
export TMUX_POWERLINE_THEME="custom"

# Status bar settings
# Use "2" for dual-line status bar (windows on one line, segments on another)
export TMUX_POWERLINE_STATUS_VISIBILITY="2"
export TMUX_POWERLINE_STATUS_INTERVAL="1"
export TMUX_POWERLINE_STATUS_JUSTIFICATION="left"
export TMUX_POWERLINE_STATUS_LEFT_LENGTH="60"
export TMUX_POWERLINE_STATUS_RIGHT_LENGTH="90"

# Dual-line layout: 0 = windows on top, 1 = windows on bottom
export TMUX_POWERLINE_WINDOW_STATUS_LINE="0"

# Custom theme path (XDG default location)
export TMUX_POWERLINE_DIR_USER_THEMES="${XDG_CONFIG_HOME:-$HOME/.config}/tmux-powerline/themes"
export TMUX_POWERLINE_DIR_USER_SEGMENTS="${XDG_CONFIG_HOME:-$HOME/.config}/tmux-powerline/segments"
