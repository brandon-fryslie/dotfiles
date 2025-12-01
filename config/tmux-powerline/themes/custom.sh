# shellcheck shell=bash
# Custom tmux-powerline theme
# Based on default theme with IP addresses and weather removed

if tp_patched_font_in_use; then
	TMUX_POWERLINE_SEPARATOR_LEFT_BOLD=""
	TMUX_POWERLINE_SEPARATOR_LEFT_THIN=""
	TMUX_POWERLINE_SEPARATOR_RIGHT_BOLD=""
	TMUX_POWERLINE_SEPARATOR_RIGHT_THIN=""
else
	TMUX_POWERLINE_SEPARATOR_LEFT_BOLD="◀"
	TMUX_POWERLINE_SEPARATOR_LEFT_THIN="❮"
	TMUX_POWERLINE_SEPARATOR_RIGHT_BOLD="▶"
	TMUX_POWERLINE_SEPARATOR_RIGHT_THIN="❯"
fi

# Colors
TMUX_POWERLINE_DEFAULT_BACKGROUND_COLOR=${TMUX_POWERLINE_DEFAULT_BACKGROUND_COLOR:-'235'}
TMUX_POWERLINE_DEFAULT_FOREGROUND_COLOR=${TMUX_POWERLINE_DEFAULT_FOREGROUND_COLOR:-'255'}
# shellcheck disable=SC2034
TMUX_POWERLINE_SEG_AIR_COLOR=$(tp_air_color)

TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR=${TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR:-$TMUX_POWERLINE_SEPARATOR_RIGHT_BOLD}
TMUX_POWERLINE_DEFAULT_RIGHTSIDE_SEPARATOR=${TMUX_POWERLINE_DEFAULT_RIGHTSIDE_SEPARATOR:-$TMUX_POWERLINE_SEPARATOR_LEFT_BOLD}

# Window status formatting
# shellcheck disable=SC2128
if [ -z "$TMUX_POWERLINE_WINDOW_STATUS_CURRENT" ]; then
	TMUX_POWERLINE_WINDOW_STATUS_CURRENT=(
		"#[$(tp_format inverse)]"
		"$TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR"
		" #I#F "
		"$TMUX_POWERLINE_SEPARATOR_RIGHT_THIN"
		" #W "
		"#[$(tp_format regular)]"
		"$TMUX_POWERLINE_DEFAULT_LEFTSIDE_SEPARATOR"
	)
fi

# shellcheck disable=SC2128
if [ -z "$TMUX_POWERLINE_WINDOW_STATUS_STYLE" ]; then
	TMUX_POWERLINE_WINDOW_STATUS_STYLE=(
		"$(tp_format regular)"
	)
fi

# shellcheck disable=SC2128
if [ -z "$TMUX_POWERLINE_WINDOW_STATUS_FORMAT" ]; then
	TMUX_POWERLINE_WINDOW_STATUS_FORMAT=(
		"#[$(tp_format regular)]"
		"  #I#{?window_flags,#F, } "
		"$TMUX_POWERLINE_SEPARATOR_RIGHT_THIN"
		" #W "
	)
fi

# Left status segments
# Removed: lan_ip, wan_ip (IP addresses)
# shellcheck disable=SC1143,SC2128
if [ -z "$TMUX_POWERLINE_LEFT_STATUS_SEGMENTS" ]; then
	TMUX_POWERLINE_LEFT_STATUS_SEGMENTS=(
		"tmux_session_info 148 234"
		"hostname 33 0"
		#"mode_indicator 165 0"
		#"ifstat 30 255"
		#"ifstat_sys 30 255"
		# "lan_ip 24 255 ${TMUX_POWERLINE_SEPARATOR_RIGHT_THIN}"  # Disabled: IP address
		# "wan_ip 24 255"                                         # Disabled: IP address
		"vcs_branch 29 88"
		#"vcs_compare 60 255"
		#"vcs_staged 64 255"
		#"vcs_modified 9 255"
		#"vcs_others 245 0"
	)
fi

# Right status segments
# Removed: weather
# shellcheck disable=SC1143,SC2128
if [ -z "$TMUX_POWERLINE_RIGHT_STATUS_SEGMENTS" ]; then
	TMUX_POWERLINE_RIGHT_STATUS_SEGMENTS=(
		#"earthquake 3 0"
		"pwd 89 211"
		#"macos_notification_count 29 255"
		#"mailcount 9 255"
		#"now_playing 234 37"
		#"cpu 240 136"
		"load 237 167"
		#"tmux_mem_cpu_load 234 136"
		"battery 137 127"
		#"air ${TMUX_POWERLINE_SEG_AIR_COLOR} 255"
		# "weather 37 255"  # Disabled: weather
		#"rainbarf 0 ${TMUX_POWERLINE_DEFAULT_FOREGROUND_COLOR}"
		#"xkb_layout 125 117"
		"continuum_custom 237 144"
		"date_day 235 136"
		"date 235 136 ${TMUX_POWERLINE_SEPARATOR_LEFT_THIN}"
		"time 235 136 ${TMUX_POWERLINE_SEPARATOR_LEFT_THIN}"
		#"utc_time 235 136 ${TMUX_POWERLINE_SEPARATOR_LEFT_THIN}"
	)
fi
