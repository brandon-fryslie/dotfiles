---
name: next
description: Pull the next ready ticket from this project's tracker and start working on it. Use when the user types `/next`, says "next ticket", "what's next", "grab the next one", "pull the next item", or otherwise asks the agent to pick up the next unit of tracked work without naming a specific ticket.
---

# Next

Pick up the next ready ticket and start work.

## Process

1. **Identify the tracker.** Don't guess. Detect from the project, in this order:
   - Look for `.linear/`, Linear references in `README.md` / `CLAUDE.md` / `AGENTS.md`, or a `LINEAR_*` env var → use Linear MCP / `linear` CLI if available.
   - `gh repo view` succeeds AND issues are enabled → use `gh issue list`.
   - Local backlog files (`TODO.md`, `BACKLOG.md`, `docs/backlog/`, `tickets/`, `issues/`) → use those.
   - A project-scoped skill or command provides ticket access (e.g. a `home-infra` or repo-specific skill) → prefer it.
   - **None found:** stop. Tell the user "no ticket source detected — point me at one" and list what was checked. Do not invent work.

2. **Find the next ticket.** "Next" means: highest priority, unblocked, assigned to the user (or unassigned and claimable), in a "ready / todo / open" state — not "in review", "blocked", or "done". If the tracker has an explicit ordering (Linear cycle order, GitHub project board column position, a `BACKLOG.md` top-of-file convention), respect it. If multiple tickets tie, list them and ask which.

3. **Read the ticket fully.** Title, description, acceptance criteria, comments, linked PRs, linked tickets. If the ticket references a spec, doc, or prior PR, read that too. You are about to author code that claims to satisfy this ticket — earn the right to claim it.

4. **Surface blockers before starting.**
   - Acceptance criteria missing or vague? Ask.
   - Depends on another ticket that isn't done? Stop and report.
   - Spec referenced but doesn't exist? Stop and report.
   - The ticket conflicts with current branch state or uncommitted work? Stop and report.
   - Don't paper over ambiguity with assumptions — confirm scope first.

5. **Set up the workspace.**
   - Create or check out the appropriate branch per repo convention (e.g. `bf/<ticket-id>-<slug>`, or whatever recent branches use — check `git branch -a` for the pattern).
   - Confirm the working tree is clean before starting. If dirty, surface it and ask before proceeding.

6. **State the plan in one paragraph, then start.** What the ticket asks for, how you'll verify it's done (the machine-verifiable criterion), and the first concrete step. Then begin.

## Hard rules

- **Never invent a ticket.** If no tracker is detected or no ready ticket exists, say so. Do not start "improvements" the user didn't ask for.
- **Never claim a ticket that's already in progress** by someone else without confirming.
- **Never close, comment, or move a ticket to "in progress" / "doing"** until the user has confirmed this is the one to work on (unless the team workflow explicitly automates that — and even then, surface it).
- **Respect ticket-lifecycle rules.** "Done" means validated against reality, review addressed, docs updated, merged. Don't pull a *new* ticket while a current one isn't actually closed — check open PRs and recent branches first.

## What "next" does NOT mean

- It does not mean "any open issue" — it means the *next ready, prioritized one*.
- It does not mean "scan the codebase for things to fix."
- It does not mean "pick the easiest ticket."
- It does not mean "start without confirming acceptance criteria are clear."

## When to stop and ask

- Multiple tickets are tied for "next".
- The top ticket has unclear acceptance criteria.
- The current branch already has uncommitted work that doesn't belong to a current ticket.
- A previous ticket looks unfinished (open PR, deferred TODOs, missing tests) — ask whether to finish it first.
