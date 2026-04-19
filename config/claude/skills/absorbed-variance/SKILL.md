---
name: absorbed-variance
description: Refactor tangled code toward architectural purity by absorbing variance into data and types instead of scattering it across control flow. Use when the user wants to detangle shotgun-parser logic, eliminate special cases (not just handle them), push invariants to boundaries, make illegal states unrepresentable, or when a metric (cyclomatic complexity, LOC) is a symptom and the real fix is structural. Invoke instead of metric-chasing refactors whenever the user says "make it pure", "the code should almost disappear", "detangle this", "stop the special cases from spreading", or describes code where fixes at one site force edits at many others.
---

# Absorbed Variance: Refactoring for Structural Purity

## What this skill is for

This skill is the answer to a specific kind of user request:

> "I don't want you to hit a metric. I want the code to become *pure*. You know how sometimes an abstraction fits so well the code almost disappears, because there's structurally no way it can go wrong? That."

If you are tempted to reduce cyclomatic complexity by extracting helpers that each contain one branch of the original `if` ladder — **stop**. That is metric-chasing. It moves the tangle behind a function name without dissolving it. The caller still has to know which helper to invoke, the branches still exist, the special cases still propagate, and you have added indirection without removing variance.

Use this skill when the goal is the opposite: **make the branches impossible to need in the first place.**

## The core idea, named precisely

There is a specific architectural quality you are chasing. It has several overlapping names in the literature, each capturing a different facet. Learn all of them — you will need every angle.

### 1. Make illegal states unrepresentable (Yaron Minsky)

The sharpest framing. If an edge case cannot be *constructed* in the type system or data shape, no downstream code ever needs to check for it. The checks do not get refactored — they get **deleted**, because the question they answered can no longer be asked.

- A nullable field that is "sometimes set depending on mode" becomes a sum type (discriminated union) where each variant carries exactly the fields it needs.
- A pair of booleans `(is_streaming, is_translated)` that only has three legal combinations becomes a three-variant enum. The fourth `if` branch that "can't happen" cannot be written.
- A string that "must be a valid hostname" becomes a `Hostname` newtype, parsed once at the boundary. Functions that take `Hostname` do not re-check.

The test is mechanical: after the refactor, try to write down the bad state. If you cannot even express it, you have succeeded. If you can express it but a comment or convention says "don't", you have failed.

### 2. Parse, don't validate (Alexis King)

Validation returns a `bool` and leaves the caller holding the same untrusted shape. Every downstream site must re-check because the type system has forgotten the guarantee. Parsing returns a **new type** that structurally proves the check already happened — a receipt, not a claim.

The practical consequence:

- **Validated-but-untyped value** → landmine. The next function still has to worry.
- **Parsed value** → receipt. The next function is in a pre-cleared universe.

This is what "push variance to the edges" looks like operationally. Every special-case check migrates to exactly one parser at the trust boundary and vanishes everywhere else. It does not get distributed — it gets *concentrated and then absorbed into the type*.

### 3. Correct by construction

The structural kin of the above. You cannot *assemble* the thing wrong, so there is no runtime check that it was assembled right.

- Builders that only expose legal transitions (no `set_foo()` after `build()`).
- State machines where illegal edges literally do not exist as methods — you cannot call `confirm()` on an unauthenticated session because `confirm` is not defined on that type.
- Constructors that take exactly the inputs a valid instance needs, no more and no less. No `__init__` that accepts everything and then asserts.

"Correct by construction" is the ideal outcome: the compiler / type checker / data shape carries the invariant, not a runtime assertion and not a comment.

### 4. Shotgun parser / shotgun validation (LangSec)

This is the **anti-pattern** you are hunting. A shotgun parser is validation logic scattered across many sites, each one doing a partial check on the raw shape, none of them authoritative. Every bug fix adds one more pellet to the shotgun. Symptoms:

- Null checks for the same field in 12 places.
- `if msg.get("type") == "X"` branches repeated in every consumer.
- Comments like "callers must ensure...".
- A bug fix that requires editing N unrelated files because each had its own copy of the check.
- New features blocked because "I'd have to update every branch" — the variance has metastasized.

The cure is always the same: **collapse the scattered checks into one parse step at the trust boundary, produce a type that encodes the guarantee, and delete the downstream checks because they can no longer fail.**

When you see a shotgun parser, the fix is never "add another check more consistently" or "extract a helper." The fix is to **move the check to a place where it only has to exist once, and change the type downstream so the old checks become impossible to write.**

### 5. Load-bearing vs. incidental complexity

Every `if` in a codebase is either:

- **Load-bearing**: the *domain* genuinely branches here. A payment either succeeds or fails; the code reflects a real-world fork.
- **Incidental**: scar tissue from a past edge-case patch. The domain does not actually branch; the code only branches because the data is the wrong shape, or because an invariant isn't enforced at the boundary, or because someone forgot to normalize two layers up.

Pure code has driven incidental complexity to zero. Every remaining `if` is load-bearing. When you look at a tangled function, the question is not "how many branches?" but "how many of these branches would *vanish* if the input had the right type?"

If the answer is "most of them," you are looking at incidental complexity and the refactor is structural — change the type, not the function. If the answer is "none, they're all load-bearing," the function is already as pure as the problem allows and cyclomatic complexity is lying to you.

### 6. The abstraction absorbs the variance

The operational slogan. The universal law `dataflow-not-control-flow` is the enforcement mechanism: same operations, same order, every call — **the values carry the variance**. The function becomes a straight pipe because the shapes flowing through it already know what they are.

When code "almost disappears," this is what happened. Variance moved out of control flow and into data, where it is free. A 200-line function with 12 branches becomes a 15-line function with zero branches, not because the logic was hidden in helpers, but because the logic was **absorbed by the shape of the input**.

The test: after the refactor, can you describe the function body as a linear sequence of unconditional operations? If yes, you absorbed the variance. If the body still has a decision tree, the variance is still in control flow and you have not finished.

### 7. Single enforcer / trust boundary

The structural consequence of all of the above. Checks live at exactly **one** edge — the parser, the constructor, the boundary adapter. Interior code operates in a pre-validated universe and is written as if nothing can go wrong, because **structurally nothing can**.

This is also the universal law `single-enforcer`. Duplicate checks across callsites will drift, and when they drift you get bugs that only appear on the paths where someone forgot to copy the check. The only stable answer is: one enforcer, and everyone downstream trusts the type.

## The directive, in one sentence

> **Push variance to the edges as data, not the interior as branches. Make illegal cases unrepresentable rather than guarded. Checks live once, at the boundary that produces the type; everywhere downstream is a straight pipe.**

Or as a code-review question: **"Where is this special case being *absorbed*, not just *handled*?"**

## How to apply this in a refactor

When given a tangled function or module to simplify with this skill active, follow this sequence. Do **not** skip to step 4.

### Step 1: Diagnose the shotgun

Before touching any code, read the function and its callers and answer:

1. **What variance is this function reacting to?** List every `if`, every mode flag, every "if X is None", every branch on a string tag or enum. Be exhaustive.
2. **Where does that variance enter the system?** Trace each branch back to its source. Is it a request header? A config flag? A None-because-optional? A discriminated shape from the network? A legacy field that's sometimes set?
3. **How many other sites check the same thing?** Grep for the same discriminator elsewhere in the codebase. If three functions all check `if mode == "translated"`, you have a three-pellet shotgun.
4. **Which branches are load-bearing and which are incidental?** For each branch, ask: would this branch exist if the input had a type that already encoded the answer? If no, it's incidental — a candidate for absorption. If yes, it's load-bearing — it stays, but probably as a dispatch over a sum type rather than an `if`.

At the end of step 1 you should be able to say, in one paragraph: *"This function is a shotgun parser for \<list of discriminators\>. The same discriminators are also checked at \<list of sites\>. If the input were typed as \<proposed type\>, N of the branches would vanish and the remaining M are load-bearing dispatch over the type's variants."*

If you cannot write that paragraph, you do not yet understand the problem and should not start editing. Read more.

### Step 2: Design the absorbing type

This is the creative step and the whole point of the skill. The question is:

> **What type, constructed once at the boundary, would let this function become a straight pipe?**

Common shapes:

- **Sum type / discriminated union**: when the current code branches on a tag or mode. Each branch becomes a variant; the function becomes a dispatch (`match` / pattern match / visitor) where each arm is unconditional.
- **Newtype with parsed invariant**: when the current code re-checks "is this a valid X" at multiple sites. The newtype's constructor is the only place the check lives.
- **Pre-resolved config object**: when the current code branches on "which mode are we in" using flags scattered across args. One `ResolvedConfig` object built at startup/request-boundary, and every downstream function takes it and reads unconditionally.
- **Typed capabilities instead of context**: when the current code is handed an omniscient object and picks fields out of it conditionally. Replace with small capability types that contain exactly what each consumer needs — no fields to branch on because the irrelevant ones are not present.
- **State machine types**: when the current code checks "is this in the right phase?" before doing work. Replace with distinct types per phase; the wrong operations are not methods on the wrong type.

Write the new type down as a data declaration *before* touching the function body. If the type is right, the function body collapses mechanically in step 3. If you find yourself wanting to put an `if` inside the function body after the type exists, the type is wrong — go back and redesign it.

### Step 3: Move enforcement to the single boundary

Find the one place where raw input becomes the new type. That is your single enforcer. All runtime checks for the invariants the type encodes live **here and only here**. The parser produces either a valid instance of the new type or a clear error — never a "mostly valid" instance that downstream code has to re-check.

Concretely:

- Delete every downstream check the new type makes impossible. Do not leave "defensive" guards — they are lies about whether the type is actually load-bearing and they will rot.
- If you find a downstream check you cannot delete, the type does not actually encode the invariant. Fix the type; do not keep the check.
- If two boundaries produce the type, pick one to own the parsing and have the other call into it. Do not duplicate the parser.

This is where you will feel resistance. Deleting null guards and "just in case" checks feels dangerous. It is only dangerous if the type is wrong. If the type is right, the checks are dead code and their presence hides whether the type is actually doing its job.

### Step 4: Rewrite the interior as a straight pipe

Now — and only now — rewrite the target function. It should be dramatically shorter. The test is:

- Can you describe the body as a linear sequence of operations with no decision tree?
- Are the remaining branches (if any) load-bearing dispatch over the new sum type, where each arm is itself unconditional?
- Can you point at the old `if`s and say, for each one, "this vanished because the type now guarantees X"?

If the answer to any of those is no, you regressed to metric-chasing. Go back to step 2 — the type is still not absorbing enough variance.

### Step 5: Propagate the cleanup

A real structural refactor **touches multiple files**. The variance did not live in one function, and the cure does not either. Expect:

- The boundary module grows a parser / type definition.
- The target function shrinks dramatically.
- Other consumers of the same data simplify too, because they now take the new type and can delete *their* shotgun pellets.
- Some helper functions become unreachable and get deleted. Deletions are wins, not scope creep.
- Tests that asserted "function handles None gracefully" for cases now unrepresentable either get deleted or get reframed as "boundary parser rejects invalid input" tests at the single enforcer.

If your diff touches only the target function, you did not do a structural refactor — you did a local rewrite. Go wider.

## Anti-patterns to catch yourself doing

These are the failure modes that disguise themselves as this skill. Watch for them in your own work.

### "Extract helpers for each branch"

Turning `def f(): if A: ... elif B: ... else: ...` into `def f(): if A: _a() elif B: _b() else: _c()` reduces cyclomatic complexity on paper and dissolves nothing. The branches still exist, the caller still dispatches, the special cases still propagate. This is metric-chasing wearing a refactor costume.

The fix: the branches should not be extracted, they should be **absorbed**. If the three helpers each take the same arguments and do the same kind of work, they are one function with a data parameter. If they take different arguments, the caller should be dispatching over a sum type whose variants carry exactly the right arguments, and there should be no `if` at all.

### "Add a flag parameter to unify the branches"

If two branches are *almost* the same, the temptation is to pass a flag that selects between them. This is control-flow variance wearing a dataflow costume. The flag is still a branch; you just hid it inside the unified function. The no-mode-explosion law forbids this.

The fix: figure out what data the two branches actually differ on, pass *that* as a parameter (not a boolean), and make the function body unconditional in the flag. If you cannot, the two branches are load-bearing and should be two functions called by a dispatch over a type — not unified behind a flag.

### "Validate at the top, then proceed"

Adding an `assert`/validation block at the start of a function and then proceeding with the same untyped input is validation, not parsing. The type has not changed; the next function in the chain does not know the check happened; the asserts multiply down the call graph. Pellet count goes up, not down.

The fix: the validation block constructs a new typed value, and the rest of the function operates on *that*. Downstream callers take the new type, not the raw input. The assert has moved from the top of every function to exactly one constructor.

### "Silent fallback for the bad case"

`if X is None: X = default()` looks like it handles an edge case. It does not — it hides one. Now the function has two modes (real X and fallback X) and downstream code may branch again on which one it got. You have made the shotgun worse while feeling like you cleaned up.

The fix: either `X` is required (make the type non-optional and enforce at the boundary) or the two cases are genuinely different (make them different variants of a sum type and dispatch). Do not paper over the choice with a default.

### "Keep the check, it's cheap, it's defensive"

A null guard with no meaningful `else` branch is control flow that pretends to be safety. It silently skips work when something is wrong, which is the worst possible failure mode — quiet incorrectness. And its presence is a lie about whether the upstream type is load-bearing: if the guard can fire, the type is wrong; if it cannot fire, the guard is dead code. Either way it must go.

The fix: delete the guard. If tests fail, either the type is wrong (fix the boundary) or the tests were asserting the guard's behavior rather than real behavior (delete or reframe the tests).

## The cc-dump-specific framing

Cite the universal laws when you justify this work. They are already the operational form of this skill:

- `dataflow-not-control-flow` — same operations, same order, variance lives in values.
- `one-source-of-truth` — the invariant has one authoritative representation (the type).
- `single-enforcer` — checks live at exactly one boundary.
- `no-defensive-null-guards` — guards without real `else` branches are forbidden.
- `no-mode-explosion` — flags and toggles are debt; dispatch over types instead.

When writing code as part of this refactor, mark the lines that are load-bearing dispatch with `// [LAW:dataflow-not-control-flow]` and the enforcement point with `// [LAW:single-enforcer]`. This makes the architectural intent legible to future readers and to future agents who might otherwise think the straight-pipe interior needs "defensive" checks re-added.

## Success criteria

A refactor under this skill has succeeded when **all** of these are true:

1. The function the user pointed at is dramatically simpler — not by extraction, by *absorption*. Most removed branches are **deleted**, not hidden.
2. At least one new or changed type definition encodes an invariant that previously lived in scattered runtime checks.
3. The diff touches multiple files. Other consumers of the same data got simpler too.
4. Tests were deleted or reframed, not added. (Adding contract tests at the new single enforcer is fine; adding defensive tests downstream is a regression.)
5. You can point at each of the old branches and explain in one sentence why it is now structurally impossible or why it migrated into a typed dispatch.
6. Any metric improvement (CC, LOC) is a *consequence*, mentioned last, not the reason the refactor is correct.

If you hit the metric but cannot answer criterion 5 for every branch, you metric-chased. Revert and start over from step 1.

## When NOT to use this skill

- **Trivial fixes, typos, single-line changes.** Structural refactoring is overkill and the overhead is not paid back.
- **True load-bearing domain branching.** If the branches reflect genuine real-world forks (payment succeeded vs failed, user is admin vs not), they are not going away — the most this skill can do is convert `if` ladders into dispatch over a sum type, which is worth doing but is a smaller win than full absorption.
- **Performance-critical inner loops** where the branch *is* the optimization. Rare in application code; if you think this applies, double-check by measuring first.
- **Code at a boundary you do not own.** You cannot move enforcement into a library you cannot modify. In that case, wrap the library at a boundary *you* own and make everything behind your wrapper a straight pipe — absorb the variance at the wrapper.

## One-paragraph mental model

When you look at tangled code, ask: *what is this function being forced to decide, and why does it have to decide it here?* If the answer is "because the input is the wrong shape," the fix is not in the function — it is at the boundary that produced the shape. Go there, design a type that makes the decision already answered, enforce it once, and come back. The function will have dissolved on its own.
