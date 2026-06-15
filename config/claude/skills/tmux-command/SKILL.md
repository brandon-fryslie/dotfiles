---
name: tmux-command
description: This skill should be used when the user asks to "run a slash command in another Claude session", "trigger /clear (or /compact, /model, /context, /rewind, …) in a tmux pane", "drive built-in commands in a running agent session over tmux", "send a slash command to the Claude/codex/opencode instance in session X", or otherwise wants to execute a harness command that the agent running in that session cannot invoke itself. Distinct from tmux-talk: this sends the raw command with no message envelope.
---

# tmux-command

Inject a harness's built-in slash command (or the keystrokes that drive its pickers) into another agent session running in a tmux pane. Built-in commands like `/clear`, `/compact`, `/model`, `/context`, `/rewind`, `/resume` are interpreted by the CLI front-end, not the model — so the agent running in that session **cannot trigger them itself**. An outside driver must type them into the pane. That is this skill.

This is **not** tmux-talk. tmux-talk wraps a message in a `From:/To-reply:` envelope for a human/agent reader. Here the receiver is the CLI parser, so the bytes sent must be *exactly* the command — there is no wrapper.

```bash
TMUXCMD=~/.claude/skills/tmux-command/bin/tmux-command
```

## Subcommands

```bash
tmux-command list                          # discover panes: address, running cmd, title
tmux-command send  <target> <command...>   # type a literal command line, then submit it
tmux-command keys  <target> <key...>       # send raw keys (Enter Down Up Escape BSpace) to drive a picker
tmux-command read-screen <target> [N]      # capture N lines (default 200) — verify the effect
```

`target` is tmux's `session:window.pane`. When the user says "session X, window Y", map to `X:Y.0`.

## Identify the harness first — it picks the command set

The available commands differ per harness, so **before sending anything, know which harness the target runs** and read the matching reference:

- `references/claude-code.md` — Claude Code
- `references/codex.md` — Codex
- `references/opencode.md` — opencode

Run `tmux-command list`. Claude Code panes report `cmd=<version-number>` (e.g. `2.1.175`), **not** `cmd=claude` — so read the `title=` field (`✳ Claude Code`) and, when unsure, `read-screen` the pane and recognize the UI. Do not guess the harness: sending a Claude command into a codex session does nothing useful and may submit garbage as a prompt.

## Flow

```bash
TMUXCMD=~/.claude/skills/tmux-command/bin/tmux-command
TARGET="work:0.0"

# 1. Confirm what's running there, then read references/<harness>.md.
$TMUXCMD list | grep "^$TARGET"

# 2. Send the command.
$TMUXCMD send "$TARGET" "/compact focus on the auth refactor"

# 3. Verify it took effect — a TUI returns no exit code, the pane is the only signal.
sleep 2
$TMUXCMD read-screen "$TARGET" 40
```

## Commands that open a picker need `keys`

Some commands open an interactive list instead of acting immediately (`/model`, `/permissions`, `/resume`, `/agents`). `send` opens the dialog; drive the selection with raw keys:

```bash
$TMUXCMD send "$TARGET" "/model"        # opens the model picker
sleep 1
$TMUXCMD keys "$TARGET" Down Down Enter # move to the choice and confirm
$TMUXCMD read-screen "$TARGET" 20       # confirm the new model
```

## Gotchas

- **Verify, never assume.** The target is another process with no exit code back to you. After every `send`, `read-screen` and confirm the command actually ran — especially for destructive ones (`/clear`, `/compact`, `/rewind`).
- **Active session vs. home screen.** In an active conversation a single Enter submits, and `send` handles that. Claude Code's brand-new "describe a task" home screen intercepts the first Enter ("enter to collapse"/"enter to create") — if `read-screen` shows the command still sitting in the input, send one more `keys <target> Enter`.
- **Don't send while it's generating.** Keystrokes sent into a busy session queue and get misread. `read-screen` first; if it's working (Claude's spinner ends in `ing…`), wait.
- **One command per `send`.** `send` appends exactly one Enter. To chain commands, call `send` again after verifying the first landed.

## References

- `references/claude-code.md` — which Claude Code commands need this skill (and which the in-session agent can already invoke itself), picker commands, and safe-to-test commands
- `references/codex.md`, `references/opencode.md` — per-harness command sets
