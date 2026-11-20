---
name: act-on-law-findings
description: Turn a completed laws audit and unranked root causes into a dependency-ranked backlog. Use it to decide what to fix first, whether a migration can proceed, and how to prove and hand off an authorized repair.
---

# Act on law findings

Start with the supplied findings, evidence, and IDs. Read the accepted design and the relevant laws in `laws:code` where available. Check the findings against current mainline and the actual backlog. In Lit, `lit backlog --all` includes epics outside the current focus. Work within the requested scope. Account for each finding, including duplicates, fixes already landed, and hypotheses that need a probe. Count confirmed law-review defects as bugs regardless of ticket type.

## Recover the reason for the architecture

State the capability the user wants and the cost that motivated it. Trace a real request through the existing system. Identify who observes the disputed fact, who decides what it means, who performs the effect, and how long shared state must survive. Use those lifetimes to choose process boundaries. When that trace or a user correction changes the design, identify which epic and ticket acceptance criteria need to change with it.

Give the epic an observable promise. In Candybar, a developer should be able to run a worktree renderer alongside the installed one against the same daemon. Count filesystem operations for the same unchanged source to prove sharing. Then stop the host and replay recorded inputs to check that each renderer reproduces its frames. Matching frames alone could hide duplicate reads.

## Decide whether the foundation holds

Treat completed migration tickets as claims about today's code. Exercise a small production path across the proposed boundary, including a transition that could break the promise. Candybar's two renderers shared the first read. When one released its subscription, the other missed the next file change. Both had assigned the same local ID to a watch the host tracked in one table.

Repair the earlier step first if extending it would spread a broken ownership rule. Here the host had to keep the watch alive until the last subscriber released it. Once the blocking contracts hold, finish the migration slice and run its acceptance test. Rerank at that milestone, even if the epic still has open tickets.

## Rank the decisions and simplify the work

Show the user how facts and effects flow through the relevant systems, then draw the fix dependencies using finding or ticket IDs. An edge `A → B` means B consumes a contract A establishes. Say what B would have to guess or redo if it landed first. Rank prerequisites first. Among ready causes, favor the hardest ownership decision whose failure would invalidate the most later work. Assess the actual consequence of each bug. Losing a menu-open flag carries little weight beside a broken shared watch.

Look for work the refactor can eliminate. A checkbox can change configuration while an explicit command preserves the ability to install a plugin. Record what the user wants removed, kept, or isolated. Give an agreed post-refactor rebuild its own ticket. Measuring reads can prove sharing during a refactor. Throughput tuning can follow once duplicate paths are gone.

Give the user the ranked causes, the code path or reproduction behind each consequential choice, the cheapest test that could reverse the first choice, and the work that can proceed independently. In a joint ranking, give your recommendation and surface the tradeoff. When asked to apply it, write the agreed ranks, design decisions, and acceptance criteria to the tracker. Read back the order. In Lit, rank epics against epics and tickets among siblings. Reserve blocking links for actual prerequisites.

## Prove the repair and hand it on

When implementation is authorized, make the old behavior fail at the boundary that can observe it. Repair the component that knows the true outcome and rerun the same probe. For example, only the writer knows which file remained changed after a failed rollback. Hold polling still and check both consumers immediately to prove they learned about the write from its owner. For a structural finding, a failing import check or type check can supply the proof. If a regression test started green, temporarily restore the old behavior in isolation and strengthen the test until it catches it.

Include independent law review in the ticket cycle. Use `laws:law-review` where available and have the reviewer challenge an assumption the passing case left open. Run authorized parallel changes in separate worktrees when their owners and edit surfaces are independent or their shared contract is settled. Verify their combined behavior. Continue independent work during checks and release activity.

Keep enough in the ticket for a fresh agent to start. Record the promise, owner, tested revision or PR, exact probe and result, outstanding review or integration, and the first action for the next unproven case. At a pause, stop delegated work and put unfinished changes on a reachable branch. After a merge, reassess which downstream tickets still require code and which now need only an acceptance check.
