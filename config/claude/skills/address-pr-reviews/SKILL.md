---
name: address-pr-reviews
description: Address open PR review threads with judgment — read each thread, decide whether the feedback is actually the right move, comment with a proposed solution, apply the fix (if warranted), comment with the resolution, and resolve the thread. Use when the user says "address the PR review", "handle the review threads", "go through the review comments", or asks to respond to PR feedback on a specific PR or the current branch's PR.
---

# Address PR Review Threads

Work through every unresolved review thread on a PR with judgment. **Do not blindly implement review feedback** — reviewers are sometimes wrong, miss context, or suggest changes that conflict with the architectural laws. Think first, then act.

## Inputs

- **PR number** (optional): if not given, infer from current branch via `gh pr view --json number`.
- **Wait duration** (optional): if the user asks you to wait (e.g. "wait 8 min"), sleep that long before fetching threads so new comments have time to land. Use `sleep` in a single background-safe Bash call; do not poll.

## Procedure

### 1. Fetch unresolved review threads

Use the GraphQL API — `gh pr view` does not expose thread resolution state.

```bash
gh api graphql -f query='
query($owner:String!, $repo:String!, $num:Int!) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$num) {
      reviewThreads(first:100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first:20) {
            nodes { author{login} body createdAt }
          }
        }
      }
    }
  }
}' -F owner=OWNER -F repo=REPO -F num=NUM
```

Filter to `isResolved: false`. Keep each thread's `id` — you need it to post replies and resolve.

### 2. For each unresolved thread, decide

Read the full comment chain and the referenced code (`path:line`). Then classify:

- **Valid** — reviewer is right, apply the change.  How do we know it's valid?  Ask these questions: Does the proposed change strengthen the architecture?  Is it aligned with the project goals?  Is it an improvement for users or for the project as a whole?  If so, you should address it as part of this work, BEFORE we merge the code.
- **Valid but different fix** — reviewer identified a real problem but proposed the wrong solution. Apply a better fix.
- **Invalid** — reviewer is wrong, or the suggestion violates the architectural laws (control-flow guards, defensive null checks, mode explosion, duplicate enforcement, etc.). Push back with reasoning.
- **Already fixed** — resolved by a later commit. Just note it and resolve.

**Cite laws when pushing back or when a law shaped your fix.** Reviewers pushing for `if x != nil` guards, silent fallbacks, or new config flags are the common cases where you say no.

### 3. Comment the proposed solution *first*

Before editing code, post a reply on the thread describing what you intend to do (or why you won't). This gives the reviewer a chance to object and creates a record of reasoning.

```bash
gh api graphql -f query='
mutation($threadId:ID!, $body:String!) {
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) {
    comment { id }
  }
}' -F threadId=THREAD_ID -F body="Proposal: ..."
```

### 4. Apply the fix (if warranted)

Edit code. Stage, commit with a message referencing the concern (not the thread ID — threads are ephemeral, commits are forever). Push to the PR branch.

Batch multiple thread fixes into one commit when they're related; separate commits when they touch unrelated concerns.

### 5. Comment the resolution

Reply again on the thread with what you actually did — commit SHA, file/line if it moved, or "not changing because ..." if you rejected the feedback.

### 6. Resolve the thread

```bash
gh api graphql -f query='
mutation($threadId:ID!) {
  resolveReviewThread(input:{threadId:$threadId}) { thread { isResolved } }
}' -F threadId=THREAD_ID
```

Only resolve threads *you* addressed. If you pushed back and the reviewer hasn't responded, leave it unresolved — resolution is their call in that case. Exception: if the user explicitly told you to resolve everything, resolve.

## Rules

- **Never silently ignore a thread.** Every unresolved thread gets either a fix+resolution or an explicit pushback comment.
- **Never blindly apply suggestions.** Reviewer authority does not override architectural laws. If a suggestion would add a defensive null guard, a silent fallback, a new flag without exit plan, or a duplicate enforcement site — refuse and explain.
- **One proposal comment, one resolution comment, per thread.** Don't spam.
- **Commit messages describe the *why*, not "address review comment".** The review thread is context; the commit has to stand alone in `git log`.
- **If threads conflict with each other**, surface the conflict to the user before acting. Don't pick a side silently.

## Output to user

When done, report: threads addressed, threads pushed back on (with reasons), commits pushed, any threads left unresolved and why.
