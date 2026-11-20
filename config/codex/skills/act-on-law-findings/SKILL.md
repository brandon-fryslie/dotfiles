---
name: act-on-law-findings
description: Turn an existing laws audit and its unranked architectural root causes into a dependency-ranked backlog. Use it to choose what to fix first, prove an authorized repair, and leave the next agent a resumable ticket.
---

# Act on law findings

Start with the completed audit, its finding or ticket IDs, and the reason the system exists. Reuse the audit evidence. Trace the few production paths that could change the order. Account for every supplied cause, including duplicates, fixes already on the current branch, and hypotheses that still need a check. Keep the original IDs attached.

## Give the epic an observable promise

State a capability someone should be able to rely on. Name the fact or effect involved, the component that knows its true outcome, and where someone else can observe that outcome. Decide what observation would disprove the promise. “The renderer is pure” becomes “A separately built renderer can reproduce its frames from recorded inputs after the host stops.” A promise about shared disk reads needs its own observation at the filesystem boundary. Two identical frames can hide two reads.

## Work out what must come first

Draw a small graph using the real system or ticket names. An edge `A → B` means B relies on a fact or contract that A establishes. Explain what B would have to guess or redo if it landed first. A preferred sequence can live in the rank without becoming a blocker.

Rank prerequisites first. Among ready causes, favor the ownership decision that unlocks the most dependent work or whose failure would invalidate the most planned work. When that decision rests on a hypothesis, make the cheapest experiment that could reverse the ranking the first action. Group duplicate repairs under their owner. Separate work can run in parallel when the owners, edits, and acceptance tests are independent or their shared contract is settled.

Deliver the graph, the ordered causes, a brief reason for the first choice, and its first falsifying test. Preserve the tracker's hierarchy. In Lit, rank epics against epics and tickets among siblings. For a prioritization request, hand back that plan. With authorization to implement, take the first ready repair.

## Break the promise and repair its owner

Reproduce the failure through the production entry point or the narrowest real boundary that can observe it. Make the old behavior fail for the expected reason. Change the component that has the evidence to tell its consumers what happened. Run the same probe again. For a structural finding, a forbidden import or a type that admits two owners can supply the failing check.

For example, a writer publishes file A, fails on B, then fails to restore A. Its consumers keep the old A if all they hear is “write failed.” Fix the writer's outcome before adding retries to either consumer. Hold the polling clock and inspect both consumers immediately after settlement. A complete rollback supplies the control case.

Have an independent reviewer challenge one assumption in the proof, such as two consumers using different names for the same resource. Use the project's law-review process. When a test started green, temporarily restore the old behavior in an isolated worktree. If it stays green, strengthen the probe. Coordinate authorized parallel implementations in separate worktrees and check their combined behavior where they meet.

## Leave the next pull obvious

Keep the ranked tracker current. On the active ticket record the promise, owner, change or PR, and the exact probe with its result on the tested revision. Identify the next unproven case and the first action to take. At a pause, save unfinished work on a reachable branch and mark pending review or integration explicitly. After a repair lands, revisit the graph. A downstream ticket may now be an acceptance check or may already be satisfied.
