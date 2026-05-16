---
name: address-pr-reviews
description: Address open PR review findings with judgment — read each finding from Copilot's session reasoning, decide whether the feedback is right, fix or push back, resolve, and trigger a re-review. Repeat until clean. Use when the user says "address the PR review", "handle the review threads", "go through the review comments", or asks to respond to PR feedback on a specific PR or the current branch's PR.
---

# Address PR Review Findings

Read Copilot's review findings, address each one, trigger a re-review, repeat until clean.

[LAW:one-source-of-truth] Copilot's session reasoning is the canonical source of findings. The thread API exposes only the subset Copilot chose to post inline; suppressed findings (dropped under the inline-comment cap) exist only in the reasoning. There is one source, not two — `fetch` returns every finding with its thread metadata joined in.

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

### 2. Fetch Copilot's review findings

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py fetch "$PR_URL"
```

Emits canonical JSON: every finding from Copilot's latest session, each tagged with `thread_id` (non-null = posted as inline thread; null = suppressed) and `is_resolved` (non-null iff `thread_id` is non-null).

Schema:

```json
{
  "session_id": "...",
  "overview": { "phrase_present": true, "comment_count": 5, "raw": "..." },
  "findings": [
    {
      "file": "path/to/file.py",
      "line_start": 42,
      "line_end": 42,
      "body": "...",
      "comment_type": "issue",
      "severity": "high",
      "fixed": false,
      "thread_id": "PRRT_xyz...",
      "is_resolved": false
    }
  ]
}
```

**Unresolved findings** = every entry where `thread_id` is null OR `is_resolved` is false. If the unresolved findings list is empty, **the loop is done**. Step 1 already guaranteed no Copilot review is in flight, so empty is unambiguous. Report the PR is ready for the user to merge. **Don't merge yourself.**

> **Suppressed-finding count.** `overview.comment_count` is the number of findings Copilot generated this session. If you see fewer `findings` than that, Copilot truncated its own output mid-stream — surface the discrepancy to the user. If `comment_count` exceeds the inline-comment cap, expect suppressed findings (`thread_id: null`) in the list.

### 3. For each unresolved finding

Open the file at `file:line_start`. Read `body`. Classify:

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

**`thread_id` is null (suppressed)** — there is no thread to reply on or resolve. Apply the code change directly (for `valid`/`different_fix`) and record the finding in your final report. The commit message is the durable record. Do **not** fabricate an inline thread to "post" a suppressed comment to.

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
