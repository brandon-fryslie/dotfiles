# shellcheck shell=bash
# Custom continuum status segment
# Shows "Continuum: Xm" when active, "CONTINUUM INACTIVE" when off

TMUX_CONTINUUM_STATUS_SCRIPT="${XDG_CONFIG_HOME:-$HOME/.config}/tmux/plugins/tmux-continuum/scripts/continuum_status.sh"

run_segment() {
	local status=""

	if [ -x "$TMUX_CONTINUUM_STATUS_SCRIPT" ]; then
		status=$("$TMUX_CONTINUUM_STATUS_SCRIPT")
	fi

	if [ -z "$status" ] || [ "$status" = "off" ]; then
		echo "CONTINUUM INACTIVE"
	else
		echo "Continuum: ${status}m"
	fi

	return 0
}
