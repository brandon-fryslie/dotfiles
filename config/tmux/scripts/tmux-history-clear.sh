#!/usr/bin/env bash
# Clear scrollback history for a tmux pane.
#
# This is a one-shot clear, not an off switch. tmux applies history-limit only
# at pane creation; setting it on an existing pane exits 0 but is silently
# ignored (verified tmux 3.6a), so a per-pane "recording disabled" state does
# not exist and must not be claimed. Output keeps recording after the clear.

set -euo pipefail

PANE_ID="${1:-.}"

# [LAW:no-silent-failure] clear must succeed before the message claims it did
tmux clear-history -t "$PANE_ID"
tmux display-message -t "$PANE_ID" "history cleared (scrollback still recording)"
