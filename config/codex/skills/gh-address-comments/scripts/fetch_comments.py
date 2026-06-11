#!/usr/bin/env python3
"""
Fetch all PR conversation comments + reviews + review threads (inline threads)
for the PR associated with the current git branch, by shelling out to:

  gh api graphql

Requires:
  - `gh auth login` already set up
  - current branch has an associated (open) PR

Usage:
  python fetch_comments.py > pr_comments.json
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Any
from urllib.parse import urlparse

# [LAW:one-type-per-behavior] the three paginated connections behave identically;
# one table of instances drives cursor variables and output keys.
# GraphQL connection field -> (cursor variable name, output JSON key)
COLLECTIONS: dict[str, tuple[str, str]] = {
    "comments": ("commentsCursor", "conversation_comments"),
    "reviews": ("reviewsCursor", "reviews"),
    "reviewThreads": ("threadsCursor", "review_threads"),
}

QUERY = """\
query(
  $owner: String!,
  $repo: String!,
  $number: Int!,
  $commentsCursor: String,
  $reviewsCursor: String,
  $threadsCursor: String
) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      url
      title
      state

      # Top-level "Conversation" comments (issue comments on the PR)
      comments(first: 100, after: $commentsCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          body
          createdAt
          updatedAt
          author { login }
        }
      }

      # Review submissions (Approve / Request changes / Comment), with body if present
      reviews(first: 100, after: $reviewsCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          state
          body
          submittedAt
          author { login }
        }
      }

      # Inline review threads (grouped), includes resolved state
      reviewThreads(first: 100, after: $threadsCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          diffSide
          startLine
          startDiffSide
          originalLine
          originalStartLine
          resolvedBy { login }
          comments(first: 100) {
            nodes {
              id
              body
              createdAt
              updatedAt
              author { login }
            }
          }
        }
      }
    }
  }
}
"""


def _run(cmd: list[str], stdin: str | None = None) -> str:
    p = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{p.stderr}")
    return p.stdout


def _run_json(cmd: list[str], stdin: str | None = None) -> dict[str, Any]:
    out = _run(cmd, stdin=stdin)
    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse JSON from command output: {e}\nRaw:\n{out}") from e


def _ensure_gh_authenticated() -> None:
    try:
        _run(["gh", "auth", "status"])
    except RuntimeError:
        print("run `gh auth login` to authenticate the GitHub CLI", file=sys.stderr)
        raise RuntimeError("gh auth status failed; run `gh auth login` to authenticate the GitHub CLI") from None


def gh_pr_view_json(fields: str) -> dict[str, Any]:
    # fields is a comma-separated list like: "number,headRepositoryOwner,headRepository"
    return _run_json(["gh", "pr", "view", "--json", fields])


def parse_base_repo(pr_url: str) -> tuple[str, str]:
    """
    Extract (owner, repo) of the BASE repository from a PR url.

    PR numbers belong to the base repository; a PR's url is always rooted
    there (https://<host>/<owner>/<repo>/pull/<n>), even for fork PRs.
    `gh pr view` exposes no baseRepository field, so the url is the one
    authoritative source available.  [LAW:one-source-of-truth]
    """
    parts = urlparse(pr_url).path.strip("/").split("/")
    if len(parts) < 4 or parts[2] != "pull":
        raise RuntimeError(f"Unrecognized PR url (expected .../<owner>/<repo>/pull/<n>): {pr_url}")
    return parts[0], parts[1]


def get_current_pr_ref() -> tuple[str, str, int]:
    """
    Resolve the PR for the current branch (whatever gh considers associated).
    Works for cross-repo PRs too: owner/repo come from the PR url (base
    repository) — head repository fields would resolve a fork PR against the
    fork, where the PR number does not exist.
    """
    pr = gh_pr_view_json("number,url")
    owner, repo = parse_base_repo(pr["url"])
    number = int(pr["number"])
    return owner, repo, number


def gh_api_graphql(
    owner: str,
    repo: str,
    number: int,
    cursors: dict[str, str | None],
) -> dict[str, Any]:
    """
    Call `gh api graphql` using -F variables, avoiding JSON blobs with nulls.
    Query is passed via stdin using query=@- to avoid shell newline/quoting issues.
    `cursors` maps cursor variable name -> cursor; None means "from the start"
    and is omitted (gh -F cannot express null).
    """
    cmd = [
        "gh",
        "api",
        "graphql",
        "-F",
        "query=@-",
        "-F",
        f"owner={owner}",
        "-F",
        f"repo={repo}",
        "-F",
        f"number={number}",
    ]
    for var, cursor in cursors.items():
        if cursor:
            cmd += ["-F", f"{var}={cursor}"]

    return _run_json(cmd, stdin=QUERY)


def fetch_all(
    owner: str,
    repo: str,
    number: int,
    fetch_page=gh_api_graphql,  # [LAW:effects-at-boundaries] injectable so the paging logic tests without gh
) -> dict[str, Any]:
    nodes: dict[str, list[dict[str, Any]]] = {field: [] for field in COLLECTIONS}
    # [LAW:types-are-the-program] per-collection state is (cursor, done): a lone
    # cursor of None cannot distinguish "not started" from "exhausted", which is
    # exactly the bug that re-appended exhausted collections' first pages.
    cursors: dict[str, str | None] = {field: None for field in COLLECTIONS}
    done: dict[str, bool] = {field: False for field in COLLECTIONS}

    pr_meta: dict[str, Any] | None = None

    while True:
        payload = fetch_page(
            owner,
            repo,
            number,
            {cursor_var: cursors[field] for field, (cursor_var, _) in COLLECTIONS.items()},
        )

        if "errors" in payload and payload["errors"]:
            raise RuntimeError(f"GitHub GraphQL errors:\n{json.dumps(payload['errors'], indent=2)}")

        pr = payload["data"]["repository"]["pullRequest"]
        if pr_meta is None:
            pr_meta = {
                "number": pr["number"],
                "url": pr["url"],
                "title": pr["title"],
                "state": pr["state"],
                "owner": owner,
                "repo": repo,
            }

        for field in COLLECTIONS:
            if done[field]:
                # Exhausted: the query still returns this connection (the page
                # at its frozen cursor), but every node is already collected.
                continue
            conn = pr[field]
            nodes[field].extend(conn.get("nodes") or [])
            page = conn["pageInfo"]
            cursors[field] = page["endCursor"]
            done[field] = not page["hasNextPage"]

        if all(done.values()):
            break

    assert pr_meta is not None
    return {
        "pull_request": pr_meta,
        **{out_key: nodes[field] for field, (_, out_key) in COLLECTIONS.items()},
    }


def main() -> None:
    _ensure_gh_authenticated()
    owner, repo, number = get_current_pr_ref()
    result = fetch_all(owner, repo, number)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
