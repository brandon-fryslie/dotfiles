---
name: share-slop
description: Share the current Claude Code session to paste.slopspot.ai as a public read-only link. Locates the session JSONL via $CLAUDE_CODE_SESSION_ID, uploads it to the slopspot claude-jsonl parser, returns the URL. Use when the user says "share this session", "share to slopspot", "paste my conversation", "/share-slop", or asks for a shareable link to the current chat.
---

# share-slop

Uploads the current Claude Code session as a JSONL to paste.slopspot.ai and prints the resulting URL. The remote claude-jsonl parser does the rendering — this skill is a thin uploader.

## When to use

- "Share this session"
- "Paste my conversation to slopspot"
- "Give me a shareable link to this chat"
- "/share-slop"

Don't use for sharing pre-existing files; this skill is specifically scoped to the *current* Claude Code session.

## How it works

1. `$CLAUDE_CODE_SESSION_ID` (exposed by CC) → session UUID.
2. `$PWD` → project slug (each `/` and `.` replaced by `-`).
3. Session file: `~/.claude/projects/<slug>/<session-id>.jsonl`.
4. Subagent transcripts (`~/.claude/projects/<slug>/<session-id>/subagents/agent-*.jsonl`) are concatenated onto the main blob, losslessly and verbatim. Each subagent line self-identifies (top-level `agentId` + `isSidechain`), so the server parser splits and reattaches them to their spawning Agent call by id-join — concatenation order is irrelevant. A session with no subagents uploads byte-identical to before. Each group's sibling `agent-<id>.meta.json` (`{agentType, description}`) is folded onto its first sidechain line so an *orphan* subagent (slash-command/skill run with no spawning Agent call, e.g. `/recap`) still renders with its real type; the fold is additive (never overwrites a source field) and keeps the line a valid sidechain line.
5. POST the bundled content as `{ source: { kind: "claude-jsonl", content: <jsonl-text> } }` to `${SLOPSPOT_URL}/api/paste` (default `https://paste.slopspot.ai`).
6. Server returns `{ slug }`. Print `${SLOPSPOT_URL}/<slug>` for the user.

The slopspot side owns ALL parsing knowledge — this skill knows zero about the JSONL schema. If Anthropic changes the JSONL format, only the server parser needs to update.

## Usage

Just invoke the helper script:

```bash
bash ${CLAUDE_PLUGIN_ROOT:-~/.claude/skills/share-slop}/share-slop.sh
```

Optional overrides:
- `SLOPSPOT_URL=http://localhost:4321 bash share-slop.sh` — point at a local dev server.

## Failure modes

The script fails loudly (no silent fallback) when:
- `CLAUDE_CODE_SESSION_ID` unset → not running under Claude Code.
- Session JSONL file missing → wrong project slug, or session was deleted.
- Network error / non-200 from the API → the server's error message is propagated as-is.
- File exceeds the server's `MAX_BYTES` (currently 8 MB) → server returns 413 with size info.

## Privacy note

The uploaded JSONL contains the **entire** current session — every prompt, every assistant reply, every tool call and its output, **including every subagent's full transcript**. Thinking blocks and CC system reminders are filtered server-side, but anything you typed or any file content the agent (or a subagent) read remains. Pastes auto-delete after 30 days; there is no edit or delete affordance before then. Don't run this in a session that touched secrets or sensitive paths.
