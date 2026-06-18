# tmux-shared

Not a skill — a shared library for the `tmux-talk` and `tmux-command` skills.
Both symlink-install under `~/.claude/skills/`, and both reach this directory by
a `$0`-relative path (`../../tmux-shared/bin/...`), so the same code lives here
exactly once instead of being copied into each skill.

## bin/tmux-resolve

The single definition of tmux target addressing. Turns a full or shorthand
address into a canonical, verified `session:window.pane`, or rejects it loudly.
One enforcer means the two skills cannot drift — a target that resolves in one
resolves identically in the other, and a bad name that errors in one errors in
both (rather than tmux silently retargeting the active pane).

Run `bin/tmux-resolve` with no argument for the grammar.
