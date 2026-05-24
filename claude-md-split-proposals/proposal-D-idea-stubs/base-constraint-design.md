<!--
PROPOSAL D — IDEA STUBS (uniform transform)   (file 1 of 2: the base section)
Replaces the <constraint-design> manifesto in CLAUDE.md. Scope: ONLY the initial
big prose blob; the laws/guidelines/operational sections are untouched by this
proposal.

The transform is uniform — every idea keeps its high-level name + exactly ONE
sentence here, and its elaboration moves to elaboration-constraint-design.md.
No idea is judged more active than another; the same map is applied to all nine.
Invariant (machine-checkable): #stubs == #elaboration-sections == 9, 1:1 by ID.
IDs (CD-1..CD-9) match proposal-M-ablation/manifest.md so anchors are single-sourced.
-->

# Design Mindset — The Types Are The Program

The architectural laws below are corollaries of one idea, stated here as nine
linked points. Each point is the *gist*; the reasoning and examples for any point
live in `elaboration-constraint-design.md` under the matching anchor.

- **CD-1 · Types are the program** — Once the constraints are right the implementation is forced and mechanical, so the judgment-work lives in constraint design, not in writing bodies. → [why](elaboration-constraint-design.md#cd-1)
- **CD-2 · Code is mostly compensation** — Most of what looks like writing code is recovering from weak constraints; strip every line that enforces what a stronger type could have, and the remaining logic is usually tiny. → [why](elaboration-constraint-design.md#cd-2)
- **CD-3 · Strongest true theorem** — Choose the strongest theorem about your data that is still true — every legal state representable, every illegal one not — and the type itself does the enforcing the body otherwise would. → [why](elaboration-constraint-design.md#cd-3)
- **CD-4 · Smooth vs rough** — A surface is smooth when its type is exactly the legal variability and nothing more; smooth blocks compose for free (N→N²) while rough ones crystallize and tax every future change. → [why](elaboration-constraint-design.md#cd-4)
- **CD-5 · Rough bits, and "done"** — A rough bit is anything that would snag a future change — a one-caller type, an almost-right name, a guard, a comment standing in for a missing constraint — and the code is done only when none remain. → [why](elaboration-constraint-design.md#cd-5)
- **CD-6 · Polishing is subtraction** — Polishing removes material a stronger constraint made unnecessary; a pass that adds a guard, helper, or case is patching, and growing code means you are crystallizing, not smoothing. → [why](elaboration-constraint-design.md#cd-6)
- **CD-7 · Hardness is information** — When the body feels hard or wants to branch or guard, the upstream constraints are wrong — fix the type (a wanted branch means a missing discriminator, a wanted guard means a too-loose upstream) instead of compensating in the body. → [why](elaboration-constraint-design.md#cd-7)
- **CD-8 · Done = smoother than you found it** — The test of done is not "it works" but "the code I leave is smoother than what I found"; every commit either adds leverage or adds debt, with no neutral ground. → [why](elaboration-constraint-design.md#cd-8)
- **CD-9 · Mindset above all** — Hold this as a mindset, not a checklist: "minimum work to close the task" makes polishing invisible and silently guarantees crystallization, so the bar must be applied stubbornly every commit. → [why](elaboration-constraint-design.md#cd-9)
