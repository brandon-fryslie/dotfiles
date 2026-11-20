---
name: act-on-law-findings
description: Work through a project's completed laws audit. Find the audit and backlog, rank root causes by dependency, and verify and repair the ready findings. Also supports ranking alone or resuming an earlier run.
---

# Act on law findings

## Start or resume in the current project

Invoking `$act-on-law-findings` by itself starts a repair run. Find the completed audit, put its findings in dependency order, and work through them under the project's normal contribution and review rules. A named epic or set of findings narrows the scope. “Rank only” is read-only and returns the graph and recommendation. “Rerank the backlog” applies the order and stops there. When the user asks to decide together, bring them the consequential tradeoff with your recommendation.

Use findings already in the conversation or a supplied report or ticket. Otherwise follow the active epic or handoff, then search the project tracker and repository. In Lit, run `lit quickstart` and `lit backlog --all` to include epics outside the current focus. An audit may have been delivered only in chat. If needed, check accessible chat history scoped to this project and match the findings to its code. Ask for a pointer only if the intended audit is still missing or ambiguous.

Resume from existing tickets and branches. Use the project's tracker as the work record, or its audit or handoff when there is no tracker. Keep finding IDs, reuse tickets, and file untracked causes in scope. Read the accepted design and the relevant laws in `laws:code` where available. Check findings against current mainline, accounting for duplicates, landed fixes, and hypotheses. Reuse recorded proof when its inputs and owning code still match. Count confirmed law-review defects as bugs regardless of ticket type.

## Recover the reason for the architecture

State the capability the user wants and the cost that motivated it. Trace a real request through the existing system. Identify who observes the disputed fact, who decides what it means, who performs the effect, and how long shared state must survive. Use those lifetimes to choose process boundaries. When that trace or a user correction changes the design, identify which epic and ticket acceptance criteria need to change with it.

Give the epic an observable promise. In Candybar, a developer should be able to run a worktree renderer alongside the installed one against the same daemon. Count filesystem operations for the same unchanged source to prove sharing. Then stop the host and replay recorded inputs to check that each renderer reproduces its frames. Matching frames alone could hide duplicate reads.

## Decide whether the foundation holds

Treat completed migration tickets as claims about today's code. Exercise a small production path across the proposed boundary, including a transition that could break the promise. Candybar's two renderers shared the first read. When one released its subscription, the other missed the next file change. Both had assigned the same local ID to a watch the host tracked in one table.

Repair the earlier step first if extending it would spread a broken ownership rule. Here the host had to keep the watch alive until the last subscriber released it. Once the blocking contracts hold, finish the migration slice and run its acceptance test. Rerank at that milestone, even if the epic still has open tickets.

## Rank the decisions and simplify the work

Show the user how facts and effects flow through the relevant systems, then draw the fix dependencies using finding or ticket IDs. An edge `A → B` means B consumes a contract A establishes. Say what B would have to guess or redo if it landed first. Rank prerequisites first. Among ready causes, favor the hardest ownership decision whose failure would invalidate the most later work. Assess the actual consequence of each bug. Losing a menu-open flag carries little weight beside a broken shared watch.

Look for work the refactor can eliminate. A checkbox can change configuration while an explicit command preserves the ability to install a plugin. Record what the user wants removed, kept, or isolated. Give an agreed post-refactor rebuild its own ticket. Measuring reads can prove sharing during a refactor. Throughput tuning can follow once duplicate paths are gone.

Give the user the ranked causes, the code path or reproduction behind each consequential choice, the cheapest test that could reverse the first choice, and the work that can proceed independently. In a repair or reranking run, write the ranks, established design decisions, and acceptance criteria to the work record. Read back the order. In Lit, rank epics against epics and tickets among siblings. Reserve blocking links for actual prerequisites.

## Prove the repair and hand it on

Before running a probe, record the observation and both decisions it can support. If the remaining renderer misses an update, repair host watch ownership first. If it receives the update, move on to replay. Choose a probe that exercises the reported failure. If the result is inconclusive, sharpen the probe. A decisive pass on current code settles the tested claim and can unblock other work without an implementation change.

On failure, repair the component that knows the true outcome and rerun the same probe. For example, only the writer knows which file remained changed after a failed rollback. Hold polling still and check both consumers immediately to prove they learned about the write from its owner. For a structural finding, an import check or type check can supply the proof. If a regression test starts green and its sensitivity is in doubt, temporarily restore the old behavior in isolation and check that the test catches it.

Include independent law review in the ticket cycle. Use `laws:law-review` where available and have the reviewer challenge an assumption the passing case left open. Run authorized parallel changes in separate worktrees when their owners and edit surfaces are independent or their shared contract is settled. Verify their combined behavior. Continue independent work during checks and release activity.

Record the promise, owner, tested revision or PR, exact probe and result, outstanding review or integration, and next action. After each finding settles, revisit its dependents and take the next ready finding in scope. If an item needs a product decision or outside action, record what would unblock it and continue independent work. Finish when the scoped findings are settled, the user's stopping point is reached, or only genuine blockers remain. At a pause, stop delegated work and put unfinished changes on a reachable branch so the next invocation can resume.
