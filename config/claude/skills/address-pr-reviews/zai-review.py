#!/usr/bin/env python3
"""Z.ai PR review helper — three operations.

  wait <PR_URL>       — block until the z.ai review workflow run for the PR's
                        current head SHA has completed; print its conclusion.
  fetch <PR_URL>      — dump every open review thread on the PR as canonical JSON.
  resolve <THREAD_ID> — resolve one review thread and fail loudly unless GitHub
                        confirms it stuck.

The z.ai reviewer is a GitHub Action (brandon-fryslie/zai-coding-agent-review),
not a requested reviewer. Its lifecycle owner is therefore the *workflow run*,
not `reviewRequests`. [LAW:no-ambient-temporal-coupling] `wait` blocks on that
one owner — the run keyed to the current head SHA — never on event-stream
timing or comment counts.

Its findings land as a formal PR review (`pulls.createReview`) with inline
comments, i.e. ordinary resolvable review threads. So there is no separate
"session" stream to join: review threads ARE the findings. [LAW:one-source-of-truth]
`fetch` reads the threads and nothing else; the agent never queries elsewhere.

Replies the agent posts with `gh api graphql` directly — the body is judgment,
not mechanism. Resolution goes through `resolve` instead: not because the mutation
is hard, but because resolution is the step agents silently drop, and a raw
mutation whose `isResolved` return is discarded makes a skipped resolve, a failed
resolve (permissions, vanished thread), and a real one all look identical.
[LAW:single-enforcer] resolution has one verified path; [LAW:no-silent-failure]
it exits non-zero unless GitHub confirms the thread is resolved.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time

# The workflow file the zai-pr-review skill writes. [LAW:one-source-of-truth]
# this filename is that skill's output contract; if it changes there, it
# changes here — there is no second place that names the workflow.
WORKFLOW_FILE = "code-review.yml"

# Two distinct deadlines for two distinct faults — the deadline is derived from
# observed run state, not a single wall. If no run registers within the short
# window the workflow almost certainly isn't installed; fail fast and point at
# /zai-pr-review. Once a run exists and is progressing, a deep review can run a
# long time, so wait it out to the generous ceiling before calling the runner
# wedged. Either way: loud failure, never a silent infinite wait.
REGISTER_TIMEOUT_S = 300
COMPLETION_TIMEOUT_S = 3600
POLL_INTERVAL_S = 8


def _gh(*args: str) -> str:
    """Run `gh` with stderr captured so main()'s handler can surface it as the
    one error line. [LAW:single-enforcer] every shell-out goes through here."""
    return subprocess.check_output(
        ["gh", *args], text=True, stderr=subprocess.PIPE
    ).strip()


def parse_pr(url: str) -> tuple[str, str, int]:
    import re
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    if not m:
        raise ValueError(f"Not a PR URL: {url}")
    return m.group(1), m.group(2), int(m.group(3))


# ---------------------------------------------------------------------------
# fetch — open review threads as canonical findings
# ---------------------------------------------------------------------------

def fetch_review_threads(owner: str, repo: str, pr_num: int) -> list[dict]:
    query = (
        "query($owner:String!,$repo:String!,$num:Int!){"
        "  repository(owner:$owner,name:$repo){"
        "    pullRequest(number:$num){"
        "      reviewThreads(first:100){"
        "        nodes{ id isResolved path line"
        "          comments(first:20){ nodes{ author{login} body } } } } } } }"
    )
    out = _gh(
        "api", "graphql",
        "-f", f"query={query}",
        "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"num={pr_num}",
        "--jq", ".data.repository.pullRequest.reviewThreads.nodes",
    )
    return json.loads(out) if out else []


def build_findings(threads: list[dict]) -> list[dict]:
    """Every open-or-resolved review thread becomes one finding.

    [LAW:dataflow-not-control-flow] one shape for every finding — z.ai-authored
    and human-authored threads are the same primitive, distinguished only by the
    `author` value, never by a separate code path. There is no thread-less
    finding: a z.ai review comment is always a thread, so `thread_id` is always
    present and the consumer never branches on its absence.
    """
    findings: list[dict] = []
    for t in threads:
        nodes = t.get("comments", {}).get("nodes") or []
        first = nodes[0] if nodes else {}
        findings.append({
            "file": t.get("path"),
            "line_start": t.get("line"),
            "line_end": t.get("line"),
            "body": first.get("body", ""),
            "author": (first.get("author") or {}).get("login"),
            "thread_id": t["id"],
            "is_resolved": t.get("isResolved", False),
            "thread_comments": [
                {"author": (c.get("author") or {}).get("login"), "body": c.get("body", "")}
                for c in nodes
            ],
        })
    return findings


def cmd_fetch(args: argparse.Namespace) -> None:
    owner, repo, pr_num = parse_pr(args.pr_url)
    threads = fetch_review_threads(owner, repo, pr_num)
    print(json.dumps({"findings": build_findings(threads)}, indent=2))


# ---------------------------------------------------------------------------
# wait — block on the workflow run for the current head SHA
# ---------------------------------------------------------------------------

def head_sha(owner: str, repo: str, pr_num: int) -> str:
    return _gh("api", f"repos/{owner}/{repo}/pulls/{pr_num}", "--jq", ".head.sha")


def latest_run(owner: str, repo: str, sha: str) -> dict | None:
    """The most recent z.ai workflow run for this exact commit, or None if no
    run has registered yet. Keyed by head_sha so a stale run from an earlier
    commit can never be mistaken for this commit's review."""
    out = _gh(
        "api",
        f"repos/{owner}/{repo}/actions/workflows/{WORKFLOW_FILE}/runs"
        f"?head_sha={sha}&per_page=1",
        "--jq", ".workflow_runs",
    )
    runs = json.loads(out) if out else []
    return runs[0] if runs else None


def cmd_wait(args: argparse.Namespace) -> None:
    owner, repo, pr_num = parse_pr(args.pr_url)
    sha = head_sha(owner, repo, pr_num)
    start = time.time()
    run: dict | None = None
    while True:
        run = latest_run(owner, repo, sha)
        if run and run.get("status") == "completed":
            print(json.dumps({
                "status": "completed",
                "conclusion": run.get("conclusion"),
                "sha": sha,
                "url": run.get("html_url"),
            }))
            return
        # The deadline tracks reality: a registered run earns the full
        # completion ceiling, an absent one only the registration window.
        deadline = COMPLETION_TIMEOUT_S if run else REGISTER_TIMEOUT_S
        if time.time() - start >= deadline:
            break
        time.sleep(POLL_INTERVAL_S)
    if run is None:
        raise RuntimeError(
            f"No z.ai review run ({WORKFLOW_FILE}) registered for {sha} within "
            f"{REGISTER_TIMEOUT_S}s. Is the workflow installed on this repo "
            f"(run /zai-pr-review) and are Actions enabled?"
        )
    raise RuntimeError(
        f"z.ai review run for {sha} did not complete within {COMPLETION_TIMEOUT_S}s "
        f"(status: {run.get('status')}). The runner may be wedged: {run.get('html_url')}"
    )


# ---------------------------------------------------------------------------
# resolve — resolve one thread and verify GitHub confirms it
# ---------------------------------------------------------------------------

def cmd_resolve(args: argparse.Namespace) -> None:
    confirmed = _gh(
        "api", "graphql",
        "-f", "query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id})"
              "{thread{isResolved}}}",
        "-F", f"id={args.thread_id}",
        "--jq", ".data.resolveReviewThread.thread.isResolved",
    )
    if confirmed != "true":
        raise RuntimeError(
            f"resolveReviewThread did not confirm resolution for {args.thread_id} "
            f"(got {confirmed!r}). The thread is NOT resolved — do not move on."
        )
    print(json.dumps({"thread_id": args.thread_id, "is_resolved": True}))


# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Z.ai PR review helper")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, fn in (("wait", cmd_wait), ("fetch", cmd_fetch)):
        p = sub.add_parser(name)
        p.add_argument("pr_url")
        p.set_defaults(func=fn)
    p_resolve = sub.add_parser("resolve")
    p_resolve.add_argument("thread_id")
    p_resolve.set_defaults(func=cmd_resolve)
    args = parser.parse_args()
    try:
        args.func(args)
    except subprocess.CalledProcessError as e:
        msg = (e.stderr or "").strip() or str(e)
        print(f"ERROR ({args.command}): {msg}", file=sys.stderr)
        sys.exit(1)
    except (RuntimeError, ValueError) as e:
        print(f"ERROR ({args.command}): {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
