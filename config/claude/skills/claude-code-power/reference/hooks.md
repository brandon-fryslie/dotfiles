# Hooks — the full event set and mechanisms

All hooks are configured under `settings.json` `hooks.<EventName>`. Use **PascalCase** event names (`SessionStart`, `PreToolUse`, …). The common events (`PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `UserPromptSubmit`, `PreCompact`) are assumed; this covers the obscure ones and the lesser-known mechanisms.

## Lesser-known events

- **`UserPromptExpansion`** — fires when a typed `/skill` or command expands into a prompt, *before Claude sees it*. Input: `command_name`, `command_input`, `expanded_prompt`. `additionalContext` **replaces** the expanded prompt; `decision: "block"` (exit 2) kills the expansion. Lets you rewrite what a slash command actually injects.
- **`PostToolBatch`** — fires once after a batch of parallel tool calls resolves, before the next model call. Input: `tool_calls[]`. `decision: "block"` (exit 2) stops the agentic loop. The only hook that sees a whole parallel batch.
- **`PermissionRequest`** / **`PermissionDenied`** — `PermissionRequest` can auto-decide via `hookSpecificOutput.decision.behavior` (`allow`/`deny`), rewrite args with `decision.updatedInput`, and teach future rules with `decision.permissionRules[]`. `PermissionDenied` (auto-mode classifier denial) can set `hookSpecificOutput.retry: true` to let the model retry.
- **`InstructionsLoaded`** — fires every time a CLAUDE.md / `.claude/rules/*.md` loads. Matchers: `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`. Input includes `memory_type` (`User`/`Project`/`Local`/`Managed`), `load_reason`, `trigger_file_path`. Async, observability-only — an audit/compliance hook.
- **`ConfigChange`** — fires when a settings file changes mid-session. Matchers: `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`. `decision: "block"` rejects the change (except `policy_settings`). `changed_keys[]` lists exact key paths.
- **`CwdChanged`** / **`FileChanged`** — react to `cd` (`old_cwd`/`new_cwd`) and watched-file changes (`change_type`: modified/created/deleted). Both get `CLAUDE_ENV_FILE` to persist env vars — the documented direnv-style integration path. Watch list registered via a `SessionStart` hook's `watchPaths` array.
- **`SubagentStart`** — inject `hookSpecificOutput.additionalContext` into a spawning subagent (matched by agent type). Pairs with `SubagentStop` (`decision: "block"` to refuse the subagent finishing).
- **`Setup`** — runs only under `--init` / `--init-only` / `--maintenance` (matchers `init`, `maintenance`). The bootstrap hook for `claude -p`.
- **`StopFailure`** — fires on API-error turn-end, matched on error type: `rate_limit`, `overloaded`, `billing_error`, `max_output_tokens`, etc. Can't block; lets you observe why a turn died.
- **`MessageDisplay`** — `hookSpecificOutput.displayContent` rewrites assistant text *on screen only* (transcript + Claude's context keep the original). 10s timeout.
- **`Elicitation`** / **`ElicitationResult`** — intercept MCP elicitation forms; auto-fill (`action: "accept"` + `content`) or decline before/after the user responds. Matched by MCP server name.
- **`WorktreeCreate`** — a command hook here prints the worktree path to stdout and that path is used; failing it aborts creation. A pluggable worktree provisioner.
- **Task/team hooks** — `TaskCreated` / `TaskCompleted` (exit 2 rolls back), `TeammateIdle` (exit 2 blocks idle; `continue:false` + `stopReason` stops the teammate).

## Mechanisms most people miss

- **Five handler types**, not just `command`: `command`, `http`, `mcp_tool`, **`prompt`** (an LLM yes/no decision; takes a `model` field), and experimental **`agent`** (subagent verification).
- **`PreToolUse` can rewrite input** via `hookSpecificOutput.updatedInput`. `permissionDecision` now includes a **`defer`** value alongside allow/deny/ask.
- **`PostToolUse` can rewrite ANY tool's output** (not just MCP) via `hookSpecificOutput.updatedToolOutput`. Use it to redact secrets from Bash output, normalize Read results, inject context. Also supports **`continueOnBlock`** — feed the rejection reason back to Claude and continue the turn instead of ending it.
- Per-hook fields: **`if`** (a permission-rule gate like `"Bash(git *)"` / `"Edit(*.ts)"`), **`once`**, **`async`** + **`asyncRewake`**, **`statusMessage`**.
- **`args: string[]` exec form** (v2.1.139+) — spawns the command directly without a shell, so path placeholders never need quoting (kills a quoting/injection class).
- **Matcher grammar:** plain `Bash` / `Edit|Write` are literal; *any other character* makes it a JS regex (`mcp__.*__write.*`).
- **Output controls:** top-level `continue: false` + `stopReason` (hard stop), `suppressOutput`, `systemMessage`, and **`terminalSequence`** (emit OSC 0/1/2/9/99/777/BEL escapes — desktop notifications, tab titles, bells, even without a controlling terminal).
- **Hook env vars:** `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE`, `CLAUDE_EFFORT` (current effort level), `CLAUDE_CODE_REMOTE` (`"true"` on web). Hooks also receive `effort.level` in JSON input.
- **`SessionStart` → `reloadSkills: true`** makes skills the hook installs available in the same session.

## Note on lockdown

`disableAllHooks` (any scope) disables hooks entirely; managed `allowManagedHooksOnly` restricts to managed-settings hooks. A Stop hook that keeps blocking turn-end is overridden by Claude Code after 8 consecutive blocks.
