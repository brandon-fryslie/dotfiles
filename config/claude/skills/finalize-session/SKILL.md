---
name: finalize-session
description: The mandatory final step that ends a working session and hands the next instruction to a fresh context window. You RUN it — you never ask the user whether to, and you never defer it — when you finish a unit of work (closed a PR, completed the handed task) or cross 300k–350k tokens of context. It resets the context (/clear, or /compact when your message says so) and pastes the next instruction (default /next) into the same pane. Covers "finalize the session", "hand off to a fresh session", "continue after /clear", "schedule the next ticket", "send myself X after I'm done".
---

# finalize-session

The last operation of a finishing turn: it resets this session's context (`/clear`, or `/compact`) and hands a precise next instruction to a fresh window in the same tmux pane. The launcher returns immediately so your turn can end; a detached worker performs the reset and paste after a short delay.

## This is mandatory — you run it, you do not decide it

When you reach a finalization point — you closed a PR, finished the task you were handed, or crossed 300k–350k tokens of context — running `finalize-session` is the close-out. It is **not** a choice you weigh, a thing you ask the user about, or a step you defer "until later."

[LAW:dataflow-not-control-flow] running this is unconditional at a finalization point — the same path every time. The only variability is a *value*: the handoff message you pass. There is no control-flow fork on *whether* to run — "is the user watching," "is this worth a fresh window," "should I just keep going," "let me check first" are not inputs that exist. If you are finalizing, the script runs.

[LAW:no-silent-failure] asking-instead-of-running or deferring is a silent failure of the handoff: the next session never receives the context, and the work stalls with nobody told. The launcher's scheduled line is the signal that the close-out happened; nothing replaces it.

**The user being present is irrelevant.** Presence is not a gate, a tiebreaker, or a reason to skip — you finalize on the *work's* state, never on whether a human is watching. "The user is here, so I'll skip it" and "I'll ask if they want me to" are both wrong: this step requires no user action and asks for none.

## Reset mode is inferred from your message — never asked of the user

The script reads your message and decides: if `/compact` appears within the first three sentences, it uses `compact`; otherwise it uses `clear`. You express the intent *in the message itself* — no separate argument, no question to the user.

`clear` when the next work stands on its own (a fresh ticket, a self-contained instruction). Include `/compact` in your message when the handoff needs the thread of what just happened — e.g., start the message with `/compact` or write "Use /compact and then continue the spec audit…".

**There is no path through this skill where the user is asked about `clear`/`compact`.**

The message defaults to `/next` — the standard "pull the next ticket" handoff. Omit it to take that default; pass one only when the next move is something more specific.

## Turn-ending discipline — the launcher invocation is the last act of the turn

Once you call the launcher, your turn is over. Stop. No closing text, no parting summary, no "scheduled!" confirmation, no further tool calls, no end-of-turn insights. The launcher's `handoff scheduled → <target> (/<reset>) in Ns` line is the only artifact this skill emits, and it is the last line your turn produces.

[LAW:dataflow-not-control-flow] the launcher's return *is* the data signal that the agent's turn has ended; the agent observes that signal and exits. There is no branch on "should I add a closing paragraph" — the same code path runs every time, and the data (launcher returned) picks the effect (turn ends).

This matters because the worker resets the same tmux pane after the delay. It cancels (Escape), submits the reset, and reads the pane back to confirm the reset ran before sending anything (see "What the worker does" below) — so a disciplined finish and a rambling one both land. The discipline keeps the handoff fast and clean rather than salvaged.

## Invocation

```bash
~/.claude/skills/finalize-session/bin/finalize-session [message...]
```

- `[message...]` — a slash command, plain text, multi-line, or containing quotes/backticks/dollar signs. Quote it at invocation as usual (your shell does word-splitting and `$VAR` expansion before the script sees argv). **Omit it to default to `/next`.**
- Reset is inferred: `/compact` anywhere in the first three sentences → `compact`; otherwise `clear`.

The launcher prints `handoff scheduled → <target> (/<reset>) in Ns (log: <tempfile>)` and exits. The log captures worker progress and any tmux errors.

## Examples

Finalize and pull the next ticket on a fresh window (default message, uses `clear`):

```bash
~/.claude/skills/finalize-session/bin/finalize-session
~/.claude/skills/finalize-session/bin/finalize-session /next
```

Hand off a specific instruction, keeping a compacted summary of this session (include `/compact` in the message):

```bash
~/.claude/skills/finalize-session/bin/finalize-session \
  '/compact Continue the spec audit. Pick up at section 4 — the previous session left findings in spec/audit/section-3.md.'
```

## What the worker does

1. Sleeps for the delay.
2. Sends Escape — cancels whatever was running in the pane — then submits `/clear` or `/compact`.
3. Reads the pane back and checks for the marker that only a reset which actually **ran** leaves: `/clear`'s startup banner, `/compact`'s "Compacting conversation" / "Conversation compacted". (A reset typed into a busy pane is swallowed as literal queued text and never runs — reading back is how the worker knows the difference.)
4. **Only if that marker is present** does it paste the message and submit it. `/clear` and `/compact` are handled identically: a message submitted during a `/compact` queues and fires when compaction finishes; one on a fresh `/clear`'d session lands immediately.

The verification gate is the whole point: the paste lives *only* on the reset-confirmed branch, so it is structurally impossible to send the message into a session that wasn't reset. If the reset didn't register, the message is **not** sent — the worker instead messages that (still-live) session asking the agent to surface the misfire to the user.

## Operating notes

- The handoff fires into the pane that invoked the launcher (`$TMUX_PANE`).
- To cancel a scheduled handoff, kill its worker: `pgrep -f 'finalize-session --worker'`.

## Related

- `tmux-talk` — synchronous agent-to-agent messaging with idle detection. Use when you need a reply, not a one-way handoff.
