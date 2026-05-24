---
name: design-mindset
description: The motivating philosophy behind the architectural laws — the complete "types are the program" manifesto and the intrinsic-cost-vs-carrying-cost argument, plus the on-conditionals worked example. The laws themselves are always loaded and self-sufficient for routine work; read this skill when you want the deep reasoning behind a law, when an implementation feels hard or branchy and you need the mindset for restructuring it, when deciding whether to delete vs add code, or when weighing whether a foundational block is worth building.
---

<!--
SPLIT PROPOSAL 3 of 3 — "LAWS INTACT, PHILOSOPHY OUT"   (file 2 of 2: skill)
This skill is the two manifesto prose blocks (near-verbatim) plus the
on-conditionals essay — exactly the content that was eclipsing the laws in the
base. Nothing here restates a law; it is the reasoning the laws are corollaries of.
Pairs with: 3-layered-base.md
-->

# DESIGN MINDSET: THE TYPES ARE THE PROGRAM

The single most important idea, from which the architectural laws are corollaries, is this: **the types are the program**. Not a description of the program. Not a scaffolding around the program. The program itself, in the sense that once the constraints are right, the implementation is forced — there is one way to satisfy them, and writing it out is mechanical. The creative work — the part that requires judgment, the part that determines whether the code will be smooth or rough — happens entirely in the constraint design. By the time you are typing function bodies, the hard part is over.

This means most of what looks like "writing code" is actually *recovering* from inadequate constraint design. Defensive checks exist because the type did not forbid the bad state. Branching exists because the type did not carry the discriminator. Tests of the implementation kind (not the contract kind) exist because the type did not make the wrong behavior unrepresentable. Every line of code that enforces something the type *could have* enforced is a line that exists to compensate for an under-constrained signature. Strip those lines away and what remains is the actual logic, which is usually small — sometimes vanishingly small. That is where "less code, substantially less code" comes from: not terser code, but the constraints doing the work that sprawl would otherwise do.

The craft of type design is **choosing the strongest theorem about the data that is still true**. Weaker theorems (looser types — `any`, bag-of-optionals, `string` for what is actually one of four enum values) admit illegal states, which forces every callsite to defend, which is coupling. Stronger-but-false theorems force the code to lie or break. The exactly-right type is *exactly as expressive as the real domain* — every legal value representable, no illegal value representable. Once that type is stated, the compiler enforces it and the rest of the code is free to assume it. There is no defensive scaffolding because there is nothing to defend against. The type is a theorem; the implementation is its proof; the goal is the strongest true theorem you can find.

This is what makes a surface **smooth**. A smooth interface is one whose type is exactly the shape of the legal variability and nothing more. Two smooth surfaces interact without an adapter, because each one's type is a shape the other already speaks. Composition becomes free — N smooth blocks yield approximately N² compositions of capability, and velocity accelerates as the pool grows. A **rough** surface is the opposite: bespoke to the call site that needed it, or admitting illegal states callers must defend against, or encoding its variability in the *names of functions* (twenty `filterByX`, `filterByY`, `filterByZ`) rather than in *values flowing across one boundary* (one `filter(predicate, list)`). Rough surfaces do not compose; they crystallize. Cost grows with `feature × accumulated-roughness`.

**The discipline is to polish until there are no rough bits.** Run your hand over the code metaphorically — anything that would snag a future change is rough. A bespoke type that exists because of one caller. A name that is almost-but-not-quite right. A parameter meaningful in two of three modes. A comment explaining an invariant the type did not encode. A guard against a state that should not exist. A branch the type's missing discriminator forced. Each is a rough bit. The code is not done when it works; it is done when there are no rough bits left to catch on.

Polishing is **subtraction**. A pass that adds code — another guard, another helper, another case — is patching, not polishing. The smooth version has *less* code than the rough version, because the constraints have absorbed the work the sprawl was doing. If your iterations grow the code, you are crystallizing, not smoothing. Each pass should remove material, make some remaining code unnecessary, and reveal that the previous version was working around something the new constraint forbids.

When implementation feels hard, **the constraints are wrong**. Hardness is information. The instinct to push through and "just handle that case in the body" is the instinct that creates crystals — the moment a piece of code becomes single-purpose, the moment leverage flips below 1. Stay in the type until the type is doing the work, even when escaping would close the task faster. If the body wants to branch, ask what discriminator the type is missing. If the body wants to guard, ask why the upstream type permits the unwanted state. If a name needs to convey what the type cannot, fix the type. The body is the *last* place to write logic; it is the *first* place to look for logic that wants to be lifted into types.

The check for "done" is not "does this work" or "do tests pass" or "does it cite the laws." It is: **is the code I am leaving behind smoother than what I found?** Each task is an opportunity to remove rough bits from the surrounding code, not just to add a feature. If the feature works but the code is rougher, the task introduced debt every future task will pay. If the feature works and the code is smoother, the task added leverage that reduces the cost of every future task. There is no neutral ground — every commit either adds leverage or subtracts it.

**Mindset above all.** "Minimum work to close the task" is the heuristic that guarantees crystallization, because polishing is invisible to it. The task is not done when the feature works; the task is done when the surrounding code is smoother than it was when you started. That is the bar.

# COST FRAMING: INTRINSIC COST VS CARRYING COST

The conventional advice "you aren't gonna need it" (YAGNI) is correct in its native context and inapplicable in this one. YAGNI is a heuristic about *intrinsic cost* — the cost to build the thing now — applied under the assumption that *carrying cost* (the cost to maintain and extend it later) is bounded and small. That assumption holds when each feature is a crystal: a single-purpose, coupling-prone chunk of code that exists only to serve the case it was built for. In that world, an unused feature is dead weight, and YAGNI correctly tells you not to build it.

That assumption does **not** hold when code is built as smooth blocks. A smooth block — pure, well-typed, generally composable — has near-zero carrying cost: it does not couple to its callers, it does not constrain future code, and it earns its keep across every project that needs anything in its shape. The "feature you might not need" is usually 95% the same as "the feature you do need" with a couple of blocks rearranged and a thin binder on top. The intrinsic cost is paid once; the savings spread across every future task and every future project that uses it.

The crucial distinction is **intrinsic cost** (cost to build) versus **carrying cost** (cost to maintain, extend, work around, and reason about forever after). Crystallized code optimizes intrinsic cost and pays unbounded carrying cost — every future task pays interest on every previous shortcut. Smooth code pays a higher intrinsic cost up front and approximately zero carrying cost, amortized across every future project. For a sufficiently skilled engineer in this mindset the economics invert: building more blocks is cheaper than building fewer, because each reduces the cost of all future work and its own carrying cost is negligible.

This is why YAGNI's usefulness is **inversely proportional to engineering skill** in the constraint-design sense. For an engineer who builds by adding and coupling, every additional piece is a real liability, and YAGNI limits the damage. For an engineer who builds by subtracting, splitting, and smoothing, additional smooth blocks are approximately free and approximately always useful — foundation, not features. You cannot need the metal *as a tool*; you need it *as the substrate that makes future tools cheap*. YAGNI is a statement about features; it has nothing to say about the substrate.

The practical consequence: for foundational pieces, "do we need this?" is the wrong question. The right questions are "is this block smooth?" and "is the type the strongest true theorem about its data?" If yes, it earns its keep regardless of whether the current task uses it. If no, the task is not done — even if it ships — because the next task will pay the carrying cost of the rough version.

# ON CONDITIONALS

"Your sentence said 'if' and 'and'. The right solution will be simpler." This applies to almost everything except maybe the last inch of UI rendering or some deep hairy algorithm. If your description of *how it operates* contains 'if', 'and', 'when', 'skip', or 'only', it is almost certainly the wrong solution. (Describing the *consequences* of a simple solution is different — sometimes that is what you need.)

> **WRONG:** "When a render pass has a viewport AND uses loadOp clear, clear ONLY the viewport region (via a scissored clear)." The signs are right there — WHEN, AND, ONLY. A single implementation like this causes endless problems: every other piece of code must know these details and work around them, and the code becomes very difficult to modify or replace.
>
> **RIGHT:** I'm overcomplicating this. Each render pass always has a viewport (default = full surface). The scissor rect always matches the viewport. The clear always clears the viewport region. Same code path every time — no conditional on "does this pass have a viewport." The only branch is clear-vs-load, which is the entire point of that enum.

Why the second is right: control flow is smooth and predictable; surrounding code does not design around special cases it doesn't own; it is easy to reason about and to replace as a unit.
