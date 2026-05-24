---
name: constraint-design
description: The reasoning that justifies the architectural discipline — the full "types are the program" manifesto, the intrinsic-cost-vs-carrying-cost framing of why smooth blocks beat YAGNI, the contextual guidelines, and worked examples. Read this when a design or refactoring decision is non-obvious, when you need the argument behind a directive in the base (subtraction, hardness-is-information, delete-before-add), when an implementation feels hard, or when weighing whether a speculative-feeling block is worth building.
---

<!--
SPLIT PROPOSAL 2 of 3 — "IMPERATIVE CORE"   (file 2 of 2: the on-demand skill)
The base already states the directives as imperatives. This skill carries ONLY
the justification and elaboration behind them — never restating a directive,
only explaining why it holds and how to apply it at the margins.
Pairs with: 2-imperative-base.md
-->

# Why The Discipline Holds

The base names the laws and states the discipline as imperatives. This skill is the
argument underneath them. If a directive in the base feels arbitrary in a hard case,
the reasoning is here.

## Types are the program

Once the constraints are right, the implementation is forced — there is one way to satisfy them and writing it out is mechanical. The creative work happens entirely in constraint design; by the time you are typing function bodies, the hard part is over. So most of what looks like "writing code" is *recovering* from inadequate constraint design: defensive checks exist because the type did not forbid the bad state; branching exists because the type did not carry the discriminator; implementation-tests exist because the type did not make the wrong behavior unrepresentable. Strip away every line that enforces what the type *could have* enforced, and what remains is the actual logic — usually small.

**This is why "polishing is subtraction."** The smooth version has less code not because it is terser, but because the constraints absorbed the work the sprawl was doing. A pass that adds a guard/helper/case is compensating for a weak type; a pass that removes material is letting a stronger constraint do the work. If iterations grow the code, you are crystallizing.

**This is why "hardness is information."** The instinct to "just handle that case in the body" is the exact moment a piece of code becomes single-purpose and leverage flips below 1. Every escape into "I'll compensate in the body" installs a rough bit. If the body wants to branch, the type is missing a discriminator. If the body wants to guard, an upstream type permits a state that should not exist. The body is the *last* place to write logic and the *first* place to look for logic that wants to be lifted into types.

**This is why "done = smoother than you found it."** Choosing the strongest theorem about the data that is still true — every legal value representable, no illegal value representable — is what makes a surface *smooth*: anything it admits is valid, anything valid it admits. Two smooth surfaces compose without an adapter; N of them yield ~N² compositions and velocity accelerates. A rough surface (bespoke to one caller, admitting illegal states, or encoding variability in function *names* rather than *values across one boundary*) crystallizes instead; cost grows with `feature × accumulated-roughness`. Every commit either adds leverage or subtracts it — there is no neutral ground.

## Why "delete before you add" beats YAGNI

YAGNI is a heuristic about *intrinsic cost* (cost to build now) that silently assumes *carrying cost* (cost to maintain and extend forever after) is bounded and small. That assumption holds for crystals — single-purpose, coupling-prone code — and there YAGNI is sound. It fails for smooth blocks: a pure, well-typed, composable block has near-zero carrying cost, does not couple to callers, does not constrain future code, and earns its keep across every project that needs its shape.

So the economics invert. Crystallized code optimizes intrinsic cost and pays unbounded carrying cost — every future task pays interest on every shortcut. Smooth code pays a higher intrinsic cost once and ~zero carrying cost, amortized across every future project. YAGNI's usefulness is inversely proportional to constraint-design skill. For foundational pieces, "do we need this?" is the wrong question; "is this block smooth?" and "is the type the strongest true theorem?" are the right ones. (And "delete over shim" is the same coin: a shim is carrying cost with no smoothing; deletion removes the carrying cost entirely.)

## On conditionals

If your description of *how it operates* contains 'if', 'and', 'when', 'skip', or 'only', it is almost certainly the wrong solution.

> **WRONG:** "When a render pass has a viewport AND uses loadOp clear, clear ONLY the viewport region." Every other piece of code must now know and work around this; the code becomes hard to modify or replace.
>
> **RIGHT:** Every render pass always has a viewport (default = full surface); the scissor always matches it; the clear always clears it. Same code path every time. The only branch is clear-vs-load — the entire point of that enum.

## Contextual guidelines (never override the laws)
- Simplicity: delete over shim; justify every knob.
- Modules: small and crisp; split by change-reason, not size.
- Dependencies: low fan-out; invariants documented at boundaries; track cascade hotspots.
- Boundaries: anti-corruption layers; variability at edges; capabilities over omniscient context.
- State: data contracts over object graphs; state machines for workflows; immutable snapshots across boundaries; caches are derived.
- Flags: owner + default + rollout + deletion date; gate at entrypoints.
- Errors: localizable context; no silent fallbacks.
- Abstractions document what they *forbid*; mechanical > policy (compile-time > runtime > docs > hope).

### Context-specific (may override guidelines, never laws)
- UI: state near use; mirror user mental models; one timing authority.
- APIs: idempotent by default; errors enable retry; version at the boundary.
- Schema: migrations roll back; avoid dual-write.
- Pipelines: explicit staged I/O; no back-edges; owned IRs.
- Distributed: failure modes documented like success; ordering has an owner.
- CLI: exit codes are contract; stdout/stderr semantics are intentional.

## Scripting & subagent discipline
- Never swallow errors; never build silent fallback data sources that change the data's meaning; never write against an untested API; validate after every external call.
- Subagents see only your prompt: include every user requirement verbatim, bad-output examples, and a verifiable acceptance criterion; read the produced artifact, not the summary.
