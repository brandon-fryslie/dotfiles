#!/usr/bin/env bash
# Periodic tmux-resurrect save, driven by launchd (see scripts/setup-tmux-resurrect-save.sh).
#
# WHY this exists instead of tmux-continuum's built-in periodic save:
# continuum triggers its interval save by prepending a "#(continuum_save.sh)"
# interpolation to `status-right` and relying on the status bar being redrawn
# every status-interval. That makes a correctness property (state is persisted)
# depend on incidental render timing, and on `status-right` having exactly one
# writer — neither of which holds here. This config sets a custom status-right
# (conf.d/tmux-command-echo.conf) and reloads it, and continuum additionally
# skips the injection whenever its another_tmux_server_running heuristic
# misfires (common with many sessions). Net effect: saves silently stopped.
# launchd is a single, explicit, render-independent scheduler for the save.
# [LAW:no-ambient-temporal-coupling] [LAW:single-enforcer] [LAW:no-silent-failure]
set -uo pipefail

# launchd starts jobs with a minimal PATH; tmux and resurrect's helpers need the
# real one. Prepend the usual locations rather than trusting the inherited PATH.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SAVE="$HOME/.config/tmux/plugins/tmux-resurrect/scripts/save.sh"

# No running tmux server means there is nothing to save. That is a normal idle
# state (e.g. between logins), not an error — exit cleanly without writing a save.
target=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | head -1)
if [ -z "$target" ]; then
  exit 0
fi

# A missing save script IS a real failure: the plugin isn't installed where we
# expect, so the periodic save would never work. Surface it loudly.
if [ ! -x "$SAVE" ]; then
  echo "tmux-resurrect-save: save script not found or not executable: $SAVE" >&2
  exit 1
fi

# Run the save THROUGH `tmux run-shell -t <session>`, not directly. save.sh is
# built to run in the tmux server's context (that is how continuum's status-right
# interpolation invokes it). A bare launchd process is the wrong environment:
# launchd's process-group reaping truncates the run, and even via run-shell a save
# with no target client dumps panes but not windows/state — a file that cannot
# drive a restore. The -t target gives dump_windows/dump_state the session context
# they need, producing a complete save. We block (no -b) so this job's exit
# reflects the save. "quiet" (save.sh's first positional arg) suppresses the
# spinner so an automated save never flashes "Saving..." in the live status bar.
# [LAW:effects-at-boundaries] [LAW:no-silent-failure]
exec tmux run-shell -t "$target" "$SAVE quiet"
