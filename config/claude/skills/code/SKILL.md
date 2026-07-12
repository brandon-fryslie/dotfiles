---
name: code
description: Universal architectural laws and domain bindings for all code work. Use when writing, editing, reviewing, refactoring, debugging, or designing code, tests, schemas, configuration, scripts, infrastructure, or system architecture — any task whose deliverable is code or will execute as code. Load BEFORE starting the work, not after. Do not apply to prose or LLM-prompt authoring; those media have their own skills.
---

<!-- Content below moved verbatim from the global CLAUDE.md on 2026-07-12.
     It is the "distilled" laws text, pending rewrite in the effective style —
     see config/claude/PLAN-guidance-restructure.md, step 2. -->

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

<context-specific>
# DOMAIN BINDINGS
The laws applied where each domain most often breaks them. Apply when working in the domain; a binding sharpens a law's application but never relaxes it — nothing below the universal-laws ever does.

<ui-frontend>
- State lives near its use; hoist only when coordination requires it. `[LAW:decomposition]`
- Components mirror the user's mental model, not implementation concerns. `[LAW:decomposition]`
- Animation and rendering have one named timing authority. `[LAW:no-ambient-temporal-coupling]`
</ui-frontend>

<apis>
- Idempotent by default; retry-unsafe is the documented exception.
- Errors carry enough context to retry intelligently. `[LAW:no-silent-failure]`
- Version at the boundary, never scattered through internals. `[LAW:single-enforcer]`
</apis>

<data-schema>
- Every migration has a rollback path; a schema change is a reversible deployment event.
- No dual-write. Where unavoidable, it has explicit cutover criteria and a deadline. `[LAW:one-source-of-truth]`
</data-schema>

<pipelines-compilers>
- Every stage declares its inputs and outputs; later stages never mutate earlier representations. `[LAW:one-way-deps]`
- Every intermediate representation has an explicit owner, never ambient. `[LAW:one-source-of-truth]`
</pipelines-compilers>

<distributed-systems>
- Failure modes are designed and documented like success paths. `[LAW:no-silent-failure]`
- Ordering and timing have an explicit owner; no ambient assumptions about sequencing. `[LAW:no-ambient-temporal-coupling]`
</distributed-systems>

<cli>
- Exit codes are a contract, not just 0/1.
- Stdout and stderr have defined semantics: parseable vs. human output is an intentional split.
</cli>
</context-specific>
