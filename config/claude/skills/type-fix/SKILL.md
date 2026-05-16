---
name: type-fix
description: Fix TypeScript and ESLint errors by resolving the underlying misalignment between code and types, not by silencing the compiler. The goal is correctness — making the type accurately describe the program — not the elimination of red squiggles. Suppressing, widening, or laundering an error (`any`, `as` casts, `!`, `@ts-ignore`, defensive `?.`/`??` added only to placate the compiler) is treated as a failure, not a solution.
---

# Type-Fix: Fix the Misalignment, Not the Error

## What this skill is for

This skill is invoked when there are TypeScript errors, ESLint type-related errors, or both, and the user wants them fixed.

The user does **not** want "typecheck passes." The user wants the types to correctly describe what the program actually is. These are not the same goal, and confusing them is the single most common failure mode of agents working on type errors.

> A typecheck error is the type system telling you that, somewhere, the code and the types disagree about what the program does. One of them is lying. The job is to figure out which, and fix the lie at the level it was actually told — not the level it was finally detected.

The wrong fix is worse than no fix. A suppressed error, a widened type, a cast, a non-null assertion — these don't remove the misalignment, they delete the evidence of it. The misalignment is still there, now invisible, now load-bearing, now a trap for the next change. A red squiggle is the cheapest form of bug report a codebase ever generates. Throwing it away to clean up the editor view is throwing away free debugging.

**If you cannot tell the user, in one or two sentences, what the error was actually telling you about the program — you have not understood it yet, and you must not change any code.**

## The catalog (READ THIS BEFORE DIVING IN)

The directory `catalog/` in this skill contains real, worked-out examples from past type-fix sessions: verbatim broken code, the diagnosis, the verbatim fix, and the explanation of why the fix is correct. Not abstract patterns — concrete cases from real codebases.

**Scan [`catalog/README.md`](./catalog/README.md) before starting work.** If a current symptom matches an entry, read that entry before touching any code; following a known-good resolution is faster and more reliable than re-deriving one. During work, when you reach for a cast / `any` / `unknown` / generic-with-`any`, check the catalog before committing to it.

Add an entry at the end of any session that surfaced something not already in the catalog — but only after the fix is actually applied and verified, so the "after" is real code rather than aspirational. The format is documented in `catalog/README.md`.

## The diagnostic loop

For each error, or each cluster of related errors, work through these steps in order. Do not skip ahead. The temptation to skip is the bug.

### 1. State what the error is

Not the message — what it is telling you. Translate it into a sentence about the program:

- "The function signature claims `X` always returns a string, but at line 42 a branch returns undefined."
- "The config loader is producing values of type `unknown` and a caller is reaching into them as if they had a known shape."
- "Two modules disagree about whether `session.id` can be empty."

If you cannot write that sentence, you have not understood the error. Re-read the surrounding code. Look at the type definitions. Look at the call sites. Come back when you can.

### 2. Identify who is lying

Exactly one of these is true for any given error:

- **The type is lying about the code.** The code does something the type forbids, but the code is correct and the type is too narrow or wrong.
- **The code is lying about the type.** The type accurately describes what the program is supposed to be, and the code is doing something it shouldn't.
- **The boundary is lying.** Two subsystems disagree about what a value means; the type each uses internally is fine, but the contract between them was never reconciled.

Name which one it is *before* proposing a fix. The fix lives at a different level depending on the answer:

- Type lying → change the type.
- Code lying → change the code.
- Boundary lying → reshape the boundary so both sides agree.

### 3. Find the misalignment's actual location

This is the most important step and the one agents skip most often.

**The error fires where the lie becomes locally inconsistent. The lie itself was told earlier — usually at a boundary.**

Look upstream from the error. Common upstream locations:

- A function signature that's too wide or too narrow.
- An exported type that doesn't match what callers actually pass.
- A configuration loader that produces a value of type `T` but the value isn't actually a `T` until later in the pipeline.
- An IPC or protocol payload that is `unknown` on ingress and got laundered into a typed shape without a real parse.
- A discriminated union missing the discriminator, so callers have to *guess* the variant.

The cast/escape-hatch heuristic — use this one aggressively:

> Find the cast nearest to the error. Read it. Ask: **what did the person who wrote this cast know that the type didn't say?** That answer is the missing constraint. The place where that value first enters the program (or first crosses a boundary) is where the missing constraint belongs.

Every `as`, every `any`, every `!`, every `unknown` in the relevant lineage is a clue pointing the same direction. They are not independent bugs. **They are the same bug, surfacing at different sites.** There is one missing constraint upstream that, when added, makes all of them unnecessary at once.

### 4. Propose a fix at the level of the misalignment

- If the type is wrong, the type changes.
- If the code is wrong, the code changes.
- If the boundary is wrong, the boundary is reshaped.

A good fix has a recognizable shape:

- It makes **one** thing more specific.
- It removes the need for runtime checks, narrowings, and casts at **several** call sites.
- It pushes uncertainty out to the boundary where uncertainty actually exists, and removes uncertainty from the interior where it never should have been.
- After it's applied, the code reads as if the error never could have happened.

If your fix instead suppresses, widens, or launders, it is the wrong fix — even if typecheck passes after.

### 5. Check the fix against architectural laws

If the project has `[LAW:<token>]` markers (cc-candybar does), the laws are part of the type system. They describe constraints the TS compiler cannot enforce but that the codebase enforces socially and structurally.

Before applying a fix:

- Search for relevant `[LAW:<token>]` markers in the affected code paths.
- Check whether your fix violates any. If it does, it is wrong even if it compiles. Find a different fix.
- Pay particular attention to: `one-source-of-truth`, `single-enforcer`, `no-defensive-null-guards`, `no-silent-fallbacks`, `dataflow-not-control-flow`, `one-type-per-behavior`.

Specifically, the laws *reject* several moves the compiler would accept:

- Adding a defensive null check to satisfy the compiler **when a law says the value cannot be null**. The fix is to make the type say so.
- Adding a silent fallback (`|| defaults`, `?? somethingElse`) that hides a divergence between two states the laws say should be the same.
- Creating a second cache, a second source of truth, or a second enforcer to escape a type problem in the first one.

### 6. State the fix and the reasoning. Wait for approval unless trivially mechanical.

Trivially mechanical = rename, move a declaration, narrow a generic with a single caller. Anything else — even if it "feels obvious" — gets stated and confirmed before applied. Particularly:

- Anything that changes an exported type or a function signature consumed elsewhere.
- Anything that touches an IPC, protocol, or boundary type.
- Anything in a region of the codebase you haven't read yet.

The cost of asking is one round trip. The cost of guessing wrong on a public-looking type is hours of cascading "fixes" pointing the wrong direction.

## Forbidden moves

These are not "discouraged." They are **forbidden unless the user explicitly grants an exception in conversation for this specific case**. If you find yourself reaching for one, that is a signal you have not understood the error yet — return to step 1.

| Move | Why it's forbidden |
|---|---|
| `any`, `: any`, `as any`, `Array<any>`, `Record<string, any>` | Deletes the constraint instead of fixing it. The bug is now invisible to the compiler. |
| `as` casts that widen, fabricate, or launder (`as unknown as T`, `as SomeWiderType`) | "Trust me" with no proof. Suspect by default. |
| `!` non-null assertions | If the value might be null, the type should say so. If it can't, the assertion is unnecessary. Either way, wrong tool. |
| `// @ts-ignore`, `// @ts-expect-error`, `// eslint-disable-*` | Not fixes. Admissions of defeat. |
| `unknown` as a way to defer the question in internal code | `unknown` is appropriate at genuine trust boundaries (parsing untrusted input, IPC ingress), where it forces narrowing. It is not appropriate as a way to silence the compiler mid-pipeline. |
| `?.` or `??` added solely to make an error vanish | Optional chaining encodes a claim that the value is optional. Add it only if the value is *actually* optional in the domain, not as a placebo. |
| Defensive null checks added to satisfy the compiler when the architectural laws say the value cannot be null | The laws are the source of truth. If the compiler disagrees with the laws, the type is wrong, not the code. |

Two narrow allowances:

- `as const` is fine — it narrows, it doesn't widen.
- `as SpecificType` is allowed *only if* you can write a one-line comment immediately above it that honestly explains what you can prove about the value that the compiler cannot see. If you can't write that comment honestly, you can't use the `as`.

## Allowed and encouraged moves

These are the shape of a real fix:

- **Restructure code so types can be tighter.** If a function takes a wide type and immediately narrows, change it to take the narrow type and have callers narrow at the boundary.
- **Split a type into a discriminated union** when the current type is conflating cases. The smell: a function that "sometimes returns X and sometimes Y," or a config object with combinations of fields where only certain combinations are actually legal.
- **Move validation to the boundary.** Untrusted input flows through internal code as the validated type, not as `unknown`/`any`. Parse once at ingress; trust the type afterward.
- **Change a function signature, exported type, or interface — even if it ripples.** The ripples are the point. They show you where the misalignment was hiding.
- **Make illegal states unrepresentable.** If the type allows `{ mode: 'A', extraField: 'only-valid-in-B' }`, change the type so it can't.
- **Ask the user whether a piece of code or a piece of type should change.** For non-trivial cases, ask. "Should this `Foo` really be a `Foo`, or is it actually a `Bar`?" is exactly the question the user wants to answer.

## Working in order

When given a batch of errors:

1. **Read all of them before changing anything.** Group them by suspected root cause, not by file. Multiple errors with the same underlying lie should be fixed together by fixing the lie once.
2. **Walk through them in order of architectural significance.** The errors that most likely indicate real misalignment first. Trivially mechanical ones last (sometimes they evaporate once a root-level fix lands).
3. **After each fix, re-run typecheck before moving on.** A correct upstream fix often resolves many downstream errors at once. If it didn't, that's information — your "root cause" wasn't actually the root.

## When to stop and ask

Stop and ask the user before proceeding when:

- The fix would change a public-looking type that other subsystems depend on, and you can't tell from local context whether those subsystems agree with the change.
- The error is in a region of the codebase you haven't read, and the right fix depends on architectural intent you don't have.
- You can see multiple plausible fixes at different levels and can't determine which level is the right one.
- You're about to reach for a forbidden move and think you have a legitimate reason. Ask, don't assume.
- You realize the right fix is structural enough that it deserves to be its own commit or its own discussion before continuing.

## Contributing back to the catalog

When a session surfaces a type-misalignment whose shape isn't already in the catalog, add an entry — but only **after** the fix is applied and verified. The "after" code in the entry must be the actual committed fix, not a draft.

Use `catalog/deepmerge-generic-iteration.md` as the example for shape, tone, and level of concreteness. Verbatim code in both the "before" and "after" sections; minimal interpretive framing; the five sections in the order specified in `catalog/README.md`. Do not invent abstract pattern names or generalize beyond what the example shows — the value is in the concreteness, and over time the abstractions will emerge from the collection itself rather than being imposed up-front.

## Reporting

When reporting progress or finishing:

- Say what *was actually wrong*, not just what changed. "The config loader was producing `unknown` and three callers were laundering it with `as`. The fix added a parser at the loader boundary so all three call sites work with the validated type and the casts are gone." That's a report. "Fixed 14 type errors" is not.
- If you used any allowed `as` cast, point at it and quote the one-line justification comment.
- If a fix is still pending user approval, name it clearly and wait.
- If you found errors you did not fix because the right fix was out of scope, list them with the suspected root cause so the user can decide.

## The framing, restated

The user wants to know what was wrong with the program. The type errors are the program telling you. Your job is to listen carefully enough to translate that signal into a sentence about the program, locate the lie at its source, and restore alignment.

Suppressing the signal is not doing the job. Patching the symptom is not doing the job. The job is to make the code mean what the types say it means — or to make the types say what the code actually does — and to do that at the level where the disagreement first appears.

**It is more important that you correctly understand what each error is telling you, and proceed only with that understanding, than that you make any change at all.** Wrong changes are worse than no changes. When in doubt, stop and ask.
