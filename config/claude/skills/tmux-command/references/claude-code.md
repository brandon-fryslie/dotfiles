# Claude Code — commands worth driving from outside

The in-session model can invoke **skills** itself (via the Skill tool) but **cannot** type a front-end command into its own prompt. Anything the CLI interprets — context, model, session, and display control — only happens when something types it at the prompt. That is the gap this skill fills.

## Recognizing a Claude Code pane

`tmux-command list` shows Claude Code panes as `cmd=<version>` (e.g. `2.1.175`), not `cmd=claude`. Identify by the `title=` (`✳ Claude Code` or the session's task title). When unsure, `read-screen` the pane — the prompt is `❯` with a `claude` label on the right rule.

## Most useful to drive externally (front-end commands, act on the session)

These cannot be triggered by the agent in the session — drive them here.

| Command | Effect | Notes |
| --- | --- | --- |
| `/clear` | Wipe context, start fresh conversation | **Destructive** — verify before and after |
| `/compact [instructions]` | Summarize the conversation to free context | Runs for a few seconds; `read-screen` to confirm it finished |
| `/context` | Show context-usage grid | Read-only, instant — safe to test the pipe with |
| `/model [model]` | Switch model | No-arg opens a **picker** (needs `keys`) |
| `/effort [level]` | Set reasoning effort (`low`…`max`, `ultracode`) | No-arg opens a slider (needs `keys` ←/→) |
| `/fast [on\|off]` | Toggle fast mode | |
| `/rewind` | Roll code/conversation back to a checkpoint | **Destructive**, opens a **picker** |
| `/resume [session]` | Resume/switch conversation | No-arg opens a **picker** |
| `/branch [name]` | Fork the conversation at this point | |
| `/cd <path>` / `/add-dir <path>` | Move / add a working directory | |
| `/memory` | Edit memory files | Opens an editor UI |
| `/config` / `/permissions` | Settings / permission rules | Open **dialogs** (need `keys`) |
| `/status` / `/usage` | Show status / cost | Read-only |
| `/diff` | Open the diff viewer | Interactive; `Escape` to exit |
| `/theme` / `/statusline` / `/tui` / `/focus` | Display controls | |
| `/export [file]` / `/copy [N]` / `/rename [name]` | Export / copy / rename | |
| `/goal [condition]` | Set a cross-turn goal | |

The full set is large and version-dependent; `send "$TARGET" /help` lists what that build actually has.

## Commands the in-session agent can already invoke — usually skip tmux-command

These are **skills/workflows** the model runs itself, so you rarely need to inject them: `/code-review`, `/simplify`, `/loop`, `/debug`, `/verify`, `/run`, `/batch`, `/claude-api`, `/deep-research`, `/fewer-permission-prompts`. Use tmux-command for them only when you specifically want the *human-prompt* entry point rather than asking the agent to run the skill.

## Picker / dialog commands — pair `send` with `keys`

`/model`, `/effort`, `/permissions`, `/config`, `/resume`, `/agents`, `/mcp`, `/theme`, `/rewind`, `/diff` open an interactive UI. `send` opens it; navigate and confirm with `keys` (`Up`/`Down`/`Left`/`Right`/`Enter`/`Escape`). `read-screen` between steps to see what's highlighted.

## Safe to test the pipe (read-only, instant, no side effects)

`/context`, `/status`, `/usage`, `/help`, `/diff`, `/cost`. Use one of these to confirm your `send` reaches the pane before sending anything destructive.

## Destructive / irreversible — verify carefully

`/clear` (wipes context), `/compact` (summarizes away detail), `/rewind` (rolls back), `/quit` `/exit` (ends the session), `/logout`. `read-screen` before to confirm it's idle and after to confirm the result.

## The home-screen Enter quirk

Claude Code's brand-new "describe a task for a new session" home screen rebinds the first Enter ("enter to collapse" / "enter to create"), so `send` may leave the command sitting in the input. An **active conversation** submits on a single Enter (what `send` does). If `read-screen` shows the command un-run on a home screen, send one extra `keys "$TARGET" Enter`.
