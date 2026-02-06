#!/usr/bin/env python3
"""
Remove synced extensions that aren't in the original manifest.
"""

import json
import shutil
from pathlib import Path


def unsync_all():
    """Remove all synced skills/agents not in the original manifest."""

    # Load the original manifest
    manifest_path = Path.home() / ".copilot" / "claude-sync-manifest.json"
    if not manifest_path.exists():
        print("No manifest found - nothing to unsync")
        return

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Get the list of valid (active) items from manifest
    valid_skills = {
        name for name, info in manifest.get("skills", {}).items()
        if info.get("status") == "active"
    }

    valid_agents = {
        name for name, info in manifest.get("agents", {}).items()
        if info.get("status") == "active"
    }

    skills_dir = Path.home() / ".copilot" / "skills"
    agents_dir = Path.home() / ".copilot" / "agents"

    removed_count = 0

    # Remove skills not in manifest
    if skills_dir.exists():
        for item in skills_dir.iterdir():
            if item.name not in valid_skills:
                print(f"Removing skill: {item.name}")
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                removed_count += 1

    # Remove agents not in manifest
    if agents_dir.exists():
        for item in agents_dir.iterdir():
            if item.name not in valid_agents and not item.is_symlink():
                print(f"Removing agent: {item.name}")
                item.unlink()
                removed_count += 1

    print(f"\nRemoved {removed_count} items not in original manifest")


if __name__ == "__main__":
    unsync_all()
