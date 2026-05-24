<!--
PROPOSAL R — RELOCATION (assumption-free)
This proposal makes NO claim about which content drives behavior. It drops and
distills nothing. `full-instructions.md` is a verbatim `cp` of the current
CLAUDE.md — every word preserved, single-sourced. This base file is the only
authored artifact, and it authors no content: it sets posture, defines the
citation vocabulary needed to read [LAW:] markers, and points at the full text.

The ONLY judgment here is timing-of-availability (which you endorsed as a valid
axis): the law token *names* and the git gate are listed because they must be
interpretable / must fire at session start regardless of content — NOT because
any prose was judged more or less active than any other. No activeness call is
made anywhere in this proposal.

Open question this proposal turns into a TEST (not an assumption): does an
on-demand skill holding `full-instructions.md` load reliably enough that the
behavior you've seen survives? That is measurable, and proposal M measures it.
-->

# Architecture Instructions — Loader

Your full architectural instructions (the laws, the design mindset, the cost
framing, the guidelines, and the operational rules) live in the
**`architecture`** skill / `full-instructions.md`. Engage them on every task that
involves design or code. They are not optional background — they are how work is
done here.

**Law citation vocabulary** (so `[LAW:<token>]` markers are interpretable without
loading the full text): `types-are-the-program`, `dataflow-not-control-flow`,
`one-source-of-truth`, `single-enforcer`, `one-way-deps`, `one-type-per-behavior`,
`verifiable-goals`, `comments-explain-why-only`, `locality-or-seam`,
`no-defensive-null-guards`, `no-shared-mutable-globals`, `no-mode-explosion`,
`behavior-not-structure`. Definitions and rationale: in the full text.

**Always-fire workflow gate** (timing, not activeness): before any code work —
clean tree → `checkout master` → `pull --rebase` → HARD GATE 0 ahead/0 behind or
STOP → branch → work → PR; the moment a PR opens, invoke `/address-pr-reviews`.

> Everything else — why the laws hold, the full constraint-design philosophy, the
> intrinsic-vs-carrying-cost argument, every guideline — is one hop away in the
> full instructions. Read them when starting any non-trivial task.
