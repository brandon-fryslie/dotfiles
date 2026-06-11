#!/usr/bin/env python3
"""GitHub review-thread primitives shared by every provider whose findings
land as PR review threads.

[LAW:one-source-of-truth] the GraphQL thread read, the canonical Finding
shape, and the verified resolve mutation live here once. A provider that
posts ordinary GitHub review threads imports these instead of minting a
second copy that drifts.
"""

from __future__ import annotations

import json
import re
import subprocess


def gh(*args: str) -> str:
    """All shell-outs through one function. [LAW:single-enforcer]"""
    return subprocess.check_output(
        ["gh", *args], text=True, stderr=subprocess.PIPE
    ).strip()


def parse_pr(url: str) -> tuple[str, str, int]:
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    if not m:
        raise ValueError(f"Not a PR URL: {url}")
    return m.group(1), m.group(2), int(m.group(3))


def head_sha(owner: str, repo: str, pr_num: int) -> str:
    return gh("api", f"repos/{owner}/{repo}/pulls/{pr_num}", "--jq", ".head.sha")


def _fetch_threads(owner: str, repo: str, pr_num: int) -> list[dict]:
    query = (
        "query($owner:String!,$repo:String!,$num:Int!){"
        "  repository(owner:$owner,name:$repo){"
        "    pullRequest(number:$num){"
        "      reviewThreads(first:100){"
        "        nodes{ id isResolved path line"
        "          comments(first:20){ nodes{ author{login} body } } } } } } }"
    )
    out = gh(
        "api", "graphql",
        "-f", f"query={query}",
        "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"num={pr_num}",
        "--jq", ".data.repository.pullRequest.reviewThreads.nodes",
    )
    threads = json.loads(out) if out else []
    # [LAW:no-silent-failure] the page caps are explicit; hitting one means
    # findings exist that this fetch did not return — that must halt, not
    # quietly read as the full set.
    if len(threads) >= 100:
        raise RuntimeError(
            "PR has 100+ review threads — pagination is not implemented and "
            "this fetch is incomplete. Do not treat it as the full finding set."
        )
    for t in threads:
        if len(t.get("comments", {}).get("nodes") or []) >= 20:
            raise RuntimeError(
                f"Thread {t['id']} has 20+ comments — pagination is not "
                "implemented and the thread chain is incomplete."
            )
    return threads


def _build_findings(threads: list[dict]) -> list[dict]:
    """[LAW:dataflow-not-control-flow] one shape for every finding — reviewer-
    authored and human-authored threads are the same primitive, never separate
    code paths."""
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
    owner, repo, pr_num = parse_pr(pr_url)
    threads = _fetch_threads(owner, repo, pr_num)
    return {"findings": _build_findings(threads)}


def resolve(thread_id: str) -> dict:
    """Resolve one review thread and verify GitHub confirms it.
    [LAW:no-silent-failure] raises RuntimeError if confirmation is absent."""
    confirmed = gh(
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
