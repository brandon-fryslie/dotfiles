# Context & session control

Surgical control over the context window, history, and session lifecycle — beyond `/clear` and `/compact`.

## `/btw <question>` — zero-cost side question

Ephemeral side question: full visibility into current context, **no tool access**, **never enters history**, runs even while Claude is working. In the answer overlay: `c` copies as raw Markdown; **`f` forks it into a real session** with tools. Use for "wait, what was X?" without polluting the transcript or spending context.

## Rewind & scoped summarization

- **`/rewind`** or **`Esc Esc`** on an *empty* input opens the rewind menu (if the input has text, `Esc Esc` clears it to history instead).
- Six actions, including the lesser-known **`Summarize from here`** / **`Summarize up to here`** — targeted compaction of *one side* of a selected message. `Summarize up to here` condenses earlier messages, keeping recent ones in full; `Summarize from here` condenses forward, keeping earlier ones intact. Original messages stay in the transcript. Surgical context control beyond `/compact`.
- Checkpointing only tracks edits made via **Claude's file tools** — *not* bash-modified files (`rm`/`mv`/`cp`), not external or concurrent-session edits. Every user prompt is a checkpoint; persists across sessions; cleaned up with sessions after 30 days (`cleanupPeriodDays`).
- Disable file tracking: `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING=1`.
- To branch instead of revert: `claude --continue --fork-session`.

## Steering compaction

- The summarizer reads `CLAUDE.md` — a line like *"When compacting, always preserve the full list of modified files and any test commands"* actually steers it.
- After compaction, only the most-recent invocation of each skill is re-attached (first ~5,000 tokens each, 25,000-token shared budget) — **re-invoke a large skill after compaction to restore its full content**.
- Tune the trigger point: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (1–100, fire earlier/later); `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (override the token capacity used in the calc).

## Transcript viewer (`Ctrl+O`, fullscreen)

- **`[`** dumps the full conversation into native terminal scrollback (so `Cmd+F` / tmux copy-mode can search it).
- **`v`** opens it in `$VISUAL` / `$EDITOR`.
- **`{` / `}`** jump between user prompts (vim paragraph motion). `?` shows the shortcut panel.

## Session lifecycle & resumption

- **`claude --from-pr 1234`** — jump straight to the session that created a PR, skipping the picker. (`/resume` + a pasted PR URL also filters; GitHub/GHE/GitLab/Bitbucket URLs work.)
- **`claude --continue --fork-session`** — branch the current session instead of continuing it linearly.
- **`--teleport`** — pull a web session local. **`--remote "task"`** — spawn a web session.
- **`CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1`** — keep nested interactive sessions in `--resume` / history.
- **`CLAUDE_CODE_TASK_LIST_ID=<name>`** — share a task list across sessions via `~/.claude/tasks/`. (`Ctrl+T` toggles the task list display.)
- **`claude project purge [path] --dry-run`** — wipe all local state for a project (transcripts, task lists, file history, config entry). Flags: `-y`, `-i`, `--all`.
- **`/recap`** — on-demand session recap; an auto-recap appears after stepping away (3+ min unfocused, 3+ turns).
