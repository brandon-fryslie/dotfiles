---
name: adversarial-review
description: Run an adversarial AI code review on a PR (default model sonnet) that posts a formal GitHub review with inline resolvable threads, then drive the address-pr-reviews loop until clean — every finding fixed or pushed back, resolved, and re-reviewed. Use when the user says "adversarial review", "run a hostile review on this PR", "tear this PR apart and fix what it finds", or wants an AI reviewer plus the full loop-until-clean workflow on the current branch's PR or a given PR.
---

# Adversarial Review — review, then loop until clean

Run a hostile reviewer agent over the PR, land its findings as ordinary GitHub
review threads, and then address them with the standard loop. This skill is an
*entry point*, not a workflow: the review backend is the `adversarial`
provider, and the loop is the `address-pr-reviews` skill, unchanged.

[LAW:single-enforcer] the loop-until-clean behavior — trigger, wait, fetch,
classify, fix-or-push-back, resolve, re-review, finalize — is owned by
`address-pr-reviews`. This skill never reimplements any of it. If the loop
needs to change, it changes there, for every provider at once.

## 1. Derive the PR

If the user named a PR, use it. Otherwise the current branch's PR:

```bash
PR_URL=$(gh pr view --json url --jq .url)
```

If there is no PR yet, create one first (`gh pr create`) — the reviewer needs
review threads to land on, and threads exist only on a PR.

## 2. Pick the model

Default is `sonnet`. Only when the user explicitly asked for a different
model, export `ADVERSARIAL_REVIEW_MODEL=<model>` in **every** Bash invocation
that calls the provider — shell state does not persist between tool calls.
[LAW:no-mode-explosion] this is the skill's only knob; everything else rides
the provider contract.

## 3. Run the address-pr-reviews loop with the adversarial provider

Invoke the `address-pr-reviews` skill now and follow it exactly — preflight,
the loop, and Finalize — with one substitution: load the provider by explicit
name so the session is pinned without touching the global default
([LAW:no-shared-mutable-globals] — `provider.json` stays whatever it was):

```python
import provider_loader
provider = provider_loader.get("adversarial")
```

Provider behavior you should expect while driving the loop:

- `CAPABILITIES = {resolve: True, trigger: True, setup_check: True}` — you
  call `provider.trigger(PR_URL)` at the top of every iteration; pushing does
  **not** re-run this reviewer.
- `trigger` is synchronous and idempotent per head SHA: it runs the reviewer
  agent, posts one `COMMENT` review carrying a SHA marker, and returns
  immediately on a SHA it already reviewed. An iteration that only resolved
  threads (no new commit) therefore re-enters `fetch` at no cost.
- `wait` verifies the marker review exists for the current head SHA and
  raises if it doesn't — a missing review halts the loop loudly, it never
  reads as a clean pass. [LAW:no-silent-failure]
- `fetch`/`resolve` operate on GitHub review threads, so human reviewer
  threads and adversarial-agent threads flow through the same loop with no
  special cases. [LAW:dataflow-not-control-flow]
- Findings the reviewer could not anchor to a diff line appear in the review
  *body* under "Findings outside the diff" — read that section once per
  iteration and address those findings too; they have no thread to resolve,
  so your commit + the review body annotation is their record.

The loop's exit condition, finalization (merge, lit ticket, recap, handoff),
and all judgment rules are `address-pr-reviews`'s, verbatim. Convergence is
the same contract: `fetch` returns zero unresolved findings after a completed
review of the current head SHA. [LAW:verifiable-goals]
