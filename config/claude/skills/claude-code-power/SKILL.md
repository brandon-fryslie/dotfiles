---
name: claude-code-power
description: Reference catalog of lesser-known, power-user Claude Code features — autonomous/unattended operation, channels and remote control, multi-agent orchestration, the full hook-event set, context/session surgery, obscure settings/env-vars/CLI-flags, and advanced skill authoring. Use when the user asks "what can Claude Code do", "is there a Claude Code feature for X", "how do I run Claude unattended / on a schedule / from my phone", "what hook events exist", "what obscure settings or env vars are there", "how do I configure/launch claude for Y", or wants to discover advanced harness capabilities beyond the basics.
---

# Claude Code Power Features

A curated reference of the high-leverage, non-obvious capabilities of the Claude Code harness. The basics (`/clear`, `/compact`, `CLAUDE.md`, plain subagents, plain MCP) are assumed and not covered here — this is the rest.

**How to use this skill:** this file is a router. Read only the reference file that matches the intent at hand — each is self-contained, so loading one does not require the others. Do not read all of them; pick by the table below.

**Provenance and accuracy:** sourced from `code.claude.com/docs`. Features list a minimum CLI version where one applies (e.g. "requires v2.1.81+"); check `claude --version` before relying on a gated feature. This is a snapshot, not the live docs — when a detail is load-bearing and the answer must be current, confirm against the source page. A handful of items are marked `(verify)` because the docs were internally inconsistent or silent on the exact mechanism; treat those as leads, not facts.

## Routing table

| Read this file | When the goal is |
|---|---|
| `reference/autonomous.md` | Keep Claude working unattended: `/goal`, `/loop`, scheduled tasks / cron, cloud routines + `/fire` webhooks, auto mode |
| `reference/remote-and-channels.md` | Operate a session from elsewhere: channels (push events in), phone permission relay, remote control, deep links, mobile push |
| `reference/multi-agent.md` | Split work across agents: advanced subagent frontmatter, agent teams, dynamic workflows, forks, worktrees & isolation |
| `reference/hooks.md` | Intercept/automate on events: the full hook-event set (incl. the obscure ones) and hook mechanisms (`prompt`/`agent` handlers, `if`, `args`, `terminalSequence`) |
| `reference/context-and-session.md` | Manage context & history: `/btw`, scoped rewind/summarize, transcript viewer, compaction steering, session forking, `--from-pr` |
| `reference/config-cli-env.md` | Tune or launch the harness: obscure settings keys, behavior-changing env vars, CLI flags/subcommands, `--safe-mode`/`--bare`, sandboxing, keybindings, fast mode, output styles |
| `reference/authoring-skills.md` | Build extensions: advanced skill frontmatter, dynamic context injection, `skillOverrides`, description-budget tuning, plugin-in-a-skill |

## Highest-leverage, least-known (the entry points)

If unsure where to start, these are the features most likely to change how the user works:

- **`/goal <condition>`** — keep running, re-checked after every turn, until a condition holds. The unattended-completion primitive. → `autonomous.md`
- **Channels permission relay** — approve `Bash`/`Edit`/`Write` from a phone (Telegram/iMessage). → `remote-and-channels.md`
- **Routine `/fire` endpoints** — Claude Code as an HTTP webhook target for CI/alerting/deploys. → `autonomous.md`
- **`claude --safe-mode`** — disable all customizations to debug a broken config without losing auth/model. → `config-cli-env.md`
- **Obscure hook events** — `UserPromptExpansion`, `PostToolUse → updatedToolOutput`, `ConfigChange`, `InstructionsLoaded`. → `hooks.md`
- **`/btw`** — zero-cost side question with full context, no tools, never enters history. → `context-and-session.md`
