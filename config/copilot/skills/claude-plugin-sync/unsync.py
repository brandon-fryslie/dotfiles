#!/usr/bin/env python3
"""
Remove synced items that sync.py recorded but no longer considers active.

The sync manifest is the single record of ownership: only names recorded
in it are ever touched. Anything in ~/.copilot/skills or ~/.copilot/agents
that the manifest does not record was authored by the user (or another
tool) and is never removed.
"""

import json
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

# [LAW:one-source-of-truth] manifest path and target dirs are defined by sync.py
from sync import DEFAULT_PATHS


def names_with_status(entries: Dict, status: str) -> Set[str]:
    """Names of manifest entries having the given status."""
    return {name for name, info in entries.items() if info.get("status") == status}


def manifest_categories(manifest) -> Tuple[Dict, Dict, Dict]:
    """Validate manifest shape and return (skills, agents, commands).

    [LAW:single-enforcer] the manifest file is external input; this is the
    one boundary where its shape is checked. Everything downstream assumes
    dict-of-dicts and never re-guards.
    """
    if not isinstance(manifest, dict):
        raise ValueError(f"manifest root must be an object, got {type(manifest).__name__}")

    categories = []
    for key in ("skills", "agents", "commands"):
        entries = manifest.get(key, {})
        if not isinstance(entries, dict) or not all(isinstance(info, dict) for info in entries.values()):
            raise ValueError(f"manifest[{key!r}] must be an object of objects")
        categories.append(entries)
    return tuple(categories)


def remove_path(item: Path) -> None:
    """Remove a filesystem entry of any kind.

    Symlinks are unlinked first because is_dir() follows them while
    shutil.rmtree refuses them — and symlinks are exactly how sync.py
    creates skills.
    """
    if item.is_symlink():
        item.unlink()
    elif item.is_dir():
        shutil.rmtree(item)
    else:
        item.unlink()


def remove_stale_items(directory: Path, recorded: Set[str], active: Set[str]) -> List[str]:
    """Remove items the manifest records but no longer marks active.

    Args:
        directory: Directory to clean
        recorded: Every name the manifest has ever recorded for this
            directory (any status) — the ownership boundary
        active: Names currently marked active — the keep-set

    Returns:
        Names of removed items
    """
    if not directory.exists():
        return []

    # [LAW:one-source-of-truth] removal requires a manifest record: unrecorded
    # items were never created by sync and are not ours to delete
    stale = sorted(
        item.name for item in directory.iterdir()
        if item.name in recorded and item.name not in active
    )
    for name in stale:
        remove_path(directory / name)
    return stale


def unsync_all(paths: Dict = DEFAULT_PATHS) -> int:
    """Remove all manifest-recorded items that are no longer active.

    Returns:
        Count of removed items
    """
    manifest_path = paths['manifest_file']
    if not manifest_path.exists():
        print("No manifest found - nothing to unsync")
        return 0

    with open(manifest_path) as f:
        manifest = json.load(f)

    # command-derived skills live in the skills dir under their manifest key
    skills, agents, commands = manifest_categories(manifest)

    removed_skills = remove_stale_items(
        paths['copilot_skills_dir'],
        recorded=set(skills) | set(commands),
        active=names_with_status(skills, "active") | names_with_status(commands, "active"),
    )
    removed_agents = remove_stale_items(
        paths['copilot_agents_dir'],
        recorded=set(agents),
        active=names_with_status(agents, "active"),
    )

    for name in removed_skills:
        print(f"Removed skill: {name}")
    for name in removed_agents:
        print(f"Removed agent: {name}")

    removed_count = len(removed_skills) + len(removed_agents)
    print(f"\nRemoved {removed_count} stale synced items")
    return removed_count


def main() -> None:
    """Entry point for CLI execution."""
    try:
        unsync_all()
    # [LAW:no-silent-failure] a corrupt manifest must abort loudly: proceeding
    # as if nothing were recorded would misreport "nothing to unsync"
    except json.JSONDecodeError as e:
        print(f"Error: manifest is not valid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Error: invalid manifest: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
