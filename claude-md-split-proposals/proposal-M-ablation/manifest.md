# Ablation Manifest — addressable units

The full instruction text, segmented into independently removable units. IDs are
stable handles for the harness. **Segmentation is granularity, not judgment** —
the boundaries say nothing about which units matter; that is what ablation finds.
Each unit cites its source span so removal is mechanical and reversible.

> Convention: a "run condition" is a CLAUDE.md assembled from a subset of these
> units. Removing a unit means assembling the file without it. The text itself
> lives single-sourced in `../proposal-R-relocation/full-instructions.md`; this
> manifest only indexes it.

## Constraint-design manifesto (`<constraint-design>`)
- **CD-1** — Thesis: the types are the program; creative work is in constraint design, body is mechanical.
- **CD-2** — "Writing code" is recovering from inadequate constraints; defensive checks/branches/impl-tests are compensation.
- **CD-3** — Craft = strongest true theorem; weaker types admit illegal states → coupling; type is a theorem, impl its proof.
- **CD-4** — Smooth vs rough surfaces; composition is free (N→N²); roughness crystallizes (feature × accumulated-roughness).
- **CD-5** — Catalogue of rough bits; "done when nothing snags."
- **CD-6** — Polishing is subtraction; adding code is patching; iterations should remove material.
- **CD-7** — Hardness is information; refuse the escape into the body; branch→missing discriminator, guard→loose upstream type.
- **CD-8** — "Done" = code smoother than you found it; leverage compounds either direction; no neutral ground.
- **CD-9** — Mindset above all; "minimum work to close the task" guarantees crystallization.

## Carrying-cost framing (`<carrying-cost>`)
- **CC-1** — YAGNI is about intrinsic cost under bounded-carrying-cost assumption (true only for crystals).
- **CC-2** — Smooth blocks have ~zero carrying cost; "feature you might not need" ≈ 95% of one you do.
- **CC-3** — Intrinsic vs carrying cost; economics invert for skilled constraint-designers.
- **CC-4** — YAGNI usefulness inversely proportional to skill; metal-as-substrate analogy.
- **CC-5** — Right question is "is this block smooth / is the type the strongest true theorem", not "do we need it".

## Universal laws (`<universal-laws>`)
- **LAW-obs** — citation requirement (`[LAW:<token>]` / exception marker).
- **LAW-types** — types-are-the-program (primary).
- **LAW-dataflow** — dataflow-not-control-flow.
- **LAW-1source** — one-source-of-truth.
- **LAW-enforcer** — single-enforcer.
- **LAW-deps** — one-way-deps.
- **LAW-1type** — one-type-per-behavior.
- **LAW-goals** — verifiable-goals (+ BAD/GOOD webapp example).
- **LAW-comments** — comments-explain-why-only.
- **LAW-seam** — locality-or-seam.
- **LAW-null** — no-defensive-null-guards.
- **LAW-globals** — no-shared-mutable-globals.
- **LAW-modes** — no-mode-explosion.
- **LAW-tests** — behavior-not-structure.

## Guidelines (`<guidelines>`)
- **G-simplicity**, **G-modules**, **G-deps**, **G-datadriven**, **G-boundaries**,
  **G-state**, **G-events**, **G-flags**, **G-testing**, **G-errors**, **G-abstractions**
  (each the corresponding bullet group).

## Context-specific (`<context-specific>`)
- **CX-ui**, **CX-apis**, **CX-schema**, **CX-pipelines**, **CX-distributed**, **CX-cli**.

## Operational (`<python-deps>`, `<scripting-discipline>`, `<subagent-delegation>`, `<wisdom>`)
- **OP-python** — PEP 668 / uv discipline.
- **OP-scripting** — never swallow errors / no silent fallbacks / test the API / validate after calls / agent-driving scripts.
- **OP-subagent** — subagents see only the prompt; 6 rules.
- **OP-longterm** — long-term-over-short-term wisdom block.
- **OP-conditionals** — the if/and/when/only rule + viewport WRONG/RIGHT example.
- **OP-ticket** — ticket lifecycle / done-criteria.
- **OP-commit** — commit-requirement.
- **OP-git** — git workflow + hard gate.
- **OP-pr** — pr-followup (/address-pr-reviews).

> ~40 units. Bisection (see README) keeps the run count near O(log n) for the
> expected case where most units are inert against any given battery.
