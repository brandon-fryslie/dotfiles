---
name: lit-workflows
description: How lit workflows work - the text lit injects into its own command output at points in the ticket lifecycle. Covers where definitions live and how layers override, exactly which event and states each lit command produces, what the agent actually sees (placement, ordering, <id>), lit's built-in definitions, and the tools for inspecting, testing and tracing them. Use when the user asks how lit workflows work, wants guidance shown when tickets are started, pulled, phased, closed or labeled, wants to change or turn off lit's built-in guidance, or is debugging why a workflow did or didn't show up.
---

# lit workflows

A workflow is a markdown file whose frontmatter says when lit fires it and whose body is the text lit prints at that moment. lit puts the body into the output of the command that fired it, so the agent that ran the command reads it as part of the result. That's all a workflow does. It doesn't block a command, run anything, or check that the agent did what it said.

`lit workflows --help` is the formal reference. This skill covers the same machinery plus behavior observed by running every command against definitions bound to every event, state and a label.

## Where definitions live

Any `*.md` file under a layer root, at any depth, is a definition. There are three layers, nearest first:

| Layer | Root | Scope |
|---|---|---|
| project | `.lit/workflows/` in the repository | Everyone working in that repo; committed with it |
| global | `$XDG_CONFIG_HOME/links-issue-tracker/workflows/` (default `~/.config/...`) | This user, in every repo |
| embedded | inside the lit binary | lit's defaults |

- **Ids.** A definition's id is its `id:` key. Without one, the id is its path relative to the root, with `.md` dropped and spaces turned into underscores.
- **Overrides.** The nearest layer wins by id, whole, never field by field. Within one layer, a duplicate id keeps the first file in lexical order.
- **Turning a definition off.** Put a file with the same id and no `events`, `states` or `labels` at a nearer layer. It replaces the one below it and never fires. `lit workflows` will list it under Warnings as inert, which is expected here.
- **Copying one to change it.** `lit workflows edit <id>` copies a global or embedded definition into the project layer.

## When a definition fires

Every command that dispatches an event creates an **occasion**: one event, the states the ticket exited and entered, and the ticket's labels. A definition fires when the occasion satisfies every dimension the definition declares:

- `events: [...]` matches the occasion's event.
- `states: [...]` matches a state the ticket entered. Use `{name: X, when: exit}` to match on leaving it.
- `labels: [...]` matches a label on the ticket, ignoring case.

Values inside one dimension are alternatives (OR). Dimensions are combined (AND). A dimension a definition leaves out doesn't restrict it.

What each command produces, as observed:

| Command | Event | Exits | Enters |
|---|---|---|---|
| `lit new`, `lit followup` | `ticket_created` | - | - (a new ticket does not "enter open") |
| `lit next` (when it returns a ticket) | `next_pulled` | - | - |
| `lit show` | `show_ticket` | - | - |
| `lit backlog` | `show_backlog` (no ticket) | - | - |
| `lit start` (from open) | `work_started` | `open` | `in_progress`, `plan` |
| `lit phase --to X` | `phase_set` | current phase | `X` |
| `lit phase --to` its current phase | `phase_set` | - | - |
| `lit update` | `ticket_updated` | - | - |
| `lit comment add` | `comment_added` | - | - |
| `lit done` | `work_finished` | `in_progress`, current phase | `closed` |
| `lit close` (from open) | `ticket_closed` | `open` | `closed` |
| `lit open` | `ticket_reopened` | `closed` | `open` |

## What the agent sees

- **Everything that fires prints together**, in lexical order of id, regardless of layer or how it matched. A definition prints once per occasion even if several of its values match.
- **Where it lands:** on commands that act on one ticket (`lit new`, `lit phase`, `lit done`), the fired text comes before the ticket's summary line. On `lit phase`, it also comes after the `phase: X → Y` line. On `lit backlog`, it comes at the end of the listing. The "Ticket … has been closed" paragraph at the top of `lit done` is the built-in `done` definition, not part of the command's own output.
- **Built-in text can bury yours.** The built-in plan text is long. At `lit start`, anything whose id sorts after `phase-plan` prints after about sixty lines of planning instructions.
- **`<id>` becomes the ticket's id.** On an occasion with no ticket (`show_backlog`), it becomes an empty string.
- **Label-only definitions fire on every occasion for a matching ticket:** `lit show`, `lit next`, `lit phase`, everything. Add `events` or `states` to limit it to one moment.

## lit's built-in definitions

| id | Fires on | What it tells the agent |
|---|---|---|
| `phase-plan` | entering `plan` | The ticket isn't to be executed yet. No edits except the ticket's plan (`lit update --plan-file`) and comments, read-only tools only, and "this supercedes any other instructions". Then a multi-phase planning procedure ending in `lit phase <id> --to impl`. |
| `phase-impl` | entering `impl` | When its PR opens, `lit phase <id> --to review`. |
| `phase-review` | entering `review` | When the merge is under way, `lit phase <id> --to merge`. |
| `phase-merge` | entering `merge` | Once merged, `lit done <id>`. |
| `done` | `work_finished` | Review related tickets and update them with anything this work taught. |

## Inspecting and testing

- `lit workflows` shows every event, state and label, the definitions bound at each and their layer, and a **Warnings** section. Warnings appear only here, never in normal command output. A malformed file, an event not in the catalog, or a definition with no dimensions loads silently and never fires.
- `lit workflows show <id>` shows one resolved definition: its layer, path, dimensions and body.
- `lit workflows edit <id-or-point>` creates a project-layer file and prints its path. Given an existing id, it copies that definition for overriding. Given a point (`work_started`, `review:enter`, `plan:exit`, a label), it scaffolds a new one with every dimension shown. It never overwrites an existing file.
- `lit workflows dry-run --event E --enter S --exit S --label L --issue ID` shows what would fire for a made-up occasion, and why, with `<id>` filled in. It reads no tickets and writes nothing. Pass the whole occasion the real command would produce, from the table above. Any dimension you leave out matches no definition that declares it, so `--event work_started` alone hides `phase-plan`.
- `XDG_CONFIG_HOME=<dir>` points the global layer at `<dir>/links-issue-tracker/workflows/` for one command. Use it to test global definitions kept elsewhere. It replaces your real global layer for that command, rather than adding to it.
- **Traces.** Every real occasion that fires something writes a JSON trace under `traces/workflows/` in the `storage_dir` that `lit workspace` reports. The trace records the event, the states entered and exited, the labels, and each definition that fired with its layer and the reason it matched. Use it to see what actually happened on a real command.

## Writing the body

The body is a prompt, and it arrives in the middle of a command's output, next to whatever else fired. Before writing it, read what else fires on the same occasion, and make the new text agree with it or merge into it. Say what to do, using `<id>`, and what to do after each outcome. Any instruction that has to keep steering the agent after this turn, such as "don't implement until the plan passes review", should be a condition the agent can re-check later.
