---
name: message-in-a-bottle
description: Schedule a delayed self-message into the current Claude Code session. Spawns a detached worker that, after a fixed delay, types `/clear` into this tmux pane and then pastes a message of the agent's choosing (the next ticket, the next instruction, a recap, anything). Use when the agent is about to finish a unit of work and wants a clean context window for whatever comes next without involving the user. Triggers on "leave myself a note for after /clear", "schedule the next ticket", "context handoff to a fresh session", "send myself X after I'm done", "drop a bottle with Y".
---

# message-in-a-bottle

A one-shot delayed self-message. The launcher returns immediately so the calling agent can finish its turn; a detached worker fires `/clear` and the message into the same tmux pane after the delay.

## When to use

- At the end of a long-running task where the next task is already known but would benefit from a fresh context window.
- After wrapping up a PR / closing a ticket, when the next move is "pull the next ticket and start" — schedule `/next` and clear.
- When you've finished gathering context and want to hand off cleanly to a fresh session with a precise instruction.

## Turn-ending discipline — the launcher invocation is the last act of the turn

Once you call the launcher, your turn is over. Stop. No closing text, no parting summary, no "bottle scheduled!" confirmation, no further tool calls, no end-of-turn insights. The launcher's `bottle scheduled → <target> in Ns` line is the only artifact this skill emits, and it is the last line your turn produces.

[LAW:dataflow-not-control-flow] the launcher's return *is* the data signal that the agent's turn has ended; the agent observes that signal and exits. There is no branch on "should I add a closing paragraph" — the same code path runs every time, and the data (launcher returned) picks the effect (turn ends).

This matters because the worker fires `/clear` into the same tmux pane after the delay. If you are still generating output — text, tool calls, a closing paragraph — `/clear` types into a not-yet-ready input frame and races the redraw. The result: `/clear` is misinterpreted or partially consumed, your fresh-session handoff fires into the *same* session, and the bottle is wasted. The worker defensively sends Escape presses before `/clear` (see "What the worker does" below), but that is belt-and-suspenders for races the discipline above is supposed to prevent.

## Invocation

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle <delay-seconds> <message...>
```

- `<delay-seconds>` — integer; how long the worker waits before `/clear`. Pick large enough that the calling agent has finished its turn (10–20s is typical; 15s is a safe default).
- `<message...>` — everything after the delay; can be a slash command, plain text, multi-line, or contain quotes/backticks/dollar signs. Quote at invocation as you normally would (your shell still does word-splitting and `$VAR` expansion before the script sees argv); once captured, the message is staged in a tempfile and never re-quoted at any internal hop on its way to `tmux paste-buffer`.

The launcher prints `bottle scheduled → <target> in Ns (log: <tempfile>)` and exits — the tempfile lives under `$TMPDIR` (on macOS, typically `/var/folders/.../T/`; on Linux, typically `/tmp/`). The log captures worker progress and any tmux errors.

## Examples

Schedule the next ticket pull in 15 seconds:

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle 15 /next
```

Hand off a specific instruction:

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle 15 \
  'Continue the spec audit. Pick up at section 4 — the previous session left findings in spec/audit/section-3.md.'
```

## What the worker does

1. Sleeps for `<delay-seconds>`.
2. Sends two Escape presses to the originating tmux pane, spaced 0.8s apart — cancels any in-flight Claude response so the next `/clear` lands on a ready input frame. The spacing is deliberately above Claude Code's double-Escape menu threshold; a fast double-tap would open the prompt-history menu and corrupt the handoff.
3. Sends `/clear` followed by Enter.
4. Pastes the message via `tmux load-buffer` + `paste-buffer`.
5. Sends Enter.

It does not retry, it does not check for idleness, it does not validate the post-clear state. The Escape pre-step is idempotent — a no-op against an already-idle pane, a cancel against a still-streaming one — same code path either way. The delay is the only timing knob — pick it deliberately.

## Limits / sharp edges

- **Fixed delay**: the primary safeguard against the worker racing the agent's tail-end output is the agent's turn-ending discipline (see above) — the launcher invocation is the agent's last act of the turn. The worker's defensive Escape pre-step is a backstop, not a substitute. Pick a delay larger than the expected agent-finish-up time anyway.
- **Single pane**: the worker fires into the pane that invoked the launcher. There is no `--target` flag — that's intentional; the source of truth for "which pane" is `$TMUX_PANE`.
- **No cancel**: once scheduled, the bottle fires. To cancel, find the background process (`pgrep -f message-in-a-bottle`) and kill it.

## Related

- `tmux-talk` — synchronous agent-to-agent messaging with idle detection. Use when you need a reply, not a one-way handoff.
