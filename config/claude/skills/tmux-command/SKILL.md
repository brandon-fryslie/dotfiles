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

## Always read the pane before you send

Reading the target is **phase one, every time** — your first action is never `send`. The pane's current state is a value you must *observe*, not assume: a blind send races whatever the pane is actually doing and silently corrupts. One opening `read-screen` (after `list`) establishes the three facts every send depends on:

1. **Which harness is running** — it picks the command set. `list` shows `cmd=` and `title=`; Claude Code panes report `cmd=<version-number>` (e.g. `2.1.175`), **not** `cmd=claude` — so identify by `title=` (`✳ Claude Code`) or by recognizing the UI in the read. Then read the matching `references/<harness>.md` (`claude-code.md`, `codex.md`, `opencode.md`). Sending a Claude command into a codex session does nothing useful and may submit garbage as a prompt.
2. **Idle or mid-generation** — whether it is safe to send at all. Keystrokes typed into a busy session queue and get misread (Claude's spinner ends in `ing…`). If it's working, wait and re-read until idle.
3. **Which screen is up** — it decides what actually submits. An active conversation submits on a single Enter (what `send` does). Claude Code's "describe a task" home screen intercepts the first Enter. A picker or editor already open means the pane is driven by `keys`, not a fresh command.

Only once the read has answered all three do you choose the command and send it.

## Flow: read → decide → send → verify

```bash
TMUXCMD=~/.claude/skills/tmux-command/bin/tmux-command
TARGET="work:0.0"

# 1. READ FIRST — observe the pane; never assume its state.
$TMUXCMD list | grep "^$TARGET"      # which harness? → read references/<harness>.md
$TMUXCMD read-screen "$TARGET" 40    # idle or generating? which screen is up?

# 2. DECIDE from what you read, then SEND the command.
$TMUXCMD send "$TARGET" "/compact focus on the auth refactor"

# 3. VERIFY — read again; a TUI returns no exit code, the pane is the only signal.
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
- **Home screen swallows the first Enter.** When the opening read showed Claude Code's "describe a task" home screen, `send` may leave the command sitting in the input (the first Enter is rebound to "collapse"/"create"). If the post-send read confirms it never submitted, send one more `keys "$TARGET" Enter`.
- **One command per `send`.** `send` appends exactly one Enter. To chain commands, call `send` again after verifying the first landed.

## References

- `references/claude-code.md` — which Claude Code commands need this skill (and which the in-session agent can already invoke itself), picker commands, and safe-to-test commands
- `references/codex.md`, `references/opencode.md` — per-harness command sets
