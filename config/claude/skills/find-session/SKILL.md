---
name: find-session
description: Find Claude Code session IDs in the current project that match a topic. Searches transcript JSONL files under ~/.claude/projects and ~/.claude.zai/projects, scoped by default to the current working directory's project slug. Use when the user asks "what was that session where I worked on X", "find the session about Y", "session id for the conversation about Z", or wants to locate a past Claude Code conversation by topic without remembering its UUID.
---

# find-session

Locate past Claude Code sessions in the current project by topic. Returns session IDs ranked by recency, with title + snippet so you can pick the right one.

## When to use

- "What was the session where we discussed <X>?"
- "Find the session ID for the conversation about <Y>."
- "I had a chat about <Z> yesterday — what was the session?"
- Any time the user wants a past session UUID and only remembers the topic.

Default scope is the current project (`$PWD`). Pass `--all` to search every project the user has on this machine.

## How it works

Claude Code stores each session as a JSONL transcript in:

- `~/.claude/projects/<slug>/<session-id>.jsonl`
- `~/.claude.zai/projects/<slug>/<session-id>.jsonl` (only if you also use the `zai` variant)

`<slug>` is the working directory with `/` and `.` replaced by `-`. Example: `/Users/bmf/code/links-issue-tracker` → `-Users-bmf-code-links-issue-tracker`.

The helper script `find_session.py` parses each JSONL line-by-line, extracts only the **searchable text fields** (`ai-title`, user prompts, assistant text/thinking blocks), and skips noise (`attachment`, `file-history-snapshot`, `permission-mode`, `system`, etc.). This keeps matches signal-rich and the output compact — one line per session — so you don't flood your context with raw transcript dumps.

## Usage

```bash
python3 ~/.claude/skills/find-session/find_session.py <query> [--limit N] [--all] [--cwd PATH]
```

- `<query>` — case-insensitive regex (a plain substring works).
- `--limit N` — max sessions to print (default 20). Bump if the user wants more.
- `--all` — search every project, not just `$PWD`'s.
- `--cwd PATH` — override the working directory used to compute the slug. Useful when the user says "find a session from my other project at <path>".
- `--snippet-len N` — truncate the per-hit snippet (default 120).

### Output shape

```
<session-id>  <YYYY-MM-DD HH:MM>  hits=<count>  [<root>]  <title>
  ↳ <snippet around the first match>
```

Sorted newest-first by the latest event timestamp in each transcript.

## Recipe

1. Run with the user's topic as the query.
2. If zero hits, suggest `--all` to widen scope, or relax the regex.
3. If many hits, the **top** result is almost always what they want (recency bias is real). Tell them the session ID and title; offer to widen if it's not the right one.
4. To resume one of the listed sessions: `claude --resume <session-id>` (or whichever resume command the user prefers).

## Examples

```bash
# topic search in current project
python3 ~/.claude/skills/find-session/find_session.py "prefix migration"

# wider net across all projects
python3 ~/.claude/skills/find-session/find_session.py "absorbed variance" --all

# regex
python3 ~/.claude/skills/find-session/find_session.py "viewport.*scissor"
```

## Notes

- The script never prints raw transcript content — only a 120-char snippet per session. Safe to run on huge sessions without context blowup.
- If neither `~/.claude/projects/<slug>` nor `~/.claude.zai/projects/<slug>` exists, the script exits 2 with a clear message — that means the user has no sessions in this project yet.
- Match counts include every text field across the transcript, so a hit count of 40 usually means the topic was the *subject* of the session, not just mentioned in passing.
