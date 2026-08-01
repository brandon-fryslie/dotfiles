---
description: Analyze the current codebase and proactively propose new features — no questions asked
argument-hint: [optional focus area, e.g. "CLI UX" or "performance"]
---

# Propose Features

Your job right now: understand what this application *is*, then propose new features for it. You are the product-minded staff engineer who already knows the codebase — not a consultant gathering requirements.

## Hard rules (non-negotiable)

1. **You MUST propose features.** Ending this command without a full slate of proposals is failure.
2. **You CANNOT ask the user questions first.** Zero questions before the proposals are delivered. At most ONE question total, and only *after* all proposals are presented, and only if it is genuinely irreducible (a preference or fact only the user holds). "Which direction interests you?" is not a question — it's an abdication.
3. **Every proposal must make sense for THIS application.** A proposal that would fit any codebase is automatically invalid.

## Phase 1 — Analyze the codebase

Build a real picture before generating anything. Read (directly or via Explore subagents for breadth):

- README, package manifest / build files, CLAUDE.md or equivalent docs
- Entry points, CLI surface / API surface / UI surface
- Config schema and options — what users can already customize
- The module layout — what machinery already exists (caches, protocols, renderers, stores, integrations)
- Tests and issue tracker (if present) for hints about direction and known gaps

Then state, in your output, before any proposals:
- **What the app is**, in one sentence.
- **The current feature inventory** — a compact list of what it already does.
- **The load-bearing machinery** — the 3–6 existing subsystems that new features could ride on.

This grounding is mandatory: every proposal must trace back to it.

## Phase 2 — Propose features

Produce ALL THREE categories, every time, at these minimums:

### A. Table stakes (≥ 3) — standard features the app is missing
Features that comparable tools in this category are expected to have. If the app is a CLI, think: shell completions, machine-readable output, config validation commands, doctor/diagnostics. If a service: health checks, metrics, export. Match to the actual category of app.

### B. Leverage plays (≥ 4) — opportunities hiding in existing machinery
Look at the load-bearing subsystems from Phase 1 and ask: what useful feature is this machinery *almost* already doing? A cache that could power history; a protocol that could carry a new verb; a template engine that could expose a new function; a data store one projection away from a new view. These are the highest-value proposals because the substrate already exists — name the specific module/file each one slots into.

### C. Wild ideas (≥ 2) — unique features nobody else has
Swing big. Something that would make a user say "wait, it can do WHAT?" These may be ambitious or weird, but they must still be *this app's* kind of weird — an outgrowth of its actual identity and architecture, not a bolted-on pivot.

### Format for every proposal

- **Name** — short and evocative
- **Pitch** — 2–4 sentences: what it does and why a user would want it
- **Why it fits** — which existing subsystem/seam it slots into (name the actual module or mechanism)
- **Effort** — S / M / L gut call

## Phase 3 — Recommend

Close with a ranked shortlist: your top 3 across all categories, with one sentence each on why they're first. Commit to an opinion — do not present a neutral menu.

## Examples of BAD output (do not produce these)

- ❌ "Add dark mode" / "Add tests" / "Improve documentation" / "Add CI" — generic any-app filler, not features
- ❌ "Depending on your goals, you could go several directions — what matters most to you?" — asking instead of proposing
- ❌ A proposal that ignores the app's architecture ("add a web dashboard" for a tool with no server component, without explaining how it rides existing machinery)
- ❌ Ten variations of the same idea padding out a category
- ❌ Proposals with no "why it fits" grounding in a named module or subsystem

## Focus

If the user provided a focus area, weight the brainstorm toward it but still fill all three categories: $ARGUMENTS
