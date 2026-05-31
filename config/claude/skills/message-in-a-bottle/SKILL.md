---
name: message-in-a-bottle
description: Schedule a delayed self-message into the current Claude Code session. Spawns a detached worker that, after a fixed delay, resets the context — your choice of `/clear` or `/compact` — in this tmux pane and then pastes a message of the agent's choosing (the next ticket, the next instruction, a recap, anything). Use when the agent is about to finish a unit of work and wants a clean (or compacted) context window for whatever comes next without involving the user. Triggers on "leave myself a note for after /clear", "schedule the next ticket", "context handoff to a fresh session", "send myself X after I'm done", "drop a bottle with Y".
---

# message-in-a-bottle

A one-shot delayed self-message. The launcher returns immediately so the calling agent can finish its turn; a detached worker resets the context (`/clear` or `/compact`, the agent's choice) and pastes the message into the same tmux pane after the delay.

## When to use

- At the end of a long-running task where the next task is already known but would benefit from a fresh context window.
- After wrapping up a PR / closing a ticket, when the next move is "pull the next ticket and start" — schedule `/next` and clear.
- When you've finished gathering context and want to hand off cleanly to a fresh session with a precise instruction.

**Whether the user is driving the session interactively is IRRELEVANT to whether a bottle fires.** Presence is not an input to this decision — not a gate, not a tiebreaker, not a "maybe skip it." The bottle fires on the *work's* state (is there well-defined, aligned next work?), never on whether a human is watching. "The user is here, so I'll skip the handoff" is always wrong reasoning.

## Turn-ending discipline — the launcher invocation is the last act of the turn

Once you call the launcher, your turn is over. Stop. No closing text, no parting summary, no "bottle scheduled!" confirmation, no further tool calls, no end-of-turn insights. The launcher's `bottle scheduled → <target> (/<reset>) in Ns` line is the only artifact this skill emits, and it is the last line your turn produces.

[LAW:dataflow-not-control-flow] the launcher's return *is* the data signal that the agent's turn has ended; the agent observes that signal and exits. There is no branch on "should I add a closing paragraph" — the same code path runs every time, and the data (launcher returned) picks the effect (turn ends).

This matters because the worker resets the same tmux pane after the delay. If you keep generating output, the worker's cancel has to cut it off and then wait for the pane to settle before it can reset — recoverable, but you're relying on the backstop instead of the discipline. The worker cancels (Escape) and then waits for the pane to return to idle before typing the reset (see "What the worker does" below), so a disciplined finish and a rambling one both land; the discipline is what keeps the handoff fast and clean rather than salvaged.

## Invocation

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle <clear|compact> <message...>
```

- `<clear|compact>` — which context reset to fire before the message lands. `clear` wipes the window; `compact` summarizes it first. Exactly these two values; anything else is rejected at the boundary.
- `<message...>` — everything after the reset keyword; can be a slash command, plain text, multi-line, or contain quotes/backticks/dollar signs. Quote at invocation as you normally would (your shell still does word-splitting and `$VAR` expansion before the script sees argv); once captured, the message is staged in a tempfile and never re-quoted at any internal hop on its way to `tmux paste-buffer`.

There is **no delay knob** — the wait before firing is a fixed internal constant, tuned inside the skill if the agent-finish window ever changes. Consumers pick *what* gets reset and *what* the message is; never *how long* to wait.

The launcher prints `bottle scheduled → <target> (/<reset>) in Ns (log: <tempfile>)` and exits — the tempfile lives under `$TMPDIR` (on macOS, typically `/var/folders/.../T/`; on Linux, typically `/tmp/`). The log captures worker progress and any tmux errors.

## Examples

Schedule the next ticket pull on a fresh window:

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle clear /next
```

Hand off a specific instruction, keeping a compacted summary of this session:

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle compact \
  'Continue the spec audit. Pick up at section 4 — the previous session left findings in spec/audit/section-3.md.'
```

## What the worker does

1. Sleeps for the fixed delay.
2. Sends one Escape to the originating tmux pane. Against a busy pane a single Escape both cancels the in-flight response **and** clears any queued messages, leaving the pane genuinely static; against an idle pane it's a no-op. (A single press — never a fast double-tap, which opens Claude Code's prompt-history menu.)
3. **Waits until the visible screen holds still.** This is the load-bearing step. A slash command typed while the pane is still streaming is captured as *literal queued text and never run* — that is the failure where the reset "never lands" and the message dumps into the same session. A streaming pane ticks its elapsed-time counter every second, so it can't hold identical across the sampling gap; an idle pane matches on the first comparison. Screen-stability subsumes every spinner verb without parsing any of them.
4. Sends `/clear` or `/compact` (whichever was chosen) followed by Enter.
5. Pastes the message via `tmux load-buffer` + `paste-buffer`, then Enter — with no second wait. `/clear` and `/compact` are handled identically: a message submitted during a `/compact` simply queues and fires when compaction finishes; one on a freshly `/clear`'d session lands immediately. The platform's own input queue does the sequencing, so the worker doesn't.

The Escape + wait-until-still is what makes the reset land. Everything downstream is one ordered burst the pane's input queue absorbs.

## Limits / sharp edges

- **No delay knob**: the wait before firing is a fixed internal constant, not a consumer argument. The primary safeguard against racing the agent's tail-end output is the agent's turn-ending discipline (see above) — the launcher invocation is the agent's last act of the turn. The cancel + wait-for-idle is the backstop that makes the handoff land reliably even if discipline slips.
- **Single pane**: the worker fires into the pane that invoked the launcher. There is no `--target` flag — that's intentional; the source of truth for "which pane" is `$TMUX_PANE`.
- **No cancel**: once scheduled, the bottle fires. To cancel, find the background process (`pgrep -f 'message-in-a-bottle --worker'`) and kill it.

## Related

- `tmux-talk` — synchronous agent-to-agent messaging with idle detection. Use when you need a reply, not a one-way handoff.
