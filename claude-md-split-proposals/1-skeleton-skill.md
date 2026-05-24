---
name: architecture-philosophy
description: The full reasoning behind the architectural laws — the "types are the program" constraint-design philosophy, the intrinsic-cost-vs-carrying-cost framing, the contextual guidelines, and worked examples. Read this whenever a design or refactoring decision is non-obvious, when an implementation starts to feel hard or branchy, when deciding whether to add code or delete it, or when you want the rationale and examples behind any [LAW:<token>] cited in the base instructions.
---

<!--
SPLIT PROPOSAL 1 of 3 — "SKELETON BASE"   (file 2 of 2: the on-demand skill)
This skill carries EVERYTHING that is not a law token, a one-line definition, or
a workflow gate. The base is a bare card of tokens; all the force lives here and
must be pulled in on demand. Pairs with: 1-skeleton-base.md
-->

# The Architecture Philosophy

The base instructions list the laws as terse tokens. This skill is *why* they work
and *how* to apply them when the answer is not obvious. Everything below elaborates
a token already named in the base; nothing here is a new rule.

## DESIGN MINDSET: THE TYPES ARE THE PROGRAM

The single most important idea, from which the architectural laws are corollaries, is this: **the types are the program**. Not a description of the program. Not a scaffolding around the program. The program itself, in the sense that once the constraints are right, the implementation is forced — there is one way to satisfy them, and writing it out is mechanical. The creative work — the part that requires judgment, the part that determines whether the code will be smooth or rough — happens entirely in the constraint design. By the time you are typing function bodies, the hard part is over.

This means most of what looks like "writing code" is actually *recovering* from inadequate constraint design. Defensive checks exist because the type did not forbid the bad state. Branching exists because the type did not carry the discriminator. Tests of the implementation kind exist because the type did not make the wrong behavior unrepresentable. Every line of code that enforces something the type *could have* enforced is a line that compensates for an under-constrained signature. Strip those lines away and what remains is the actual logic, which is usually small.

The craft of type design is **choosing the strongest theorem about the data that is still true**. Weaker theorems (looser types — `any`, bag-of-optionals, `string` for what is one of four enum values) admit illegal states, which forces every callsite to defend, which is coupling. Stronger-but-false theorems force the code to lie or break. The exactly-right type is *exactly as expressive as the real domain* — every legal value representable, no illegal value representable. The type is a theorem; the implementation is its proof; the goal is the strongest true theorem you can find.

This is what makes a surface **smooth**: its type is exactly the shape of the legal variability and nothing more. Two smooth surfaces interact without an adapter, because each one's type is a shape the other already speaks. Composition becomes free — N smooth blocks yield ~N² compositions, and velocity accelerates as the pool grows. A **rough** surface is the opposite: bespoke to one caller, admits illegal states, or encodes its variability in the *names of functions* (twenty `filterByX/Y/Z`) rather than in *values across one boundary* (one `filter(predicate, list)`). Rough surfaces crystallize; cost grows with `feature × accumulated-roughness`.

**The discipline is to polish until there are no rough bits.** A bespoke type that exists because of one caller. A name that is almost-but-not-quite right. A parameter meaningful in only two of three modes. A comment explaining an invariant the type did not encode. A guard defending a state that should not exist. A branch the type's missing discriminator forced. Each is a rough bit. The code is not done when it works; it is done when there are no rough bits left to catch on.

**Polishing is subtraction.** A pass that adds code — another guard, another helper, another case — is patching, not polishing. The smooth version has *less* code, because the constraints absorbed the work the sprawl was doing. If your iterations grow the code, you are crystallizing. Each pass should remove material and reveal that the previous version was working around something the new constraint forbids.

When implementation feels hard, **the constraints are wrong**. Hardness is information. The instinct to push through and "just handle that case in the body" is the instinct that creates crystals. Stay in the type until the type does the work. If the body wants to branch, ask what discriminator the type is missing. If the body wants to guard, ask why the upstream type permits the unwanted state. If a name needs to convey what the type cannot, fix the type.

The check for "done" is not "does this work" or "do tests pass." It is: **is the code I am leaving behind smoother than what I found?** Each task either adds leverage that reduces the cost of every future task, or adds debt that every future task pays. There is no neutral ground.

## COST: INTRINSIC VS CARRYING

YAGNI is correct in its native context and inapplicable here. YAGNI is a heuristic about *intrinsic cost* (cost to build now) under the assumption that *carrying cost* (cost to maintain and extend later) is bounded and small. That holds when each feature is a crystal. It does **not** hold for smooth blocks: a pure, well-typed, composable block has near-zero carrying cost — it does not couple to callers, does not constrain future code, and earns its keep across every project that needs its shape.

Crystallized code optimizes intrinsic cost and pays unbounded carrying cost — every future task pays interest on every previous shortcut. Smooth code pays a higher intrinsic cost once and ~zero carrying cost, amortized across every future project. So YAGNI's usefulness is **inversely proportional to constraint-design skill**. For foundational pieces the question is not "do we need this?" but "is this block smooth?" and "is the type the strongest true theorem about its data?" If yes, it earns its keep regardless of whether the current task uses it.

## CONTEXTUAL GUIDELINES (judgment calls — never override the laws)

- **Simplicity**: delete over shim (shims become permanent); justify every knob (flexibility is debt with interest).
- **Modules**: small and crisp — when a module becomes "where things go," split it, by *why* it would change, not by file size.
- **Dependencies**: low fan-out on core modules; document invariants at the boundary; track and reduce cascade hotspots.
- **Boundaries**: anti-corruption layers between legacy/new; push variability to edges, keep core invariants fixed; grant capabilities, not omniscient context objects.
- **State**: data contracts over object graphs; state machines for workflows; immutable snapshots for cross-boundary coordination; caches are derived with centrally owned invalidation.
- **Events** supplement call graphs, they don't supplant them.
- **Flags**: every flag needs owner, default, rollout plan, deletion date; gate at entrypoints, not deep in logic.
- **Errors**: enough context to localize responsibility; no silent fallbacks.
- **Abstractions** document *what they forbid*; mechanical enforcement beats policy (compile-time > runtime > docs > hope).

### Context-specific (may override guidelines, never laws)
- **UI/frontend**: state lives near use; components mirror user mental models; one timing authority.
- **APIs**: idempotent by default; errors enable retry; version at the boundary.
- **Data/schema**: migrations have rollback paths; avoid dual-write (if unavoidable, define cutover criteria + deadline).
- **Pipelines/compilers**: staged with explicit I/O; no back-edges; IRs are owned.
- **Distributed**: failure modes documented like success paths; ordering/timing has an explicit owner.
- **CLI**: exit codes are contract; stdout/stderr have intentional, defined semantics.

## ON CONDITIONALS

"Your sentence said 'if' and 'and'. The right solution will be simpler." If your description of *how it operates* contains 'if', 'and', 'when', 'skip', or 'only', it is almost certainly the wrong solution. (Describing the *consequences* of a simple solution is different.)

> **WRONG:** "When a render pass has a viewport AND uses loadOp clear, clear ONLY the viewport region." — every other piece of code must now know and work around this special case; the code becomes hard to modify or replace.
>
> **RIGHT:** Each render pass always has a viewport (default = full surface). The scissor always matches it. The clear always clears it. Same code path every time. The only branch is clear-vs-load — which is the entire point of that enum.

The right version has smooth, predictable control flow; surrounding code designs around no special case it doesn't own; it is easy to reason about and to replace as a unit.

## SCRIPTING & SUBAGENT DISCIPLINE

- **Never swallow errors** (`2>/dev/null`, `|| true`, `|| echo default`). A script that eats errors and continues with garbage is worse than one that crashes.
- **Never build silent fallback data sources** — a fallback that changes the meaning of the data is a bug that fires only when things are already broken.
- **Never write against an untested API** — run the commands first; verify flags, output shape, and error shape.
- **Validate after every external call** — exit 0? non-empty? parses? values sane? Abort loudly otherwise.
- **Subagents see only the prompt you write** — every user requirement, in their own words, in every prompt; include bad-output examples; include a verifiable acceptance criterion; read the actual artifact, not the subagent's summary.

## WISDOM

We optimize for the long term. The cheapest implementation by far is doing it the right way from the beginning and continuing to. You do not have the full picture of where this is going — plan as if implementing for years. "No matter how far you've gone down the wrong road, turn around."
