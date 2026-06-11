"""
Tests for fetch_comments.py paging and base-repo resolution.

Run: uv run --with pytest pytest test_fetch_comments.py
"""

from __future__ import annotations

from typing import Any

import pytest

import fetch_comments
from fetch_comments import fetch_all, parse_base_repo


def _conn(nodes: list[dict[str, Any]], end_cursor: str | None, has_next: bool) -> dict[str, Any]:
    return {
        "nodes": nodes,
        "pageInfo": {"hasNextPage": has_next, "endCursor": end_cursor},
    }


def _payload(comments, reviews, threads) -> dict[str, Any]:
    return {
        "data": {
            "repository": {
                "pullRequest": {
                    "number": 7,
                    "url": "https://github.com/base-owner/base-repo/pull/7",
                    "title": "t",
                    "state": "OPEN",
                    "comments": comments,
                    "reviews": reviews,
                    "reviewThreads": threads,
                }
            }
        }
    }


class FakePager:
    """Serves comment pages by cursor; reviews/threads exhaust on page one."""

    def __init__(self, comment_pages: dict[str | None, dict[str, Any]],
                 reviews: list[dict[str, Any]], threads: list[dict[str, Any]]):
        self.comment_pages = comment_pages
        self.reviews = reviews
        self.threads = threads
        self.calls: list[dict[str, str | None]] = []

    def __call__(self, owner: str, repo: str, number: int,
                 cursors: dict[str, str | None]) -> dict[str, Any]:
        self.calls.append(dict(cursors))
        return _payload(
            self.comment_pages[cursors["commentsCursor"]],
            _conn(self.reviews if cursors["reviewsCursor"] is None else [], None, False),
            _conn(self.threads if cursors["threadsCursor"] is None else [], None, False),
        )


def test_exhausted_collections_are_not_reappended_while_another_pages():
    """The original bug: 3 comment pages caused reviews/threads to appear 3x."""
    comment_pages = {
        None: _conn([{"id": "c1"}], "CUR1", True),
        "CUR1": _conn([{"id": "c2"}], "CUR2", True),
        "CUR2": _conn([{"id": "c3"}], "CUR3", False),
    }
    pager = FakePager(comment_pages, reviews=[{"id": "r1"}], threads=[{"id": "t1"}])

    result = fetch_all("base-owner", "base-repo", 7, fetch_page=pager)

    assert [n["id"] for n in result["conversation_comments"]] == ["c1", "c2", "c3"]
    assert [n["id"] for n in result["reviews"]] == ["r1"]
    assert [n["id"] for n in result["review_threads"]] == ["t1"]
    assert len(pager.calls) == 3


def test_single_page_everything_makes_one_call():
    pager = FakePager(
        {None: _conn([{"id": "c1"}], None, False)},
        reviews=[{"id": "r1"}],
        threads=[],
    )
    result = fetch_all("o", "r", 7, fetch_page=pager)

    assert len(pager.calls) == 1
    assert [n["id"] for n in result["conversation_comments"]] == ["c1"]
    assert [n["id"] for n in result["reviews"]] == ["r1"]
    assert result["review_threads"] == []


def test_pr_meta_comes_from_first_page():
    pager = FakePager({None: _conn([], None, False)}, reviews=[], threads=[])
    result = fetch_all("base-owner", "base-repo", 7, fetch_page=pager)
    assert result["pull_request"] == {
        "number": 7,
        "url": "https://github.com/base-owner/base-repo/pull/7",
        "title": "t",
        "state": "OPEN",
        "owner": "base-owner",
        "repo": "base-repo",
    }


def test_graphql_errors_raise():
    def pager(owner, repo, number, cursors):
        return {"errors": [{"message": "boom"}], "data": None}

    with pytest.raises(RuntimeError, match="GraphQL errors"):
        fetch_all("o", "r", 7, fetch_page=pager)


def test_parse_base_repo_uses_url_not_head_repo():
    """For a fork PR the url is rooted in the BASE repo — that's what we must get."""
    assert parse_base_repo("https://github.com/upstream-org/project/pull/123") == (
        "upstream-org",
        "project",
    )


def test_parse_base_repo_rejects_non_pr_urls():
    with pytest.raises(RuntimeError, match="Unrecognized PR url"):
        parse_base_repo("https://github.com/owner/repo")
    with pytest.raises(RuntimeError, match="Unrecognized PR url"):
        parse_base_repo("https://github.com/owner/repo/issues/5")


def test_default_fetch_page_is_the_real_gh_call():
    """Guard the seam: production default must be the gh effect, not a stub."""
    assert fetch_all.__defaults__ == (fetch_comments.gh_api_graphql,)
