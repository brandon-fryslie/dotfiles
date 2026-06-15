# Remote control & channels

Operate or feed a running session from outside the terminal — phone, browser, chat apps, URLs.

## Channels — push external events INTO a running local session

`claude --channels plugin:<name>@<marketplace>` boots an MCP server that injects events as `<channel source="...">` tags into the live session. Space-separate to load several:

```
claude --channels plugin:telegram@... plugin:discord@...
```

- **Being in `.mcp.json` is not enough** to push messages — a server must also be named in `--channels`. (Security model.)
- **iMessage self-chat bypasses access control entirely** — texting yourself reaches Claude with zero setup (reads `~/Library/Messages/chat.db`; needs Full Disk Access). Other senders: `/imessage:access allow +15551234567`.
- Token config: Telegram → `~/.claude/channels/telegram/.env` (or `TELEGRAM_BOT_TOKEN`); Discord → `~/.claude/channels/discord/.env` (or `DISCORD_BOT_TOKEN`). Set via `/telegram:configure <token>` / `/discord:configure <token>`.
- Lock down: `/telegram:access pair <code>` then `/telegram:access policy allowlist` (same for discord).
- **Learn the model fast** with the localhost demo: `/plugin install fakechat@claude-plugins-official`, then `claude --channels plugin:fakechat@claude-plugins-official`, UI at `http://localhost:8787` (no auth).
- Unattended use: `-p` mode disables terminal-input tools (multiple-choice, plan approval) so the session never stalls. `--dangerously-skip-permissions` bypasses prompts except explicit ask rules.
- Dev/test a non-allowlisted channel: `claude --dangerously-load-development-channels server:webhook` (per-entry; does not extend bypass to `--channels` entries).
- Enterprise: managed-settings `channelsEnabled` (master switch) and `allowedChannelPlugins` (array replacing the Anthropic allowlist).

### Permission relay — approve tools from your phone (v2.1.81+)

The headline. A channel that declares `capabilities.experimental['claude/channel/permission']: {}` can approve/deny tool calls remotely:

1. Claude Code sends `notifications/claude/channel/permission_request` with `{request_id, tool_name, description, input_preview}`.
2. The channel replies `notifications/claude/channel/permission` with `{request_id, behavior: 'allow'|'deny'}`.

So `Bash`/`Write`/`Edit` can be approved from Telegram/iMessage. The terminal dialog stays live and the first answer wins.

- `request_id` is five lowercase letters skipping `l` (so it never reads as 1/I on a phone). The local terminal dialog does **not** display this ID — the outbound handler is the only way to learn it.
- The relay does **not** cover project-trust or MCP-consent dialogs (terminal only).

### Building a channel (the protocol)

A channel is an MCP server declaring `capabilities.experimental['claude/channel']: {}` and emitting `notifications/claude/channel` notifications. `content` → tag body; `meta` Record → tag attributes.

- **`meta` keys must match `[A-Za-z0-9_]` only** — keys with hyphens or other chars are silently dropped.
- Notifications are fire-and-forget: `await mcp.notification()` resolves on transport write, not delivery. If the session didn't load the channel or org policy blocks it, **events drop silently with no error** — build a reply tool for confirmation.
- Events arriving while Claude is busy are batched and handled together on the next turn. For independent concurrent streams, run separate sessions.
- **Gate on sender identity** (`message.from.id`), never room/chat id — gating on the room lets anyone in an allowlisted group inject prompts.
- Debug log: `~/.claude/debug/<session-id>.txt` holds channel-server stderr; `/mcp` shows connect status.

## Remote control — drive a local session from phone/browser (v2.1.51+)

- **Server mode:** `claude remote-control` serves up to 32 concurrent sessions (`--capacity N`); spacebar shows a QR.
- **`--spawn worktree`** gives each on-demand remote session its own git worktree (vs `same-dir`, which conflicts on shared files); `--spawn session` = single-session. Press `w` at runtime to toggle same-dir/worktree.
- **Interactive variants:** `claude --remote-control` (or `--rc`, optionally `--rc "Name"`) keeps a normal local session you can also type into; `/remote-control` (`/rc`) inside a session carries over current history.
- **Enable for all sessions:** `/config` → "Enable Remote Control for all sessions".
- Session-name prefix: `--remote-control-session-name-prefix <p>` or `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX`.
- **Auth gotcha:** requires a full-scope `/login` token. `claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN` are inference-only and rejected ("requires a full-scope login token").
- Starting an **ultraplan** session disconnects remote control. A ~10-min network outage times out the session. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_TELEMETRY` break eligibility.
- From mobile/web (v2.1.166+): `/mcp reconnect` with no server name reconnects **all** failed/needs-auth servers (the local CLI requires a name).

## Mobile push (v2.1.110+)

- `/config` → "Push when Claude decides" — Claude pushes a notification when it judges one warranted.
- Request inline: "notify me when the tests finish".
- `/mobile` shows an app-download QR.

## Deep links — `claude-cli://` URLs that open a prefilled session (v2.1.91+)

```
claude-cli://open?repo=owner/name&q=<urlencoded>&cwd=<abspath>
```

Opens a new terminal with the prompt prefilled but **not** sent.

- **`repo=owner/name` resolves to the local clone you ran `claude` in most recently** — Claude Code records every dir's path against its GitHub slug (clones/worktrees tracked separately). If never seen, opens the home dir.
- `q` max 5,000 chars, `%0A` for newlines. `cwd` beats `repo` if both given.
- Fire from automation: `open "claude-cli://..."` (macOS), `xdg-open` (Linux), `Start-Process` (PowerShell), `start "" "..."` (cmd).
- **GitHub strips `claude-cli://`** in rendered markdown (only http/https survive) — put it in a code block.
- Disable handler registration: `"disableDeepLinkRegistration": "disable"` in settings. VS Code variant: `vscode://anthropic.claude-code/open`.
- Tip: store a long runbook as a skill so `q` only has to name it.
