---
name: lit-workflows
description: Add, change, or override a lit workflow - a markdown definition that makes lit inject guidance into its own output at a point in the ticket lifecycle (lit start, lit next, a phase change, lit done, a label). Covers choosing the layer (one repo or every repo), choosing the one moment it fires, writing the injected text, and proving it fires with a dry run. Use when the user says "whenever we pull/start/close a ticket, do X", "add a lit workflow", "make lit remind the agent to...", "change what lit says after done", or "run <skill> at <point> in the ticket lifecycle".
---

# Implement a lit workflow

`lit workflows --help` is the reference for the file format, layers, activation rules and event catalog. Read it first; this skill doesn't repeat it. Below are the decisions the reference leaves to you.

## 1. Is guidance enough?

A workflow adds text to what a lit command prints. It never blocks, gates or runs anything. If the user needs X to be impossible to skip, a workflow can't do that, so tell them before building one. A hook or a check in the tooling is the gate. A workflow is right when the agent only needs to be told, at the moment it matters.

## 2. Pick the layer

- **One repo:** `.lit/workflows/` in that repo, committed like any other change there.
- **Every repo on this machine:** the global layer. `~/.config/links-issue-tracker/workflows` is a symlink into the dotfiles repo, so the file belongs in `~/code/dotfiles/config/links-issue-tracker/workflows/`, and the change goes through a dotfiles worktree and PR. Don't write through the `~/.config` path: it edits the dotfiles master checkout directly, and the change skips review and history.

To change one of lit's built-in definitions, run `lit workflows edit <id>`. It copies the definition into the project layer, where the copy replaces it whole. For the global layer, copy that file into the dotfiles folder instead.

## 3. Pick one moment

Bind to the event that every path to the moment goes through. Don't bind to several events that happen in sequence, or the text prints twice. "When we pull a ticket" means `work_started` (`lit start`): a ticket picked by id never passes `lit next`, but every ticket gets started. Phases (`plan`, `impl`, `review`, `merge`) are states, not events. Bind with `states:` when the moment is entering or leaving one. Add `labels:` only to narrow which tickets it fires for. Dimensions combine with AND.

## 4. Write the body

An agent reads the body once, in the middle of running a command, and acts on it then. Write it for that one turn:
- What to do now, naming `<id>` so it's interpolated.
- One clause of why, when the step would otherwise look skippable.
- How to act on each outcome, when the step has outcomes. A skill that returns READY / NOT READY needs a line for each result, including what happens after a failure.

No background, no history of the workflow, nothing about other moments.

## 5. Prove it fires

- `lit workflows dry-run --event <event> --issue <some-id>` (or `--enter <state>`, `--label <label>`) must list the definition under Fired, with the body as the agent will see it.
- `lit workflows` must show it at the intended point, with no Warnings naming it.

A global definition can't be dry-run before it is merged and installed. Copy it into the repo's `.lit/workflows/` for the dry run, then delete the copy. After merge, `just install` in dotfiles creates the link if this machine doesn't have it yet. Run `lit workflows` again to confirm it resolves as `(global)`.
