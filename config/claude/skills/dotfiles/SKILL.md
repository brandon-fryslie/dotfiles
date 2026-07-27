---
name: dotfiles
description: Street map of Brandon's dotfiles repo at ~/code/dotfiles — where every managed config in the home directory actually lives, the profile-suffix naming convention, the separate agent-skill trees, and the workflows for editing managed files. Use whenever a task touches a config file under ~ or ~/.config — "where does my zshrc/tmux/nvim/git/kitty config live", "edit my shell config", "add a global Claude skill/command/agent", "change my Claude settings", "add a new dotfile", "why is ~/.foo a symlink" — or any mention of the dotfiles repo. Consult BEFORE editing anything under ~ or ~/.config, and before creating any file under ~/.claude, ~/.agents, ~/.gemini, ~/.copilot, or ~/.codex.
---

# Dotfiles — street map

The repo is `~/code/dotfiles`, a git repo worked directly on `master`. Nearly every
config file in the home directory is a symlink into it. This document is a map of
addresses and signs, not a description of what lives inside any config — never add
tool settings or config content here.

## The one rule

Every managed path has exactly one street address inside the repo. Because the home
paths are symlinks, editing `~/.zshrc` and editing `~/code/dotfiles/config/zshrc.home`
edit the same file — either is fine, but **the change lands in the repo and must be
committed there** (`cd ~/code/dotfiles && git status` will show it).

What is never fine:

- **WRONG:** creating anything — file, directory, or link — directly at a managed
  `~` path (`~/.agents/skills/my-skill/`, `~/.claude/commands/foo.md` as a real
  file). The temptation is always "it's a one-off, I'll just drop it here" — and it
  will work today, then silently fall out of management and vanish. **RIGHT:**
  create it under the matching `config/` address listed below. If no address exists
  for it yet, that is repo work — do it inside `~/code/dotfiles` under the repo's
  own `CLAUDE.md`; do not improvise a home for it from outside.
- **WRONG:** deleting a real (non-symlink) file to clear the way for anything.
  **RIGHT:** move it to a timestamped backup first; only symlinks are ever removed.

## Repo layout

| Path | What it is |
|---|---|
| `config/<tool>/` or `config/<tool>.<suffix>` | One address per managed tool — all config content lives here |
| `justfile` | The workflow entry points — run `just` for the authoritative recipe list |
| `migrations/` | Numbered one-shot machine-state scripts (`NNNN-name.sh`) |
| `tests/` | Bats suites (`tests/functional/`, `tests/unit/`, `tests/e2e/`) |
| `scripts/`, `bin/` | Repo helper scripts |
| `docs/`, `watchers/` | Architecture notes and file-watcher definitions |

## Profiles

Three profiles: `base` (shared core), `home`, `work`. The convention is a suffix on
the filename at the `config/` root:

- `*.global.*` — linked for every profile (e.g. `config/p10k.global.zsh`, `config/gemrc.global`)
- `*.home.*` / `*.work.*` — profile-specific variants (e.g. `config/zshrc.home`,
  `config/zshrc.work`, `config/rad-plugins.home`, `config/pypirc.work`,
  `config/mackup.home.cfg`)

`just status` reports which profile is active on this machine and where the repo is.
When adding a file, pick the suffix that matches its scope — a shared config gets
`.global.`, not a copy per profile.

## Address book — home path → repo address

Shell and terminal:

| Home path | Repo address |
|---|---|
| `~/.zshrc` | `config/zshrc.<profile>` (`config/zshrc.base` is the shared core) |
| `~/.rad-plugins` | `config/rad-plugins.<profile>` |
| `~/.p10k.zsh` | `config/p10k.global.zsh` |
| `~/.config/tmux` | `config/tmux/` |
| `~/.config/tmux-powerline` | `config/tmux-powerline/` |
| `~/.config/kitty` | `config/kitty/` |
| `~/.config/zellij` | `config/zellij/` |
| `~/.config/iterm2` | `config/iterm2/` (home profile) |

Editors and tools:

| Home path | Repo address |
|---|---|
| `~/.config/nvim` | `config/nvim/` |
| `~/.config/git` | `config/git/` |
| `~/.mackup.cfg` | `config/mackup.<global\|home>.cfg` |
| `~/.aider.conf.yml` | `config/aider.conf.global.yml` |
| `~/.gemrc`, `~/.rvmrc` | `config/gemrc.global`, `config/rvmrc.global` |
| `~/.pypirc` | `config/pypirc.work` (work profile) |

Agent CLIs:

| Home path | Repo address |
|---|---|
| `~/.claude/CLAUDE.md`, `settings.json` | `config/claude/CLAUDE.md`, `config/claude/settings.json` |
| `~/.claude/skills`, `commands`, `agents`, `personal-synced` (and `*-disabled`) | `config/claude/<same name>/` |
| `~/.agents/skills/<name>` | `config/agents/skills/<name>/` |
| `~/.gemini/GEMINI.md`, `~/.gemini/skills` | `config/gemini/` |
| `~/.copilot/copilot-instructions.md`, skills | `config/copilot/` |
| `~/.config/codex`, `~/.codex/skills` | `config/codex/` |

## The two skill trees — do not merge them

- `config/claude/skills/<name>/SKILL.md` → Claude Code's global skills. Claude Code
  supports non-standard frontmatter extras.
- `config/agents/skills/<name>/SKILL.md` → all other agents. Standard skill
  frontmatter only.

These have **different frontmatter requirements**. The "single source of truth"
consolidation instinct is wrong here — merging them breaks one side or the other.
Author a new skill directly under the correct `config/` tree, never at the `~` path.

## Common workflows

- **Edit an existing config:** edit the file (via either end of the symlink), then
  commit in `~/code/dotfiles`. Leave the tree clean.
- **Bring a new path under management:** repo work — do it inside `~/code/dotfiles`
  following the repo's own `CLAUDE.md`. Never wire anything up by hand from outside.
- **Add a global Claude skill/command/agent:** new directory or file under
  `config/claude/skills/`, `commands/`, or `agents/` — it is live immediately.
- **Change machine state (not a file link):** write a migration — `just migrate-new
  <name>`, fill in the generated `migrations/NNNN-<name>.sh`, run `just migrate`;
  `just migrate-status` shows what has run on this machine.
- **Verify:** `bats tests/functional/` (or a specific suite under `tests/`).
- **Work sessions in the repo itself** follow the repo's own `CLAUDE.md`, including
  its `lit` ticket workflow — this map does not replace it.
