# claude-shared

Not a skill — a shared library for skills that read Claude Code's own session
state. Skills symlink-install together under `~/.claude/skills/`, so each reaches
this directory by a `$0`-relative path (`../claude-shared/bin/...` from a skill's
root), and the code lives here once instead of being copied into each skill.

## bin/claude-transcript

The one definition of where a session's transcript is: `claude-transcript
<session-id>` prints the path of `<session-id>.jsonl` under any project dir of
`${CLAUDE_CONFIG_DIR:-~/.claude}/projects`, and exits 0. No transcript, or more
than one for the id, exits 1 with the reason on stderr (every path, for several).
share-slop and tmux-shared's `tmux-sender-info` call it, so the two cannot read
different transcripts for one session.
