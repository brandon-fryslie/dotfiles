---
name: find-interesting-code
description: Audit a codebase for "interesting" code — load-bearing workarounds where the implementation solves a problem by routing around it rather than solving it cleanly. "Interesting" here is the polite-hedge sense ("it's not clear what the right answer is, but it's definitely not this") — code that works, isn't a bug, and isn't merely ugly, but depends on subtle ordering, two-phase measurements, ambient assumptions, or write-then-read-yourself dances that future change will break in non-obvious ways. Produces a ranked list of file:line findings with the workaround shape, why it's load-bearing, and what a cleaner shape might look like — without rewriting. Use when the user says "find interesting code", "where's the load-bearing weirdness", "find the workarounds", "find the things that work for the wrong reasons", or wants a structural smell audit before a refactor.
---

# Find Interesting Code: The Polite-Hedge Audit

## What this skill is for

There is a specific kind of code that is hard to talk about. It works. Its tests pass. It is not a bug. It is not merely ugly. But when an experienced reader looks at it, they find themselves saying "...interesting" — and that word is doing rhetorical work. They mean: *I can't tell you what the right answer is, but I can tell you it's not this.*

This skill finds those sites.

The concept has a sharp definition. **Interesting code is code that solves a problem by routing around it instead of solving it.** It produces correct output, but the path it takes to get there depends on:

- A layer below doing something the code can't see, in an order it can't control.
- A piece of state the code reads from itself after writing, on a different tick.
- An ambient assumption about a parent / sibling / framework that nobody documents because nobody articulated it.
- A workaround for a constraint that may not exist anymore.
- A two-phase dance where phase one exists only to make phase two possible.

The honest read is: the design is missing a primitive. Instead of building the primitive, the code built a dance around the absence. The dance is load-bearing — change anything around it and it stops working — but its load-bearing-ness is invisible until something breaks.

That is what "interesting" means. This skill catches it.

## When to use

- "find the interesting code"
- "where are we routing around problems instead of solving them"
- "find the load-bearing workarounds"
- "find code that works for non-obvious reasons"
- "where are the dances"
- Before a refactor — "what's going to break in surprising ways when we touch this?"
- After a debugging session that ended with "...weirdly that works now" with no explanation
- Onboarding to a codebase and wanting to know which sites *not* to touch without a plan

## When NOT to use

- You want to find bugs — interesting code is not buggy by definition; use a bug audit instead.
- You want a code-quality / readability review — that's taste; this is structure.
- You want to find TODOs / FIXMEs — `grep TODO` is fine; this skill is for the workarounds that **don't** apologize for themselves, which are the dangerous ones.
- You want a pure complexity-audit — there's a separate skill for that.
- You want to find variance-leakage shotgun parsers — that's `/variance-audit`'s job.

These overlap occasionally. Findings from this skill *can* feed those skills. But the unit of work here is "this site is structurally compromised in a way that will surprise the next agent who touches it" — not metrics, not bugs, not duplication.

## The core insight

The most dangerous workarounds **do not apologize for themselves.** Greppable apologies — `// hack`, `// FIXME`, `// XXX`, `// workaround` — are the easy case. The author noticed and flagged. The hard case is when the author internalized the workaround so completely they wrote it without comment, because in their head it was "just how you do it."

So this skill cannot find findings by searching for shame words. It has to find them by searching for **shapes**. The shape of a routing-around-the-problem solution is recognizable in the dataflow: side effects in unusual orders, state read shortly after being written, mounting trickery, multi-pass renders, ordering assumptions made on framework primitives whose ordering isn't part of the contract.

A useful test the auditor applies on every candidate: **"If a junior engineer asked me why this is shaped this way, would my honest answer start with 'because of how X happens to work'?"** If yes, it is interesting in this skill's sense. The "because of how X happens to work" is the ambient assumption; the shape is the routing-around. Find that shape and you find the finding.

## The shapes to look for

These are the patterns. They are not the *only* patterns — but they cover the high-yield majority. Each pattern has greppable signals (used to enumerate candidates) and verification questions (used to decide whether each candidate is actually a finding).

### 1. Empty-render-then-measure-then-rerender

The widget needs its own size to render content (e.g. repeating a character to fill width). Layout produces the size. So the widget renders empty, lets layout measure it, writes the measurement to observable state, and re-renders with the size populated.

Signals:
- `useLayoutEffect` writing to a MobX observable / Zustand / Redux store / `useState` setter, *based on a measurement*, *without conditional*.
- `measureElement`, `getBoundingClientRect`, `ResizeObserver`, `IntersectionObserver` paired with state updates that drive the **same** component's render.
- A render that reads `screenRegion`, `clientWidth`, `offsetHeight`, etc., and uses the value to compute repeated content.
- `Math.max(0, region.width)` defensiveness — load-bearing because the first pass returns 0.

Verification:
- Does the component genuinely need its own size to render, or is it asking for a size the parent or layout primitive should provide?
- Would `flex`/`grid`/`fr` / a fill-character primitive let the layout produce the right shape without the read-self loop?
- What happens if the measurement source ever fires synchronously vs. asynchronously? Does the component still produce correct output, or does it silently render empty?

### 2. Ordering assumptions on framework primitives

Code that works because effect A fires before effect B in a way the framework happens to do today, but doesn't promise.

Signals:
- `useLayoutEffect` + `useEffect` in the same component where the order matters.
- Comments like "this must run before…", "fires after layout", "before paint" without a citation.
- Multiple effects with empty/overlapping dep arrays where order changes the result.
- Cleanup functions that read state set in another component's mount.
- Microtask trickery: `Promise.resolve().then(...)`, `queueMicrotask`, `setTimeout(0)`.
- `requestAnimationFrame` used to "wait for layout".

Verification:
- Is the ordering documented in the framework's contract (React: useLayoutEffect fires before paint), or is it documented in the code's *imagination* of the contract?
- If the framework reordered (e.g., concurrent React, batched effects), does the code break or silently misbehave?
- Is there a single seam that could enforce the ordering as data, instead of as effect choreography?

### 3. Refs that exist to bypass closure staleness

A ref is created and updated in an effect, then read by a callback or another effect, because the callback would otherwise see the stale value.

Signals:
- `useRef` + an effect that mirrors a state value or prop into the ref every render.
- Patterns like `widgetRef.current = widget`.
- Callbacks that read a ref instead of a closed-over variable, with no comment, in code where the closure value is the obvious thing to read.
- `useImperativeHandle` exposing things that look like they should be props/state.

Verification:
- Why isn't the closure value usable directly? (Stale callback fed to an event listener? Subscriber registered once with the wrong identity?)
- Could the subscription be re-registered when the value changes, eliminating the ref?
- Could state be lifted so the producer and consumer share the same source of truth without a mirror?

### 4. Write-then-read-self loops

Component writes to shared state, reads it back on the next render to compute its output.

Signals:
- `setState` in `useEffect` with no dep gating.
- MobX `runInAction` immediately followed by an observer that reads the same observable.
- Two `useEffect`s where the first writes A and the second reads A.
- A component that subscribes to a store it also publishes to.

Verification:
- Could the value flow through props instead of through shared state?
- Is the round trip producing observability you actually need (devtools, replay, undo), or just plumbing?
- Is there an infinite-loop guard (`if (newValue !== oldValue)`) doing load-bearing work? If yes, the loop *can* infinite-loop and is being held back by an equality check that may rot.

### 5. Conditional control flow gating side effects

The codebase claims dataflow-not-control-flow as a law, but a side effect is wrapped in `if` to make it conditional.

Signals (this overlaps `[LAW:dataflow-not-control-flow]` audits — keep findings if the law marker is **absent** but the shape exists):
- `if (X) { sideEffect() }` with no `else`, where the side effect is something like dispatch / publish / write / set / mount.
- `if (mounted)` / `if (ready)` / `if (visible)` guards around real work.
- Early returns that skip dispatches based on transient state.
- `if (!disposed)` cleanup checks that protect against an ordering assumption.

Verification:
- Could the side effect be unconditional, with the variation living in its arguments?
- Is the guard hiding a real bug (operation happens before init complete) or laundering ordering assumptions?

### 6. Manual scheduler / re-entry shims

Code that exists to fight the framework's scheduler.

Signals:
- `let inFlight = true; ... inFlight = false`-style re-entry guards.
- `flushSync`, `unstable_batchedUpdates`, `act(...)` outside tests.
- Custom debounce / throttle wrappers around a thing that should just be a derived value.
- `setTimeout(0)` / `requestIdleCallback` to "let X settle".
- Two-phase commit patterns at the application level (mark dirty / actually-do-it).

Verification:
- What is settling? Is the settling pure framework state (then push it through the framework's primitives) or genuinely external (then debounce belongs at the boundary)?
- Could a derived selector eliminate the need for the shim?

### 7. Magic numeric constants tuned to a specific layout

Numbers that exist because they happen to make one fixture render correctly.

Signals:
- Hard-coded widths/heights with comments naming a fixture / breakpoint / "for now".
- Padding/margin offsets like `- 2` with no explanation, applied to a value that looks like a content size.
- Sleep / poll intervals that match a single observed timing.
- "Half of …" / "double …" arithmetic without a named principle.

Verification:
- Where does the number come from? Is it derived from a primitive (font cell width, screen size, framework constant) or a single empirical measurement?
- Is there a fixture or test whose passage *requires* this exact value? If yes, the number is load-bearing on that test's geometry.

### 8. Ambient assumptions about parents

A component / function that only works correctly when its caller does something it doesn't declare.

Signals:
- A component that uses `width: 1` but assumes the parent is `flexDirection: row` of a known height.
- A function that mutates input then returns nothing, used in a pipeline that expects the mutation.
- Hooks that read context they don't declare a default for, depending on a Provider being mounted upstream.
- Widgets that assume a particular sibling is also rendered (a layout sibling, an event sibling).

Verification:
- What's the contract? Is it written down (prop types, JSDoc, spec)?
- If a new caller used the component in a different context (e.g., column layout), would it silently render wrong, or would it fail loudly?

### 9. Workarounds for a constraint that may no longer apply

The original problem was real. The library was upgraded, the bug was fixed, the API changed — and the workaround stayed.

Signals:
- Comments referencing an old version: `node 12`, `react 16`, `before vite 4`, `pre-strict-mode`, `legacy IE`.
- Comments referencing a closed bug ticket / linked issue.
- Code that imports a polyfill or shim alongside a modern alternative.
- "Hack for X" where X is a known historic problem.

Verification:
- Does the named constraint still hold today (current versions, current targets)?
- If you delete the workaround, what fails — anything?

### 10. Plumbing through observability that should flow as data

A value is published through an event, observable, callback, or context — only to be consumed by another part of the *same* feature, where a direct prop/argument would have worked.

Signals:
- Event emitters used between siblings that share a parent.
- Context used to plumb a value one level deep.
- Pub/sub between two functions in the same file.
- "I don't want to drill the prop" — drilled props are honest; the bus hides the dependency.

Verification:
- Is the consumer in a place where the producer's prop *could* reach it? (Same tree, parent–child, same module.)
- Is the indirection earning anything (multiple consumers, decoupled lifetimes), or is it only there because the direct path felt awkward?

## Workflow

### Phase 1: Enumerate candidates

Use Grep / Glob with the signal patterns above. Don't read the whole codebase; pull candidate sites by shape. Build a list of `file:line` candidates per shape category.

Useful seed greps (adapt to language and codebase):

- `useLayoutEffect` (every occurrence is a candidate; verification rejects most).
- `measureElement|getBoundingClientRect|ResizeObserver|IntersectionObserver`
- `useRef` + `(?<!Initial)Ref\.current\s*=` mirror-into-ref idiom.
- `runInAction` paired with `observer\(`.
- `flushSync|unstable_batched|requestAnimationFrame|setTimeout\(.*,\s*0\s*\)|queueMicrotask`
- `if\s*\([^)]*\)\s*\{\s*[a-zA-Z_$][\w$]*\(` followed by no `else`, and the call is plausibly a side effect.
- Hard-coded numbers with regex `\b(?<!#)\d{2,}\b` filtered to layout/timing-shaped contexts.
- Comments containing: `hack`, `workaround`, `for now`, `temporary`, `kludge`, `because of`, `needed for`, `wait for`, `after layout`, `before paint`, `must run`, `must be called`, `node 1[0-6]`, `react 1[0-7]`.
- Word-boundary searches for `interesting` and `tricky` in comments — sometimes the author told you.

Each language and stack has its own shapes. If the codebase is Rust, the equivalents are `unsafe` blocks with `// SAFETY:` comments that name an ambient assumption, `mem::transmute` near generic bounds, lifetimes that exist only to satisfy the borrow checker for one call site, etc. Adapt the shape list to the language; the meta-pattern (routing-around-a-missing-primitive) is universal.

### Phase 2: Verify each candidate

For each candidate, apply the verification questions for its shape. Read enough surrounding code to answer the question. The candidate either:

- **Confirmed interesting** — the routing-around shape is real, the ambient assumption exists, the workaround is load-bearing.
- **Honest** — there's a real reason that's properly captured (the problem genuinely lives at this layer; the framework's contract guarantees the ordering; the constraint still applies).
- **Bug** — actually broken; punt to a bug audit, not this skill.
- **Out of scope** — readability or performance issue, not structural.

If you cannot decide between Confirmed and Honest, mark **Suspect** and surface it for human review with the verification question that defeated you. Do not guess. The whole point of "interesting" is that it's the polite hedge for "I'm uncertain about the right answer" — be honest about that uncertainty in the audit too.

### Phase 3: Articulate each finding

For every confirmed (or suspect) finding, write three things, in this order:

1. **The shape.** One sentence naming the workaround pattern. ("Empty-render-then-measure-then-rerender to fill width with a repeated character.")
2. **The ambient assumption.** One sentence naming what has to be true for this to work, that isn't part of any contract. ("Depends on `useLayoutEffect` firing synchronously after the first render and on MobX observers re-rendering before paint.")
3. **The cleaner shape (best-effort).** One or two sentences proposing what a non-routing-around solution might look like. **Hedge honestly when you don't know** — "I don't know what the right shape is, but a layout primitive that stretches a fill character (so the widget never reads its own size) probably eliminates the dance."

The third item is the load-bearing one. If you can't say *anything* about a cleaner shape, the finding might still be valid, but say so explicitly: "No proposed cleaner shape — this needs design work." Do not invent a fix to fill the slot. A confident wrong fix is worse than an honest "I don't know" because the next agent acts on it.

### Phase 4: Rank

Rank by **blast radius if the workaround drifts**:

1. **Foundational** — shape is in core framework / shared utility / widget base. A change to the underlying assumption breaks every consumer.
2. **Cross-cutting** — same shape repeated in 3+ sites; if one breaks they all probably break.
3. **Public API edges** — the workaround leaks into a contract callers depend on.
4. **Localized** — single site, internal, contained blast radius.
5. **Suspect** — couldn't decide; lower priority but list separately.

Within tier, sort by how recently the surrounding code has been touched (recent churn = higher chance of an upcoming change colliding with the assumption).

### Phase 5: Report

```
Interesting-code findings: N (confirmed: C, suspect: S)

By shape:
  empty-then-measure:        x
  ordering-assumption:       x
  ref-mirror:                x
  write-then-read-self:      x
  control-flow-gates:        x
  scheduler-shim:            x
  magic-constant:            x
  ambient-parent:            x
  obsolete-workaround:       x
  observability-as-plumbing: x

Top findings:
  1. src/widgets/rule-component.tsx:78 — empty-then-measure
       Shape: renders char.repeat(0) on first pass, then re-renders after
              useLayoutEffect writes screenRegion via MobX.
       Ambient: depends on Ink's measure pass running synchronously and
                MobX observer firing before paint.
       Cleaner: probably a layout primitive that stretches a fill character;
                I don't know the exact shape — needs design.
  2. src/framework/context.tsx:404 — ordering-assumption
       Shape: WidgetScope's useLayoutEffect mutates widget.screenRegion;
              several consumers' renders read it; works because effects
              run depth-first.
       Ambient: React's effect-order guarantee is being relied on for
                semantic correctness, not just for cleanup.
       Cleaner: pass measured region as a prop from a layout owner that
                computes it once, instead of every consumer reading it.
  ...
```

Each row carries: `file:line`, shape (one line), ambient assumption (one line), cleaner shape proposal **or honest "I don't know"** (one line). No prose beyond that — the user can drill in.

If the codebase is large, cap at top 20 in the inline body and write a separate count by tier; expand only if asked.

## Action policy: surface, don't fix

This skill **does not edit code.** That is a deliberate choice and matches the polite-hedge meaning: if we knew the right answer we wouldn't be saying "interesting." Auto-rewriting an interesting site to a different routing-around is exactly the laundering that vet-comments warns about for LAW markers.

For each confirmed finding:

- **Surface it in the report** with shape, ambient assumption, and best-effort cleaner shape (or honest "I don't know").
- **Do not edit** the implementation.
- **Do not insert** a `TODO(find-interesting-code)` comment unless the user asks. Unlike `vet-comments`, the finding here isn't a falsifiable claim — it's a design observation. Inserting TODOs at every site clutters the codebase with subjective concern markers.

If the user *does* want comment-level surfacing afterward, propose a single `// NOTE(find-interesting-code):` line per site naming the shape — e.g., `// NOTE(find-interesting-code): empty-then-measure; widget reads its own width`. Keep the note short and shape-named so it's greppable and a future agent doing structural work can find them all.

## Anti-patterns to catch yourself doing

- **Confusing "ugly" with "interesting."** Ugly code might be perfectly honest about its problem. Interesting code is structurally compromised in a way that *looks* fine. If you can articulate "this is just verbose," it's not a finding.
- **Confusing "complex" with "interesting."** Complexity can be load-bearing on a real domain problem. Interesting is when the complexity exists *to work around the framework / layer below*, not because the domain is complex.
- **Auto-proposing a fix.** The skill's whole point is that we don't always know the right shape. A confident wrong fix is the most expensive thing this skill can produce.
- **Skipping verification.** "This looks weird" is not a finding. Pull on the thread until you can name the ambient assumption and the shape; if you can't, mark Suspect.
- **Treating every TODO as interesting.** Apologetic comments are the easy case; greppable. Don't pad the report with them; the high-value findings are the un-apologetic ones.
- **Treating every effect as a workaround.** Effects are a real primitive. Most uses are honest. Filter aggressively in Phase 2.

## Pairing with other skills

- **`/absorbed-variance`** — when an interesting finding turns out to be variance routed through control flow, that's an absorption candidate.
- **`/variance-audit`** — when multiple interesting findings cluster around one discriminator or one missing primitive, the audit's seam-finding may identify the underlying structural gap.
- **`/vet-comments`** — comments that say "for some reason" or "needed because of how X works" are already self-confessing as interesting; cross-reference findings.
- **`/complexity-audit`** — different question (god modules, dead code, scattered concerns); occasionally surfaces the same site for different reasons.

## Success criteria

A find-interesting-code run has succeeded when:

1. Every finding names a **shape** (not a vibe), an **ambient assumption** (not a vague worry), and either a **cleaner shape** or an **honest "I don't know."**
2. No finding was auto-fixed. The implementation is unchanged unless the user explicitly asked for `// NOTE(find-interesting-code)` markers.
3. The user can read the report and, for each finding, predict what would break if the named ambient assumption changed (framework upgrade, library swap, layout reflow, scheduler change).
4. Findings are ranked by blast radius, not by author taste or code age. A heavily-relied-on workaround in core utilities outranks an isolated weirdness in a leaf component.
5. Suspect findings are separated from confirmed ones and carry the verification question that defeated the auditor — so a human (or a follow-up run with more context) can finish the call.

If a future agent reads the report and cannot tell what design-level question each finding is asking, the report failed Phase 3. If a finding's "cleaner shape" reads like a confident prescription and the auditor was actually unsure, that's exactly the laundering this skill exists to prevent — rewrite it as an honest hedge.
