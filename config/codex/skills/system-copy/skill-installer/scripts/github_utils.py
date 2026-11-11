#!/usr/bin/env python3
"""Shared GitHub helpers for skill install scripts."""

from __future__ import annotations

import os
import urllib.error
import urllib.request


class GitHubRequestError(Exception):
    def __init__(self, message: str, status: int | None) -> None:
        super().__init__(message)
        self.status = status


def github_request(url: str, user_agent: str) -> bytes:
    headers = {"User-Agent": user_agent}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    req = urllib.request.Request(url, headers=headers)
    # [LAW:single-enforcer] every urllib failure becomes GitHubRequestError here; HTTPError
    # subclasses URLError, so it must be caught first to keep its status code.
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise GitHubRequestError(f"HTTP {exc.code} from {url}", exc.code) from exc
    except urllib.error.URLError as exc:
        raise GitHubRequestError(f"{exc.reason} ({url})", None) from exc


def github_api_contents_url(repo: str, path: str, ref: str) -> str:
    return f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"
