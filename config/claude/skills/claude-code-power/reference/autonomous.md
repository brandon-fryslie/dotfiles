# Autonomous & unattended operation

Make Claude keep working without a human at the keyboard. Four layers, from in-session loops to cloud schedules.

## `/goal <condition>` — run until a condition holds (v2.1.139+)

Sets a completion condition; a fast model (Haiku by default) evaluates after **every turn** and re-prompts Claude until satisfied, then auto-clears.

- Setting a goal **starts a turn immediately** — no separate prompt needed.
- It is implemented as a session-scoped, prompt-based Stop hook.
- **The evaluator runs no commands and reads no files** — it judges only what Claude surfaced in the transcript. So write conditions Claude's own output can demonstrate: `"npm test exits 0 and the output is shown"`, not `"the tests pass"`.
- Condition up to 4,000 chars. Bound runtime by embedding a clause: `... or stop after 20 turns`.
- Non-interactive: `claude -p "/goal CHANGELOG.md has an entry for every PR merged this week"` runs the whole loop in one invocation; Ctrl+C to stop.
- Survives `--resume`/`--continue` (condition carries over; turn/timer/token baselines reset). Achieved/cleared goals do not.
- Clear: `/goal clear` (also `stop`/`off`/`reset`/`none`/`cancel`); `/clear` wipes it too. Bare `/goal` shows turns + tokens + last evaluator reason.
- Blocked when `disableAllHooks` or managed `allowManagedHooksOnly` is set; the command tells you why.
- Complements auto mode: auto mode removes per-tool prompts, `/goal` removes per-turn prompts — combine for fully unattended runs.

## `/loop` — recurring in-session execution (v2.1.72+)

Three modes by argument:

- `/loop 5m <prompt>` — fixed interval (cron).
- `/loop <prompt>` — Claude self-paces the interval (1 min–1 hr each iteration), printing chosen delay + reason.
- bare `/loop` — runs a built-in maintenance prompt, or your override.
- Can wrap a command: `/loop 20m /review-pr 1234`.

**Override the bare-loop prompt:** `.claude/loop.md` (project, wins) or `~/.claude/loop.md` (user) replaces the built-in maintenance prompt. Edits take effect on the next iteration (live-editable); truncated past 25,000 bytes.

Built-in maintenance prompt continues unfinished work → tends the current branch's PR (review comments, failed CI, conflicts) → cleanup passes. It never starts new initiatives; irreversible actions only continue what the transcript already authorized.

Self-paced `/loop` may use the Monitor tool to stream a background script's output line-by-line instead of re-prompting (more token-efficient than polling).

## Scheduled tasks & cron (in-session)

- Raw tools: `CronCreate` (5-field cron + prompt + recurring/once), `CronList`, `CronDelete` (8-char IDs). Max 50 tasks/session.
- One-time reminders via natural language: "remind me at 3pm to …".
- **Jitter is deterministic, derived from task ID:** recurring fires up to +30 min late (or +half-interval if sub-hourly); one-shots at `:00`/`:30` fire up to 90s early. If exact timing matters, avoid `:00`/`:30` — use e.g. `3 9 * * *`.
- **Seven-day expiry:** recurring tasks (including self-paced loops) auto-expire 7 days after creation — they fire once more, then self-delete.
- Cron uses local timezone (not UTC); when both day-of-month and day-of-week are set, matches if **either** (vixie-cron semantics); no `L`/`W`/`?`/name aliases.
- Kill switch: `CLAUDE_CODE_DISABLE_CRON=1` disables the scheduler, cron tools, and `/loop`.

## Cloud routines — scheduled / API / GitHub-triggered (research preview)

Cloud-hosted Claude Code sessions. Three trigger types; one routine can combine all three.

- **API trigger (`/fire` endpoint)** — each routine gets an HTTP endpoint. Claude Code becomes a webhook target for alerting/CI/deploy:
  ```
  curl -X POST https://api.anthropic.com/v1/claude_code/routines/<trig_id>/fire \
    -H "Authorization: Bearer <token>" \
    -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"text":"freeform run context, passed literally"}'
  ```
  Returns a session id + URL. The trigger token is shown once.
- **GitHub triggers** on `pull_request.*` / `release.*` with filters (author/title/body/base/head/labels/is-draft/is-merged) and operators including `matches regex`. **Regex matches the whole field** — use `.*hotfix.*`, not `hotfix`. Each event = a new isolated session. Requires installing the Claude GitHub App (`/web-setup` alone does **not** install it).
- **Schedule triggers** — the only kind the CLI creates: `/schedule daily PR review at 9am`, `/schedule clean up feature flag in one week` (one-off), plus `/schedule list|update|run`. Custom cron via `/schedule update` (minimum interval 1 hour). API/GitHub triggers are added on the web.

Gotchas:
- **Green status ≠ task success.** It means the session started/exited without infra error. Blocked network, missing connector, or task failure show only in the transcript.
- Locally-added `claude mcp add` servers do **not** appear as routine connectors (they are machine-local). Add connectors at claude.ai/customize/connectors or commit a `.mcp.json`.
- One-off runs don't count against the daily routine cap (but draw normal subscription usage).
- `/schedule` returns "Unknown command" when `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`apiKeyHelper` is set, when telemetry-disabling vars are set, inside a web session, or on CLI < v2.1.81.

## Auto mode — the classifier that gates tools without prompting

`claude --permission-mode auto` lets a classifier decide what runs without per-tool prompts. Inspect and tune it:

- `claude auto-mode defaults` — print the built-in rules as JSON.
- `claude auto-mode config` — effective config with `$defaults` expanded.
- `claude auto-mode critique` — AI review of your custom rules for ambiguity / false positives.
- `settings.autoMode.environment` — an array of **prose** describing trusted repos/buckets/domains; the classifier reads it to define "external/exfiltration." Default trusts only cwd + current repo remotes.
- **`$defaults` foot-gun:** the literal string `"$defaults"` splices the built-in deny list in place. **Omit it and you replace the entire default list** — a `soft_deny` without `$defaults` silently discards built-in force-push / `curl|bash` / prod-deploy blocks; a `hard_deny` without it discards exfiltration + bypass rules.
- `settings.autoMode.hard_deny` — rules that block matching actions unconditionally, overriding any allow exception.
- Precedence inside the classifier: `hard_deny` (absolute) → `soft_deny` → `allow` (overrides soft_deny) → explicit user intent (overrides remaining soft blocks).
- The classifier also reads `CLAUDE.md` — "never force push" there steers both Claude and the classifier.
- It does **not** read `autoMode` from shared `.claude/settings.json` (only `settings.local.json`, user, managed, or `--settings`) — a checked-in repo can't inject allow rules.
- Retry a denial: `/permissions` → Recently denied → `r` to mark for retry. Programmatic: the `PermissionDenied` hook can set `retry: true`.
- Bedrock/Vertex/Foundry require `CLAUDE_CODE_ENABLE_AUTO_MODE` first.
