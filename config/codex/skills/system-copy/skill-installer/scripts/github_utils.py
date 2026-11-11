#!/usr/bin/env python3
"""Shared GitHub helpers for skill install scripts."""

from __future__ import annotations

import http.client
import os
import urllib.error
import urllib.request

REQUEST_TIMEOUT_SECONDS = 30


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
    # [LAW:single-enforcer] every request failure becomes GitHubRequestError here; HTTPError
    # subclasses URLError, which subclasses OSError, so they are caught narrowest first.
    # The timeout bounds each socket operation, so a stalled network errors instead of hanging.
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise GitHubRequestError(f"HTTP {exc.code} from {url}", exc.code) from exc
    except urllib.error.URLError as exc:
        raise GitHubRequestError(f"{exc.reason} ({url})", None) from exc
    except (OSError, http.client.HTTPException) as exc:
        # a timeout or a connection dropped mid-read surfaces from resp.read(), not urlopen
        raise GitHubRequestError(f"{exc!r} ({url})", None) from exc


def github_api_contents_url(repo: str, path: str, ref: str) -> str:
    return f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"
