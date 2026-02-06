Yes. The gaps are mostly about control surfaces: how you keep an agent aligned across time, and how you make “done” mechanically inevitable instead of negotiable.

Here are the most related questions you haven’t asked (and that matter a lot for agentic refactors), phrased the way you’d actually use them.

1) What is the explicit “Definition of Done” for the migration?

Most agents stall because “done” is fuzzy. You want something like:
	•	build passes
	•	unit tests pass (which set?)
	•	integration tests pass (which set?)
	•	smoke tests defined
	•	legacy entrypoints unreachable (or flagged)
	•	no forbidden imports
	•	docs/plan updated

If you don’t write this down, the agent will keep finding “reasonable” stopping points.

2) What are the invariants and how are they enforced?

Not “best practices,” but system invariants:
	•	data shape invariants
	•	API contracts
	•	ordering/consistency rules
	•	performance ceilings
	•	compatibility guarantees

And: are they enforced by tests, linters, schema validation, runtime asserts, or CI gates?

3) What is the cutover strategy and rollback strategy?

Agents defer hard work when they can’t see a safe landing.
You want to choose explicitly:
	•	flag / strangler / adapter
	•	dual-write / backfill / read-switch
	•	incremental per-slice cutover vs big bang
	•	rollback mechanism (and what “rollback” means at each phase)

4) What is the “boundary law” between legacy and new world?

You touched this, but the missing question is:
	•	Which direction(s) are calls allowed?
	•	Is the bridge allowed to grow or must it shrink?
	•	How do you measure “legacy surface area” over time?

This boundary law is the single best anti-resurrection tool.

5) What’s the work decomposition unit and sequencing rule?

Agents get stuck because tasks aren’t “closed loops.”
You want to ask:
	•	What is the smallest slice that can be migrated end-to-end?
	•	What is the order of slices (highest leverage / highest risk first)?
	•	Do we allow partial migrations that don’t compile?

This is basically: “How do we keep every step shippable?”

6) How do we prevent plan drift and context rot?

You discussed superseded plans, but the deeper question is:
	•	What is the canonical source of truth (one doc, one checklist)?
	•	How often does the agent restate it?
	•	What is the process for updating it (single changelog, versioning)?

Without this, the agent will continue to follow ghosts.

7) How do we handle tests as contracts, not obstacles?

The missing angle is:
	•	Which tests encode business contracts that must survive?
	•	Which tests encode implementation details that should die?
	•	Who decides ambiguity, and how is that decision recorded?

If you don’t classify tests, “green” incentivizes resurrection forever.

8) What are the “stop conditions” that force escalation instead of deferral?

Agents need explicit rules like:
	•	If blocked > N minutes or > N attempts: summarize blockage + propose 2 options + ask.
	•	If ambiguity about contract: stop and ask, don’t invent.
	•	If risky change: require explicit approval.

This prevents infinite “we’ll do it later” loops.

9) What metrics prove progress toward completion?

Refactors feel infinite unless you track something monotonic:
	•	count of legacy imports
	•	count of legacy entrypoints reachable
	•	number of quarantined tests remaining
	•	percentage of modules migrated
	•	number of bridge calls

This is how you create “convergence pressure” that agents respond to.

10) What is the review protocol for agent-produced changes?

Agents can generate huge diffs. You want a policy:
	•	maximum diff size per PR
	•	required summary format (“what changed / why / risk / test plan”)
	•	mandatory “no behavior change” vs “behavior change” labeling
	•	how to verify locally

This keeps you from drowning at 80–95%.

If you want one question to unify almost all of the above, it’s this:

“What governance artifacts (DoD, boundary law, cutover plan, test taxonomy, stop conditions, progress metrics) will we keep in the repo, and which ones must the agent restate at the start of every phase?”

That’s the difference between “agent helps with code” and “agent reliably lands a migration.”



1) What is the explicit “Definition of Done” for the migration?
2) What are the invariants and how are they enforced?
3) What is the cutover strategy and rollback strategy?
4) What is the “boundary law” between legacy and new world?
5) What’s the work decomposition unit and sequencing rule?
6) How do we prevent plan drift and context rot?
7) How do we handle tests as contracts, not obstacles?
8) What are the “stop conditions” that force escalation instead of deferral?
9) What metrics prove progress toward completion?
10) What is the review protocol for agent-produced changes?

## "OPTIMAL LIST"

	1.	What is the explicit Definition of Done for this effort?
	2.	What is the target end-state architecture and what is explicitly not part of it?
	3.	What invariants must never be violated during or after the change?
	4.	How are those invariants mechanically enforced (tests, schema, CI, runtime checks, etc.)?
	5.	What is the cutover strategy from old to new?
	6.	What is the rollback strategy at every phase of that cutover?
	7.	What is the boundary law between legacy and new systems (who may call whom, and how)?
	8.	Where is the single bridge or adapter between those worlds, and how is its growth constrained?
	9.	What units of work are allowed (the smallest slice that must compile, test, and ship)?
	10.	In what order must those slices be executed, and why?
	11.	What work is explicitly allowed to be temporarily broken or quarantined?
	12.	How is quarantined code, UI, or behavior made unreachable or inert?
	13.	How are tests classified into: still-valid, legacy-only, and contract-unknown?
	14.	What is the policy for migrating, deprecating, or quarantining each test class?
	15.	What prevents resurrection of legacy code or behavior once removed?
	16.	What is the single canonical source of truth for the current target state?
	17.	How are superseded plans, designs, or assumptions marked and archived?
	18.	How often must the agent restate the current target state and active rules?
	19.	What constitutes a blocker that cannot be deferred?
	20.	What are the explicit stop-and-escalate conditions?
	21.	What outputs are mandatory when touching high-risk areas (migrations, data, security, APIs)?
	22.	What progress metrics must monotonically decrease or increase toward completion?
	23.	How is legacy surface area measured and tracked?
	24.	What gates must be green before any phase is considered complete?
	25.	What review protocol applies to agent-generated changes?
	26.	What is the maximum safe batch size for changes before review?
	27.	How are ambiguous or unknown contracts resolved and recorded?
	28.	Who or what has authority to decide when uncertainty is acceptable?
	29.	What artifacts must be updated when the plan or target state changes?
	30.	What final validations prove the system is truly done and releasable?

    Here is the reduced but still attractor-locking set — this is what you use when you want strong convergence without drowning in governance.
	1.	What is the explicit Definition of Done for this effort?
	2.	What is the target end state, and what is explicitly out of scope?
	3.	What invariants must never be violated, and how are they enforced?
	4.	What is the cutover and rollback strategy?
	5.	What is the boundary law between legacy and new systems?
	6.	What is the single bridge or adapter between them, and how is its growth constrained?
	7.	What is the smallest shippable unit of work, and what order must units be done in?
	8.	What work is allowed to be temporarily broken or quarantined, and how is it made unreachable?
	9.	How are tests classified (migrate / deprecate / unknown), and how is resurrection prevented?
	10.	What is the single canonical source of truth for the current plan and target state?
	11.	What are the stop-and-escalate conditions when ambiguity or risk is encountered?
	12.	What progress metrics must monotonically move toward completion?
	13.	What gates must be green before a phase is considered complete?
	14.	What is the review and batching protocol for agent-produced changes?
	15.	What final validations prove the system is truly done and releasable?

This is the smallest set I know that still prevents:
	•	deferral
	•	resurrection
	•	plan drift
	•	false “green” states
	•	infinite refactor loops

You can think of it as the governance kernel for an agentic refactor.

TODO: 

- Integrate system from ChatGPT
- Try out 'Gabe' agent
- Appreciate Nikki

https://chatgpt.com/share/695a44f0-c418-800c-8428-a40dcd4132e3