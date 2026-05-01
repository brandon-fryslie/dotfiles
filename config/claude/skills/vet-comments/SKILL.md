---
name: vet-comments
description: Audit a codebase for inaccurate, stale, or load-bearing-false comments. Each comment is a claim about the code — this skill extracts the claim and verifies it against the current state. Pays special attention to `[LAW:<token>]` markers, since downstream agents trust them as architectural ground truth and will make destructive edits based on a lying marker. Produces a ranked list of file:line findings with claim, reality, and recommended fix. Use when the user says "vet comments", "check comments for accuracy", "find lying comments", "audit law markers", "find stale comments", or suspects agent-written comments are drifting from reality.
---

# Vet Comments: Finding Comments That Lie

## What this skill is for

Comments are claims. Every comment asserts something about the surrounding code — what it does, why it does it, what invariant it preserves, where the single source of truth lives, which law it obeys. When a comment's claim is true, it's load-bearing context. When the claim is false, it's actively dangerous: future agents read it, trust it, and make decisions on top of it.

The most dangerous case in agent-written codebases:

- An agent adds `// [LAW:single-enforcer] only place this is checked` while writing function A.
- A later agent reads that marker, sees a similar check in function B, and deletes B as a duplicate — because the marker said A was the single enforcer.
- The marker was wrong. B *was* the real enforcer. Now the invariant is gone, and no test catches it because the test was written to match the marker, not the original behavior.

This skill finds comments like that *before* the next agent acts on them.

## When to use

- "vet comments"
- "check the comments"
- "find lying / inaccurate / stale / outdated comments"
- "audit the LAW markers"
- "are these `[LAW:...]` annotations actually true?"
- After a multi-agent refactor where comments may have drifted from code
- Before a major refactor that will trust those comments as input
- When onboarding to a codebase and you want to know which comments to believe

## When NOT to use

- You only want to find TODO/FIXME tags — `grep` is fine.
- You want to *write* comments, not vet them — that's a different task.
- Codebase has effectively no comments — nothing to vet.
- The user wants a doc-quality review (grammar, clarity) — that's prose editing, not claim verification.

## The core insight

Every meaningful comment makes one of these claims:

1. **Identity claim** — "this is the X" (`single enforcer`, `source of truth`, `the parser`).
2. **Negative claim** — "this is *not* X" (`never null here`, `not called from outside`, `no other consumers`).
3. **Causal claim** — "X because Y" (`needed because of bug #123`, `must run before init`, `tmux 3.4+ required`).
4. **Derivation claim** — "X is derived from Y" (`auto-generated`, `mirrors the union`, `kept in sync with`).
5. **Procedural claim** — "callers must X" / "do not Y" (`callers must hold the lock`, `do not call after close()`).
6. **Reference claim** — names another file, function, line number, ticket, or external system.

A comment without any of these claims is decoration; you can usually ignore it. A comment *with* one of these claims is testable — you can read the code and decide whether the claim still holds.

LAW markers (`// [LAW:<token>] reason`) are a special, high-stakes case: they make a structural claim *and* signal "this code embodies a universal architectural rule." Agents treat them as primary evidence when deciding whether other code is duplicated, redundant, or safe to delete. A false LAW marker therefore has a blast radius far beyond its line.

## Workflow

### Phase 1: Inventory the comment surface

Use Grep / Glob to enumerate everything that could be a claim. Don't read each file front to back — pull comments by pattern.

Targets:

- `// [LAW:` — every law marker, every language. **Must be 100% covered**, no sampling.
- `/**` and JSDoc/docstring blocks on exported symbols.
- Inline `//` and `#` comments containing claim signals: `single`, `only`, `never`, `always`, `must`, `derived`, `mirrors`, `because`, `do not`, `callers`, `source of truth`, `enforced`, `invariant`, `assumes`, `guaranteed`.
- Reference-shaped comments: `see `, `from `, `bug #`, ticket IDs (`JIRA-`, `lit:`, etc.), URLs to the same repo's files.
- Multi-line `//` blocks at the top of files (module-level docs).

Skip:

- Pure decoration (`// ---- section ----`).
- License headers.
- Type-annotation-only JSDoc (`@param`, `@returns` with no prose) unless the prose makes a claim.

For each hit, record `file:line`, the comment text, and which claim type(s) it makes. This list is the audit's input.

### Phase 2: Extract the claim

For each comment in the inventory, write down — explicitly — what would have to be true in the code for the comment to be honest. Be precise; vague claims produce vague verifications.

Examples:

| Comment | Extracted claim |
|---|---|
| `// [LAW:single-enforcer] discriminator lives here` | The discriminator (named in surrounding context) is checked at exactly this site and nowhere else in the codebase. |
| `// [LAW:one-source-of-truth] derived from TmuxMessage` | This type/value is *structurally* derived from `TmuxMessage` such that adding a variant updates this automatically. |
| `// callers must hold sessionLock` | Every caller of this function takes `sessionLock` before invoking. |
| `// never null after init()` | Across all paths after `init()` runs, this field is not null. |
| `// see SPEC.md §4` | `SPEC.md` exists, has a §4, and §4 is relevant to this code. |
| `// tmux 3.4+ for refresh-client -r` | The surrounding code calls `refresh-client -r` and the README/spec lists this as needing tmux 3.4. |
| `// auto-generated, do not edit` | A generator script exists, runs in the build, and would overwrite manual edits. |

If you can't extract a testable claim, the comment is decorative — drop it from the audit.

### Phase 3: Verify each claim against the current code

This is the load-bearing step. **Do not skim — verify.** For each claim:

#### Identity claims (`single`, `only`, `the X`)

Grep the codebase for *the same check / the same construct elsewhere*. If you find another site, the identity claim is false.

- `single-enforcer` → grep the discriminator string, the field name, the validation function. More than one match outside the marked site = false.
- `the parser` → look for other parse-shaped functions with the same input type.
- `the canonical X` → look for type aliases, re-exports, or parallel definitions of X.

#### Negative claims (`never`, `not`, `no`)

Grep for the disallowed pattern.

- `never null` → grep assignments to the field; check every path; check whether construction always sets it.
- `not called from outside` → grep imports and call sites.
- `no other consumers` → grep the symbol name across the repo.

A single counterexample falsifies the claim.

#### Causal claims (`because`, `needed for`, `prevents`)

The harder kind. Verify by:

- If the cause is a bug/ticket: check whether the bug still applies (is the code path even reachable? does the underlying dependency still behave that way?).
- If the cause is a version requirement: check the actual usage and the project's stated minimum version.
- If the cause is an ordering constraint: check whether the constraint is still mechanically enforced.

A causal claim becomes false the moment the cause disappears, even if the surrounding code still works. (Example: "we set X because the old library required it" — but the library was replaced two refactors ago.)

#### Derivation claims (`derived`, `mirrors`, `auto-generated`)

The most common LAW lie in agent-written code. Read both sides:

- Is the derivation **structural** (mapped type, generator, transform)? → claim is honest.
- Is the derivation **convention** (two hand-written things kept in sync)? → claim is false. The comment should say "must be kept in sync with X" — a weaker, but truthful, claim.

If you find a `[LAW:one-source-of-truth] derived from X` marker on a hand-maintained duplicate, that's a top-priority finding.

#### Procedural claims (`callers must`, `do not call after`)

- Grep all callers; verify each one obeys the precondition.
- For `do not X` rules, grep for X.
- A procedural claim with even one violating caller is at best stale — the violation either is a bug or the rule is wrong.

#### Reference claims

- Files: does the file exist?
- Line numbers: does that line still contain what's referenced? (Line numbers rot fast.)
- Sections: does `SPEC.md` still have a §4 about that topic?
- Tickets: does the ticket exist; is it still relevant?
- Function names: does the function still exist under that name?

### Phase 4: Categorize each finding

Every comment falls into one bucket. For each finding, also classify which **side** is wrong: the **code** (the comment's claim is the design intent, but the code drifted away from it) or the **comment** (the code is fine; the comment overstates, lies, or rotted).

| Bucket | Definition | Default action |
|---|---|---|
| **Accurate** | Claim verified true. | Leave alone. Do not list in the report. |
| **Stale-update** | Claim was true, now wrong but the *intent* is still useful. | See action policy below. |
| **Stale-delete** | Claim referred to something that no longer exists or no longer matters. | Delete the comment. |
| **Load-bearing-false** (LBF) | Claim is false **and** is the kind of claim future agents will act on (LAW marker, identity, derivation, single-enforcer). | See action policy below — never silently rewrite a LAW marker; convert to a TODO that names the violation. |
| **Decorative** | Made no testable claim. | Out of scope for this skill; drop from audit. |
| **Ambiguous** | Couldn't extract a testable claim with confidence. | Flag for human review; don't guess. |

LAW markers can never be "Decorative" — every LAW marker either earns Accurate, Stale-update, Stale-delete, or LBF. If a LAW marker is too vague to verify, it itself is a problem (a LAW comment with no falsifiable content is just noise wearing a load-bearing costume) — flag as LBF with the recommendation "rewrite to a verifiable form or remove."

### Phase 5: Rank the findings

Within the report, sort:

1. **LBF on LAW markers** — highest priority. These are the comments that cause cascading bad agent decisions.
2. **LBF on non-LAW identity / derivation / procedural claims** — same shape, slightly smaller blast radius.
3. **Stale-update on LAW markers** — the claim is repairable; do it before a future agent over-trusts the broken version.
4. **Stale-update on other claims** — repair when convenient.
5. **Stale-delete** — bulk cleanup.
6. **Ambiguous** — list separately, recommend human eyes.

Within each tier, rank by exposure: a comment in `src/index.ts` outranks a comment in `examples/playground/scratch.ts`. A comment near a public API outranks one in a private helper.

### Phase 6: Report

Final chat reply, navigable-index form:

```
Comments inventoried: N (LAW markers: L)
Verified accurate: A
Findings: F
  LBF (LAW):           x  ← act first
  LBF (non-LAW):       x
  Stale-update (LAW):  x
  Stale-update:        x
  Stale-delete:        x
  Ambiguous:           x

Top findings:
  1. file.ts:42 — [LAW:single-enforcer] claims sole site, but file2.ts:88 has same check
     Recommended: <fix the marker OR delete the duplicate, decide which is the real enforcer>
  2. file.ts:120 — "derived from TmuxMessage" but type is hand-written 28-entry interface
     Recommended: <make it actually derived, OR change comment to "must be kept in sync">
  ...
```

Each finding row carries: `file:line`, the false claim (one line), the contradicting evidence (one line, with file:line if applicable), the recommended fix (one line, **specific** — not "consider"). No prose explanations beyond that — the user can drill into any row.

If the codebase is large, cap the body of the report at top 20 findings and put a count of the rest by bucket. Write the full list to the chat as a follow-up only if asked.

### Phase 7: Action policy — TODO, don't launder

The reflex "rewrite the comment to match the code" is dangerous because it **launders a violation as compliance**: a `[LAW:single-enforcer]` claim that the code no longer satisfies, silently rewritten to say something weaker, hides the architectural drift from every future reader. The skill must never do this.

But leaving a known-false comment in place is worse than no comment at all — future agents read it and act on it. So the policy is: **convert false comments into TODOs that flag themselves and propose the fix.** The TODO is a self-announcing landmine instead of a silent one.

Per finding, decide which side is wrong, then act:

#### Code is the wrong side (rare but critical)

Surface as a finding in the report. Do **not** rewrite the comment — the comment captures the original design intent, and silently weakening it to match drifted code erases that intent. Examples:
- `[LAW:single-enforcer]` claims sole site, but a duplicate check appeared in another file → the duplicate is the violation. Report it; the human (or a follow-up `/absorbed-variance` run) fixes the code.
- `[LAW:one-source-of-truth] derived from X` on a hand-maintained duplicate → the duplicate exists because the derivation was never built. Report it; the fix is to actually derive (mapped type, generator). Once derived, the original comment becomes true again with no edit.

#### Comment is the wrong side (more common)

The comment overstates, was always wrong, or has rotted past saving. Replace it in-place with a TODO that:

1. Names the law/claim that is being violated (verbatim if it was a LAW marker).
2. States the contradiction in one sentence (what the code actually does).
3. Proposes a specific fix.

Format:

```ts
// TODO(vet-comments): claimed [LAW:single-enforcer] but discriminator
// "output"|"extended-output" also appears in <file:line>, <file:line>.
// Fix: route those callsites through isPaneOutput(), OR scope the claim
// to "connector layer only" if the demo/test sites are intentional.
```

Rules for the TODO:

- Use a tag that grep can find later. `TODO(vet-comments)` is the canonical form so a future agent can `git grep TODO(vet-comments)` and pick up where this run left off.
- Keep the original LAW token visible (`claimed [LAW:single-enforcer]`) so the architectural intent is still readable. Do NOT just write `// FIXME` — that loses the load-bearing context.
- Propose a fix even if you're unsure which fix is right — give the next agent a starting point. "Fix: A or B; A if X, B if Y" is fine.
- For derivation-claim LBFs especially (e.g., `derived from TmuxMessage`): the TODO must explain that the structural derivation isn't actually wired up, so the next agent doesn't see a comment about derivation, look at the imports, and conclude "looks fine."

#### Both sides are arguable

Some LBFs are scope ambiguities — e.g., `[LAW:single-enforcer]` is true within `src/` but the claim text says "ONLY", and tests/demos legitimately re-use the literal. Don't pick a side; write the TODO with both possibilities:

```ts
// TODO(vet-comments): [LAW:single-enforcer] says "appears in this file
// ONLY", but tests/<file> and examples/<file> use the literal. Either
// (a) scope the claim to "connector layer", or (b) migrate those sites
// to isPaneOutput().
```

#### When to delete instead of TODO

- **Stale-delete** category: the referenced thing is gone (file deleted, function renamed and not findable, ticket closed years ago) — delete the comment outright.
- **Decorative**: out of scope.
- Never delete an LBF on a LAW marker just because it's wrong — that erases architectural intent. Always TODO.

#### When to leave alone

- **Accurate** findings.
- **Ambiguous** findings — flag in the report, don't edit. The whole point of Ambiguous is "we couldn't decide", and editing under that uncertainty is exactly the laundering the skill exists to prevent.

#### Editing scope

Do TODO conversions and deletes inline as you go through Phase 4 — they're mechanical and the report should reflect the final state. The report still lists every finding, but each row notes the action taken (TODO inserted / deleted / surfaced for human / left for ambiguity). Surface the TODOs in the final summary so the user can `git diff` them, scan for ones that read wrong, and revert any that overstepped.

## LAW marker — verification cheat sheet

For each universal-laws token, this is the mechanical check the auditor runs.

| Token | What the marker claims | How to falsify |
|---|---|---|
| `dataflow-not-control-flow` | Same operations run every call; variance lives in values. | Find an `if`/`switch` in the marked code that gates *whether* an operation runs (not just *which* data it runs on). |
| `one-source-of-truth` | This is the canonical representation; others derive from it. | Find a second hand-maintained representation of the same concept that does *not* import / derive from this one. |
| `single-enforcer` | The named invariant is checked here only. | Grep the same check / discriminator / validation elsewhere in the code. Any second site = falsified. |
| `one-way-deps` | No upward call; no cycle through this point. | Run a dependency tracer (or grep imports) for cycles touching this module. |
| `one-type-per-behavior` | If two things share behavior, they are one type. | Find sibling types whose only differences are name + config — that's a false `one-type-per-behavior` adherent. |
| `verifiable-goals` | The marked goal has machine-checkable success criteria. | Look for the criteria in the surrounding code/spec. If absent, marker is false. |
| `locality-or-seam` | Changes here don't force edits elsewhere. | Recent git history: did a change in this module force edits in N unrelated modules? Then the seam is missing. |
| `no-defensive-null-guards` | Null guard here is at a real trust boundary, not defensive. | The guard is at a trust boundary AND has an `else` branch with real behavior. Both required; absence of either = falsified. |
| `no-shared-mutable-globals` | Module-level state has a single owner + explicit API. | Find writes from outside the declaring module. |
| `no-mode-explosion` | New flag has owner + cap + exit plan. | Look for the documented cap / exit plan. Absent = falsified. |
| `behavior-not-structure` | The test asserts contract, not implementation. | Inspect the test: does it import internal helpers? Assert on private state? Then it's structural. |

When verifying a LAW marker, the **cite-on-violation** convention applies in reverse too: a `// [LAW:X] exception: reason` is a self-reported violation. Confirm the exception is still warranted (still load-bearing? still the only escape hatch?) — stale exceptions are LBF too.

## Anti-patterns to catch yourself doing

- **Skimming instead of verifying.** "This looks reasonable" is not a verification. Either run the grep / read the cited file / trace the callers, or mark it Ambiguous.
- **Trusting the comment to interpret the code.** Read the code first, *then* the comment, *then* compare. Reading them in the other order biases you toward the comment's framing.
- **Auto-rewriting LAW markers to match code.** As above — the code may be the wrong side of the discrepancy. Report; don't fix.
- **Treating decorative comments as findings.** They're noise but they're not lies. Out of scope.
- **Bulk-deleting "obvious" stale comments.** A comment that looks stale may be the last record of a non-obvious constraint. When in doubt, mark Ambiguous.

## Pairing with other skills

- **`/absorbed-variance`** — if Phase 4 surfaces a `[LAW:single-enforcer]` LBF that turns out to be a real shotgun parser, that's an absorption candidate.
- **`/variance-audit`** — if multiple LBF LAW markers cluster around one discriminator, that's a seam — re-run the audit with this finding in mind.
- **`/spec-audit`** — when reference-claim findings point at spec sections that have drifted, that's a spec problem, not a comment problem.

## Success criteria

A vet-comments run has succeeded when:

1. Every `[LAW:...]` marker in the codebase has been individually verified or flagged ambiguous — no sampling, no spot-check.
2. Every reported finding has a specific file:line, a one-line claim, a one-line counter-evidence, and a one-line recommended fix or action taken.
3. No false comment was silently rewritten to match the code. LBFs where the comment is the wrong side were converted to `TODO(vet-comments)` notes that name the violated claim, state the contradiction, and propose the fix. LBFs where the code is the wrong side were left untouched and surfaced for the human or a follow-up agent.
4. The user can `git diff` the changes and see, for each TODO inserted: which LAW token it concerns, what the contradiction is, and what the proposed fix would be.
5. Reading the report alone, a future agent can tell whether each LBF's *comment* or *code* is the wrong side. The TODOs in-tree carry the same context for anyone who finds them via `git grep`.

If a future agent, reading the audit report alone, cannot tell whether the comment or the code is the wrong side of a finding, the report failed Phase 4 and needs another pass. If a TODO was inserted that doesn't make the contradiction obvious to a reader who hasn't seen the report, the TODO has failed Phase 7's job and should be rewritten.
