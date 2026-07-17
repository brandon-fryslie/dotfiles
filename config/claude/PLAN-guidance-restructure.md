# PLAN: Restructure agent guidance — laws move to /code, media get their own skills

**Status file — temporary.** Owner: bmf. Created 2026-07-12 by a Claude Opus 4.8 session on the new mac.
Delete when every step in "Remaining work" is done and verified.

---

## ⛔ HARD PROHIBITION — the one file you may not open (read before anything else)

**While executing this plan, do not read, open, `cat`, `grep`, `Read`-tool, tail, or
otherwise view the contents of `config/claude/skills/code/SKILL.md`. Do not run
`Skill(code)` or load the code skill by any path.** Not to "check what's there," not to
"confirm coverage," not "just the token list." Zero exposure. This is the single most
important instruction in the file.

Why — this is a mechanism, not a formality:

- That file holds the **distilled** laws: the exact terse artifact this plan exists to
  replace. Reading it anchors your context on its phrasings, and every draft you write
  afterward regresses toward them. You cannot author the effective-style version while
  the distilled version is the freshest thing in your context.
- Loading it as guidance re-creates the **ambient law pressure** that caused the original
  failure. A session with the laws active applies the laws' own aesthetic — dedupe,
  say-it-once, less-code, subtract — to guidance *prose*, which is precisely how the
  effective version was destroyed. Reading the file *about* the failure re-enacts the
  failure; this already happened once, mid-conversation, on this exact document.

**An author who has read that file is compromised for steps 1–3.** If you have already
opened it, run `Skill(code)`, or read its body this session, stop: do not author the
genre reference or the rewrite yourself. Hand off to a fresh session (message-in-a-bottle)
or delegate the authoring to a subagent that has not seen it. Say so plainly — do not
quietly proceed.

What to do **instead** — you still need to know what content must survive, and you get
that without opening the distilled file:

1. The style exemplar `config/claude/CLAUDE.orig.universal-laws.md` is required reading
   (step 2) and safe: its aesthetic is the *target*, so it steers toward the goal, not
   away. Read it in full.
2. For the coverage checklist — the four laws the distillation *added* (`decomposition`,
   `composability`, `carrying-cost`, `effects-at-boundaries`), plus the framing tree,
   token index, citation protocol, parentage links, and recency summary — spawn a
   **throwaway subagent** that reads `skills/code/SKILL.md` in isolation and returns ONLY
   a neutral list: each law token + one plain sentence of what it means. Forbid it from
   returning the distilled prose, its sentences, or its phrasings. You author from the
   `.orig` exemplar + that neutral checklist; you never see the distilled text, and the
   subagent's polluted context is discarded with it.
3. The category-level inventory of what must survive is already written out in step 2
   below. Treat that list plus the neutral checklist as your coverage spec.

**If this guardrail still fails** — a session drifts into distillation despite it, or the
isolation hand-off proves unworkable — the *instructions* are wrong, not the executor.
Record the failure in this file and adjust the plan: stronger placement, a pre-extracted
neutral checklist committed as its own file, or a different division of labor. The user
has explicitly authorized adjusting the plan when the instructions don't work.

---

## The problem this solves (read this first, it is the whole point)

The universal architectural laws — the code-quality guidance in this repo — used to live in
`CLAUDE.md` in a long, redundant, metaphor-heavy form (preserved at
`config/claude/CLAUDE.orig.universal-laws.md`). In a marathon 6+ hour session, Claude and bmf
rewrote it *specifically to be better LLM guidance*: deduplicated, taxonomized, token-efficient,
with a clean derivation tree. The result (the `<universal-laws>` block that lived in
`config/claude/CLAUDE.md` until this restructure, now moved verbatim to
`config/claude/skills/code/SKILL.md`) is a **better specification and a worse prompt**. In
practice the old version drives noticeably better agent behavior.

Root cause, identified 2026-07-12: **the laws were applied to the authoring of the laws
document itself.** The laws' aesthetic — subtraction, deduplication, one-source-of-truth, "the
smooth version has less code" — is correct for *code* and destructive for *behavioral guidance*,
where redundancy, imagery, and rehearsal are load-bearing. The category error was possible
because the laws were pre-wired into every session (always in CLAUDE.md + a hook injecting
"apply the laws to any task" on every user prompt). Under that ambient pressure, any long
session that authors guidance text will drift into distilling it.

Direct evidence, same day: mid-conversation *about this exact failure*, the hook fired on a
request to rewrite the guidance document, and the agent opened its response by designing the
document under `[LAW:one-source-of-truth]` and `[LAW:one-type-per-behavior]` — the failure mode
re-enacted while discussing it. The pre-wiring does not merely fail to help non-code work; it
actively misroutes it.

bmf's framing, verbatim — these are requirements:

> "This guidance ONLY APPLIES TO CODE. Applying the laws themselves to LLM guidance IS the
> failure mode that created the less-functional version."

> "I want a rewritten version that covers the new content but in the old style (effective)."

> "I want you to go all out on this."

## Target end state

| Artifact | Role |
|---|---|
| `config/claude/skills/code/SKILL.md` | **The single home of the laws.** Content rewritten in the effective style (see genre guidance below). Loads for code work only. |
| `config/claude/skills/prompting/` | Existing skill (mirror of Anthropic prompt-eng docs). Gains a **behavioral-guidance genre reference** (e.g. `references/behavioral-guidance.md`) capturing the craft below, and a pointer to it from SKILL.md. |
| `config/claude/skills/prose/` | New skill for human-audience writing. It will be light and simple, and that's fine (bmf: "That is up to me to improve later"). Write it as genuinely useful light guidance — do NOT frame it as a stub, placeholder, or apology. |
| `config/claude/CLAUDE.md` | Operations + skill routing only. **No law content, ever again.** |
| `config/claude/personal-synced/bin/universal-laws-reminder.sh` | Rewritten as a **router** (see step 4). Currently unwired. |
| `config/claude/CLAUDE.orig.universal-laws.md` | Kept permanently as the style exemplar. Not active guidance. |

## Completed in the 2026-07-12 session (this is already done — verify, don't redo)

1. `config/claude/skills/code/SKILL.md` created; the `<universal-laws>` and `<context-specific>`
   (domain bindings) blocks MOVED there verbatim from CLAUDE.md. The content is still the
   "distilled" version — the rewrite is step 2 below.
2. `config/claude/CLAUDE.md` slimmed to skill-routing + OPERATIONS. Inline `[LAW:...]` citations
   stripped from the operations text (they pointed at content no longer in the file).
3. The `universal-laws-reminder.sh` hook entry REMOVED from `config/claude/settings.json`
   (the "do it right" hook remains). The script itself is untouched, awaiting step 4. Do not
   re-wire it before rewriting it — its current text says "apply the laws to any task," which
   is the exact misrouting this plan removes.
4. Committed to master and pushed (working tree = live `~/.claude` config; a branch would be
   reverted by the next session's `git checkout master`).

Also relevant, separate concern: branch `rad-shell-clean-fresh-install` holds an unmerged fix
to `install-rad.conf.yaml` + `scripts/bootstrap-rad-shell.sh` (fresh-machine install). Not part
of this plan.

## Remaining work, in order

### 1. Write the behavioral-guidance genre reference into /prompting

New file, e.g. `config/claude/skills/prompting/references/behavioral-guidance.md`, linked from
that skill's SKILL.md ("when authoring persistent agent guidance — CLAUDE.md files, system
prompts, skill bodies, hooks — read references/behavioral-guidance.md"). Content: the genre
guidance section below, expanded into standing craft knowledge with examples. This exists so
that no future rewrite of guidance depends on a conversation's memory.

**Acceptance:** the reference explains each device with its mechanism (why it works on the
model), includes at least one concrete before/after pair (the laws distillation is the worked
example: cite the .orig and distilled files by path), and states the anti-goals explicitly.

### 2. Rewrite the /code skill body — new content, old style

This is the deliverable bmf asked for ("go all out"). Written ONLY after step 1, judged
against it. Requirements:

- **Content**: everything in the current (distilled) text must survive — all 19 laws, both
  framings, the token index, citation protocol, parentage links ("instance of X"), grouped
  structure, recency summary, domain bindings. The distillation *added real things* the .orig
  lacked (`decomposition`, `composability`, `carrying-cost`, `effects-at-boundaries`, the
  derivation tree); keep them all. (You know this inventory from the neutral checklist
  and from this plan — **never** by reading `skills/code/SKILL.md`; see the HARD
  PROHIBITION at the top.)
- **Style**: the .orig file's devices, per the genre guidance below. READ
  `config/claude/CLAUDE.orig.universal-laws.md` IN FULL before writing a word — it is the
  style exemplar, not a content source.
- **Length is not a cost.** Token economy is an anti-goal. The distillation's token savings
  were the false optimization that caused this whole mess.
- **Every law gets the same internal schema** (one schema, 19 instances): statement → image
  (sensory metaphor as retrieval handle) → the moment of temptation (the exact rationalization
  in quotes + the refusal + the redirect) → a one-line diagnostic question → parentage. The
  highest-traffic laws (types-are-the-program, dataflow-not-control-flow,
  no-defensive-null-guards, one-source-of-truth, no-silent-failure, verifiable-goals,
  composability) additionally get worked WRONG/RIGHT examples. Preserve the .orig's viewport
  WRONG/RIGHT dialogue and the BAD/GOOD assistant-quote example for verifiable-goals verbatim
  or near-verbatim — they are battle-tested.
- A strong real-world example available for one-source-of-truth: on 2026-07-12 the rad-shell
  upstream installer (`curl … install.sh | bash` in install-rad.conf.yaml) wrote
  `~/.rad-plugins` *through* a dotbot symlink and silently clobbered the tracked, curated
  `config/rad-plugins.home` — two writers, one file, real data loss, caught only because the
  laws-primed session ran `git status` and read the diff. Generalize as needed.

**Acceptance:** a reader can point, for each law, at its metaphor, its temptation script, and
its diagnostic; nothing from the content inventory is missing (checked against the neutral
coverage checklist from the isolation subagent — never against the distilled file itself;
see the HARD PROHIBITION at the top); the file
reads as rhetoric aimed at the moment of decision, not as a reference taxonomy.

### 3. Create the /prose skill

`config/claude/skills/prose/` for human-audience writing (docs, READMEs, reports, messages).
Light and simple **by design** — a page of honest, useful guidance beats a scaffold. bmf will
evolve it. Add it to CLAUDE.md's routing block when it exists.

### 4. Rewrite the reminder hook as a router, then re-wire it

`universal-laws-reminder.sh` (or a renamed successor — update `install-agent-cli` linking if
renamed; note the file lives under `personal-synced/bin/`): instead of "engage the universal
laws on any task," it instructs: *identify the medium of the deliverable — code → Skill(code),
text an LLM will consume → Skill(prompting), human prose → Skill(prose) — load that skill and
hold its bar; applying one medium's laws to another's artifact is a known failure mode.* Keep
the cooldown machinery and the three variants (user-prompt / read-post / task-pre). The router
text is itself LLM guidance: write it under /prompting. Re-add the settings.json hook entry
only after the text is right.

### 5. Housekeeping

- Mark `CLAUDE.orig.universal-laws.md` with a one-line header: permanent style exemplar,
  not active guidance. Do not delete it.
- Decide fate of `CLAUDE.md.audit-2026-06-09.md` and `claude-md-split-proposals/` (bmf's call).
- Never create `CLAUDE.updated-laws.md` or any second copy of the laws — the skill body is the
  single home; proposals happen on branches, not as sibling files.

### 6. Verify (the goal has a shape; check it)

- Fresh session, code task ("add a function to X"): transcript shows Skill(code) loaded before
  the work; laws cited at callsites.
- Fresh session, prose task ("tighten this README paragraph"): no law engagement, no law
  citations in the output.
- Fresh session, prompt task ("write a subagent prompt for Y"): Skill(prompting) loads.
- After step 4: a test prompt shows the router text injected, correctly worded.
- Optional A/B for the rewrite itself: a small task set with planted violations (a dual-writer
  config, a tempting null-guard, a silent `|| true` fallback); run with distilled-laws vs
  rewritten-laws as context; score catches. This is the only honest way to claim "more
  effective" — two static texts can't prove it.

Open question to resolve during verification: whether user-global CLAUDE.md content reaches
Task() subagents. If it does, moving the laws out of CLAUDE.md changed what subagents inherit;
the subagent-delegation rules (still in CLAUDE.md) already require putting requirements in
every subagent prompt, but confirm whether /code's guidance needs an explicit "include the
relevant laws in code-writing subagent prompts" line.

## Genre guidance: what makes behavioral guidance effective (the payload — step 1 expands this)

The audience for a guidance document is not a scholar of the document. It is a next-token
predictor at a decision point, choosing under competing defaults — "smallest change that closes
the ticket," "add a guard," "wrap it in an if." Guidance wins by out-activating those defaults
at the moment of generation, not by being logically complete. Judged as specs, terse+complete
wins; judged as behavior induced, the devices below win. The distillation failed because it
optimized the first judgment while being deployed for the second.

The devices, each observed working in the .orig file and missing/weakened in the distillation:

1. **Redundancy is amplitude.** Restating one principle in many shapes across the document is
   not flab — each restatement is another feature cluster pointing the same direction, raising
   the odds the principle fires at the decision point. Never deduplicate guidance prose on
   principle. (The distillation treated load-bearing repetition as noise.)
2. **Metaphor is a retrieval handle.** "Run your hand over the code — anything that would snag
   is rough"; crystals vs. smooth blocks. A model recognizes "this is like the rough stone" in
   novel situations far more readily than it re-derives an abstract rule. Abstract-on-abstract
   does not transfer; abstract-cashed-out-as-image does. Every law needs an image.
3. **Rehearse the moment of temptation.** Name the feeling ("when implementation feels hard"),
   quote the rationalization the model will hear itself think ("I'll just handle that case in
   the body"), script the refusal and the redirect. This installs a trigger→response pair at
   the instant of choice. A rule without its temptation script fires only when convenient.
4. **Disarm the counter-arguments by name.** YAGNI, "wrong abstraction worse than duplication"
   — these are the escape hatches used to rationalize the easy path. Leave them standing and
   they get used. The .orig's neolithic-toolmaker passage is the model: engage the objection,
   show its domain of validity, show why it doesn't apply here.
5. **Negative examples are enforceable; positive instructions are ignored.** WRONG/RIGHT pairs,
   BAD/GOOD dialogue, forbidden-pattern lists (`2>/dev/null`, `|| true`, caller-enumerating
   comments). The repo's own subagent-delegation rules already know this; apply it to the
   guidance itself.
6. **Stakes, not calm.** "There is no neutral ground — every commit either adds leverage or
   subtracts it." A calm taxonomy invites treating the laws as reference to consult; stakes
   framing produces a stance to embody.

Also preserve what the distillation got RIGHT — these are compatible with the devices and are
the "new content" that must survive: the canonical token index; the citation protocol
(`[LAW:token]` at callsites — one key per concept, reinforced by use); explicit parentage
("instance of X") forming the derivation tree; the grouped structure (root framings → primaries
→ corollaries by face); the summary-at-recency with verbatim tokens; the four laws it added.

**Anti-goals, explicit:** token economy; elegance-as-terseness; deduplication of principles;
"saying it once, well"; any application of the laws' subtraction aesthetic to the guidance
text. When writing guidance, /prompting is the authority. The laws are the *subject matter*,
never the *style authority*, of the /code skill body.

## Pitfalls for the session executing this plan

- Do the steps in order. Step 2 without step 1 recreates the original failure: a rewrite
  steered by session-local judgment instead of standing craft.
- Do not "improve" the .orig exemplar's devices while porting them. Port the mechanism.
- Do not shorten the rewrite because it "feels bloated." Feeling bloated to a spec-reader is
  the expected texture of an effective prompt.
- Do not re-wire the old hook text, even temporarily.
- If any instruction here conflicts with bmf's live direction, bmf wins; note the deviation in
  this file.
