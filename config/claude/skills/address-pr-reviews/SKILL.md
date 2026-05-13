---
name: address-pr-reviews
description: Address open PR review threads with judgment — read each thread, decide whether the feedback is right, fix or push back, resolve, and trigger a re-review. Repeat until clean. Use when the user says "address the PR review", "handle the review threads", "go through the review comments", or asks to respond to PR feedback on a specific PR or the current branch's PR.
---

# Address PR Review Threads

Read the PR, address the comments, trigger a re-review, repeat until clean.

## The loop

If the user didn't give you a PR number, infer it:

```bash
gh pr view --json url --jq .url
```

Then repeat **until step 1 returns zero unresolved threads AND the most recent Copilot review is finished**:

### 1. Fetch unresolved review threads

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$num:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$num){
      reviewThreads(first:100){
        nodes{ id isResolved path line
          comments(first:20){ nodes{ author{login} body createdAt } } } } } } }
' -F owner=OWNER -F repo=REPO -F num=NUM \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)]'
```

If the result is `[]`, **the loop is done**. Report the PR is ready for the user to merge. **Don't merge yourself.**

### 2. For each unresolved thread

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
' -F id=THREAD_ID -F body="Proposal: ..."

# Resolve
gh api graphql -f query='
mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{isResolved} } }
' -F id=THREAD_ID
```

### 3. Commit and push your fixes

Commit messages describe the **why** (architectural concern), not "address review comment" — each commit must stand alone in `git log`. Batch related concerns; separate unrelated.

### 4. Trigger a fresh Copilot review

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py trigger <PR_URL>
```

### 5. Wait for it to finish

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py wait <PR_URL>
```

`wait` blocks until Copilot is removed from `reviewRequests` — that's the only authoritative signal that a review is submitted. Don't trust event-stream stability, stored-comment counts, or how recent the latest review object looks.

### 6. Go to step 1.

## Optional — inspect Copilot's full reasoning

If you want to see comments Copilot drafted but didn't post (suppressed under the inline-comment cap) or the "generated N comments" overview phrase directly:

```bash
~/.claude/skills/address-pr-reviews/copilot-review.py fetch <PR_URL>
```

The "generated N comments" phrase is the most reliable count of how many findings the latest review produced; absence of the phrase means the review found nothing (or hasn't finished). The agent already covers this by gating on `wait` + counting unresolved threads — `fetch` is for when you want to read what Copilot was *thinking*.

## Rules

- **Don't merge.** Your job ends when step 1 returns zero unresolved threads after a completed re-review. The user merges.
- **Architectural laws override reviewer authority.** Refuse suggestions that violate `[LAW:...]`. Cite the law in the pushback body — that body is the durable record of why the code is the way it is.
- **Resolve every thread you addressed, including pushbacks.** Automated reviewers don't reply; the pushback comment is the record. Open threads accumulate forever.
- **Don't invent suppressed-comment threads.** If a worthwhile finding lives only in Copilot's session reasoning (no inline thread to reply on), fix it in your commit pass and mention it in your final report.
- **Conflicts between threads** — surface to the user before acting. Don't pick a side silently.
- **Iteration cap.** After 3 full passes (1 → 5 → 1 → 5 → 1 → 5) that each push code, stop and report. Convergence isn't happening; the user needs to see what's going on.
