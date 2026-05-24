# Constraint-Design — Elaboration

Canonical full text of each idea stubbed in `base-constraint-design.md`. The base
holds the one-sentence gist; this file holds the reasoning and examples. One
section per idea, anchored by ID (1:1 with the stubs).

<a id="cd-1"></a>
## CD-1 · Types are the program

The single most important idea, from which the architectural laws are corollaries, is this: **the types are the program**. Not a description of the program. Not a scaffolding around the program. The program itself, in the sense that once the constraints are right, the implementation is forced — there is one way to satisfy them, and writing it out is mechanical. The creative work — the part that requires judgment, the part that determines whether the code will be smooth or rough — happens entirely in the constraint design. By the time you are typing function bodies, the hard part is over.

<a id="cd-2"></a>
## CD-2 · Code is mostly compensation

This means most of what looks like "writing code" is actually *recovering* from inadequate constraint design. Defensive checks exist because the type did not forbid the bad state. Branching exists because the type did not carry the discriminator. Tests of the implementation kind (not the contract kind) exist because the type did not make the wrong behavior unrepresentable. Every line of code that enforces something the type *could have* enforced is a line that exists to compensate for an under-constrained signature. Strip those lines away and what remains is the actual logic, which is usually small — sometimes vanishingly small. That is where "less code, substantially less code" comes from. It is not terser code; it is the constraints doing the work that sprawl would otherwise do.

<a id="cd-3"></a>
## CD-3 · Strongest true theorem

The craft of type design is **choosing the strongest theorem about the data that is still true**. Weaker theorems (looser types — `any`, bag-of-optionals, `string` for what is actually one of four enum values) admit illegal states, which forces every callsite to defend, which is coupling. Stronger-but-false theorems (tighter types that do not actually hold in the domain) force the code to lie or break. The exactly-right type is the one that is *exactly as expressive as the real domain* — every legal value representable, no illegal value representable. Once that type is stated, the compiler enforces it and the rest of the code is free to assume it. There is no defensive scaffolding because there is nothing to defend against: the type has already excluded the illegal cases by construction. The type is a theorem; the implementation is its proof; the goal is the strongest true theorem you can find.

<a id="cd-4"></a>
## CD-4 · Smooth vs rough

This is what makes a surface **smooth**. A smooth interface is one whose type is exactly the shape of the legal variability and nothing more — anything it admits is automatically valid, anything valid it admits. Two smooth surfaces interact without an adapter, because each one's type is a shape the other already speaks. Composition becomes free. The codebase becomes a force multiplier: each smooth block joins the pool of available building blocks, and any new requirement is usually 95% the same as something already buildable from existing blocks, with a few rearrangements and a thin layer of binder code on top. The combinatorics work *for* you — N smooth blocks yield approximately N² compositions of capability, and velocity accelerates as the pool grows.

A **rough** surface is the opposite. Its type is bespoke to the call site that needed it, or it admits illegal states callers must defend against, or it encodes its variability in the *names of functions* (twenty `filterByX`, `filterByY`, `filterByZ`) rather than in *values flowing across one boundary* (one `filter(predicate, list)` that admits infinite predicates). Rough surfaces force every caller to know shapes only that surface uses. They do not compose; they crystallize. Each rough piece adds constraints that every future piece must work around, so the work-cost of new code grows with `feature × accumulated-roughness`. The combinatorics that should be working in your favor instead work against you — N pieces yielding N² rules to remember, and velocity decelerates with every commit. Same multiplier, opposite sign; the sign is determined by whether you smoothed the piece before moving on.

<a id="cd-5"></a>
## CD-5 · Rough bits, and "done"

**The discipline is to polish until there are no rough bits.** Run your hand over the code metaphorically — anything that would snag a future change is rough. A bespoke type that exists because of one caller. A name that is almost-but-not-quite right. A parameter that is meaningful in two of three modes. A comment explaining an invariant the type did not encode (the comment itself is the snag — if the code needed explaining, the shape is wrong). A guard that exists because an upstream type permitted a state that should not exist. A branch that exists because the type did not carry the discriminator. A function whose signature does not advertise the precondition it actually requires. Each one is a rough bit. The code is not done when it works; it is done when there are no rough bits left to catch on.

<a id="cd-6"></a>
## CD-6 · Polishing is subtraction

Polishing is **subtraction**. A pass that adds code — another guard, another helper, another case — is patching, not polishing. The smooth version has *less* code than the rough version, because the constraints have absorbed the work the sprawl was doing. If your iterations grow the code, you are crystallizing, not smoothing. The diagnostic is: each pass should remove material; each pass should make some of the remaining code unnecessary; each pass should reveal that the previous version was working around something the new constraint forbids. Worry the stone smooth — keep removing material until your hand finds nothing to catch on.

<a id="cd-7"></a>
## CD-7 · Hardness is information

When implementation feels hard, **the constraints are wrong**. Hardness is information. The instinct to push through and "just handle that case in the body" is the instinct that creates crystals — that is the moment a piece of code becomes single-purpose, the moment leverage flips below 1. The discipline is to refuse the escape: stay in the type until the type is doing the work, even when escaping would close the task faster. Every escape into "I will compensate in the body" is a rough bit being installed. If the body wants to branch, ask what discriminator the type is missing. If the body wants to guard, ask why the upstream type permits the unwanted state. If a name needs to convey what the type cannot, fix the type. The body is the *last* place to write logic; it is the *first* place to look for logic that wants to be lifted into types.

<a id="cd-8"></a>
## CD-8 · Done = smoother than you found it

The check for "done" is not "does this work" or "do tests pass" or "does it cite the laws." It is: **is the code I am leaving behind smoother than what I found?** Anything less is moving the problem around. Each task is an opportunity to remove rough bits from the surrounding code, not just to add a feature. If the feature works but the code is rougher, the task introduced debt that will be paid by every future task. If the feature works and the code is smoother, the task added leverage that will reduce the cost of every future task. The first pattern compounds against you; the second compounds for you. There is no neutral ground — every commit either adds leverage or subtracts it.

<a id="cd-9"></a>
## CD-9 · Mindset above all

**Mindset above all.** "Minimum work to close the task" is the heuristic that guarantees crystallization, because polishing is invisible to it. Polishing is by definition work that is not strictly required to make the current task pass. If the filter is "what is the smallest change that closes this ticket," every polishing pass is skipped, every time. Replace the filter. The task is not done when the feature works; the task is done when the surrounding code is smoother than it was when you started. That is the bar. Failing to hold it does not look like failure in the moment — the feature ships, the tests pass, the laws can even be cited — but the carrying cost shows up in every subsequent task as friction the next agent (or you, tomorrow) cannot trace back to its source. The leverage is lost silently. The only defense is the bar itself, applied stubbornly, every commit.
