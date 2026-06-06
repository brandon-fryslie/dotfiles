---
name: copy-session-to-zai
description: Copy a Claude Code session transcript for the current project from the normal Anthropic config dir into the z.ai Claude config dir. Use only when explicitly invoked by name, or when the user asks to copy, transfer, or continue a ~/.claude session in z.ai / zlod. Lists the five most recently updated source sessions with recent-message summaries first; after the user chooses one, copies the selected JSONL with the bundled script. Never symlinks sessions.
---

# copy-session-to-zai

Copies one Claude Code session JSONL from `~/.claude/projects/<project-slug>` into the z.ai config dir's matching project directory. The source is always the normal Claude config root. The target is the z.ai config root that loaded this skill.

All transcript discovery, parsing, summary extraction, conflict detection, and copying must be done by `session_copy.py`. Do not search session files manually and do not read raw JSONL transcripts directly.

## Workflow

1. Run the decision report from the current project:

   ```bash
   python3 session_copy.py list /absolute/project/path --limit 5 --recent-messages 5
   ```

2. Show the user the five sessions from the script output: session id, last updated time, title, target state, and recent messages. Ask which session to copy.

3. After the user selects a session id, copy it with the script:

   ```bash
   python3 session_copy.py copy /absolute/project/path <session-id>
   ```

4. Report the script's `copied:` or `already copied:` line and the target path.

## Conflict Handling

The script refuses to overwrite an existing different target file by default. If it reports `exists-different`, ask the user whether to replace that target copy. Only after explicit confirmation, rerun:

```bash
python3 session_copy.py copy /absolute/project/path <session-id> --replace
```
