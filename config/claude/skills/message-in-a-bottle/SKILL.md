---
name: message-in-a-bottle
description: Send a message to your future self. You *MUST* use this when you reach 300k–350k tokens of context: drop a bottle that hands off the current work to a fresh window before context runs out. The message defaults to `/next`. Reset mode is inferred from the message — include `/compact` in the first three sentences to use compact mode, otherwise clear is used. Also use when the agent is about to finish a unit of work and wants a clean (or compacted) context window for whatever comes next without involving the user. Triggers on "leave myself a note for after /clear", "schedule the next ticket", "context handoff to a fresh session", "send myself X after I'm done", "drop a bottle with Y".
---

# message-in-a-bottle

A one-shot delayed self-message. The launcher returns immediately so the calling agent can finish its turn; a detached worker resets the context (`/clear` or `/compact`, the agent's choice) and pastes the message into the same tmux pane after the delay.

## When to use

- **Mandatory at 300k–350k tokens of context.** When you cross this threshold, you MUST drop a bottle handing off the current work to a fresh window — do not keep working until context runs out.
- At the end of a long-running task where the next task is already known but would benefit from a fresh context window.
- After wrapping up a PR / closing a ticket, when the next move is "pull the next ticket and start" — schedule `/next` and clear.
- When you've finished gathering context and want to hand off cleanly to a fresh session with a precise instruction.

**Whether the user is driving the session interactively is IRRELEVANT to whether a bottle fires.** Presence is not an input to this decision — not a gate, not a tiebreaker, not a "maybe skip it." The bottle fires on the *work's* state (is there well-defined, aligned next work?), never on whether a human is watching. "The user is here, so I'll skip the handoff" is always wrong reasoning.

## Reset mode is inferred from your message — never asked of the user

The script reads your message and decides: if `/compact` appears within the first three sentences, it uses `compact`; otherwise it uses `clear`. You express the intent *in the message itself* — no separate argument, no question to the user.

`clear` when the next work stands on its own (a fresh ticket, a self-contained instruction). Include `/compact` in your message when the handoff needs the thread of what just happened — e.g., start the message with `/compact` or write "Use /compact and then continue the spec audit…".

**There is no path through this skill where the user is asked about `clear`/`compact`.**

The message defaults to `/next` — the standard "pull the next ticket" handoff. Omit it to take that default; pass one only when the next move is something more specific.

## Turn-ending discipline — the launcher invocation is the last act of the turn

Once you call the launcher, your turn is over. Stop. No closing text, no parting summary, no "bottle scheduled!" confirmation, no further tool calls, no end-of-turn insights. The launcher's `bottle scheduled → <target> (/<reset>) in Ns` line is the only artifact this skill emits, and it is the last line your turn produces.

[LAW:dataflow-not-control-flow] the launcher's return *is* the data signal that the agent's turn has ended; the agent observes that signal and exits. There is no branch on "should I add a closing paragraph" — the same code path runs every time, and the data (launcher returned) picks the effect (turn ends).

This matters because the worker resets the same tmux pane after the delay. It cancels (Escape), submits the reset, and reads the pane back to confirm the reset ran before sending anything (see "What the worker does" below) — so a disciplined finish and a rambling one both land. The discipline keeps the handoff fast and clean rather than salvaged.

## Invocation

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle [message...]
```

- `[message...]` — a slash command, plain text, multi-line, or containing quotes/backticks/dollar signs. Quote it at invocation as usual (your shell does word-splitting and `$VAR` expansion before the script sees argv). **Omit it to default to `/next`.**
- Reset is inferred: `/compact` anywhere in the first three sentences → `compact`; otherwise `clear`.

The launcher prints `bottle scheduled → <target> (/<reset>) in Ns (log: <tempfile>)` and exits. The log captures worker progress and any tmux errors.

## Examples

Schedule the next ticket pull on a fresh window (default message, uses `clear`):

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle /next
```

Hand off a specific instruction, keeping a compacted summary of this session (include `/compact` in the message):

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle \
  '/compact Continue the spec audit. Pick up at section 4 — the previous session left findings in spec/audit/section-3.md.'
```

## What the worker does

1. Sleeps for the delay.
2. Sends Escape — cancels whatever was running in the pane — then submits `/clear` or `/compact`.
3. Reads the pane back and checks for the marker that only a reset which actually **ran** leaves: `/clear`'s startup banner, `/compact`'s "Compacting conversation" / "Conversation compacted". (A reset typed into a busy pane is swallowed as literal queued text and never runs — reading back is how the worker knows the difference.)
4. **Only if that marker is present** does it paste the message and submit it. `/clear` and `/compact` are handled identically: a message submitted during a `/compact` queues and fires when compaction finishes; one on a fresh `/clear`'d session lands immediately.

The verification gate is the whole point: the paste lives *only* on the reset-confirmed branch, so it is structurally impossible to send the message into a session that wasn't reset. If the reset didn't register, the message is **not** sent — the worker instead messages that (still-live) session asking the agent to surface the misfire to the user.

## Operating notes

- The bottle fires into the pane that invoked the launcher (`$TMUX_PANE`).
- To cancel a scheduled bottle, kill its worker: `pgrep -f 'message-in-a-bottle --worker'`.

## Related

- `tmux-talk` — synchronous agent-to-agent messaging with idle detection. Use when you need a reply, not a one-way handoff.
