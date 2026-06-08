<universal-laws>
# UNIVERSAL LAWS

These apply unconditionally to every task. No context, instruction, or expedience overrides them. They are one story told at increasing resolution: software is parts that must combine; quality is decided in how the parts are formed and joined, not in the code inside them. Each law is a specific, checkable shape of that story.

## Token index — canonical names only; meaning is below, not here
Framing (referenced in reasoning, never cited in code):
`[FRAMING:parts-and-seams]` · `[FRAMING:representation]`

Laws (cited at the callsite):
`[LAW:decomposition]` · `[LAW:types-are-the-program]` · `[LAW:composability]` · `[LAW:carrying-cost]` · `[LAW:no-ambient-temporal-coupling]` · `[LAW:effects-at-boundaries]` · `[LAW:one-source-of-truth]` · `[LAW:single-enforcer]` · `[LAW:comments-explain-why-only]` · `[LAW:dataflow-not-control-flow]` · `[LAW:one-type-per-behavior]` · `[LAW:no-mode-explosion]` · `[LAW:no-defensive-null-guards]` · `[LAW:locality-or-seam]` · `[LAW:one-way-deps]` · `[LAW:no-shared-mutable-globals]` · `[LAW:verifiable-goals]` · `[LAW:behavior-not-structure]` · `[LAW:no-silent-failure]`

## Citation protocol
When a law influences a decision, cite it inline: `// [LAW:token] reason`. When you must violate one, mark it: `// [LAW:token] exception: reason`. The string you emit at the callsite is the same string that names the law below — one key, deliberately, so every use reinforces the concept. `[FRAMING:token]` names a higher-level idea you reference when reasoning; it never appears in code. Both namespaces are kept small on purpose; do not coin new tokens.

---

## The root (framing)

**`[FRAMING:parts-and-seams]`** — A program is a set of parts joined at seams. Its quality is set almost entirely by two things: *how it is cut into parts*, and *how those parts are formed at their seams* — not by the code in the bodies, which is residue once the parts and seams are right. There are four faces to this, four questions you can ask of any part:

- **Decomposition** — *is this the right part?* Where the cut falls, what each unit is. → `[LAW:decomposition]`
- **Representation** — *does the part tell the truth?* Whether its contract is honest and consistent. → `[FRAMING:representation]`, `[LAW:types-are-the-program]`
- **Time** — *does it combine correctly in sequence?* Who owns ordering and lifecycle. → `[LAW:no-ambient-temporal-coupling]` *(face real; under-specified — revisit)*
- **World** — *does it separate computing from acting?* Where the part touches the outside. → `[LAW:effects-at-boundaries]` *(face real; partially specified — revisit)*

Decomposition and representation are fully worked below. Time and world are real and named so the structure is honest about them, but deliberately left brief; their corollaries are sound even though the faces themselves want more work later. When the parts are well-cut and truthful, they compose — and composition is the whole goal.

**`[FRAMING:representation]`** — Every representation must be coherent and accurate, without exception. A representation is anything that stands for something else: a type, a comment, a name, a cache, a derived value, a schema. When a representation drifts from what it represents, it becomes a lie the rest of the system trusts. Types are the *strongest concrete instance* of this — a representation a machine checks for you — which is why `[LAW:types-are-the-program]` is the operational primary and this framing is the reason its corollaries (`[LAW:one-source-of-truth]`, `[LAW:comments-explain-why-only]`) belong to the same family. Prefer the most concrete, most mechanically-checked representation available: compile-time over runtime, runtime over documentation, documentation over hope.

---

## The primaries

**`[LAW:decomposition]`** — Cut the program at its real joints. Each part does one thing, and the boundaries fall where the domain actually separates, not where a single caller's convenience suggests. The test is whether the seam carries the whole truth of the part: a good cut leaves a part you can understand, test, move, and reuse by looking only at the part. A bad cut fuses concerns (selection *and* action, policy *and* mechanism) so the part serves exactly one site and resists every other. Names in a spec are usually examples of instances, not evidence of where to cut. When you cannot name what a part *is* in one phrase without "and," the cut is wrong.

**`[LAW:types-are-the-program]`** — The types *are* the program: not a description of it, not a linter, not a test suite. Choose the strongest theorem about your data that is still true — every legal state representable, every illegal state unrepresentable. Too weak (`any`, bags of optionals, `string` where four enum values are meant) and illegal states slip through, forcing every callsite to defend. Too strong but false (tighter than the domain allows) and the code must lie or break. The exactly-right type is *exactly as expressive as the domain*; state it once and everything downstream is free to assume it. Once the constraints are right, the implementation is residue — the body is forced and writing it is mechanical. So every rough bit in the body is the code asking you to fix a constraint: if the body wants to branch, the type is missing a discriminator; if it wants to guard, an upstream type permits a state it shouldn't; if it needs a comment to explain an invariant, the type didn't encode it. **When implementation feels hard, the constraints are wrong.** Fix the type; do not push through the body. The concrete face of `[FRAMING:representation]`.

## The consequence — what right parts and true types buy

**`[LAW:composability]`** — A part composes when it **does one thing, completely, asking nothing**: it makes a closed promise about a general case, so it can be dropped into any context that wants that one thing and will deliver it with no negotiation. Three failure modes, one test. *Does more than one thing* → the fused part (`colorOddRows`) serves one caller; split it. *Completes only for a particular caller* → the promise secretly depends on facts not in the interface; lift those facts to the seam as values (the inlined `odd` check becomes a `predicate` parameter — `filter(isOdd, rows)`). *Asks for machinery before it will act* → the over-abstraction that can't move until you assemble its config; that is commitment pushed onto callers from the other side. You reach this state by subtraction: each pass removes one thing the part decided on a caller's behalf, until nothing snags. The check for done is not "does it work" or "do tests pass" — it is **does the part I am leaving compose better than the one I found.** Emerges from `[LAW:decomposition]` and `[LAW:types-are-the-program]` done together; neither alone is sufficient, because a perfectly typed part can still be badly cut.

**`[LAW:carrying-cost]`** — Distinguish *intrinsic cost* (to build a thing once) from *carrying cost* (to maintain, extend, work around, and reason about it forever). A part that composes (`[LAW:composability]`) has near-zero carrying cost: it doesn't couple to callers, doesn't constrain future code, and earns its keep across every project needing its shape. So for an engineer building by subtraction the economics invert — more good parts is *cheaper* than fewer, because each lowers the cost of all future work and carries almost nothing. YAGNI is advice about intrinsic cost under the assumption carrying cost is bounded, which holds only for non-composing parts; it speaks about *features* and has nothing to say about *substrate*. Doing it right now is cheaper than continuing wrong, regardless of effort already spent — no matter how far down the wrong road, turn around. The "wrong abstraction is worse than duplication" warning is `[LAW:no-mode-explosion]` in disguise: the cost is caused not by abstracting but by *stretching* one part over shapes it wasn't cut for; the fix is to fork, not to retrofit every caller. The right question for a foundational piece is never "do we need it" but "does it compose, and is its type the strongest true theorem."

## The world faces

**`[LAW:no-ambient-temporal-coupling]`** — Ordering, timing, lifecycle, initialization, cleanup, and re-entry have one explicit owner and are represented as state, data, or capability — never hidden in incidental execution order. Correctness must not depend on sleeps, event-loop ticks, effect order, render timing, "settle" delays, caller sequencing, or in-flight flags unless that scheduler is the named owner. If an operation is only safe after another, encode the phase transition in a typed state machine or route both through the single owner. The time face of `[FRAMING:parts-and-seams]`: a temporal assumption left in folklore is an illegal call order left representable — an instance of `[LAW:types-are-the-program]` in the dimension of sequence.

**`[LAW:effects-at-boundaries]`** — A part either computes or acts on the world (IO, mutation, network, randomness, clock) — never both. Push effects to the edges; keep the interior pure. A pure interior can be reasoned about, tested, and composed in isolation; an effect mixed into logic makes the logic context-dependent and uncomposable, because the part now has an undeclared seam to the world. When an effect appears mid-computation, lift it to the boundary: let the pure core return a *description* of what to do, and perform it at the edge. The world face of `[FRAMING:parts-and-seams]`, and the spatial cousin of `[LAW:no-ambient-temporal-coupling]` — one localizes *where* a part touches the world, the other *when*. The "return a description, not the action" move is `[LAW:dataflow-not-control-flow]` applied to effects.

## The representation corollaries — does the part tell the truth

**`[LAW:one-source-of-truth]`** — Every concept has exactly one authoritative representation; all others are derived and explicitly synchronized. If two representations can diverge, the architecture is broken — find the canonical one, never mint a second. Caches and indexes are derived, never authoritative. An instance of `[FRAMING:representation]`: two things that can disagree are an under-constrained type, since the constraint that they agree is encoded nowhere.

**`[LAW:single-enforcer]`** — Any cross-cutting invariant (auth, validation, serialization) is enforced at exactly one boundary. Duplicate checks across callsites drift; if enforcement already exists, remove the duplicate, never add another. The specialization of `[LAW:one-source-of-truth]` to enforcement — the single enforcer is where the invariant's type lives; every other check is residue from a missing type or a misplaced boundary.

**`[LAW:comments-explain-why-only]`** — Comments explain *why*, never *what*, and rarely *how*. The code is the authoritative description of what it does; prose restating it is a copy that drifts immediately and is never refreshed. Forbidden in comments: enumerations of callers, counts, references to specific lines, variable names, or function names. Remove any you find, without debating exceptions. An instance of `[LAW:one-source-of-truth]`: a what-comment is a manual divergent copy; and if code needed explaining, the shape is wrong — fix the type, don't write the comment.

## The dataflow corollaries — variability lives in values

**`[LAW:dataflow-not-control-flow]`** — Structure mirrors data flow, not control flow. The same operations run in the same order every invocation; variability lives in the *values* (nulls, empty collections, discriminated unions), never in *whether* an operation runs. Side effects are unconditional — vary behavior by varying inputs, not by guarding execution. Most-violated law, because every language defaults to control flow; fight the default. Sharpest diagnostic: if describing the *mechanics* of your solution needs "if," "and," "when," "skip," or "only," variability has leaked into control flow and the solution is almost certainly wrong. An instance of `[LAW:types-are-the-program]`: variability in values is variability the type carries; variability in whether code runs is variability the type cannot constrain.

**`[LAW:one-type-per-behavior]`** — If multiple things have identical behavior, they are instances of one type, not multiple types. Before creating FooA, FooB, FooC, ask what differs besides the name; if "nothing" or "only configuration," make one Foo with instances. An instance of `[LAW:dataflow-not-control-flow]`: the configuration is the value crossing one boundary; the type is the boundary, held fixed.

**`[LAW:no-mode-explosion]`** — New flags and options need a documented cap and an exit plan; the default path stays canonical. An instance of `[LAW:dataflow-not-control-flow]`: prefer variability in values over variability in modes — values flow through a fixed boundary and can be reasoned about, while modes must be enumerated and tested combinatorially.

**`[LAW:no-defensive-null-guards]`** — Null checks are valid only at trust boundaries (external input, network, user data) or where a value explicitly represents optionality. If a value should never be null, make it not-null upstream; don't add a guard that silently skips work. A null guard with no meaningful `else` is control flow in disguise, hiding bugs by skipping instead of failing loudly. If absence is genuine, encode it as a discriminated value handled by exhaustive match, not a check. An instance of `[LAW:dataflow-not-control-flow]`: the guard is the body asking you to lift optionality into the type.

## The boundary corollaries — is this the right part

**`[LAW:locality-or-seam]`** — Changes to X must not force edits in unrelated Y. A missing seam is a missing cut: the change cascades because no boundary carries the variability. Create the interface first; the seam *is* the part boundary. An instance of `[LAW:decomposition]`.

**`[LAW:one-way-deps]`** — Dependency direction is declared. Cycles forbidden; upward calls forbidden. An instance of `[LAW:decomposition]`: a cycle is two parts sharing a hidden third that wants extracting and naming, so both can depend on it cleanly.

**`[LAW:no-shared-mutable-globals]`** — Registries and singletons require a single owner, an explicit API, and documented invariants. An instance of `[LAW:decomposition]` and `[LAW:single-enforcer]`: an unowned global is a part with no real boundary — anything reads, anything writes — and the owner's API is the missing seam made manifest.

## The process corollaries — correctness must be observable

**`[LAW:verifiable-goals]`** — Every planned goal has concrete criteria a deterministic process can check (e.g. "app loads with no warnings or errors in logs"). Exhaust your own verification before asking the user to test — that is the last resort. Where uncertainty remains, ask before proceeding rather than guessing. Wrong: "it's built, now you test it." Right: "I verified it against defined criteria; there are no warnings or errors." An instance of `[LAW:types-are-the-program]`: an unverifiable goal is one whose "done" state has no type — define the shape of success and failure, and verification follows.

**`[LAW:behavior-not-structure]`** — Tests assert *what* (contracts, the meaning of operations), never *how* (implementation). A test that can only pass by preserving deprecated code encodes structure — update or delete it, never satisfy it by reintroducing removed code. An instance of `[LAW:types-are-the-program]`: structure is already enforced by the type system, so a structure-asserting test is miscast; and if a test is the only thing keeping code alive, the type is missing the constraint that should have made the code load-bearing.

**`[LAW:no-silent-failure]`** — Failure must be loud and explicit. Never swallow errors, never fall back silently to a different data source or default that changes meaning. `2>/dev/null`, `|| true`, and silent catches are lies — they send the next agent or human confidently down the wrong path. A fallback that alters the *meaning* of data is a bug that fires only when things are already broken, guaranteeing maximum confusion. If the primary path fails, stop and surface it. An instance of `[FRAMING:representation]`: a swallowed failure misrepresents failure as success, and it defeats `[LAW:verifiable-goals]` by hiding the signal verification depends on.

---

## Summary (recap at recency — verbatim tokens, relationships, no new definitions)
The story compressed, for reinforcement. Software is `[FRAMING:parts-and-seams]`: parts joined at seams, with four faces — decomposition (the cut), representation (the truth), time, world.

- **Cut the right parts.** `[LAW:decomposition]`, and its boundary corollaries `[LAW:locality-or-seam]`, `[LAW:one-way-deps]`, `[LAW:no-shared-mutable-globals]`.
- **Make each part true.** `[FRAMING:representation]` → `[LAW:types-are-the-program]`, with `[LAW:one-source-of-truth]`, `[LAW:single-enforcer]`, `[LAW:comments-explain-why-only]` (don't let representations diverge), and `[LAW:dataflow-not-control-flow]`, `[LAW:one-type-per-behavior]`, `[LAW:no-mode-explosion]`, `[LAW:no-defensive-null-guards]` (variability lives in values, not branches).
- **Mind the world.** `[LAW:no-ambient-temporal-coupling]` (when) and `[LAW:effects-at-boundaries]` (where) keep a part's contact with the outside declared, not scattered.
- **The payoff.** Right parts + true types compose: `[LAW:composability]` — does one thing, completely, asking nothing — and composing parts have near-zero `[LAW:carrying-cost]`, which is why building more of them is cheaper than building fewer.
- **Stay honest.** `[LAW:verifiable-goals]`, `[LAW:behavior-not-structure]`, `[LAW:no-silent-failure]` keep correctness observable.

When in doubt, return to the root: design the parts and their seams so the parts compose; the body is residue.
</universal-laws>

# TODO: rewrite the rest

<guidelines>
Contextual guidelines—apply when relevant. Unlike the unconditional laws above, these are judgment calls.

<simplicity>
- **Delete over shim**: Remove features rather than maintain compatibility layers. Shims become permanent.
- **Justify every knob**: New configuration options need a value case. Flexibility is debt with interest.
</simplicity>

<modules>
- **Small and crisp**: When a module becomes "where things go," it's time to split.
- **Split by change-reason**: Growing modules split by *why* they'd change, not by file size.
</modules>

<state>
- **Data contracts over object graphs**: Stable shapes beat implicit references that hide coupling.
- **State machines for workflows**: Multi-phase logic gets explicit state transitions.
- **Immutable coordination**: Snapshots over shared mutable references for cross-boundary communication.
- **Caches are derived**: Invalidation rules must be owned and centralized. Cache as optimization, not architecture.
</state>

<dependencies>
- **Low fan-out**: Core modules should have few outgoing edges. Measure this.
- **Invariants at boundaries**: Document constraints at the module edge, not buried in implementation.
- **Track hotspots**: Where changes routinely cascade, reduce centrality. These are architecture risks.
</dependencies>

<data-driven-architecture>
See `dataflow-not-control-flow` in PRIMARY CONSTRAINTS above. The structural form: when you find yourself reaching for an `if` that skips an operation, the constraint upstream is wrong — restructure so the operation always runs and the data decides what happens.
</data-driven-architecture>


<boundaries>
- **Anti-corruption layers**: Legacy/new boundaries get explicit translation layers.
- **Variability at edges**: Core invariants stay fixed. Push optionality outward.
- **Capabilities over context**: Don't pass omniscient objects; grant specific abilities.
</boundaries>

<events>
- **Events don't replace call graphs**: Clear dependencies beat implicit pub/sub. Events supplement, not supplant.
</events>

<flags>
- **Track mode count**: Flags × permutations = risk. Measure and minimize.
- **Flag discipline**: Every flag needs: owner, default, rollout plan, deletion date.
- **Gate entrypoints**: Feature toggles branch at entry, not deep inside logic.
</flags>

<testing>
- **Contract vs implementation tests**: Separate them. Contract tests are stable; implementation tests are local and cheap.
</testing>

<errors>
- **Context in errors**: Enough information to localize responsibility without guessing.
- **No silent fallbacks**: Explicit failure beats hidden compatibility paths. Silent fallbacks hide rot.
</errors>

<abstractions>
- **"What it forbids"**: New abstractions document their guardrails—what they prevent, not just what they enable.
- **Make it impossible**: Mechanical enforcement beats policy. Compile-time > runtime > documentation > hope.
</abstractions>

<remember>No guidelines overrule the universal-laws.  You must ALWAYS obey the universal laws.</remember>
</guidelines>

<context-specific>
Apply these when working in the relevant domain.

<ui-frontend>
- **State lives near use**: Hoist only when coordination requires it.
- **Components mirror user mental models**: Not implementation concerns.
- **One timing authority**: Animation/rendering applies `no-ambient-temporal-coupling`; the timing/lifecycle owner is explicit.
</ui-frontend>

<remember>Context-specific rules may overrule the guidelines, but NEVER the universal-laws.  The universal-laws are always and forever</remember>

<apis>
- **Idempotency by default**: Retry-safe unless explicitly documented otherwise.
- **Errors enable retry**: Include enough context to retry intelligently.
- **Version at the boundary**: Not scattered through internals.
</apis>

<data-schema>
- **Migrations have rollback paths**: Schema changes are reversible deployment events.
- **Avoid dual-write**: If unavoidable, define explicit cutover criteria and deadline.
</data-schema>

<pipelines-compilers>
- **Staged with explicit I/O**: Each stage declares inputs/outputs.
- **No back-edges**: Later stages never mutate earlier representations.
- **IRs are owned**: Intermediate representations have explicit ownership, not ambient.
</pipelines-compilers>

<distributed-systems>
- **Failure modes documented like success paths**: Not afterthoughts.
- **Ordering/timing has explicit owner**: Distributed sequencing applies `no-ambient-temporal-coupling`; no ambient assumptions about sequencing.
</distributed-systems>

<cli>
- **Exit codes are contract**: Not just 0/1.
- **Stdout/stderr have defined semantics**: Parseable vs. human output is intentional.
</cli>
</context-specific>

<remember>PRIMARY CONSTRAINTS: The types are the program. Dataflow not control flow. One source of truth. Single enforcer. One-way dependencies. One type per behavior. Goals must be verifiable. No ambient temporal coupling. Each is an instance of: design constraints such that illegal states cannot be expressed; the implementation is residue.</remember>

<python-deps>
# PYTHON DEPENDENCY DISCIPLINE

NEVER run `pip install --break-system-packages` or any flag that bypasses PEP 668. It can corrupt OS-managed Python and break system tooling.

When a Python dep is missing, prefer in this order:
1. Use a tool that doesn't need the dep (curl, node, headless `chrome --screenshot`, an existing MCP tool).
2. **Use `uv`** — `uv run --with <pkg> python -c '...'` or `uv run --with <pkg> script.py`. This is the default; the user has stated uv is the preferred tool.
3. Throwaway venv: `python3 -m venv /tmp/venv && /tmp/venv/bin/pip install <pkg>`.
4. Ask before installing anything globally.
</python-deps>

<scripting-discipline>
# SCRIPTING AND AUTOMATION DISCIPLINE

Hard-won lessons. Non-negotiable when writing scripts, automation, or glue code.

**Never swallow errors.**
- Forbidden patterns: `2>/dev/null`, `|| true`, `|| echo "default"`. These are lies — if a command can fail, that failure is meaningful.
- Silent failures send agents or humans confidently down the wrong path for hours. Let it fail, let it be loud, fix the cause.
- The *only* acceptable use of `|| true` is when the failure is genuinely irrelevant to every downstream consumer. If you're unsure, it's not irrelevant.

**Never build silent fallback data sources.**
- Two queries that look similar but have different filtering/ordering/semantics (e.g., "ready work respecting dependencies" vs. "all open items") are NOT interchangeable.
- A fallback that changes the *meaning* of the data is a bug that only triggers when things are already broken — guaranteeing maximum confusion.
- If the primary source fails: stop and tell the operator. Don't improvise.

**Never write against an API you haven't tested.**
- Before scripting against a CLI/API/service, run the commands yourself. Check what flags exist, what the output actually looks like, what errors look like, what JSON shape comes back.
- Every `jq -r '.[].id'` is an assertion about the shape of the data. Verify it or don't ship it.
- A script written against an assumed interface is fiction, not code.

**Validate data after every external call.** Before captured output flows downstream, check:
- Did the command exit 0?
- Is the output non-empty?
- Does it parse as the expected format?
- Do extracted values look sane?

If any check fails, abort with a clear message. An empty string or malformed JSON interpolated into the next command is how you get phantom work items, wrong branches, and corrupted state.

**Agent-driving scripts are amplifiers — treat them like it.**
- A script that loops `claude -p` over work items multiplies every bug by every iteration. An error in ticket ordering wastes hours of agent compute.
- The script IS the agent's judgment about what to work on. If the script is wrong, the agent is wrong at scale.
- Write it like it matters, because it does.
</scripting-discipline>

<subagent-delegation>
# SUBAGENT DELEGATION

Subagents see only the prompt you write. No conversation context, no CLAUDE.md, no user requirements carry over. If it's not in the prompt, it doesn't exist.

## Rules

1. **Every user requirement goes in every subagent prompt.** All of them. Do not filter for relevance. Do not summarize. Include the actual constraints in the user's actual words.
2. **Include examples of bad output.** Positive instructions ("be behavioral") are ignored. Negative examples ("do NOT produce output like this: [example]") are enforceable.
3. **Include a verifiable acceptance criterion.** The subagent must know what correct output looks like before it starts.
4. **Before dispatching the first agent, verify the prompt template against the user's requirements.** Every requirement missing from the template produces N copies of wrong work.
5. **Read the actual artifact each subagent produces.** Not its summary. Not its self-assessment. The file it wrote.
6. **Validate against the user's requirements, not the subagent's report.** Subagents will report success on work that completely misses the point.
</subagent-delegation>

<wisdom>
Following these rules will often, even mostly, require more SHORT TERM work than
 you expected.  That is not a problem.  "No matter how far you've gone
down the wrong road, turn around."  or  "When you find yourself in a
hole - stop digging!"  or  "you can't get to the right destination by
taking the wrong path".  Make sense?  It might feel like extra effort,
but logically, once you know the right direction, you shouldn't spend
any time continuing away from it.

The critical insight here is that we are optimizing for the LONG TERM, not the
short term.  It might take 1/5 the effort to do something the easy way, which can
feel like a win.  But then you might need to refactor that work 3x throughout the
project for new capabilities, and consider the friction + churn added to downstream code.

The cheapest implementation by far is doing it the right way, from the 
beginning and continuing to do it the right way over time.  Since we can't always know
what that is, we must ensure everything is modular with strong api boundaries, 
so we can replace individual pieces without rearchitecting the system.

Another critical insight here is that you do NOT have the full picture of
where we are going.  If our ultimate goal was "implement this one
feature" and after that we were done, then the shortcut might make sense.  
But it's not.  We must plan as if we will be implementing for years to come.

<on-conditionals>
"Your sentence said 'if' and 'and'.  The right solution will be
simpler."

This applies broadly to pretty much everything except maybe the last
inch of UI rendering, or some deep hairy algorithm stuff.  So rare it's
not worth writing an exception.  This is a true all purpose rule I'd
like you to remember.  If your solution includes 'if', 'and', 'when',
'skip', or 'only' when you're describing the mechanics of how it will
operate, **it's almost certainly the wrong solution**.  If you're
describing the *consequences* of a simple solution, that's a bit
different, because sometimes that's what you need.

Real world example:

<WRONG>
 The real problem: a viewport should behave as its own
  render target. When you set a viewport and clearTarget([r,g,b,a]), the
   clear should fill that viewport — not the whole surface. The viewport
   IS the target.

That means the fix is in the engine: when a render pass has a viewport
AND uses loadOp: clear, clear only the viewport region (via a
scissored clear or by drawing a fill quad internally in the engine).
The DSL fixture shouldn't need to know or care about this —
clearTarget within a viewport just works.
</WRONG>

Why wrong: 
- **WHEN** a render pass has a viewport **AND** uses loadOp clear **ONLY** the viewport region...
- A single implementation like this can cause endless problems
- Every other piece of code becomes more complex as it must know these details and work around them
- This code becomes very difficult to modify or replace - every other piece of code that interacts with it must change
- Obvious signs: WHEN, AND, ONLY <- conditionals!
- We recognized this and thought for a moment.  A better solution became clear!

<RIGHT>
I'm overcomplicating this.

Each render pass always has a viewport (default = full surface). The
scissor rect always matches the viewport. The clear always clears the
viewport region. Same code path every time — no conditionals on "does
this pass have a viewport."

The implementation: the engine always uses loadOp: Load on the GPU
attachment, always sets scissor to the viewport, and draws a fill rect
with the clear color when the pass specifies clear. loadTarget skips
the fill rect. The only branch is clear vs load — which is the entire
point of that enum.
</RIGHT>

Why right:
- Control flow is smooth and predictable!
- Surrounding code does not need to design around special cases they don't own!
- Easy to reason about.  Easy to replace as a unit without impacting others!


</on-conditionals>

<ticket-lifecycle>
# TICKET LIFECYCLE

You own ticket state — close tickets yourself, never punt to the user.

A ticket is done when **all** of:
- Validated against reality (tests, integration, or live verification — match the bar to the work)
- Review comments addressed
- No known-but-deferred issues left
- Docs updated
- Merged and ready to release (or released)

"Code written and tests pass" alone is not done. That's how tickets close prematurely and reopen in a loop. When in doubt that any criterion isn't met, leave it open and report status.
</ticket-lifecycle>

<commit-requirement>
When you're done implementing work, commit it. Make a separate commit for the work you implemented. That is a requirement.
</commit-requirement>

<git-workflow>
# GIT WORKFLOW — MANDATORY BEFORE ANY CODE WORK

Follow these steps exactly at the start of every session that involves code changes. This is not a checklist to skim — every step is required. Deviation is a failure mode.

1. Ensure working directory is clean (`git status` — no uncommitted changes)
2. `git checkout master` (or the repo's default branch)
3. `git branch -u origin/master`
4. `git pull --rebase`

**HARD GATE:** After step 4, you must be 0 commits ahead and 0 commits behind. If you are not, STOP. Do not touch any code. Tell the user the exact state and wait for instruction.

5. `git checkout -b <descriptive-branch-name>` — all work on a branch, never directly on master
6. Do work
7. `git pull --rebase` once or twice a day during longer tasks
8. Open a PR — never push directly to master

Working on top of a diverged or stale master is always wrong. There is no scenario where it is acceptable to proceed past step 4 if the hard gate is not met.
</git-workflow>

<pr-followup>
# AFTER OPENING A PR — INVOKE /address-pr-reviews

The moment `gh pr create` (or any equivalent PR-opening action) succeeds, invoke the `/address-pr-reviews` skill on that PR in the same response. Do not wait to be told. Do not end the turn after opening the PR without invoking it. The skill owns the no-reviews-yet case (it will wait/poll/exit cleanly as appropriate); the requirement here is that *starting the address-review loop is part of opening the PR*, not a separate step the user has to trigger. This applies to every PR you open in every session, on every project, unconditionally.
</pr-followup>

</wisdom>
