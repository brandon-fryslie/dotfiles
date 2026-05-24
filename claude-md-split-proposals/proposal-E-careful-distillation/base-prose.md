<!--
PROPOSAL E — CAREFUL DISTILLATION   (file 1 of 2: the CLAUDE.md lines)
Each line below is a hand-distilled compression of one idea from the opening
prose blobs — read carefully, then written to carry the idea with force, not
mechanically truncated. Full original-language treatment of each idea lives in
elaboration-prose.md. (Ideas, not code — restating them at two densities is
intended, not a one-source-of-truth violation.)
-->

# Design Mindset — The Types Are The Program

- **The types are the program** — not a description of it. Get the constraints right and the implementation is forced; the judgment is spent before you type the first function body.
- **Most code is compensation** — defensive checks, branches, and implementation tests exist because a type failed to forbid a bad state. Strip what a stronger type would have enforced and what remains is the real logic, usually tiny.
- **Strongest true theorem** — choose the type that makes every legal state representable and every illegal one unrepresentable; then the compiler enforces it and nothing downstream has to defend.
- **Smooth vs rough** — a surface is smooth when its type is exactly the legal variability and nothing more; smooth blocks compose without adapters and multiply (N→N²), while rough ones crystallize and make every future change pay `feature × roughness`.
- **Rough bits, and "done"** — a rough bit is anything that snags a future change: a one-caller type, a not-quite-right name, a guard for an impossible state, a comment standing in for a missing constraint. Done is when none remain, not when it works.
- **Polishing is subtraction** — every pass should remove material a stronger constraint made unnecessary; if your passes add guards, helpers, or cases, you're patching — crystallizing, not smoothing.
- **Hardness is information** — when the body wants to branch or guard, the upstream type is wrong: a wanted branch is a missing discriminator, a wanted guard is a too-loose upstream. Fix the type instead of compensating in the body.
- **Done = smoother than you found it** — the test isn't "it works" or "tests pass," it's "is the code smoother than I found it?" Every commit adds leverage or adds debt; there is no neutral ground.
- **Mindset above all** — "the smallest change that closes the ticket" skips every polishing pass by definition, and the carrying cost lands silently on the next task. Apply the bar stubbornly, every commit.

# Cost — Intrinsic vs Carrying

- **YAGNI assumes bounded carrying cost** — it's advice about build-now cost, blind to the cost of maintaining and working around a thing forever. That blindness is safe only when features are crystals.
- **Smooth blocks barely cost to carry** — a pure, composable block doesn't couple to callers or constrain future code, and the "feature you might not need" is usually 95% of one you will. It's foundation, not speculation.
- **The economics invert** — crystals optimize build cost and pay unbounded carrying cost; smooth blocks pay a little more up front and ~nothing after, amortized across every future project. Past a skill threshold, building more blocks is cheaper than building fewer.
- **YAGNI scales inversely with skill** — it speaks to features, not substrate. Telling a smith he won't need metalworking because he can't name the tool misses that the metal makes every future tool cheap.
- **Wrong question, right question** — for foundational pieces don't ask "do we need this?" Ask "is this block smooth?" and "is the type the strongest true theorem about its data?" If yes, it earns its keep regardless of today's task.

> Full reasoning, in the original language, broken out idea-by-idea: `elaboration-prose.md`.
