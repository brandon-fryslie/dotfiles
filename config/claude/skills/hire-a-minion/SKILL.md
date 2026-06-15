---
name: hire-a-minion
description: Allows an agent to hire a tmux minion
---

# hire-a-minion

Hire a minion: a second claude instance, running on its own git worktree, in a
new tmux window in your session. You stay the controller — you plan, groom, and
review; the minion does the implementation work in parallel.

```bash
MINION=~/.claude/skills/hire-a-minion/bin/hire-a-minion
```

## Spawning a minion

```bash
# Fresh minion: auto-creates a worktree, runs opus
ADDR=$("$MINION")

# Resume an existing session — its worktree name is REQUIRED
ADDR=$("$MINION" --worktree feature-auth --resume <session-id>)

# Pick the model, override the system prompt
ADDR=$("$MINION" --model sonnet --append-system-prompt "Be terse. Ask before large refactors.")
```

The script prints **one line on stdout: the minion's tmux address**
(`session:window.pane`). Capture it. Everything you do to the minion afterward
goes through that address. A worktree is always used — there is no way to run a
minion without one. It fails loudly if you are not inside tmux.

Flags: `--worktree [name]` (omit name to auto-create), `--model sonnet|opus`
(default opus), `--resume <session-id>` (needs `--worktree <name>`;
`--continue` is intentionally unsupported), `--system-prompt`,
`--append-system-prompt`.

## Talking to your minion

Use **/tmux-talk** for every message to and read from the minion — feed it the
address the spawn printed:

```bash
TALK=~/.claude/skills/tmux-talk/bin/tmux-talk

$TALK wait "$ADDR" 60                 # let it boot before the first message
$TALK send "$ADDR" "<your brief>"     # brief it
$TALK read-screen "$ADDR" 300         # see what it's doing
```

Stop a minion that's heading the wrong way without clearing its context:

```bash
tmux send-keys -t "$ADDR" Escape
```

## You are the controller — your job

The minion exists to help you accomplish more work. It runs on a worktree, in
parallel with you. While it implements, you ideate, plan the next unit, groom
the backlog, and review the last result. Your responsibilities:

- **Decide what it works on.** Keep the backlog groomed and rank-ordered and
  every blocking question answered *before* you hand work down. A minion on a
  skip-permissions agent with an ambiguous brief is how wrong work happens fast.
- **Brief it completely.** The minion shares none of your context — not this
  conversation, not the user's words, not your plan. Whatever it needs (the
  ticket, the requirements in the user's actual words, the acceptance criteria,
  where to look, what "done" means) must be in the messages you send. If it
  isn't in the message, it doesn't exist for the minion.
- **Confirm it actually started.** After spawning, `wait` then `read-screen` to
  see claude booted in the right worktree and isn't stuck. Don't assume — look.
- **Track each minion.** Keep a ledger: address → worktree → what it's working
  on → status. The address is the one handle; don't lose it.
- **Review its work yourself.** Read the diff and the PR, not the minion's
  self-report. Minions report success on work that misses the point. Validate
  against the requirements you were given, not against what the minion claims.
- **Let it run its own PR-review loop, but coordinate.** A minion can take a
  change through `/address-pr-reviews` itself. You still own *which* work it
  pulls and the *order* things merge.
- **Own the sequencing.** When two minions touch overlapping code, you decide
  merge order and tell the second to rebase. Cross-minion ordering has exactly
  one owner: you.
- **Manage its context window.** Watch the minion's token usage. If it climbs
  past ~300k and it hasn't run its own handoff (`/message-in-a-bottle`) or
  cleared, clear it for it: `$TALK send "$ADDR" "/clear"`. Re-brief after
  clearing — it loses everything.
- **Recover a stuck minion.** `Escape` to interrupt, `read-screen` to diagnose,
  then either send a correction, or `/clear` and re-brief, or kill and respawn
  with `--resume <session-id>` plus the worktree name to pick up where it left
  off.
- **Don't talk into a busy minion.** Use `$TALK idle "$ADDR"` / `$TALK wait`
  first — keystrokes sent mid-generation queue up and get misread.
- **Clean up when it's done.** A finished minion's worktree should be merged and
  removed; close the loop, then `tmux kill-window -t "$ADDR"`. Don't leak
  worktrees or orphan windows.

## Running multiple minions

Hire more than one when you have independent, non-overlapping work. Each gets
its own worktree and window, so they don't collide. The limit is *your*
attention: you must still brief, track, and review every one. Two minions you
review well beat five you don't.
