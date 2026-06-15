# opencode — commands worth driving from outside

opencode's slash commands are front-end TUI actions — the agent in the session can't type them itself. All are submitted with **Enter**, so `tmux-command send` drives them directly.

## Recognizing an opencode pane

opencode runs as the `opencode` binary, so `tmux-command list` should show `cmd=opencode`. Confirm with `read-screen`. **Built-ins can be overridden by user custom commands**, so the real set on a given machine may differ — `send "$TARGET" /help` shows what that install actually has.

## Two ways to trigger — `send` (slash) or `keys` (leader)

opencode exposes the common actions on a `ctrl+x` leader and a `ctrl+p` command palette. Either works:

```bash
$TMUXCMD send "$TARGET" /compact      # slash form
$TMUXCMD keys "$TARGET" C-x c         # leader form (ctrl+x then c) — same action
$TMUXCMD keys "$TARGET" C-p           # open the command palette, then type to filter
```

Leader bindings: `C-x c`→/compact · `C-x e`→/editor · `C-x m`→/models · `C-x n`→/new · `C-x q`→/exit · `C-x r`→/redo · `C-x t`→/themes · `C-x u`→/undo · `C-x x`→/export · `C-x l`→/sessions.

## Most useful to drive externally

| Command (aliases) | Effect | Notes |
| --- | --- | --- |
| `/new` (`/clear`) | Start a fresh session | **Destructive** to context |
| `/compact` (`/summarize`) | Compress session history | |
| `/models` | Switch model | **Picker** |
| `/sessions` (`/resume`, `/continue`) | List and switch sessions | **Picker** |
| `/themes` | Switch theme | **Picker** |
| `/connect` | Add a provider / API key | **Picker** |
| `/details` | Toggle tool-execution detail visibility | Immediate |
| `/thinking` | Toggle reasoning-block visibility | Immediate |
| `/share` / `/unshare` | Enable / disable session sharing | Immediate |
| `/undo` | Remove last user message, responses, **and file changes** | **Destructive** — touches files |
| `/redo` | Restore an undone message **and file changes** | Touches files |
| `/export` | Export conversation to Markdown, open in `$EDITOR` | Opens an editor — see caution |
| `/editor` | Compose the next message in `$EDITOR` | Opens an editor — see caution |
| `/init` | Guided config setup | **Interactive** |
| `/help` | Help dialog | Read-only |

## Picker / dialog commands — pair `send` with `keys`

`/models`, `/sessions`, `/themes`, `/connect`, `/help`, `/init` open an interactive UI. `send` opens it; navigate and confirm with `keys` (`Up`/`Down`/`Enter`/`Escape`). `read-screen` between steps.

## Editor-opening commands — caution

`/editor` and `/export` launch the pane's `$EDITOR`. Once an editor owns the pane, you're sending editor keystrokes, not opencode commands — `read-screen` to see which program has focus, and drive/exit the editor with `keys` (e.g. `Escape :q Enter` for vim) before sending more opencode commands.

## Safe to test the pipe (read-only / reversible)

`/help`, `/models`, `/themes`, `/sessions` (without selecting), `/details`, `/thinking`. Use one to confirm `send` reaches the pane before sending anything destructive.

## Destructive / session-ending — verify carefully

`/new` (alias `/clear`, wipes context), `/undo` / `/redo` (revert/restore **file changes**, not just chat), `/exit` (aliases `/quit`, `/q` — terminates opencode). `read-screen` before to confirm idle and after to confirm the result.

## Not documented — don't assume

The docs don't state whether any command is disabled while a task is running, nor a queue-while-busy mechanism (Codex's `Tab`). Treat that as unknown: `read-screen` and confirm the session is idle before sending, per the general flow in SKILL.md.
