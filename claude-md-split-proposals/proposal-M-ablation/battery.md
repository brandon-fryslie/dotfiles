# Behavior Battery (starter)

Tasks where the behavior you want to preserve is **observable and
deterministically gradeable**. Each defines the *goal* (what good output is) — not
the *cause* (which prose produces it). The grader is a script over the produced
git diff / final file, so a run can be scored with no human in the loop
(`verifiable-goals`).

These are built from behaviors you have actually reported or that the
instructions explicitly target. They are a STARTER — you own what counts as
success, so review/extend before any run is meaningful. Each task needs a fixture
(small repo state) committed under `fixtures/`.

---

## B1 — Delete-to-fix
**The behavior:** solving a problem by removing code rather than adding a guard/shim.
**Fixture:** a module with a dead fallback path + a duplicated representation that
can diverge (a real `one-source-of-truth` smell).
**Prompt:** "This sync occasionally serves stale data. Fix it."
**PASS (scriptable):** final diff is net-negative lines AND the duplicated
representation is removed (one source remains). **FAIL:** a guard / freshness check
/ cache-invalidation branch is *added* while both representations survive.

## B2 — Fix-the-type-not-the-body
**The behavior:** tightening a type so a defensive check becomes unnecessary,
instead of adding another check.
**Fixture:** a function taking `status: string` used as if it were one of 4 values,
with scattered `if (status === ...)` guards and a null guard with no else.
**Prompt:** "Make this robust."
**PASS:** parameter retyped to the closed set (enum/union) AND ≥1 guard deleted as
newly-unreachable. **FAIL:** more guards / a runtime validator added while the type
stays `string`.

## B3 — Collapse-the-special-case (on-conditionals)
**The behavior:** removing a conditional by making the operation unconditional and
letting data decide — the viewport WRONG→RIGHT move.
**Fixture:** a renderer with `if (hasViewport && op === clear) { clearRegion } else { clearAll }`.
**Prompt:** "Clean up the clear logic."
**PASS:** the `hasViewport`/`op` compound branch is gone; one code path with the
variability in a value (default-full-surface viewport). **FAIL:** the conditional is
kept or a new mode/flag is introduced.

## B4 — Refuse the premature abstraction / inert-feature
**The behavior:** *not* building speculative machinery, while still building a
genuinely smooth block. (Softer to grade — include only if you want to probe the
carrying-cost units CC-*.)
**Fixture:** a one-shot data transform with a request hinting at "make it
configurable for future formats."
**Prompt:** "Implement the CSV export."
**PASS:** one direct implementation, no unused config knobs/flags. **FAIL:** a
plugin/registry/strategy scaffold for formats that don't exist.

---

## Grading & noise
- Each task → binary PASS/FAIL by the script above (extend to a 0–2 partial score
  if binary proves too coarse).
- Battery score = sum across tasks. Run **K times per condition** (start K=8) to
  get a mean + spread; the noise band is the spread of the all-units-present
  baseline. A unit is LOAD-BEARING only if removing it drops the mean beyond that
  band.
- Keep fixtures and prompts **frozen** across all conditions — the only thing that
  varies between runs is which manifest units are present. (Same operations, same
  order, every run; the variability lives in the data — `dataflow-not-control-flow`
  applied to the experiment itself.)

## Driver (spec only — not yet written)
A script that, given a subset of `manifest.md` unit IDs: assembles a CLAUDE.md from
those units, runs each battery task via `claude -p` in a fresh fixture clone,
captures the diff, scores it, and tallies. **Will be written only after I run and
verify the actual `claude -p` flags, output shape, and exit codes** — not against
an assumed interface.
