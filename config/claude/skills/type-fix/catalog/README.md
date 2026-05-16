# Type-Fix Catalog

A growing catalog of real type-fix examples from real codebases. **Not** a catalog of patterns or abstract rules — verbatim code, the diagnosis, the verbatim fix, and the explanation of why the fix is correct.

## Purpose

These entries exist so a future agent (or a future you) can recognize a structurally identical problem in a different codebase and follow a known-good resolution rather than re-deriving it.

The catalog is most useful when its entries are concrete and unfiltered. Reading "here is the actual broken code" and "here is what the fix actually was" is far more useful than reading a paraphrased rule, because the rule is what the reader's brain is supposed to extract on its own from seeing several concrete cases.

## Format of each entry

Each entry is a single markdown file with five sections:

1. **What the problematic code looked like** — verbatim. Copy the code, don't paraphrase.
2. **Why it is problematic even though the typecheck technically passes** — what the type-system harm actually is, what the casts/`any`s are paying for, what bug or fragility the type lie is hiding.
3. **Broader symptoms that could indicate this sort of issue** — surface signs that point at this kind of problem.
4. **The correct way to resolve it** — verbatim of the actual fix that was applied. Not "what a fix would look like" — what was actually written and committed.
5. **Why it's correct** — the specific properties of the fix that resolve the misalignment, not generic praise.

Provenance (file path, repo, date) at the top. Verification (typecheck/test results after the fix) at the bottom.

## How to use the catalog

- **Before starting a session**: scan entry titles. If one matches the symptom you're looking at, read it before touching any code.
- **During a session**: when you reach for a cast / `any` / `unknown` / generic-constraint-with-`any`, check whether any entry's diagnosis matches.
- **At the end of a session**: if you discovered something that isn't here, add an entry — but only after the fix is actually applied and verified, so the "after" code is real, not aspirational.

## Entries

- [deepmerge-generic-iteration.md](./deepmerge-generic-iteration.md) — `function deepMerge<T extends Record<string, any>>(...)` walking PowerlineConfig keys. Replaced with named-field typed merger.
