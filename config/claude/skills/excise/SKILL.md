---
name: excise
description: Remove text from this Claude Code session's own transcript completely, then kill the session and resume it without that text. Use when the user says "excise X", "cut that from the transcript", "remove what I said about X from this conversation", "rewrite the conversation without X", or asks to take something out of the session's history so the resumed session never saw it.
---

# Excise

`excise.py`, beside this file, cuts exact strings out of the running session's transcript and brings the session back in its tmux pane. The resumed session has no record that the text existed, and no record that it was excised.

## What gets cut

- Every occurrence of each string, anywhere in the transcript: the user's messages, your replies, tool calls and results, the compaction summary.
- Every thinking block from the turn where a string first appears onward. They are stored encrypted, so whether one mentions the text can't be read.
- This turn: everything from the user's request to excise onward.
- Any message the cut leaves empty.

## Steps

1. **Pin down the exact strings.** The script matches exact text. Take each string from the conversation as it was written, a whole message or the part of it the user wants gone. If the user named the information rather than quoting it, list the exact strings you will cut and the messages they come from, and have the user confirm. The cut can't be undone.
2. **Write them to a file** in your scratchpad as a JSON list of strings.
3. **Run it:**

   ```
   python3 ~/.claude/skills/excise/excise.py restart <the file>
   ```

   If a string isn't in the transcript, it refuses before anything changes, and says which. Fix the string and run it again.

When it succeeds, this session ends mid-command. Write nothing after the command: nothing you write survives.

## When it can't run

- **Not in tmux.** There is no pane to bring the session back in. Tell the user, and stop.
- **After the session is gone,** the pane shows the script's output. If the cut failed there, the transcript is unchanged, the pane drops to a shell, and the error is on screen.
