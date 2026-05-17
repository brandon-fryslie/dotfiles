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

**Unresolved findings** = every entry where `thread_id` is null OR `is_resolved` is false. If the unresolved findings list is empty, **the loop is done**. Step 1 already guaranteed no Copilot review is in flight, so empty is unambiguous. Report the PR is ready for the user to merge. **Don't merge yourself.**

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

## Rules

- **Don't merge.** Your job ends when step 2 returns zero unresolved findings after a completed re-review. The user merges.
- **Architectural laws override reviewer authority.** Refuse suggestions that violate `[LAW:...]`. Cite the law in the pushback body (for posted threads) or in the commit message (for suppressed findings) — that text is the durable record of why the code is the way it is.
- **Resolve every thread you addressed, including pushbacks.** Automated reviewers don't reply; the pushback comment is the record. Open threads accumulate forever.
- **Suppressed findings get fixed in the commit pass and listed in your final report.** They have no thread; the commit message and the report are the only records.
- **Conflicts between findings** — surface to the user before acting. Don't pick a side silently.
