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

## bin/tmux-sender-info

The single definition of the sender line — `<model> · <N>k tokens of context ·
<working directory>`. tmux-talk puts it in the `Sender:` header of the envelope
its receiver reads; tmux-command prints it to the caller, because the bytes it
delivers must stay byte-exact. Both expose it directly as `sender`.

Model and context size are read from the calling session's own transcript
(`$CLAUDE_CODE_SESSION_ID` under `${CLAUDE_CONFIG_DIR:-~/.claude}`), taking the
last main-thread assistant turn's `input + cache_read + cache_creation` tokens —
the harness's own count, so nothing is estimated.

Unlike the resolver, this part is advisory and **never fails**: no session id, no
transcript, no `jq`, a half-written line — every way of not knowing degrades to
the working directory alone and exits 0, so it cannot break the send it decorates.
A caller that prints the directory by itself is telling you the sender is not a
Claude session.
