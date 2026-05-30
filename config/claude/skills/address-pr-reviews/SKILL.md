---
name: address-pr-reviews
description: Address open PR review findings with judgment — read every finding (Copilot session reasoning AND human review threads), decide whether the feedback is right, fix or push back, resolve, and trigger a re-review. Repeat until clean. Use when the user says "address the PR review", "handle the review threads", "go through the review comments", or asks to respond to PR feedback on a specific PR or the current branch's PR.
---

# Address PR Review Findings

Read every pending review finding on the PR, address each one, trigger a re-review, repeat until clean. Same model people use at a real company: handle Copilot's findings AND human-reviewer threads in one pass, push back with reasoning when you disagree, resolve, re-request review.

[LAW:one-source-of-truth] `fetch` is the single source of pending findings for this loop. It aggregates two upstream streams — every Copilot session finding (posted inline or suppressed under the inline-comment cap) AND every open review thread on the PR (Copilot-authored OR human-authored) — and dedupes them by `thread_id`. The agent reads this list; it never queries the threads API or the session logs separately.

## Setup — derive PR_URL, OWNER, REPO, PR_NUM once

If the user didn't give you a PR number, infer it:

```bash
PR_URL=$(gh pr view --json url --jq .url)
read -r OWNER REPO PR_NUM < <(echo "$PR_URL" | sed -E 's#.*github\.com/([^/]+)/([^/]+)/pull/([0-9]+).*#\1 \2 \3#')
```

All subsequent commands use `$OWNER`, `$REPO`, `$PR_NUM`, and `$PR_URL`.

## Bootstrap — ensure a Copilot review exists or is in flight

GitHub auto-triggers a Copilot review when a PR is opened *by an account with an active Copilot subscription*. PRs opened by non-subscriber accounts (e.g. `elton-prawn`) get no auto-trigger, so the loop's step 1 ("wait") would return "nothing to wait for," step 2 ("fetch") would return zero findings, and the loop would exit with the PR un-reviewed.

Run this once at the start, before the loop:

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py ensure "$PR_URL"
```

`ensure` triggers a review **only if** Copilot has never reviewed this PR **and** no review is currently in flight. Idempotent and safe on every PR — for subscription-holder PRs the auto-trigger has typically already fired by the time `ensure` runs, so it no-ops. See `copilot-review.py:cmd_ensure` for the full decision matrix and race-window analysis (between the two checks, a subscriber's auto-trigger can race ours; both POSTs converge on the same "Copilot is requested once" state, so the worst case is one wasted HTTP request, not a corrupted state).

[LAW:dataflow-not-control-flow] `ensure` runs unconditionally; the bootstrap variability lives in the PR's current state (pending? has-reviewed?), not in whether the caller decided to bootstrap. The agent does not branch on "did I just open this PR" or "is this account a subscriber" — the data decides.

## The loop

Repeat until **step 2 returns zero unresolved findings**:

### 1. Wait for any in-flight Copilot review to finish

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py wait "$PR_URL"
```

Idempotent — exits immediately if no review is in flight; blocks until Copilot is removed from `reviewRequests` if one is. That's the only authoritative signal that a review is submitted. Don't trust event-stream stability, stored-comment counts, or how recent the latest review object looks.

### 2. Fetch all pending review findings

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py fetch "$PR_URL"
```

Emits canonical JSON: every Copilot session finding **plus** every open review thread on the PR (including human-reviewer threads), deduped by `thread_id`. The `source` discriminator tells you which stream produced each entry. `session_id` is `null` if Copilot hasn't reviewed yet — that's fine; human threads still surface.

Schema:

```json
{
  "session_id": "...",
  "overview": { "phrase_present": true, "comment_count": 5, "raw": "..." },
  "findings": [
    {
      "source": "copilot_session",
      "file": "path/to/file.py",
      "line_start": 42,
      "line_end": 42,
      "body": "...",
      "author": "copilot-pull-request-reviewer",
      "comment_type": "issue",
      "severity": "high",
      "fixed": false,
      "thread_id": "PRRT_xyz...",
      "is_resolved": false,
      "thread_comments": [
        {"author": "copilot-pull-request-reviewer", "body": "..."},
        {"author": "alice", "body": "actually I disagree because..."}
      ]
    },
    {
      "source": "review_thread",
      "file": "path/to/other.py",
      "line_start": 7,
      "line_end": 7,
      "body": "Please rename this — it shadows a stdlib name.",
      "author": "alice",
      "comment_type": null,
      "severity": null,
      "fixed": false,
      "thread_id": "PRRT_abc...",
      "is_resolved": false,
      "thread_comments": [
        {"author": "alice", "body": "Please rename this — it shadows a stdlib name."}
      ]
    }
  ]
}
```

**Unresolved findings** = every entry where `thread_id` is null OR `is_resolved` is false. If the unresolved findings list is empty, **the loop is done**. Step 1 already guaranteed no Copilot review is in flight, so empty is unambiguous. Proceed to **Finalize** below.

> **Read `thread_comments` before deciding.** A thread may already contain replies (yours from a prior iteration, a human's pushback on Copilot, or a back-and-forth between reviewers). The full chain is in `thread_comments`; the `body` field is just the first comment for quick scanning.

> **Suppressed-finding count.** `overview.comment_count` is the number of findings Copilot generated this session. If you see fewer entries with `source: copilot_session` than that, Copilot truncated its own output mid-stream — surface the discrepancy to the user. If `comment_count` exceeds the inline-comment cap, expect suppressed Copilot findings (`thread_id: null`) in the list.

### 3. For each unresolved finding

Open the file at `file:line_start`. Read `body` and the full `thread_comments` chain. Classification rules are the same regardless of `source` — Copilot findings and human-reviewer threads get the same judgment treatment:

- **valid** — reviewer is right; apply the fix
- **different_fix** — reviewer identified a real issue but proposed the wrong fix; apply a better one
- **invalid** — reviewer is wrong, or the suggestion violates an architectural law (defensive null guards, silent fallbacks, mode explosion, duplicate enforcement, control-flow in place of data-flow variance, etc.). Push back and **cite the law** (`[LAW:no-defensive-null-guards]`)
- **already_fixed** — resolved by a later commit; note and resolve

Process the finding. The action varies by `thread_id`:

**`thread_id` is non-null (posted inline)** — post a proposal reply, apply the code change if warranted, post a resolution reply, then resolve the thread:

```bash
# Reply (proposal or resolution)
gh api graphql -f query='
mutation($id:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){ comment{id} } }
' -F id="$THREAD_ID" -F body="Proposal: ..."

# Resolve
gh api graphql -f query='
mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{isResolved} } }
' -F id="$THREAD_ID"
```

**`thread_id` is null (suppressed Copilot finding — only possible for `source: copilot_session`)** — there is no thread to reply on or resolve. Apply the code change directly (for `valid`/`different_fix`) and record the finding in your final report. The commit message is the durable record. Do **not** fabricate an inline thread to "post" a suppressed comment to. (Entries with `source: review_thread` always have a `thread_id`.)

### 4. Address failing checks

Check the PR for any failing checks. Address them before continuing.

### 5. Commit and push your fixes

Commit messages describe the **why** (architectural concern), not "address review comment" — each commit must stand alone in `git log`. Batch related concerns; separate unrelated.

### 6. Trigger a fresh Copilot review

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py trigger "$PR_URL"
```

`trigger` internally waits for Copilot to register in `reviewRequests` before returning — so the next iteration's step 1 (`wait`) will correctly see the review in flight.

### 7. Go to step 1.

## Finalize — when the loop exits clean

The loop exits with zero unresolved findings after a clean re-review. The PR is reviewed; the work is done. [LAW:single-enforcer] this skill is the single place that closes a PR loop — merge, ticket-close, and recap live here, not scattered across callers or punted to the user. [LAW:dataflow-not-control-flow] finalize runs unconditionally on every clean exit; the data (the PR, the in-progress ticket, the merged commits) is what each step operates on. Per `<ticket-lifecycle>`, the agent owns ticket close-out — Finalize is where that happens. The recap step is the durable handoff to the next agent (its own justification, not something `<ticket-lifecycle>` requires).

[LAW:one-source-of-truth] **follow the tooling's runtime guidance.** Each step's tool (`gh pr merge`, `lit done`, `/recap`) emits its own instructions at runtime — preview tokens, next-step hints, branch-protection messages, admin-bypass prompts, apply-token strings, output paths. The skill describes the *shape* of each step; the tool itself is the authoritative source for *how* to follow through. Read what the tool prints and do what it says — don't paper over a warning, don't guess past a prompt, don't substitute the skill's wording when the tool gave you a literal token or path to use.

### A. Merge the PR

```bash
gh pr merge "$PR_URL" --squash --delete-branch
```

Squash is the repo's configured merge strategy. `--delete-branch` cleans up the remote branch (and the local one if checked out). [LAW:one-source-of-truth] `gh pr merge`'s exit code is the canonical signal of merge success — failure (required checks not satisfied, merge conflict, branch protection) halts Finalize. Don't add a `gh pr view --json merged` check as a second source; the exit code is the truth. At that point the agent's job changes from "close out" to "fix the merge blocker."

### B. Close the lit ticket

```bash
lit done "$TICKET_ID"
```

The ticket is the one this PR closed — pull it from the PR body, branch name, or the ticket you were working on in this session, and assign it to `$TICKET_ID`. The code block above is the canonical case: a confidently identified `$TICKET_ID`. Don't run `lit done` with an empty, guessed, or unverified value. `lit done` is a two-phase transition: the first call prints a preview with an apply token; capture it as `$TOKEN` and rerun with `--apply="$TOKEN"` to commit. For an out-of-band PR with no associated lit ticket, Step B is a no-op — skip the command entirely and note the missing-ticket case in the recap so the next agent sees it.

### C. Recap the merged work

Invoke `/recap` with a short note describing what was merged. The recap is the durable historical record — what shipped, what's left, what to watch out for. It lives in the project's recap log; future sessions browsing history read it there.

### D. Hand off the next session via message-in-a-bottle

The handoff has two terminal forms: fire the bottle (with content shaped by the candidate's classified state) or halt and surface a per-candidate failure table to the user. [LAW:types-are-the-program] the section's output is `Handoff = Bottle(direct_work) | Bottle(define_task) | HaltAndExplain(failure_table)` — variants of one typed value, dispatched mechanically from the classification step. Well-definedness is *not* a fire/no-fire gate; it shapes bottle content. The only halt case is project-level misalignment across every examined candidate.

**These three arms are exhaustive — no "skip," "hold," or "ask instead" arm exists.** The user being present, the step feeling minor, or the `/clear` being disruptive are NOT inputs to this decision. Deviating requires citing a clause *in this skill*; a tool's tone or purpose is never authorization (`message-in-a-bottle`'s "without involving the user" means *requires no user action*, not *only fire when the user is absent*). Absent such a clause the prescribed arm **executes as written** — never a silent skip, never a fallback to asking.

**Step 1 — Enumerate candidates.** Read multiple candidates in priority order:

1. An explicit instruction the user gave during this session for what comes next.
2. A concrete follow-up this PR surfaced and you queued as a ticket.
3. The top entries of `lit ready` — pull at least the top three with `lit show <id>` (or all of them if fewer exist).

A pool is needed because the highest-priority slot may hold work that no longer fits where the project actually is after this PR's epic shipped. The next-best aligned candidate is what the next session should actually start on.

**Step 2 — Classify each candidate.** Each candidate sits in exactly one state:

- **AlignedAndDefined** — aligned with the project's current trajectory AND a fresh session could start without asking the user clarifying questions (acceptance criteria explicit, scope bounded, dependencies met).
- **AlignedButFuzzy** — aligned with the project's current trajectory BUT exploratory or probe-shaped ("explore X", "consider Y", "investigate Z"); the body of work is to *define* the actual work, not to start it.
- **Misaligned** — the candidate's premise no longer matches the project's actual requirements. Common after an epic ships: the queued item assumed an older architecture, depends on a hypothesis the recent work invalidated, expands surface area the user has decided to contract, or opens a strategic thread the user has not validated at the project level.

**What "aligned" means here — project-level, not session-level.** It asks: does this candidate continue the trajectory the project is actually on right now? After an epic ships, work queued before it may need rescoping, re-prioritization, or outright deletion to fit the project's new shape. That's a strategy call the agent cannot make for the user — when no candidate is aligned, the user must intervene before any handoff is meaningful. (Distinct from the prior framing, which read "aligned" as session-level user assent. That predicate was both too narrow — rejecting valid work the user just hadn't blessed by name — and too loose — admitting tickets that became architecturally stale when the prior epic shipped.)

**Step 3 — Dispatch.** Take the highest-priority candidate classified as Aligned (Defined or Fuzzy). Its state shapes the bottle's content:

- **AlignedAndDefined** → bottle the direct work. The next instruction is a precise pointer (ticket ID, acceptance criteria, or `/next` when the candidate is the top of `lit ready`).
- **AlignedButFuzzy** → bottle a define-task. The next session (1) understands the problem the candidate raises, (2) investigates possible solutions, and (3) prepares a proposal for the user that surfaces the important information quickly without burying them in irrelevant detail. Implementation waits on user approval of direction.

Empty aligned-pool (every examined candidate classified Misaligned, or no candidates exist at all) → **HaltAndExplain**. Do not fire a bottle. Surface to the user, in this turn, a per-candidate failure table — the candidate's title/ID and the precise reason it failed (what shipped, what direction the project moved, what the candidate assumed that no longer holds). Vague summaries are unacceptable; the user needs the specifics to rescope, reorder, or close the tickets.

**Step 4 — Fire the bottle** (AlignedAndDefined and AlignedButFuzzy arms):

```bash
~/.claude/skills/message-in-a-bottle/bin/message-in-a-bottle 15 "$(cat <<'EOF'
Last session shipped PR #<num> — <one-line description of what merged>.
<forward-looking notes the next agent should know: in-flight context,
follow-ups this PR surfaced, things to watch out for>

<next instruction — for AlignedAndDefined: a precise pointer (ticket ID,
acceptance criteria) or /next. For AlignedButFuzzy: "Understand the
problem in <ticket>, investigate possible solutions, and prepare a
proposal for the user that surfaces the important information quickly
without burying them in irrelevant detail. Return with the proposal —
do not implement until the user approves direction.">
EOF
)"
```

[LAW:dataflow-not-control-flow] the variability lives in the candidates' classified state, not in whether the agent decided to look or fire. Bottle content (direct vs define-task) and the halt-vs-fire decision are both mechanical consequences of classification — the data picks the variant. Well-definedness in particular is no longer a fire/no-fire gate; it's a content discriminator.

[LAW:one-source-of-truth] when a bottle fires, its content derives from the same authored recap as step C — past-tense canonical form vs forward-looking action, one substrate consumed for two purposes. The bottle script's tmux precondition fails loudly outside tmux — the handoff is meaningless there.

Then stop. The loop is finished, the work is shipped, the recap is filed.

## Rules

- **You own the close-out.** When the loop exits clean, run Finalize (merge, close lit ticket, recap). Don't punt these to the user — `<ticket-lifecycle>` is explicit that the agent closes its own tickets, and a PR that sits open waiting for a human to push the merge button is the same anti-pattern. The bottle handoff (step D) fires whenever an aligned candidate exists in the pool; its content (direct work vs define-task) is shaped by whether the candidate is well-defined. The only halt case is project-level misalignment across every examined candidate — alignment is a strategy question the agent cannot answer on the user's behalf, and that case is surfaced as a per-candidate failure table for the user to act on.
- **Architectural laws override reviewer authority.** Refuse suggestions that violate `[LAW:...]`. Cite the law in the pushback body (for posted threads) or in the commit message (for suppressed findings) — that text is the durable record of why the code is the way it is.
- **Resolve every thread you addressed, including pushbacks.** Automated reviewers don't reply; the pushback comment is the record. Open threads accumulate forever.
- **Suppressed findings get fixed in the commit pass and listed in your final report.** They have no thread; the commit message and the report are the only records.
- **Conflicts between findings** — surface to the user before acting. Don't pick a side silently.
