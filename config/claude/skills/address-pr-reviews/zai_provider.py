#!/usr/bin/env python3
"""Z.ai PR review provider — implements the provider contract for the z.ai
GitHub Actions-based reviewer.

The z.ai reviewer is a GitHub Action (brandon-fryslie/zai-coding-agent-review)
that runs on pull_request (opened, synchronize) and posts a formal PR review
with inline comments — i.e. ordinary resolvable review threads, authored by
github-actions.

Lifecycle owner is the *workflow run*, not `reviewRequests`. [LAW:no-ambient-temporal-coupling]
`wait` blocks on that owner — the run keyed to the current head SHA — never
on event-stream timing or comment counts.

Its findings land as review threads, so there is no second stream to join.
`fetch` reads the threads and nothing else. [LAW:one-source-of-truth]
"""

from __future__ import annotations

import json
import subprocess
import time
from typing import Optional

CAPABILITIES = {
    "resolve":     True,   # GitHub review threads are resolvable
    "trigger":     False,  # fires automatically on push via GitHub Action
    "setup_check": True,   # checks that code-review.yml workflow is installed
}

# The workflow file this provider watches. [LAW:one-source-of-truth]
WORKFLOW_FILE = "code-review.yml"

REGISTER_TIMEOUT_S = 300
COMPLETION_TIMEOUT_S = 3600
POLL_INTERVAL_S = 8


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _gh(*args: str) -> str:
    """All shell-outs through one function. [LAW:single-enforcer]"""
    return subprocess.check_output(
        ["gh", *args], text=True, stderr=subprocess.PIPE
    ).strip()


def _parse_pr(url: str) -> tuple[str, str, int]:
    import re
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    if not m:
        raise ValueError(f"Not a PR URL: {url}")
    return m.group(1), m.group(2), int(m.group(3))


def _head_sha(owner: str, repo: str, pr_num: int) -> str:
    return _gh("api", f"repos/{owner}/{repo}/pulls/{pr_num}", "--jq", ".head.sha")


def _latest_run(owner: str, repo: str, sha: str) -> Optional[dict]:
    out = _gh(
        "api",
        f"repos/{owner}/{repo}/actions/workflows/{WORKFLOW_FILE}/runs"
        f"?head_sha={sha}&per_page=1",
        "--jq", ".workflow_runs",
    )
    runs = json.loads(out) if out else []
    return runs[0] if runs else None


# ---------------------------------------------------------------------------
# Contract: setup_check
# ---------------------------------------------------------------------------

def setup_check(owner: str, repo: str) -> dict:
    """Verify code-review.yml workflow is installed on the repo."""
    try:
        state = _gh(
            "api", f"repos/{owner}/{repo}/actions/workflows/{WORKFLOW_FILE}",
            "--jq", ".state",
        )
        if state == "active":
            return {"installed": True, "message": f"{WORKFLOW_FILE} is active"}
        return {
            "installed": False,
            "message": (
                f"{WORKFLOW_FILE} exists but state is '{state}' — "
                "check Actions settings on this repo."
            ),
        }
    except subprocess.CalledProcessError:
        return {
            "installed": False,
            "message": (
                f"z.ai review workflow ({WORKFLOW_FILE}) not found on "
                f"{owner}/{repo} — run /zai-pr-review in this repo and "
                "merge it to the default branch first."
            ),
        }


# ---------------------------------------------------------------------------
# Contract: wait
# ---------------------------------------------------------------------------

def wait(pr_url: str) -> dict:
    """Block until the z.ai workflow run for the current head SHA completes."""
    owner, repo, pr_num = _parse_pr(pr_url)
    sha = _head_sha(owner, repo, pr_num)
    start = time.time()
    run: Optional[dict] = None
    while True:
        run = _latest_run(owner, repo, sha)
        if run and run.get("status") == "completed":
            return {
                "status":     "completed",
                "conclusion": run.get("conclusion"),
                "sha":        sha,
                "url":        run.get("html_url"),
            }
        deadline = COMPLETION_TIMEOUT_S if run else REGISTER_TIMEOUT_S
        if time.time() - start >= deadline:
            break
        time.sleep(POLL_INTERVAL_S)
    if run is None:
        raise RuntimeError(
            f"No z.ai review run ({WORKFLOW_FILE}) registered for {sha} within "
            f"{REGISTER_TIMEOUT_S}s. Is the workflow installed on this repo "
            "(run /zai-pr-review) and are Actions enabled?"
        )
    raise RuntimeError(
        f"z.ai review run for {sha} did not complete within {COMPLETION_TIMEOUT_S}s "
        f"(status: {run.get('status')}). The runner may be wedged: {run.get('html_url')}"
    )


# ---------------------------------------------------------------------------
# Contract: fetch
# ---------------------------------------------------------------------------

def _fetch_threads(owner: str, repo: str, pr_num: int) -> list[dict]:
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


def _build_findings(threads: list[dict]) -> list[dict]:
    """[LAW:dataflow-not-control-flow] one shape for every finding — z.ai-authored
    and human-authored threads are the same primitive, never separate code paths."""
    findings = []
    for t in threads:
        nodes = t.get("comments", {}).get("nodes") or []
        first = nodes[0] if nodes else {}
        findings.append({
            "file":            t.get("path"),
            "line_start":      t.get("line"),
            "line_end":        t.get("line"),
            "body":            first.get("body", ""),
            "author":          (first.get("author") or {}).get("login"),
            "thread_id":       t["id"],
            "is_resolved":     t.get("isResolved", False),
            "thread_comments": [
                {"author": (c.get("author") or {}).get("login"), "body": c.get("body", "")}
                for c in nodes
            ],
        })
    return findings


def fetch(pr_url: str) -> dict:
    """Return all review threads as canonical findings."""
    owner, repo, pr_num = _parse_pr(pr_url)
    threads = _fetch_threads(owner, repo, pr_num)
    return {"findings": _build_findings(threads)}


# ---------------------------------------------------------------------------
# Contract: resolve
# ---------------------------------------------------------------------------

def resolve(thread_id: str) -> dict:
    """Resolve one review thread and verify GitHub confirms it.
    [LAW:no-silent-failure] raises RuntimeError if confirmation is absent."""
    confirmed = _gh(
        "api", "graphql",
        "-f", "query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id})"
              "{thread{isResolved}}}",
        "-F", f"id={thread_id}",
        "--jq", ".data.resolveReviewThread.thread.isResolved",
    )
    if confirmed != "true":
        raise RuntimeError(
            f"resolveReviewThread did not confirm resolution for {thread_id} "
            f"(got {confirmed!r}). The thread is NOT resolved — do not move on."
        )
    return {"thread_id": thread_id, "is_resolved": True}


# ---------------------------------------------------------------------------
# CLI shim — preserves backward-compat with callers that used zai-review.py
# directly. The skill's SKILL.md references provider_loader, not this module,
# but the shim means any existing scripts that called zai-review.py still work.
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Z.ai PR review provider (direct)")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("wait", "fetch"):
        p = sub.add_parser(name)
        p.add_argument("pr_url")
        p.set_defaults(func=globals()[name])
    p_resolve = sub.add_parser("resolve")
    p_resolve.add_argument("thread_id")
    p_resolve.set_defaults(func=resolve)

    args = parser.parse_args()
    try:
        if args.command in ("wait", "fetch"):
            print(json.dumps(args.func(args.pr_url), indent=2))
        else:
            print(json.dumps(args.func(args.thread_id), indent=2))
    except subprocess.CalledProcessError as e:
        msg = (e.stderr or "").strip() or str(e)
        print(f"ERROR ({args.command}): {msg}", file=sys.stderr)
        sys.exit(1)
    except (RuntimeError, ValueError) as e:
        print(f"ERROR ({args.command}): {e}", file=sys.stderr)
        sys.exit(1)
