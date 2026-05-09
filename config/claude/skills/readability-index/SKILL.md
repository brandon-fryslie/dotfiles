---
name: readability-index
description: Score the readability of terminal output, logs, CLI screens, or any dense text-based UI on six orthogonal axes — self-explanatory, signal-to-noise, visual hierarchy, alignment-and-line-fit, state/error prominence, and contextualization — and produce a comparable index out of 10. Use when the user says "rate this output", "readability index", "score the readability", "how readable is X", "compare these logs", "assess this output", or pastes terminal output / a log sample / a TUI screenshot and asks for a quality assessment. Designed for objective comparison between two or more implementations of the same output, so optimization can target the lowest-scoring axes instead of vibes.
---

# Readability Index

A multi-axis rubric for scoring how readable a piece of text-based output actually is. Modeled on a review system (cleanliness 7/10, food 9/10, ambiance 3/10 → total). The point isn't to be philosophically right about readability — it's to produce a **stable, comparable score** so two implementations of the same output can be ranked, and so optimization effort lands on the axis actually dragging the total down.

## The master principle

**A reader should be able to use this output without reading the source code of the program that produced it.**

Every axis below is one of the ways output fails this contract. When two scoring decisions could go either way, return to the master principle: did the reader need to consult the source to know what `cW` means, what `≈` indicates, what gets repeated and what doesn't, where the error is, what unit the number is in? Each "yes" is a readability debt.

## When to use

- "score this output" / "rate the readability" / "readability index"
- "how readable is this log / TUI / CLI / table / report"
- "compare these two outputs and tell me which is better"
- "assess this terminal output"
- The user pastes a chunk of program output and asks for quality feedback that isn't just vibes.

## When NOT to use

- The text is prose — a README, a blog post, a doc page. Use a writing-quality review instead; this skill is calibrated against dense terminal/log/TUI output.
- The user wants help *fixing* the output's source code — score it first with this skill, then move to implementation. Don't conflate scoring and refactoring in one pass.
- The output is a single line of < 80 chars — there isn't enough surface to score most axes meaningfully. Tell the user and ask for a longer sample.

## Inputs the skill accepts

- A pasted chunk of output (preferred).
- A file path (`/var/log/foo.log`, `./build-output.txt`, etc.).
- A screenshot of a TUI / CLI screen (textual axes need the actual text — ask for it if absent).

Color is **not scored.** ANSI escapes that survive in pasted text are noise to be ignored when assessing the textual axes; their presence or absence doesn't enter the score.

## Asking the user for context (only when needed)

Score quality goes up sharply when the audience and use-context are known. Before scoring, if the input doesn't make these obvious, ask **once** in a single message:

1. **Who reads this output?** (oncall engineer scanning during an incident; developer running locally; CI log consumed by humans + automation; end-user of a CLI tool; etc.)
2. **What are they trying to do with it?** (find an error fast; understand current state; verify a build passed; debug a specific subsystem.)
3. **What was this compared against, if anything?** (Old format? Sibling tool? Just looking for an absolute read?)

If the user doesn't want to answer, default to: *audience = developer / oncall engineer; goal = find errors and understand state; absolute scoring, no comparison.* State the assumption in the report.

## The six axes

Each axis is scored 0–10 against the anchors below. The first axis carries the most weight because it most directly enforces the master principle.

### 1. Self-explanatory

Can the reader use the output without consulting source code? Specifically:

- **Abbreviations.** Standard (`s`, `ms`, `MB`, `tps`, `req/s`, `KiB`) or locally invented (`cW`, `qz`, `ctxw`)?
- **Ambiguity.** Could the same token reasonably refer to multiple things in context? (`cW` could be "cache write," "cells written," "completion words," "concurrent workers"…)
- **Symbols.** Are non-textual marks (`↑`, `↓`, `→`, `·`, `≈`, `⟶`) explained somewhere visible — header, legend, first-occurrence note?
- **Legend.** Is there a column header / first-occurrence expansion / footer key that names the cryptic bits before they show up?
- **Field names.** Full words (`cache_write_tokens`) or cryptic (`cW`)?
- **Audience fit.** Terms the named audience already knows vs. terms specific to the implementation.

Anchors:

- **0–2** Cryptic field names, invented abbreviations, and unexplained symbols throughout; no legend. The reader cannot know what tokens like `cW`, `≈`, `↑`, `·` mean without reading the source.
- **3–4** Mix of cryptic and clear; several abbreviations are ambiguous (could mean two things in this context); legend missing or only partial.
- **5–6** Mostly understandable; one or two cryptic tokens that need context but aren't ambiguous; legend implied by header but not explicit.
- **7–8** All terms either standard or expanded on first use; symbols explained; legend or header covers the cryptic bits; identifiers carry meaning.
- **9–10** A reader fluent in the domain understands every line on first read with zero source-code reference. Same concept always has the same name. No ambiguous tokens.

### 2. Signal-to-noise

How much of every line is information vs. ceremony — timestamps the reader doesn't need, PIDs/hostnames/log-levels repeated on every line, ASCII banners, decorative separators, **prefix or label phrases that repeat verbatim across every record without earning their space**.

Anchors:

- **0–2** Most width is mechanical prefix or repeated boilerplate; reader passes 30+ chars before reaching content; the *same* multi-word labels repeat on every record (`ticks crossed this call: 0, ticks crossed total: 3 of 4 needed` on every iteration).
- **3–4** Useful info present but visibly outnumbered by ceremony; multiple repeating prefixes that don't earn their space.
- **5–6** Useful info dominates but ceremony still steals real estate (full timestamp on every line where deltas would suffice).
- **7–8** Tight; almost every character does work; ceremony only where it earns it (errors keep their timestamp, routine info doesn't).
- **9–10** Every line carries information that can't be removed without loss; ceremony lives in headers/footers, not per-line.

### 3. Visual hierarchy & density

Can a reader skim and find what matters? Headers, sections, blank lines used as grouping, indentation, and whether **density** is right (not a wall of text, not so sparse the eye gets lost).

Anchors:

- **0–2** Wall of unbroken text *or* one fact per page with vast blank spaces; no skim path; reader has to read every line to find anything.
- **3–4** Some structure (occasional blank lines, ad-hoc headers) but inconsistent; reader can't predict where to look.
- **5–6** Clear sections, but density is wrong somewhere (too sparse in patches, too dense in others, or section breaks not honored consistently).
- **7–8** Skimmable: headers / indentation / sectioning guide the eye; density tuned so a screenful holds a meaningful unit of work.
- **9–10** Reader finds any specific piece in <2 seconds; density mirrors the mental model (one record per logical unit, related things grouped).

### 4. Alignment, structure & line-fit

Tabular consistency, predictable record shape, and — critically — **lines fit in a reasonable terminal width without wrapping**. Wrapped columnar data destroys readability; this is a hard-fail criterion.

Default reference widths: 120 cols (modern terminal), 100 cols (split pane), 80 cols (legacy / log viewer). Score against the audience's likely environment if known; otherwise penalize wrapping at 120 hard, at 100 moderately, at 80 lightly.

Anchors:

- **0–2** Lines wrap on a 120-col terminal **or** tables drift / columns don't line up **or** records have variable shape with no predictable place to look. Nested data shown only as `a.b.c.d.e` paths.
- **3–4** Most lines fit 120 but several wrap; tables mostly align but drift on long values; nesting flattened to dotted paths even when a tree would help.
- **5–6** Lines fit 120; tables align; record shape recognizable; doesn't visually expose nesting where it would matter.
- **7–8** Lines fit 100; records have predictable shape; columns align under headers; nesting shown with indentation or a tree.
- **9–10** Lines fit 80 comfortably; layout so consistent the reader's eye lands on the right column without thinking; nesting is structural, not encoded in strings.

### 5. State & error prominence

Do errors / warnings / successes stand out from happy-path noise? Is there a severity ladder? Is there a summary that calls failures out so they aren't buried?

Without color (which this skill ignores), state must be carried by **position, symbols, severity tokens, and summaries** — not chroma.

Anchors:

- **0–2** Errors and successes look identical; failures buried mid-stream with no signal; no summary; you'd miss the error in 200 lines.
- **3–4** Errors marked with a token (`[ERROR]`) but the token isn't visually distinct enough to spot in a stream; no consolidating summary.
- **5–6** Individual errors stand out (symbol + severity word + position); severity ladder partial; no summary tying multiple failures together.
- **7–8** Severity levels visually distinct via symbols/words/indentation; errors easy to spot; summary at top or bottom consolidates failures.
- **9–10** A failure is impossible to miss; severity ladder is unambiguous and consistently used; summary names exact count, identities, and where to look.

### 6. Contextualization

Numbers have units. Durations have scale. IDs say what they identify. Timestamps are absolute when needed and relative when useful. Acronyms expand on first use or live in a legend. The reader never has to ask "of what?" or "what unit?".

Anchors:

- **0–2** Bare numbers with no units; raw IDs floating without context; absolute ISO timestamps where deltas would matter (or vice versa); no legend.
- **3–4** Some context but inconsistent (some numbers have units, some don't; some IDs labeled, some bare).
- **5–6** Most numbers have units; most IDs labeled; some still ambiguous; timestamps OK most of the time.
- **7–8** Units, scales, ID-types all explicit; timestamps in the format that matches the use case; durations human-readable when appropriate.
- **9–10** Every number self-describes; every ID names what it identifies; the reader never has to look up what a value refers to.

## Calibration anchors (real examples)

These are concrete examples scored against the rubric. When in doubt about what a band feels like, compare to these.

### Anchor A — heavily fails axis 1, marginal on axis 4 (rated low)

```
│  #001  large    4.2s   5h 43→44% ↑   in 1,847  out 12  cW 145,000  ≈292,000  │
│  #002  large    4.0s   5h 44→45% ↑   in 1,853  out 11  cW 145,200  ≈292,300  │
│  #003  large    4.1s   5h 45→45% ·   in 1,844  out 13  cW 145,100  ≈291,058  │
```

Scores:
- **Self-explanatory: 1/10.** `cW` is invented, `≈` is unexplained, `↑` vs `·` semantics aren't stated, `5h` ambiguous (5-hour window? 5 hours into something?), `large` and `micro` are unexplained size classes, `in`/`out` lack a noun. No legend or header. Reader must read source to know any of this.
- **Alignment & line-fit: 5/10.** Columns align but the line is right at the edge of 120 cols; wraps on smaller terminals.
- **Signal-to-noise: 7/10.** Compact — at least the noise *isn't* there.

### Anchor B — heavily fails axis 2, marginal on axis 1 (rated low)

```
[08:46:20] iteration 37: prompt size micro, took 3.7 seconds
  5h window: utilization 24%, ticks crossed this call: 0, ticks crossed total: 3 of 4 needed, input-equivalent tokens until next tick: ~0
  7d window: utilization 11%, ticks crossed this call: 0, ticks crossed total: 0 of 2 needed, input-equivalent tokens until next tick: ~747,202
  tokens used this call: input 5, output 7, cache read 6,025, cache write 8,473 (input-equivalent total: 17,588)
[08:46:24] iteration 38: prompt size micro, took 3.9 seconds
  5h window: utilization 24%, ticks crossed this call: 0, ticks crossed total: 3 of 4 needed, input-equivalent tokens until next tick: ~0
```

Scores:
- **Signal-to-noise: 2/10.** Multi-word labels (`ticks crossed this call:`, `input-equivalent tokens until next tick:`, `cache read`, `cache write`) repeat verbatim every iteration. Most of the line width is the *label*, not the value.
- **Alignment & line-fit: 2/10.** Lines clearly exceed 120 cols; will wrap on standard terminals; the data is positionally inconsistent (no columns).
- **Self-explanatory: 6/10.** It is at least *legible* — `cache read`, `cache write`, `5h window`, `utilization` are full words. Not great (`tick` is a domain term unexplained, `input-equivalent` glossed over) but a reader can mostly figure it out from words alone.
- **Visual hierarchy: 3/10.** The 4-line-per-iteration block is sparse and similar across iterations; no skim path.

The lesson the two anchors carry together: **compactness alone isn't readability and verbosity alone isn't readability**. Anchor A is compact-but-cryptic, Anchor B is verbose-but-redundant. Both rate low for opposite reasons, so the rubric must let them fail on different axes.

## How to score

For each axis, in order:

1. **Pick a band** ("This is in the 3–4 band — most numbers have units but several bare counts in the table"). Only after picking the band, choose the integer inside it.
2. **Cite a concrete example from the input** — the literal token / line that justifies the score. If the input has no example for the axis (no errors at all when scoring State Prominence), score against what *would* happen if there were errors and note the inference.
3. **Note one specific change** that would lift the axis by one band. Don't propose redesigns — propose the smallest move.

If two bands apply (output has features of a 4 and features of a 7), score the **lower** band and note the inconsistency in the rationale. Inconsistency is itself a readability problem.

## Output format

Fixed structure so two assessments are comparable side-by-side. Don't deviate — comparability is the whole point.

```
# Readability Index: <short label of what was assessed>

Audience / context: <one line — copy from user, or note assumed default>
Sample size: <N lines, M screens>
Reference width assumed: <80 / 100 / 120 cols, based on audience>

| Axis                                | Score | Rationale (one line, with quoted example)                |
|-------------------------------------|-------|----------------------------------------------------------|
| 1. Self-explanatory                 | x/10  | <band + example>                                         |
| 2. Signal-to-noise                  | x/10  | <band + example>                                         |
| 3. Visual hierarchy & density       | x/10  | <band + example>                                         |
| 4. Alignment, structure & line-fit  | x/10  | <band + example>                                         |
| 5. State & error prominence         | x/10  | <band + example>                                         |
| 6. Contextualization                | x/10  | <band + example>                                         |

Overall: X.X / 10   (sum: YY / 60)

## Top 3 fixes that would move the needle
1. <smallest concrete change>  →  axis <n> band <a→b>, expected total +X.X
2. <smallest concrete change>  →  axis <n> band <a→b>, expected total +X.X
3. <smallest concrete change>  →  axis <n> band <a→b>, expected total +X.X

## Notes
<anything the rubric didn't capture: confidence caveats, sample-size warnings,
 audience caveats, axis trade-offs (e.g., increasing density costs hierarchy)>
```

Top-3 fixes must be concrete enough to implement without follow-up. "Improve hierarchy" is not a fix; "Insert a blank line and a `── <suite name> ──` header before each test-suite block" is.

## Comparing two outputs

When the user provides two samples (old vs. new, A vs. B), produce **two reports back-to-back with identical format**, then a third section:

```
## Delta: <A> → <B>

| Axis                                | A     | B     | Δ     |
|-------------------------------------|-------|-------|-------|
| 1. Self-explanatory                 | 6/10  | 8/10  | +2    |
| ...

Total: A=X.X, B=Y.Y, Δ=+Z.Z

## Where B beat A
- ...

## Where B regressed against A
- ...
```

A version that improves four axes by 1 each and tanks one by 4 is *not* an improvement to the reader who depends on that axis. Surface regressions even when the total went up.

## Calibration discipline

- **Always quote the example** from the input. If you can't quote, you can't score.
- **Always name the band** before picking a number inside the band.
- **Don't average sub-impressions across the axis.** If alignment is great in one section and broken in another, score the lower band and note the inconsistency. Averaging hides problems.
- **Don't penalize the same defect on multiple axes.** If a wrapping line is hurting axis 4, don't also dock axis 3 for "hierarchy ruined." Note the link in the rationale and score on the axis where the *root* defect lives.

## Anti-patterns to catch yourself doing

- **Scoring against your own taste.** "I prefer JSON" is bias, not rubric. Score against what the named audience needs to do with the output.
- **Punishing density.** Dense output isn't bad output. `top` and `htop` are dense and excellent. Score density against whether the reader can extract what they need, not against how packed it looks.
- **Letting compactness compensate for cryptic-ness, or verbosity compensate for redundancy.** Compact-but-cryptic and verbose-but-redundant both fail readability — see Anchor A and Anchor B. Score each axis separately.
- **Top-3 fixes that are redesigns.** A fix is something a developer can do in <1 hour without rethinking the architecture. "Switch to a tabular format" is a redesign. "Replace the 23-char ISO timestamp with `+1.2s` deltas on routine lines and full timestamps only on errors" is a fix.
- **Pretending you scored when you guessed.** If sample size is too small for an axis (no tables to assess alignment), say so and skip; don't fabricate a number.

## Iteration

This skill is meant to be tweaked. The defaults above are a starting point.

- If the user wants to amend the rubric mid-conversation ("add an axis for X" / "drop axis Y" / "weight Z double"), apply the change to **all subsequent runs in this session** and re-score the prior baseline so totals stay comparable. Tell them you re-scored.
- Default weighting is equal across all 6 axes. The user may state custom weights; if so, apply consistently.
- If a band description doesn't match what the user means by "good," prompt them to refine the wording, then update this file (`~/.claude/skills/readability-index/SKILL.md`).

## Success criteria

A run succeeded when:

1. Every axis carries a band-anchored score with a quoted example from the input.
2. The overall total comes from a stated arithmetic (sum / 60).
3. The Top 3 fixes are concrete enough to implement without follow-up questions.
4. When comparing two outputs, regressions are surfaced even when the total improved.
5. A reader of the report can predict which lines of the input drove each score without re-reading the input.
