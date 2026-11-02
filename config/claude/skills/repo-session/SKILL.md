---
name: repo-session
description: Start a Claude instance in another repo and delegate work to it over tmux. Creates (or adds a window to) the tmux session named after the repo's directory, launches `claude --worktree --dangerously-skip-permissions` there (the instance works in its own new git worktree), waits until it takes input, and prints its pane id; you then brief it verbatim with /tmux-command, look again ~10s later to confirm it is actually working, wait, and verify what it produced. Use when the user says "start a session in <repo>", "spin up claude in ~/code/<repo>", "launch claude in <repo>", "delegate this to <repo>", "have an agent in <repo> do X", or when work you have found belongs to a repo other than the one you are in (file the ticket there, then hand it to an instance started here).
---

# repo-session

Put a fresh Claude in another repo's tmux session and hand it work. You stay the
controller: you write the brief, you wait, you check the result. The work itself
happens in that repo, by that instance.

```bash
RS=~/.claude/skills/repo-session/bin/repo-session
TALK=~/.claude/skills/tmux-talk/bin/tmux-talk
CMD=~/.claude/skills/tmux-command/bin/tmux-command
```

## Start the instance

```bash
ADDR=$("$RS" gh-pages-multiplexer)               # bare name → ~/code/<name>
ADDR=$("$RS" ~/code/some/path)                    # or any directory
ADDR=$("$RS" home-infra -- --model sonnet)        # extra claude args after --
ADDR=$("$RS" --session "$MINE" ~/code/x)          # into a session you name
ADDR=$("$RS" --worktree my-name ~/code/x)         # name the worktree (default: claude picks)
```

What the script does, so you don't redo any of it by hand:

- Session name = `--session <name>` if given, else the directory's basename
  (`.`/`:` become `_` in either, as tmux requires). No session yet → it creates one, detached, rooted at the repo. Session exists →
  it adds a new detached window. It never types into an existing pane and never
  switches what an attached user is looking at.
- Runs `claude --worktree [name] --dangerously-skip-permissions` as the pane's own
  process. `--worktree` gives the instance a git worktree of the repo (new,
  unless you name an existing one with `--worktree <name>`), so
  the directory must be a git repository and the work lands on a branch in that
  worktree, not in the repo's own checkout. No
  shell sits in front of it, so none of the user's rc files, prompt theme, or
  shell plugins run in that pane. The pane closes when Claude
  exits cleanly; a Claude that crashes leaves its screen in a dead pane, so a
  failure hours in can still be read.
- Waits until Claude's input prompt is up, then prints **one line on stdout: the
  pane id** (`%N`). Keep it — every later step goes through it. It is the
  pane's identity, not its position: tmux never reassigns it, whereas a
  `session:window.pane` address renumbers when an earlier window in the
  session closes (`renumber-windows on`), so an address held across hours
  can quietly point at a different instance. The stderr line carries the
  address the window landed at, for finding it on screen only.
- Exit 2 with the screen on stderr if Claude stops at a dialog (folder trust,
  bypass-mode acceptance). That is the user's decision; tell them, don't answer it.
  Exit 1 with the screen if Claude exits before it is up (window removed) or
  isn't up within 90s (`REPO_SESSION_BOOT_TIMEOUT`; the window stays, its
  pane id in the message).

One instance per line of work. For follow-up work in the same repo, reuse the
pane id you already hold — check it with `$TALK idle "$ADDR"` — rather than
starting another. Lost it? `$TALK list` prints every pane's id beside its
address and running command.

## Brief it

The instance knows its repo's CLAUDE.md and nothing of yours. It has not seen
this conversation, the user's words, the ticket you're thinking of, or why the
work matters. Your brief is a note slid under a door: whatever isn't on the note
does not exist on the other side.

The brief is whatever text you pass, delivered verbatim: `tmux-command send`
types exactly those bytes into the pane and presses Enter — no envelope, nothing
added. Multi-line text, quotes, backticks, `$` and a leading `/` arrive as
written.

```bash
$CMD send "$ADDR" "<brief>"
$CMD send "$ADDR" "$(cat brief.md)"     # a brief kept in a file, delivered as is
```

Everything below is optional — what a brief can carry, when the work calls for it:

- **The task and its ticket** — the lit id if one exists in that repo (file it
  there first if it should exist and doesn't).
- **The user's requirements in the user's words**, unsummarized.
- **What done looks like**, checkably: the test that passes, the PR merged, the
  file that exists with this content.
- **What it must not do**, if anything is out of bounds.
- **How to report back.** A verbatim brief has no reply route; if you want a
  message back, put your pane id (`$TALK whoami`) in the brief and say what the
  reply should hold (PR number, ticket id, the one fact you need). Sending with
  `$TALK send` instead wraps the brief in an envelope (`From:` / `Sender:` /
  `To reply:`) that carries the route, at the cost of the brief no longer being
  the only text it reads.

A half-written note is the failure to avoid: mid-task, the delegated piece feels
small and you think *"it's in the repo, it'll work out what I mean."* It will
work out *something*, at full skip-permissions speed, and you'll be reviewing
the wrong change.

Illustration of a brief that carries several of the optional parts:

- WRONG: `Fix the push retry bug.`
- RIGHT: `Ticket pages-deploy-012 in this repo. The push retry ignores a failed
  rebase, so two concurrent deploys to different slots lose one silently.
  Requirement (user's words): "<…>". Done = a test reproducing two concurrent
  deploys where both land, passing; PR merged; a release tagged. Reply with the
  PR number and the release tag.`

## Ten seconds later: is it working?

Boot readiness only proves Claude can take input. Whether it takes the work is
a separate fact, and the failures are silent: the pane just sits there. About 10
seconds after sending the brief, look: `$CMD read-screen "$ADDR" 40`.

- **Working** — a spinner line (a verb ending in `…`) or tool output moving; or
  it already finished and shows its answer.
- **Stuck on a decision that is the user's** — an approval or permission prompt,
  a numbered-choice dialog, a login, an update or trust prompt, anything that
  waits for a human before it will go on. Tell the user, naming the pane id and
  what the screen asks; don't answer it for them.
- **Brief typed but not submitted** — the text sits in the input box. Press
  Enter (`$CMD keys "$ADDR" Enter`).
- **Idle, brief nowhere on screen** — it was lost, or it already finished and
  scrolled the brief out of view. Read further back (`read-screen "$ADDR" 300`)
  before sending it again; a re-sent brief is done twice.

After fixing any of these, look again the same way.

## While it works

- **Don't type into a busy pane.** Keystrokes sent mid-generation queue and get
  misread. `$TALK wait "$ADDR" <seconds>` before every send.
- **Look, don't assume.** `$TALK read-screen "$ADDR" 200` to see where it is.
- **Steer or stop.** A correction goes through `$CMD send`, like the brief. To
  interrupt: `$CMD keys "$ADDR" Escape`. Slash commands (`/compact`, `/clear`,
  `/model`) go through `$CMD send`, never `$TALK` — the envelope hides them from
  the CLI.
- **Its context may reset on its own.** Instances follow the user's git workflow,
  which hands off to a fresh context mid-PR (message-in-a-bottle). The pane and
  its id survive; the new context resumes from its own message. Don't re-brief
  just because the screen went blank — read it first.

## When it says it's done

It isn't done because it said so. Open the artifact yourself: the diff, the PR,
the ticket state, the test output (`gh pr view`, `git -C <repo> worktree list`
to find the instance's worktree and `git log` there, `lit show <id>` from that
repo). Check it against the user's requirements, not
against its summary. Instances report success on work that misses the point —
the reply is a pointer to the evidence, never the evidence.

- WRONG: relaying "Done, PR #12 merged, all tests pass" to the user.
- RIGHT: `gh pr view 12 --repo … --json state,mergedAt,files`, read the diff
  against the requirement, then tell the user what you verified.

Then report to the user what was done, where it lives, and what you checked.
