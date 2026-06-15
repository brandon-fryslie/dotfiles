# opencode — command reference

**Not yet populated.** The opencode command set has not been documented here.

Do **not** guess opencode commands or assume they mirror Claude Code's — a wrong command typed into the prompt is submitted as a literal message, not silently ignored.

Until this file is filled in:

1. Confirm the pane is opencode (`tmux-command list` → `title`/`cmd`, or `read-screen` and recognize the UI).
2. Discover the real command set live — open opencode's command menu and `read-screen` the list, or check opencode's own help.
3. Confirm the exact command with the user before sending anything that changes or ends the session.

When the command reference is provided, replace this file with the same structure as `claude-code.md`: which commands the in-session agent can't invoke and are worth driving here, which open pickers (and the keys to drive them), and which are safe read-only commands to test the pipe.
