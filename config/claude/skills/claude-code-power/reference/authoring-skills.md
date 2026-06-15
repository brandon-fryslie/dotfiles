# Authoring skills & extensions

Advanced mechanics for building skills, commands, and plugins.

## Skill frontmatter — advanced fields

- **`paths:`** glob frontmatter — the skill auto-activates only when working with matching files (monorepo-friendly).
- **`disallowed-tools:`** — strip tools (e.g. `AskUserQuestion`) for an autonomous skill; clears on the next user message.
- **`model:` / `effort:`** — per-skill model/effort override, for the rest of the current turn only.
- **`context: fork` + `agent: <type>`** — run the skill as a subagent; the skill body becomes the task prompt. `agent: Explore` skips CLAUDE.md/git for a lean context.
- **`shell: powershell`** — for inline command execution (needs `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`).
- **`arguments:`** — declares named args usable as `$name` in the body.

## Dynamic context injection

- `` !`command` `` (line-start or after-whitespace only) and multi-line ```` ```! ```` blocks run **before** Claude sees the skill; output is inlined as plain text (not re-scanned).
- Disable org-wide with `"disableSkillShellExecution": true`.

## Substitutions available in skill/command bodies

`$ARGUMENTS`, `$ARGUMENTS[N]` / `$N`, named `$name` (via `arguments:` frontmatter), `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, and **`${CLAUDE_SKILL_DIR}`** — resolves bundled scripts regardless of cwd. `${CLAUDE_SKILL_DIR}` is the key to portable script-bundling skills (the path stays correct no matter where `claude` runs).

## Visibility & context budget

- **`skillOverrides`** setting (`.claude/settings.local.json`) — control skill visibility (`"on"` / `"name-only"` / `"user-invocable-only"` / `"off"`) **without editing a skill's frontmatter**. `/skills` writes it interactively (`Space` cycles, `Enter` saves). Frees description budget for the skills you actually use.
- **Description budget:** combined `description` + `when_to_use` is capped at 1,536 chars (`maxSkillDescriptionChars`); the whole skill listing is budgeted at 1% of the context window (`skillListingBudgetFraction`, or `SLASH_COMMAND_TOOL_CHAR_BUDGET`). `/doctor` shows whether it's overflowing and which skills got truncated.

## Lifecycle — what stays in context

- Invoked SKILL.md content stays in context all session and is **not** re-read.
- After compaction, only the most-recent invocation of each skill is re-attached (first ~5,000 tokens each, 25,000-token shared budget). Re-invoke a large skill after compaction to restore its full content.
- `ultrathink` anywhere in skill content requests deeper reasoning on run.

## Plugin-in-a-skill

- Drop `.claude-plugin/plugin.json` into a skill folder → it loads as `<name>@skills-dir` and can bundle agents/hooks/MCP alongside the skill.
- Plugins in `.claude/skills` load automatically — no marketplace.
- `claude plugin init <name>` scaffolds one. In `plugin.json`, `defaultEnabled: false` installs-without-enabling.
- Load a plugin for one session from an artifact: `claude --plugin-url https://…/plugin.zip` or `--plugin-dir` (accepts a `.zip`).
- `/reload-plugins` and `/reload-skills` re-scan without restarting the session.

## CLAUDE.md mechanics

- `@path` imports, including `@~/.claude/my-project-instructions.md`. Child-directory CLAUDE.md files load on demand during nested traversal.
- `claudeMdExcludes` (settings) — glob/abs paths of CLAUDE.md files to skip.
- `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` — load CLAUDE.md from extra directories.
