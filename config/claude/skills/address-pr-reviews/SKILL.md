---
name: address-pr-reviews
description: Address open PR review threads with judgment — read each thread, decide whether the feedback is right, fix or push back, resolve, and trigger a re-review. Repeat until clean. Use when the user says "address the PR review", "handle the review threads", "go through the review comments", or asks to respond to PR feedback on a specific PR or the current branch's PR.
---

# Address PR Review Threads

Read the PR, address the comments, trigger a re-review, repeat until clean.

## Setup — derive PR_URL, OWNER, REPO, PR_NUM once

If the user didn't give you a PR number, infer it:

```bash
PR_URL=$(gh pr view --json url --jq .url)
```

Then extract the three pieces every step below uses:

```bash
read -r OWNER REPO PR_NUM < <(echo "$PR_URL" | sed -E 's#.*github\.com/([^/]+)/([^/]+)/pull/([0-9]+).*#\1 \2 \3#')
```

All subsequent commands use `$OWNER`, `$REPO`, `$PR_NUM`, and `$PR_URL`.

## The loop

Repeat until **step 2 returns zero unresolved threads**:

### 1. Wait for any in-flight Copilot review to finish

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py wait "$PR_URL"
```

This is idempotent — if no review is in flight, it exits immediately. If one is in flight, it blocks until Copilot is removed from `reviewRequests`. That's the only authoritative signal that a review is submitted. Don't trust event-stream stability, stored-comment counts, or how recent the latest review object looks.

### 2. Fetch unresolved review threads

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$num:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$num){
      reviewThreads(first:100){
        nodes{ id isResolved path line
          comments(first:20){ nodes{ author{login} body createdAt } } } } } } }
' -F owner="$OWNER" -F repo="$REPO" -F num="$PR_NUM" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)]'
```

If the result is `[]`, **the loop is done**. Step 1 already guaranteed no Copilot review is in flight, so `[]` is unambiguous. Report the PR is ready for the user to merge. **Don't merge yourself.**

> **Pagination limit.** This query returns up to 100 unresolved threads (and 20 comments per thread). If the response array has exactly 100 entries, there may be more — surface to the user with a count and let them decide whether to triage manually or extend the query. PRs with more than 100 unresolved review threads are pathological and the loop won't try to handle them automatically.

### 3. For each unresolved thread

Open the file at `path:line`. Read the comment body. Decide which bucket the thread falls into:

- **valid** — reviewer is right; apply the fix
- **different_fix** — reviewer identified a real issue but proposed the wrong fix; apply a better one
- **invalid** — reviewer is wrong, or the suggestion violates an architectural law (defensive null guards, silent fallbacks, mode explosion, duplicate enforcement, control-flow in place of data-flow variance, etc.). Push back and **cite the law** (`[LAW:no-defensive-null-guards]`)
- **already_fixed** — resolved by a later commit; note and resolve

For each thread, post a proposal reply (your plan), apply the code change if warranted, post a resolution reply (what you did or why you won't), then resolve the thread:

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

### 4. Commit and push your fixes

Commit messages describe the **why** (architectural concern), not "address review comment" — each commit must stand alone in `git log`. Batch related concerns; separate unrelated.

### 5. Trigger a fresh Copilot review

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py trigger "$PR_URL"
```

`trigger` internally waits for Copilot to register in `reviewRequests` before returning — so the next iteration's step 1 (`wait`) will correctly see the review in flight.

### 6. Go to step 1.

## Optional — inspect Copilot's full reasoning

If you want to see comments Copilot drafted but didn't post (suppressed under the inline-comment cap) or the "generated N comments" overview phrase directly:

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py fetch "$PR_URL"
```

The "generated N comments" phrase is the most reliable count of how many findings the latest review produced; absence of the phrase means the review found nothing (or hasn't finished). The loop already covers this by gating on `wait` + counting unresolved threads — `fetch` is for when you want to read what Copilot was *thinking*.

## Rules

- **Don't merge.** Your job ends when step 2 returns zero unresolved threads after a completed re-review. The user merges.
- **Architectural laws override reviewer authority.** Refuse suggestions that violate `[LAW:...]`. Cite the law in the pushback body — that body is the durable record of why the code is the way it is.
- **Resolve every thread you addressed, including pushbacks.** Automated reviewers don't reply; the pushback comment is the record. Open threads accumulate forever.
- **Don't invent suppressed-comment threads.** If a worthwhile finding lives only in Copilot's session reasoning (no inline thread to reply on), fix it in your commit pass and mention it in your final report.
- **Conflicts between threads** — surface to the user before acting. Don't pick a side silently.
- **Iteration cap.** After 3 full passes that each push code, stop and report. Convergence isn't happening; the user needs to see what's going on.
