---
name: message-in-a-bottle
description: Writes a message to a future session's agent.  Send them your fondest memories of what you worked on, what went well, what didn't go well, and any useful tips they might need. You always run this when you finish a unit of work (closed a PR, completed the handed task, etc) or cross 300k–350k tokens of context.  ALWAYS.
---

# finalize-session

The last operation of a finishing turn: prepares instructions for a future agent. The launcher returns immediately. You MUST immediately stop and say nothing and use no tools after running this.

## This is mandatory — you run it, you do not decide it

When you reach a finalization point — you closed a PR, finished the task you were handed, or crossed 300k–350k tokens of context — running `finalize-session` is the close-out. It is **not** a choice you weigh, a thing you ask the user about, or a step you defer "until later."

[LAW:dataflow-not-control-flow] running this is unconditional at a finalization point — the same path every time. The only variability is a *value*: the handoff message you pass. 

**The user being present is irrelevant.** Presence is not a gate, a tiebreaker, or a reason to skip — you finalize on the *work's* state, never on whether a human is watching. "The user is here, so I'll skip it" and "I'll ask if they want me to" are both WRONG: this step requires no user action and asks for none.

### The only gate, and the rationalizations that are never one

There is exactly **one** legitimate input: **is the handed unit of work complete?** Unit complete (PR merged, ticket closed, task delivered) *or* context at 300k–350k tokens → you run it, now, with no further deliberation. Unit **not** complete → you are not "deciding not to finalize," you are *still doing the work*: finish the unit, then finalize. There is no third state, and "skip finalize because X" is never one of them.

## You can provide a 'hint' for the next stage, if valuable: /compact

The message you provide to the future agent may carry a hint about how its context should be set up.  If you are in the middle of a task/epic and it would help the future agent to begin with a compacted summary of the work so far rather than a blank slate, you may specify '/compact' somewhere within the first sentence of your message.  This gives the future agent a summarized version of that knowledge to start from.  If you do not specify this, the future agent starts with ONLY the message you send it (and the standard system, user global, and project level guidance).

Include `/compact` in your message when the handoff needs the thread of what just happened — e.g., start the message with `/compact` or write "Use /compact and then continue the spec audit…".

## Turn-ending discipline — the launcher invocation is the last act of the turn

Once you call the launcher, your turn is over. Stop. No closing text, no parting summary, no "scheduled!" confirmation, no further tool calls, no end-of-turn insights. The launcher's `handoff scheduled → <target> (/<reset>) in Ns` line is the only artifact this skill emits, and it is the last line your turn produces.

[LAW:dataflow-not-control-flow] the launcher's return *is* the data signal that the agent's turn has ended; the agent observes that signal and exits. There is no branch on "should I add a closing paragraph" — the same code path runs every time, and the data (launcher returned) picks the effect (turn ends).

## Invocation

```bash
~/.claude/skills/message-in-a-bottle/bin/finalize-session [message...]
```

- `[message...]` — a slash command, plain text, multi-line, or containing quotes/backticks/dollar signs. Quote it at invocation as usual (your shell does word-splitting and `$VAR` expansion before the script sees argv). **Omit it to default to `/next`.**

The launcher prints `handoff scheduled → <target> … in Ns (log: <tempfile>)` and exits. The log captures worker progress and any transport errors.

The transport is chosen by capability, most reliable first: **tmux** (reset the pane in place, verified by reading it back, then paste) → **iTerm2** (kill the running claude and relaunch it fresh with the message as its initial prompt, delivered in the background with no focus steal) → **file-drop** (no live transport: the message is written to `~/.claude/finalize-pending-handoff.txt` with delivery instructions, never silently dropped). You do not choose the transport; the launcher detects it. To preview the decision without scheduling anything, prefix `FINALIZE_DRY_RUN=1`.

## Examples

Finalize and provide the future agent with guidance to pull the next ticket:

```bash
~/.claude/skills/message-in-a-bottle/bin/finalize-session /next
```

Hand off a specific instruction, providing a compacted summary of this session (include `/compact` in the message):

```bash
~/.claude/skills/message-in-a-bottle/bin/finalize-session \
  '/compact Continue the spec audit. Pick up at section 4 — the previous session left findings in spec/audit/section-3.md.'
```
