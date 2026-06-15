# Codex — commands worth driving from outside

Codex's slash commands are front-end TUI actions typed at the composer — the agent running the session cannot type them into its own prompt. Drive them here.

## Recognizing a Codex pane

Codex runs as the `codex` binary, so `tmux-command list` should show `cmd=codex`. Confirm with `read-screen` — the Codex composer and footer status line are distinctive. Don't infer Codex from a version string the way you would Claude Code.

## Codex's timing model — different from Claude Code

This changes *when* you can send:

- **While a task is running**, `send` a command then `keys "$TARGET" Tab` to **queue** it for the next turn. Codex parses queued commands when they run, so menus/errors appear after the current turn finishes.
- **Several commands are disabled mid-task**: `/clear`, `/archive`, `/plan`. Sending them while busy does nothing — `read-screen` to confirm the session is idle first, or queue with `Tab`.
- `<kbd>Ctrl</kbd>+<kbd>L</kbd>` only clears the view (keeps the chat); `/clear` starts a new conversation. Don't confuse them.

## Most useful to drive externally

| Command | Effect | Notes |
| --- | --- | --- |
| `/clear` | Clear terminal **and** start a fresh chat | **Destructive**; disabled mid-task |
| `/new` | New conversation, same CLI session (no view clear) | **Destructive** to context |
| `/compact` | Summarize the conversation to free tokens | Offers a confirm — `keys` to accept |
| `/model` | Choose model (and reasoning effort) | **Picker** |
| `/fast on\|off\|status` | Toggle the model's Fast tier | Direct arg, no picker; hidden if no Fast tier |
| `/personality friendly\|pragmatic\|none` | Communication style | **Picker** with no arg; hidden if unsupported |
| `/permissions` | Set approval preset (Auto / Read Only / profiles) | **Picker** |
| `/approve` | Retry one auto-review-denied action | Confirm dialog |
| `/plan [prompt]` | Switch to plan mode (optional inline prompt) | Disabled mid-task |
| `/goal <objective>` / `/goal pause\|resume\|clear` | Set/pause/resume/clear a task goal | Direct arg; ≤4000 chars |
| `/raw on\|off` | Toggle raw scrollback | Direct arg |
| `/vim` | Toggle composer Vim mode | |
| `/status` | Model, approval policy, writable roots, token usage | Read-only |
| `/diff` | Git diff incl. untracked files | Read-only; scroll to review |
| `/mention <path>` | Attach a file to the conversation | **Picker** filters matches |
| `/resume` / `/fork` / `/agent` | Resume / fork / switch thread | `/resume`, `/agent` are **pickers** |
| `/theme` / `/statusline` / `/title` / `/keymap` | Display & keybinding config | **Pickers**; persist to `config.toml` |
| `/experimental` | Toggle experimental features (e.g. subagents) | **Picker**; may need restart |
| `/memories` | Configure memory use/generation | **Picker** |
| `/copy` | Copy latest completed output | Also `Ctrl+O` |
| `/init` | Generate an `AGENTS.md` scaffold | Writes a file |
| `/ide` | Pull IDE context into the next prompt | |

The full set is version-dependent; `send "$TARGET" /status` plus opening the slash popup (`send "$TARGET" /`) confirms what a given build exposes.

## Picker / dialog commands — pair `send` with `keys`

`/model`, `/personality`, `/permissions`, `/resume`, `/fork`, `/agent`, `/apps`, `/plugins`, `/hooks`, `/skills`, `/mention`, `/theme`, `/statusline`, `/title`, `/keymap`, `/experimental`, `/memories` open an interactive UI. `send` opens it; navigate and confirm with `keys` (`Up`/`Down`/`Enter`/`Escape`; `Space` toggles plugin/feature state in some browsers). `read-screen` between steps to see what's highlighted.

## Direct-argument commands — no picker, act immediately

`/fast on|off|status`, `/raw on|off`, `/goal <text>|pause|resume|clear`, `/mcp verbose`, `/plan <inline prompt>`. Send the full line in one `send`.

## Safe to test the pipe (read-only, no side effects)

`/status`, `/diff`, `/mcp`, `/debug-config`, `/ps`. Use one to confirm `send` reaches the pane before sending anything destructive.

## Destructive / session-ending — verify carefully

`/clear`, `/new`, `/compact` (summarizes away detail), `/archive` (archives **and exits** Codex), `/quit`, `/exit` (aliases), `/logout`. `/stop` (alias `/clean`) cancels background terminals. `read-screen` before to confirm idle and after to confirm the result.

## Background terminals

`/ps` lists experimental background terminals and recent output (populated only when `unified_exec` is in use); `/stop` cancels them all.
