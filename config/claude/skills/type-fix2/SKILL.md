---
name: type-fix2
description: Fix TypeScript and ESLint errors by resolving the underlying misalignment between code and types, not by silencing the compiler. Suppressing, widening, or laundering an error (`any`, `as` casts, `!`, `@ts-ignore`, defensive `?.`/`??` added only to placate the compiler) is treated as a failure, not a solution.
---

# Type-Fix: Listen to what the type system is reporting

A type error is the type system telling you that, somewhere, the code and the types disagree about what the program does. The job is to find which is lying and fix the lie at its source — not to delete the evidence with a cast, a widening, or a suppression. The user wants the types to correctly describe what the program actually is; "typecheck passes" is a different goal, and confusing them is the most common failure mode. A wrong fix is worse than no fix: it removes the report of the misalignment without removing the misalignment, and the next change pays the bill.

**If you cannot state in one sentence what the error is telling you about the program, you do not yet understand it and must not change code.**

## Diagnostic loop

For each error or cluster of related errors, in order. The temptation to skip is the bug.

**1. Translate the error into a sentence about the program.** Not the message — what it means. "The loader produces `unknown` and three callers reach into it as if it had a known shape." If you cannot write that sentence, re-read the code and types. Come back when you can.

**2. Name who is lying.** Exactly one is true:
- *Type is lying* — code is correct, type is too narrow or wrong → change the type.
- *Code is lying* — type accurately describes the intended program, code does something else → change the code.
- *Boundary is lying* — two subsystems' internal types are each fine but they disagree at the contract between them → reshape the boundary.

**3. Find the root, which is almost never where the error fires.** The error fires where the lie becomes locally inconsistent. The lie was told earlier — usually at a boundary, a signature, or a return type that's weaker than it should be. Two heuristics for walking upward, used together:
- *Precision is bounded by inputs and context.* If a function's output type is weak (`unknown`, a wide union, a guess), it is because its input types or the context available to it are weaker. The fix lives upstream — at the input, the signature, or wherever the missing context should have been surfaced. The output is rarely the source.
- *The escape hatches are clues, not bugs.* Find the cast, `any`, `!`, or `as unknown as` nearest to the error. Ask: *what did the person who wrote this know that the type didn't say?* That answer is the missing constraint, and where the value first entered the program is where the constraint belongs. Multiple escape hatches in the same lineage are usually one missing constraint surfacing at several sites — they get fixed together by fixing it once.

**4. Apply the fix at the level of the misalignment.** A good fix makes one thing more specific and removes the need for narrowings or casts at *several* downstream sites. After it's applied, the code reads as if the error couldn't have happened. If the fix instead suppresses, widens, or launders, it is wrong even if typecheck passes.

## How tight should the type be?

Tightness is a journey, not a state. Three rough levels:

1. `unknown` / `any` / a cast — the compiler has been told nothing or lied to. This is the signal that something is wrong.
2. A concrete union (e.g. `string | number | boolean`) — honest about what flows through, but doesn't say *why* it varies.
3. A structural type — the variation is encoded where it comes from. The union disappears or becomes precise per call site.

The endpoint is (3). (2) is sometimes a necessary stepping stone because writing the honest union makes the *source* of variation visible, which is what reveals the structural fix. Stopping at (2) ships a function whose type says "it depends" without saying what it depends on. If (3) is visible directly from (1), skip (2). If you reach (2) and the structural fix isn't yet visible, that's a signal to widen the lens — the root is probably further up than you've looked.

## Shapes a real fix can take

Example shapes, not a checklist. None of these is "the principle." The principle is *find the root and fix it there*; what that looks like varies by case.

- **Move validation to the trust boundary.** Untrusted input parses once at ingress; internal code works with the validated type, not with `unknown`/`any`.
- **Split a conflated type into a discriminated union.** Smell: a value that "sometimes has field X, sometimes Y," or a function that returns different shapes depending on a flag the type doesn't carry.
- **Lift context into the signature.** A function returning a union because its output genuinely depends on contextual information it doesn't currently see — the fix is to surface that context as a parameter or generic so the return type becomes a function of the input. TypeScript expresses this through overloads, generic parameters constrained by literal types, and indexed access over a type-level mapping (one source of truth for the type relationship). One shape, not the shape.
- **Tighten a signature so callers stop having to defend.** If callers all narrow the same way after calling, the signature was too wide. Move the narrowing up.
- **Make illegal states unrepresentable.** If the type permits `{ mode: 'A', extraField: 'only-valid-in-B' }`, change the type so it can't.
- **Reshape a boundary.** If two subsystems disagree on what a value means, neither's internal fix will hold. Reconcile the contract.

## Forbidden moves

Forbidden unless the user explicitly approves an exception for this specific case. Reaching for one is a signal you have not understood the error yet — return to step 1.

| Move | Why |
|---|---|
| Any form of `any` (`: any`, `as any`, `Array<any>`, `Record<string, any>`) | Deletes the constraint instead of fixing it. |
| Widening or laundering casts (`as unknown as T`, `as SomeWiderType`) | "Trust me" with no proof. |
| `!` non-null assertions | If null is possible, the type should say so. If not, the assertion is noise. |
| `// @ts-ignore`, `// @ts-expect-error`, `// eslint-disable-*` | Not fixes. Admissions of defeat. |
| `unknown` used to defer the question inside the system | `unknown` belongs at trust boundaries where it forces narrowing. Not as mid-pipeline silence. |
| `?.` or `??` added solely to silence the compiler | These claim the value is optional. Use only if it actually is in the domain. |
| Defensive null check that contradicts an architectural law or stated invariant | The invariant is the source of truth. If the compiler disagrees, the type is wrong, not the code. |

Allowances: `as const` is fine (it narrows). A specific `as T` is allowed only if you can write a one-line comment above it honestly stating what you can prove about the value that the compiler cannot see. If you can't write that comment honestly, you can't use the cast.

## Working in order

Read all errors in a batch before changing anything. Group them by suspected root cause, not by file — multiple errors with the same underlying lie get fixed together by fixing it once. Walk through clusters in order of architectural significance, root-likely first; the trivial ones often evaporate when a real root fix lands. Re-run typecheck after each fix: if downstream errors didn't resolve, your "root" wasn't the root.

## When to stop and ask

- The fix changes an exported type or signature consumed elsewhere and local context can't tell you whether those callers agree.
- The right fix depends on architectural intent you don't have.
- Multiple plausible fixes at different levels exist and you can't tell which is the root.
- You're tempted toward a forbidden move and think the case is legitimate. Ask, don't assume.

## Reporting

Say what was *actually wrong*, not what changed. "The loader produced `unknown` and three callers were laundering it with `as`. Added a parser at the loader so the casts are gone and all three sites consume the validated type." That's a report. "Fixed 14 type errors" is not. If you used an allowed `as` cast, quote the justification comment. If a fix is pending approval, name it clearly and wait. If you found errors you didn't fix because the right fix was out of scope, list them with the suspected root so the user can decide.
