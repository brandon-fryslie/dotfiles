---
name: share-slop
description: Share the current Claude Code session to paste.slopspot.ai. Locates the session JSONL via $CLAUDE_CODE_SESSION_ID, uploads it to the slopspot claude-jsonl parser as an unsubmitted draft, and opens the editor for review before the user publishes. Use when the user says "share this session", "share to slopspot", "paste my conversation", "/share-slop", or asks for a shareable link to the current chat.
---

# share-slop

Uploads the current Claude Code session as a JSONL to paste.slopspot.ai as an **unsubmitted draft**, opens the editor for review, and prints the review URL. The remote claude-jsonl parser does the rendering — this skill is a thin uploader. The user reviews the conversation and clicks "Share it" to publish (review-before-publish).

## When to use

- "Share this session"
- "Paste my conversation to slopspot"
- "Give me a shareable link to this chat"
- "/share-slop"

Don't use for sharing pre-existing files; this skill is specifically scoped to the *current* Claude Code session.

## How it works

1. `$CLAUDE_CODE_SESSION_ID` (exposed by CC) → session UUID.
2. Session file: `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/*/<session-id>.jsonl`, found by id, so the shell's current directory doesn't matter.
3. Subagent transcripts (`<project dir>/<session-id>/subagents/agent-*.jsonl`, beside the session file) are concatenated onto the main blob, losslessly and verbatim. Each subagent line self-identifies (top-level `agentId` + `isSidechain`), so the server parser splits and reattaches them to their spawning Agent call by id-join — concatenation order is irrelevant. A session with no subagents uploads byte-identical to before. Each group's sibling `agent-<id>.meta.json` (`{agentType, description}`) is folded onto its first sidechain line so an *orphan* subagent (slash-command/skill run with no spawning Agent call, e.g. `/recap`) still renders with its real type; the fold is additive (never overwrites a source field) and keeps the line a valid sidechain line.
4. POST the bundled content as `{ source: { kind: "claude-jsonl", content: <jsonl-text> } }` to `${SLOPSPOT_URL}/api/draft` (default `https://paste.slopspot.ai`).
5. Server returns `{ draftId, url }` where `url` is `/?draft=<id>`. Open `${SLOPSPOT_URL}<url>` in the browser (best-effort) and print it. The user reviews the rendered conversation and clicks "Share it" to publish via `/api/paste`. The draft auto-expires in 1 hour if never published.

The slopspot side owns ALL parsing knowledge — this skill knows zero about the JSONL schema. If Anthropic changes the JSONL format, only the server parser needs to update.

## Usage

Just invoke the helper script:

```bash
bash "${CLAUDE_SKILL_DIR}/share-slop.sh"
```

Optional overrides:
- `SLOPSPOT_URL=http://localhost:4321 bash "${CLAUDE_SKILL_DIR}/share-slop.sh"` — point at a local dev server.

## Failure modes

The script fails loudly (no silent fallback) when:
- `CLAUDE_CODE_SESSION_ID` unset → not running under Claude Code.
- No transcript for this session id under the config root, or more than one → wrong config root, the session was deleted, or copies of it need resolving by hand.
- Network error / non-200 from the API → the server's error message is propagated as-is.
- File exceeds the server's `MAX_BYTES` (currently 8 MB) → server returns 413 with size info.

## Privacy note

The uploaded JSONL contains the **entire** current session — every prompt, every assistant reply, every tool call and its output, **including every subagent's full transcript**. Thinking blocks and CC system reminders are filtered server-side, but anything you typed or any file content the agent (or a subagent) read remains. Pastes auto-delete after 30 days; there is no edit or delete affordance before then. Don't run this in a session that touched secrets or sensitive paths.
