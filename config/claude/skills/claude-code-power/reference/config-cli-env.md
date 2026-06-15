# Configuration, CLI & environment

Tune and launch the harness: obscure settings keys, behavior-changing env vars, CLI flags/subcommands, and the sandbox/keybinding/fast-mode/output-style knobs.

## Launch & debug flags

- **`--safe-mode`** (v2.1.169+) — disable **all** customizations (hooks/skills/plugins/MCP) to debug a broken config, while keeping auth/model/tools/permissions. Sets `CLAUDE_CODE_SAFE_MODE`. The surgical "is it me or my config?" switch.
- **`--bare`** — skip discovery of hooks/skills/plugins/MCP/auto-memory/CLAUDE.md for fast scripted starts (Bash+Read+Edit only; sets `CLAUDE_CODE_SIMPLE`). Broader than `--safe-mode`.
- **`--exclude-dynamic-system-prompt-sections`** — move per-machine prompt sections (cwd, env, git flag) into the first user message for prompt-cache reuse across machines/users in `-p` fleets.
- **`--agents '{...}'`** — define subagents inline as JSON; **`--agent <name>`** picks one for the session.
- **`--json-schema '{...}'`** — force `-p` output to validate against a JSON Schema (structured outputs).
- **Tool scoping:** `--tools "Bash,Edit,Read"` (restrict available tools) vs `--allowedTools` (auto-approve) vs `--disallowedTools "mcp__*"` (a bare name removes the tool from context; a scoped rule denies only matching calls).
- **`--fallback-model sonnet,haiku`** — comma-separated fallback chain (used for the rest of the session if the primary isn't found).
- **`--max-budget-usd 5.00`**, `--max-turns`, `--no-session-persistence`.
- **`--bg "task"`** + **`--exec 'pytest -x'`** — launch a background agent or PTY shell job and return immediately.
- **`--setting-sources user,project`** (choose which scopes load) and **`--settings '<inline json>'`** (per-key session overrides).
- `--init` / `--init-only` / `--maintenance` drive the `Setup` hook matchers. `--allow-dangerously-skip-permissions` only *adds* bypass to the Shift+Tab cycle (vs `--dangerously-skip-permissions`, which starts in it).
- Note: `claude --help` does not list every flag — absence from help ≠ unavailable.

## Subcommands worth knowing

- `claude auto-mode defaults` / `auto-mode config` — dump the auto-mode classifier rules as JSON.
- `claude agents --json [--all]`, `attach <id>`, `logs <id>`, `respawn <id>`, `stop`/`kill`, `rm <id>` — shell control of background sessions; `claude daemon status` / `daemon stop --any --keep-workers` for the supervisor.
- `claude setup-token` — long-lived OAuth token for CI (prints, doesn't save; needs a subscription).
- `claude project purge [path] --dry-run` — wipe all local state for a project.
- `claude ultrareview [target] --json` — non-interactive deep review (exit 0/1).

## Obscure settings keys

Skill control:
- **`skillOverrides`** — per-skill visibility: `{"skill-name": "on" | "name-only" | "user-invocable-only" | "off"}` (v2.1.129+).
- **`maxSkillDescriptionChars`** (default 1536) and **`skillListingBudgetFraction`** (default 0.01 = 1% of context) — tune how much context the skill listing eats.
- **`disableSkillShellExecution`** — kills inline `` !`...` `` shell blocks in skills. Also `disableBundledSkills`, `disableWorkflows`, `claudeMdExcludes`.

Behavior/UX:
- **`spinnerTipsOverride`** `{tips:[], excludeDefault:bool}` and **`spinnerVerbs`** `{mode:"replace"|"append", verbs:[]}` — rewrite the spinner.
- **`alwaysThinkingEnabled`**, **`effortLevel`** (`low`/`medium`/`high`/`xhigh`), **`editorMode`** (`normal`/`vim`).
- **`fastModePerSessionOptIn`** (fast mode resets off each session).
- **`autoMemoryDirectory`** / **`autoMemoryEnabled`**, `showThinkingSummaries`, `awaySummaryEnabled`, `prefersReducedMotion`.
- **`preferredNotifChannel`**: `auto`/`terminal_bell`/`iterm2`/`iterm2_with_bell`/`kitty`/`ghostty`/`notifications_disabled`.
- **`attribution`** `{commit, pr}` (replaces deprecated `includeCoAuthoredBy`) — customize commit/PR bylines. **`prUrlTemplate`** with `{host}/{owner}/{repo}/{number}/{url}` placeholders.
- **`skipWebFetchPreflight`** (skip WebFetch domain safety check — for restrictive-egress Bedrock/Vertex).

Auth helpers (each runs a script): `apiKeyHelper` (TTL via `CLAUDE_CODE_API_KEY_HELPER_TTL_MS`), `awsAuthRefresh`, `awsCredentialExport`, `gcpAuthRefresh`, `otelHeadersHelper`.

Lockdown: `disableAllHooks`, `disableAutoMode: "disable"`, `disableRemoteControl`, `disableAgentView`, `enableAllProjectMcpServers`, `enabledMcpjsonServers`/`disabledMcpjsonServers`, `forceLoginMethod`/`forceLoginOrgUUID`.

**Precedence** (high→low): Managed → CLI args → `.claude/settings.local.json` → `.claude/settings.json` → `~/.claude/settings.json`. **Exception:** `permissions` allow/deny/ask **merge** across all scopes rather than override. `model` and `outputStyle` require a session restart; most other keys hot-reload (and fire `ConfigChange`).

## Behavior-changing env vars

- **`CLAUDE_CODE_EFFORT_LEVEL`** (`low`…`max`, `auto`) — overrides `/effort` and the setting.
- **`MAX_THINKING_TOKENS=0`** forces thinking off (except Fable 5); `CLAUDE_CODE_DISABLE_THINKING=1` strips the param; `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`.
- **`CLAUDE_CODE_SUBAGENT_MODEL`** — model for subagents.
- **`CLAUDE_AUTO_BACKGROUND_TASKS=1`** force-backgrounds after ~2 min; `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` disables.
- **`BASH_DEFAULT_TIMEOUT_MS`** (120k), **`BASH_MAX_TIMEOUT_MS`** (600k), **`BASH_MAX_OUTPUT_LENGTH`** (overflow saved to a file; model gets path + preview), `MAX_MCP_OUTPUT_TOKENS`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`.
- **`CLAUDECODE=1`** is set in every subprocess Claude spawns; **`CLAUDE_CODE_CHILD_SESSION=1`** (v2.1.172+) distinguishes a nested `claude` from a top-level launch (useful in agent-spawning scripts to avoid recursion).
- **`CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`** — return to project cwd after each Bash command.
- **`CLAUDE_CODE_ATTRIBUTION_HEADER=0`** — drop the attribution block to improve prompt-cache hits on gateways. `ANTHROPIC_BETAS` (works with all auth, unlike `--betas`), `ANTHROPIC_CUSTOM_HEADERS`.
- Rendering: `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` (keep conversation in native scrollback), `CLAUDE_CODE_DISABLE_MOUSE=1`, `CLAUDE_CODE_ACCESSIBILITY=1`.
- Bulk-off: **`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`** = telemetry + autoupdater + feedback + error-reporting in one. `CLAUDE_CODE_DISABLE_CRON` kills `/loop` + scheduled tasks.
- Debug: `CLAUDE_CODE_DEBUG_LOGS_DIR` (despite the name, a **file** path), `CLAUDE_CODE_DEBUG_LOG_LEVEL` (`verbose`/`debug`/`info`/`warn`/`error`).

## Sandboxing — OS-enforced Bash isolation (`/sandbox`)

macOS Seatbelt / Linux+WSL2 bubblewrap. Enable globally with `sandbox.enabled: true`; `/sandbox` writes the mode to `.claude/settings.local.json`.

- **Auto-allow mode** runs sandboxed Bash with no prompt, independently of permission mode. Even then: deny rules, `rm`/`rmdir` on `/`/home, and content-scoped ask rules (`Bash(git push *)`) still prompt.
- Filesystem keys (arrays merge across scopes): `sandbox.filesystem.allowWrite`/`denyWrite`/`denyRead`/`allowRead`. **Default read = whole machine, including `~/.aws/credentials` and `~/.ssh`** — add those to `denyRead` to block. Path prefixes: `/abs`, `~/home`, `./project-relative`.
- Network: proxy-based, **no domains pre-allowed** (first hit prompts). `sandbox.network.allowedDomains`/`deniedDomains`; `httpProxyPort`/`socksProxyPort` for a custom proxy.
- Escape hatch: the model may retry with the `dangerouslyDisableSandbox` tool parameter (goes through normal permissions). Kill it with `sandbox.allowUnsandboxedCommands: false`.
- `sandbox.excludedCommands` — run named tools outside the sandbox (e.g. `docker`, `gh`/`gcloud`/`terraform` Go-TLS issues).
- `--dangerously-skip-permissions` is blocked as root/sudo on Linux/macOS unless inside a recognized sandbox.

## Keybindings (`~/.claude/keybindings.json`, hot-reloaded; open with `/keybindings`)

Schema: `{ "bindings": [ { "context": "...", "bindings": { "ctrl+e": "chat:externalEditor", "ctrl+u": null } } ] }`. Set an action to `null` to unbind. `$schema`: `https://www.schemastore.org/claude-code-keybindings.json`.

Notable defaults:
- `chat:stash` = `Ctrl+S` (stash the current prompt). `chat:killAgents` = `Ctrl+X Ctrl+K`.
- `chat:fastMode` = `Meta+O`; `chat:thinkingToggle` = `Meta+T`; `chat:modelPicker` = `Meta+P`.
- `task:background` = `Ctrl+B` *or* `Ctrl+X Ctrl+B` (the chord avoids the tmux-prefix conflict; v2.1.169+).
- `historySearch:cycleScope` = `Ctrl+S` inside Ctrl+R (session → project → everywhere).
- Multiline: `Ctrl+J` (any terminal) or `\`+Enter. `/terminal-setup` installs the Shift+Enter binding for VS Code/Cursor/Alacritty/Zed.
- 20 contexts (`Scroll`, `DiffDialog`, `Doctor`, `Plugin`, `ModelPicker`, `HistorySearch`, …) — bindings are context-scoped. Unbinding a whole chord prefix frees it for a single-key binding. Reserved: `Ctrl+C`, `Ctrl+D`, `Ctrl+M` (=Enter). `/doctor` surfaces keybinding warnings.

## Fast mode (`/fast`, v2.1.36+, CLI only)

Same Opus model, different API config — up to ~2.5× faster, higher per-token cost. Toggle with `/fast`, `"fastMode": true`, or `Meta+O`/`Alt+O`.
- **Cost gotcha:** the first enable in a conversation charges the **entire context** at the uncached fast-mode input price — enable at session start. Toggling off/on later doesn't re-charge.
- Draws from usage credits only, bypassing plan rate limits. Combine with a lower `--effort` for max speed. Disable org-wide with `CLAUDE_CODE_DISABLE_FAST_MODE=1`; force per-session opt-in with `fastModePerSessionOptIn: true`. Not on Bedrock/Vertex/Foundry.

## Output styles

- Set via `/config` → Output style, or `"outputStyle": "Explanatory"` in settings (the standalone `/output-style` command is gone).
- Files at `~/.claude/output-styles`, `.claude/output-styles`, or the managed-settings dir. Filename = style name unless `name` frontmatter is set.
- Frontmatter: `name`, `description`, **`keep-coding-instructions`** (default `false` — leaving it off *strips* Claude's built-in SWE instructions), **`force-for-plugin`** (plugin styles auto-apply when the plugin is enabled, overriding the user's `outputStyle`).
- Built-ins beyond Default: **Proactive** (stronger autonomous execution without changing permission mode), **Explanatory**, **Learning** (inserts `TODO(human)` markers).
- Baked into the system prompt at session start → takes effect only after `/clear` or a new session.
