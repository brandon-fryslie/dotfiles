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

## Invocation

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle <delay-seconds> <message...>
```

- `<delay-seconds>` — integer; how long the worker waits before `/clear`. Pick large enough that the calling agent has finished its turn (5–15s is typical; 10s is a safe default).
- `<message...>` — everything after the delay; can be a slash command, plain text, multi-line, contain quotes — passed through a tempfile so shell-quoting hazards do not apply.

The launcher prints `bottle scheduled → <target> in Ns (log: /tmp/bottle-log.XXXX)` and exits. The log captures worker progress and any tmux errors.

## Examples

Schedule the next ticket pull in 10 seconds:

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle 10 /next
```

Hand off a specific instruction:

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle 15 \
  'Continue the spec audit. Pick up at section 4 — the previous session left findings in spec/audit/section-3.md.'
```

## What the worker does

1. Sleeps for `<delay-seconds>`.
2. Sends `/clear` followed by Enter to the originating tmux pane.
3. Pastes the message via `tmux load-buffer` + `paste-buffer`.
4. Sends Enter.

It does not retry, it does not check for idleness, it does not validate the post-clear state. The delay is the only timing knob — pick it deliberately.

## Limits / sharp edges

- **Fixed delay**: if the calling agent is still streaming output when the worker fires, the `/clear` will queue as typed input and may not behave as intended. Pick a delay larger than the expected response time.
- **Single pane**: the worker fires into the pane that invoked the launcher. There is no `--target` flag — that's intentional; the source of truth for "which pane" is `$TMUX_PANE`.
- **No cancel**: once scheduled, the bottle fires. To cancel, find the background `bash` process (`ps -ax | grep message-in-a-bottle`) and kill it.

## Related

- `tmux-talk` — synchronous agent-to-agent messaging with idle detection. Use when you need a reply, not a one-way handoff.
