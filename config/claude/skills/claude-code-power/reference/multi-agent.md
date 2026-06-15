# Multi-agent orchestration

Split work across many agents — subagents, teams, dynamic workflows, forks — and isolate them with worktrees.

## Advanced subagent frontmatter

Full field set (also definable inline as JSON via `--agents '{...}'`, session-only, never written to disk):
`description, prompt, tools, disallowedTools, model, permissionMode, mcpServers, hooks, maxTurns, skills, initialPrompt, memory, effort, background, isolation, color`.

- **`memory: user|project|local`** — persistent cross-session memory dir (`~/.claude/agent-memory/<name>/`, `.claude/agent-memory/<name>/`, `.claude/agent-memory-local/<name>/`). Auto-injects the first 200 lines / 25KB of `MEMORY.md`; auto-enables Read/Write/Edit.
- **`skills:`** — preloads the *full skill content* (not just the description) into the subagent at startup. Cannot preload `disable-model-invocation: true` skills.
- **Inline `mcpServers:`** — define an MCP server for one subagent only, so its tool descriptions never consume the main conversation's context. Connected on start, disconnected on finish.
- **`initialPrompt`** — auto-submitted as the first user turn when the agent runs as the main session (`--agent`); commands/skills are processed.
- **`effort`** per-subagent override (`low`…`max`); **`background: true`** always runs concurrent; **`color`** for display.
- **Model resolution order:** `CLAUDE_CODE_SUBAGENT_MODEL` env → per-invocation param → frontmatter `model` → main conversation.
- **`Agent(worker, researcher)` tools syntax** — allowlist which subagent types a main-thread `--agent` session may spawn. `Agent` (no parens) = any; omit `Agent` = none. (`Task(...)` still aliases `Agent`.)
- **Nested subagents** (v2.1.172+): a subagent can spawn its own subagents. Background subagents at depth 5 lose the Agent tool. Transcripts at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`.
- **Resume a subagent** via `SendMessage` with its agent ID (requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Explore/Plan are one-shot and unresumable.
- **Disable built-ins:** `permissions.deny: ["Agent(Explore)"]`, or `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` in headless/SDK.
- Plugin subagents silently ignore `hooks`, `mcpServers`, `permissionMode`.
- `subagent_type` matches case/separator-insensitively (`"Code Reviewer"` → `code-reviewer`).

### Forks — a subagent that inherits the full conversation

`/fork <directive>` (default-on from v2.1.161; else `CLAUDE_CODE_FORK_SUBAGENT=1`). Inherits the full conversation + **shares the parent's prompt cache** (cheaper than a fresh subagent); its tool calls stay out of your context. `CLAUDE_CODE_FORK_SUBAGENT=1` makes Claude fork instead of using general-purpose, running all spawns in background. Forks can't spawn forks.

## Agent teams — multiple full Claude instances messaging each other (v2.1.32+, experimental)

Enable: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (env or settings). Unlike subagents, teammates have independent context, talk directly to each other, share a task list, and can be messaged directly.

- **Display mode** `"teammateMode"` in `~/.claude/settings.json`: `"auto"` (default) / `"tmux"` (split panes via tmux or iTerm2 `it2`) / `"in-process"`. Per session: `claude --teammate-mode in-process`.
- **Reuse a subagent definition as a teammate** ("spawn a teammate using the security-reviewer agent type…"): honors that def's `tools` + `model`, body appended to system prompt. **But `skills` and `mcpServers` frontmatter are not applied** — those load from project/user settings instead.
- **Plan-approval gating:** ask the lead to "require plan approval before they make any changes" — teammates work read-only until the lead approves. Steer with "only approve plans that include test coverage".
- **Quality-gate hooks:** `TeammateIdle`, `TaskCreated`, `TaskCompleted` — exit code 2 sends feedback and blocks the idle/creation/completion.
- **State on disk:** team config `~/.claude/teams/{team-name}/config.json` (holds session + tmux pane IDs — do not hand-edit, overwritten on state update); tasks `~/.claude/tasks/{team-name}/`. No project-level equivalent.
- Task claiming uses file locking; tasks support dependencies that auto-unblock.
- Limits: `/resume`/`/rewind` don't restore in-process teammates; one team at a time; no nested teams; lead is fixed for life; teammates inherit the lead's permission mode at spawn. Split panes unsupported in VS Code terminal / Windows Terminal / Ghostty.

## Dynamic workflows — a JS orchestration script Claude writes (`/workflows`)

Claude writes a JavaScript script; a background runtime executes it across many subagents (up to **16 concurrent**, **1,000 agents/run**). Intermediate results live in script variables, not your context — only the final answer returns.

- **Trigger one-off:** include the keyword `ultracode` in the prompt (or say "use a workflow"). `Option+W`/`Alt+W` dismisses the highlight.
- **Always-on:** `/effort ultracode` plans a workflow for every substantive task.
- **Bundled:** `/deep-research <question>` — fan-out search, cross-check sources, vote per claim, cited report with unsupported claims filtered (requires the WebSearch tool).
- **Save for reuse:** in `/workflows`, select the run and press `s` → saves to `.claude/workflows/` (project) or `~/.claude/workflows/` (personal); becomes `/<name>`.
- **Args:** saved workflows read a global named `args` (structured data, not a string — call array/object methods directly; `undefined` if omitted).
- **Script location:** every run writes its script under `~/.claude/projects/<session>/`; you can read/diff/edit and relaunch.
- **Permission subtlety:** workflow subagents always run in `acceptEdits` and inherit your tool allowlist regardless of session mode — file edits auto-approve, but un-allowlisted shell/web/MCP calls still prompt mid-run. Pre-allowlist before a long run.
- **Disable:** `"disableWorkflows": true` or `CLAUDE_CODE_DISABLE_WORKFLOWS=1`. Resumable only within the same session.

## Worktrees — parallel isolation

- **`claude --worktree <name>`** / `-w` — isolated worktree under `.claude/worktrees/<value>/` on branch `worktree-<value>`; omit name to auto-generate. **`--worktree "#1234"`** branches from a PR (fetches `pull/<number>/head` to `.claude/worktrees/pr-<number>`); a full PR URL works too.
- **`.worktreeinclude`** (project root, `.gitignore` syntax) — auto-copies gitignored files like `.env` into every new worktree (applies to `--worktree`, subagent worktrees, desktop sessions). Only files that are both matched **and** gitignored copy.
- **`worktree.baseRef`**: `"fresh"` (default, branch from `origin/HEAD`) | `"head"` (carry your unpushed commits into new worktrees).
- **`isolation: worktree`** subagent frontmatter — each subagent gets a temp worktree, auto-removed if it made no changes. Branches from default unless `worktree.baseRef: "head"`.
- **`worktree.bgIsolation: "none"`** — background sessions edit the working copy directly, skipping isolation.
- **`WorktreeCreate` / `WorktreeRemove` hooks** — replace git logic entirely for SVN/Perforce/Mercurial. Note: `.worktreeinclude` is **not** processed when a `WorktreeCreate` hook is set — copy configs in the hook.
- While an agent runs, its worktree is `git worktree lock`ed so cleanup can't remove it. The `cleanupPeriodDays` sweep only removes subagent/background worktrees, never `--worktree` ones.

## Managing background agents

- `claude agents` (research preview) — one dashboard for every CC session (running/blocked/done); attach with Enter, `←` back. `--cwd <path>` scopes the list. Dispatch flags include `--add-dir --settings --mcp-config --plugin-dir --permission-mode --model --effort`.
- `claude agents --json [--all]` — live sessions as JSON for status bars / custom pickers.
- `claude agents attach <id>` / `logs <id>` / `respawn <id>` / `stop` / `kill` / `rm <id>` — shell control.
- `claude daemon status` / `daemon stop --any --keep-workers` — the supervisor.
- `Ctrl+X Ctrl+K` stops all background subagents. `Ctrl+B` backgrounds the running job (tmux: press twice).
