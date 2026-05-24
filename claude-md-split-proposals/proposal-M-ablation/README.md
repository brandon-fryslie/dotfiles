# Proposal M — Measured Cut (Ablation Harness)

The cut is an **output of measurement**, never an input from anyone's reading of
the prose. This proposal does not pre-sort content into base/skill. It defines a
machine that *discovers* which content is load-bearing, so the eventual cut is
defensible to you and to anyone you share it with.

## Why this is the only fully assumption-free way to actually shrink the base

Relocation (proposal R) is assumption-free but doesn't shrink the *total* — it
just moves it. To genuinely remove content while preserving behavior, you must
know which content matters. You cannot get that by reading (the whole premise:
the reader is unreliable about activeness). You can only get it by **ablation**:
remove a chunk, run a fixed battery of real tasks, measure whether the prized
behavior degrades. The chunk's behavioral footprint, not anyone's opinion, decides
its tier.

This is `verifiable-goals` made literal: the goal "X is load-bearing" finally has
a type — *removing X drops the battery score beyond noise*. Green/red is set by
observed behavior.

## The three artifacts

1. **`manifest.md`** — the full instruction text segmented into independently
   removable, stably-IDed units (CD-1, CD-2, CC-1, LAW-types, …). Segmentation is
   *granularity*, not *activeness* — boundaries say nothing about importance, only
   about what can be toggled. Finer chunks → more precise cut, more runs.

2. **`battery.md`** — a frozen set of tasks where the behavior you want to preserve
   is *observable and deterministically gradeable* (delete-to-fix, fix-the-type-
   not-the-body, collapse-the-special-case). The battery defines the **goal**
   (what good output looks like) — which is yours to set — never the **cause**
   (which prose produces it) — which the machine finds.

3. **`run.md`** — the protocol below, plus the spec for a driver script. (The
   driver is specified, not yet written: per scripting discipline I will not ship a
   script against `claude -p` flags I haven't run and verified first.)

## Protocol

```
baseline    = run battery with ALL units present, K replications, grade each
for each unit (or bisected group) U:
    condition = run battery with U removed, K replications, grade each
    footprint(U) = baseline_score - condition_score   (with noise band from K)
classify:
    footprint(U) beyond noise  -> LOAD-BEARING  -> base (always-on)
    footprint(U) within noise   -> INERT for this battery -> on-demand / candidate to drop
```

- **K replications per condition** because the signal is rare and stochastic
  (the delete-to-fix event was a single observation). One run proves nothing.
- **Bisect, don't one-at-a-time, first.** Remove half the units; if the battery
  holds, the whole half is inert *together* — recurse only into halves that move
  the score. Cuts run count from O(n) toward O(log n) for the common case where
  most prose is inert.
- **Interactions exist.** A unit may be inert alone but load-bearing as part of a
  set (the "scaffold makes the imperative fire" hypothesis). Bisection on groups
  catches set-effects that single-unit ablation misses.

## What you get out

A ranked footprint per unit → a base containing exactly the load-bearing set, an
on-demand skill containing the rest, and — crucially — a *reason* for every
placement that is not "Claude thought so." Re-runnable whenever the model changes,
because model upgrades change what's load-bearing and a static cut would silently rot.

## The honest cost

This is a research loop, not an afternoon edit. The expensive input is the
battery: it must be gradeable without a human in the loop, or the loop doesn't
scale. `battery.md` is a starter built from behaviors you've actually reported —
it needs your sign-off on what counts as success before any run is meaningful.
