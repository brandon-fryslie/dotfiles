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
tmux-command context <target> [N]          # gather before acting: the pane's id line + N screen lines (default 200)
tmux-command send  <target> <command...>   # type a literal command line, then submit it
tmux-command keys  <target> <key...>       # send raw keys (Enter Down Up Escape BSpace) to drive a picker
tmux-command read-screen <target> [N]      # capture N lines (default 200) — re-check / verify the effect
```

`target` is tmux's `session:window.pane`, or a shorthand the shared resolver expands (same grammar in `/tmux-talk`):

| form | means |
| --- | --- |
| `dotfiles:2.1` | full address |
| `dotfiles:2` | window 2, pane defaults to 1 |
| `dotfiles:orca` | window **named** `orca` (looked up; ambiguous/unknown names error) |
| `:2.1` / `:2` | same session |
| `.2` | same session **and** window, pane 2 |
| `:self` | the pane you (the driver) are running in |

Every verb resolves its target through `tmux-shared/bin/tmux-resolve` first, so a bad, unknown, or ambiguous target fails loudly instead of tmux silently retargeting the active pane.

## Flow: context → decide → send → verify

Start by running `context` — it returns everything you need to reply, so you never have to assemble the gather by hand:

```bash
TMUXCMD=~/.claude/skills/tmux-command/bin/tmux-command
TARGET="work:0.0"

# 1. Gather the context you need to reply — one call.
$TMUXCMD context "$TARGET"

# 2. Decide the command from what came back, then send it.
$TMUXCMD send "$TARGET" "/compact focus on the auth refactor"

# 3. Verify — a TUI returns no exit code, the pane is the only signal.
sleep 2
$TMUXCMD read-screen "$TARGET" 40
```

`context` prints the pane's `cmd=`/`title=` line and its live screen. That one read tells you the harness (→ which `references/<harness>.md` to open), whether it's idle or mid-generation, and which screen is up — everything that decides *what* to send and *whether it's safe to send now*. Claude Code panes report `cmd=<version-number>` (e.g. `2.1.175`), not `cmd=claude`, so identify them by `title=` (`✳ Claude Code`) or the UI.

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
- **Home screen swallows the first Enter.** When `context` showed Claude Code's "describe a task" home screen, `send` may leave the command sitting in the input (the first Enter is rebound to "collapse"/"create"). If the post-send `read-screen` confirms it never submitted, send one more `keys "$TARGET" Enter`.
- **One command per `send`.** `send` appends exactly one Enter. To chain commands, call `send` again after verifying the first landed.

## References

- `references/claude-code.md` — which Claude Code commands need this skill (and which the in-session agent can already invoke itself), picker commands, and safe-to-test commands
- `references/codex.md`, `references/opencode.md` — per-harness command sets
