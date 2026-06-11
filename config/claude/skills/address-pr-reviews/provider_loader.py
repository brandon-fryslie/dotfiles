#!/usr/bin/env python3
"""Load the active PR review provider.

Reads provider.json (or PR_REVIEW_PROVIDER env var) from this directory,
imports the named module, and validates CAPABILITIES before returning it.

Usage:
    import provider_loader
    provider = provider_loader.get()
    result = provider.fetch(pr_url)
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent
CONFIG_FILE = SKILL_DIR / "provider.json"

REQUIRED_CAPABILITIES = {"resolve", "trigger", "setup_check"}


def get(name: str | None = None) -> object:
    """Return the active provider module, validated against the contract.

    [LAW:dataflow-not-control-flow] provider selection is a value with one
    precedence chain: explicit `name` arg > PR_REVIEW_PROVIDER env > provider.json.
    The explicit arg lets a caller pin a provider for one session without
    mutating the global default. [LAW:no-shared-mutable-globals]
    """
    name = _resolve_name(name)
    module = _load_module(name)
    _validate(module, name)
    return module


def _resolve_name(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    if env := os.environ.get("PR_REVIEW_PROVIDER"):
        return env
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text())["provider"]
        except (json.JSONDecodeError, KeyError) as e:
            raise RuntimeError(f"provider.json is malformed: {e}") from e
    raise RuntimeError(
        f"No provider configured. Create {CONFIG_FILE} with "
        '\'{"provider": "<name>"}\' or set PR_REVIEW_PROVIDER.'
    )


def _load_module(name: str) -> object:
    path = SKILL_DIR / f"{name}_provider.py"
    if not path.exists():
        raise RuntimeError(
            f"Provider module not found: {path}\n"
            f"Available providers: {_available()}"
        )
    # [LAW:single-enforcer] sibling imports (shared modules like github_threads)
    # resolve here, once, for every provider — not per-provider path hacks.
    if str(SKILL_DIR) not in sys.path:
        sys.path.insert(0, str(SKILL_DIR))
    spec = importlib.util.spec_from_file_location(f"{name}_provider", path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        raise RuntimeError(f"Failed to load provider '{name}': {e}") from e
    return module


def _validate(module: object, name: str) -> None:
    caps = getattr(module, "CAPABILITIES", None)
    if caps is None:
        raise RuntimeError(f"Provider '{name}' is missing CAPABILITIES dict.")
    missing_keys = REQUIRED_CAPABILITIES - caps.keys()
    if missing_keys:
        raise RuntimeError(
            f"Provider '{name}' CAPABILITIES is missing keys: {missing_keys}"
        )
    for cap, required in (("wait", True), ("fetch", True)):
        if not hasattr(module, cap):
            raise RuntimeError(
                f"Provider '{name}' is missing required function '{cap}'."
            )
    for cap in ("resolve", "trigger", "setup_check"):
        if caps.get(cap) and not hasattr(module, cap):
            raise RuntimeError(
                f"Provider '{name}' declares capability '{cap}' but does not "
                f"implement the function."
            )


def _available() -> list[str]:
    return [
        p.stem.removesuffix("_provider")
        for p in SKILL_DIR.glob("*_provider.py")
    ]


if __name__ == "__main__":
    try:
        p = get()
        caps = p.CAPABILITIES
        print(f"Active provider: {p.__name__}")
        print(f"Capabilities:    {caps}")
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
