---
name: find-session
description: Find Claude Code session IDs in the current project that match a topic, then probe one session for context around the match or fetch one message's full body. Searches transcript JSONL files under ~/.claude/projects and ~/.claude.zai/projects, scoped by default to the current working directory's project slug. Use when the user asks "what was that session where I worked on X", "find the session about Y", "session id for the conversation about Z", "show me what was said around X in that session", or wants to locate and read a past Claude Code conversation by topic without remembering its UUID.
---

# find-session

Locate past Claude Code sessions in the current project by topic, then drill into a specific session without reading the whole transcript.

Two scripts, both under this skill directory:

- `find_session.py` — search across many sessions, return ranked summary lines.
- `show_session.py` — probe one session: print context around a match, or fetch one message by uuid.

## When to use

- "What was the session where we discussed <X>?" → `find_session.py`
- "Find the session ID for the conversation about <Y>." → `find_session.py`
- "Show me what was said around <X> in that session." → `show_session.py context`
- "What did I/you say in message <uuid>?" → `show_session.py message`

Default scope for `find_session.py` is the current project (`$PWD`). Pass `--all` to widen.

## How it works

Claude Code stores each session as a JSONL transcript:

- `~/.claude/projects/<slug>/<session-id>.jsonl`
- `~/.claude.zai/projects/<slug>/<session-id>.jsonl` (if you also use the `zai` variant)

`<slug>` is the working directory with `/` and `.` replaced by `-`. Example: `/Users/bmf/code/links-issue-tracker` → `-Users-bmf-code-links-issue-tracker`.

Both scripts share `_session_lib.py` for JSONL parsing and event-text extraction. Only meaningful text fields are read (`ai-title`, user prompts, assistant text/thinking); attachments, hook outputs, and metadata are skipped.

## `find_session.py` — search

```bash
python3 ~/.claude/skills/find-session/find_session.py <query> [--limit N] [--all] [--cwd PATH] [--snippet-len N]
```

- `<query>` — case-insensitive regex (a plain substring works).
- `--limit N` — max sessions to print (default 20).
- `--all` — search every project, not just `$PWD`'s.
- `--cwd PATH` — override the working directory used to compute the slug.
- `--snippet-len N` — truncate the per-hit snippet (default 120).

### Current session is excluded

When the script runs from inside a Claude Code session, the env var `CLAUDE_CODE_SESSION_ID` identifies that session, and it is excluded from results — otherwise it would always match its own user prompt. The filter is a no-op when the env var is unset (e.g., running the script from a plain shell).

### Output shape

```
<session-id>  <YYYY-MM-DD HH:MM>  hits=<count>  [<root>]  <project>  <title>
  ↳ <snippet around the first match>
```

The `<project>` column is the slug — feed it back to `show_session.py` to drill in. Sorted newest-first by the latest event timestamp in each transcript.

## `show_session.py context` — context around matches

```bash
python3 ~/.claude/skills/find-session/show_session.py context [FLAGS] -- <project> <session_id> <query>
```

- `<project>` / `<session_id>` — from `find_session.py` output.
- `<query>` — case-insensitive regex.
- `-C N` — symmetric context: N messages before AND after each match (default 2). Mirrors `diff(1)`.
- `-A N` / `-B N` — override one side independently.
- `--word-budget N` — per-side words around the match in the matched message (default 50). Non-matched messages get first/last `N//2` words with `…` between.

**`--` is required:** project slugs always begin with `-` (e.g. `-Users-bmf-…`), so without the `--` separator argparse mistakes the slug for a flag. Put all flags **before** `--`, all positionals **after**. This is standard Unix convention (the same `--` that `git checkout -- <pathspec>` uses).

Overlapping windows merge automatically — if matches are close together, you get one fused block rather than repeated messages.

Each printed line starts with `[<uuid>]`. Copy a uuid into `show_session.py message` to fetch its full body.

### Output shape

```
=== match block 1 of 2 (messages 14..19) ===
[3c8a…] user 2026-05-09 11:47
  first 25 words … last 25 words
[9bae…] assistant 2026-05-09 11:48  ← MATCH
  …50 words before «matched phrase» 50 words after…
[7d12…] user 2026-05-09 11:50
  first 25 words … last 25 words
```

## `show_session.py message` — full message by uuid

```bash
python3 ~/.claude/skills/find-session/show_session.py message -- <project> <session_id> <uuid>
```

Prints the full text of the conversation event identified by `<uuid>`. No truncation. Use when the `context` output's `…` ellipses are hiding something you need. (`--` is needed for the same reason as `context`.)

## Recipe

1. `find_session.py <topic>` — get candidate sessions.
2. Pick the top hit (recency bias usually wins). Note the session id and project slug.
3. `show_session.py context -C 2 -- <project> <session_id> <topic>` — see the conversation around the match.
4. `show_session.py message -- <project> <session_id> <uuid>` — read any one message in full if the truncated view isn't enough.
5. To resume: `claude --resume <session-id>`.

## Examples

```bash
# topic search in current project
python3 ~/.claude/skills/find-session/find_session.py "prefix migration"

# wider net across all projects
python3 ~/.claude/skills/find-session/find_session.py "absorbed variance" --all

# probe the top hit (flags first, then -- then positionals)
python3 ~/.claude/skills/find-session/show_session.py context -C 3 -- \
  -Users-bmf-code-dotfiles 1fb9383f-47fe-46a2-aab1-fb6fded22ed9 \
  "prefix migration"

# fetch one full message
python3 ~/.claude/skills/find-session/show_session.py message -- \
  -Users-bmf-code-dotfiles 1fb9383f-47fe-46a2-aab1-fb6fded22ed9 \
  9baeb633-2496-4178-bb5b-482b91aebe89
```

## Notes

- `find_session.py` exit codes: `0` (results), `1` (no matches), `2` (no session dirs).
- `show_session.py` exit codes: `0` (printed), `1` (no matches / uuid not found), `2` (session file not found — both attempted paths are listed on stderr).
- Output is plain text designed for an agent to read without flooding context. Truncation is per-message, so even sessions with many hits stay bounded.
- If you need the full transcript, `cat ~/.claude/projects/<slug>/<session-id>.jsonl` is always available — but that's exactly the token blowup these scripts are designed to avoid.
