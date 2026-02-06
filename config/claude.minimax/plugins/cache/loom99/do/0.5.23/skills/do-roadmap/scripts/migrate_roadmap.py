#!/usr/bin/env python3
"""
Migrate non-compliant ROADMAP.md formats to schema.
Handles cherry-chrome-mcp narrative format.
"""

import os
import re
import sys
import json
from pathlib import Path
from typing import Dict, Tuple
from roadmap_lib import timestamp, write_roadmap, RoadmapError


def detect_migration_needed(path: str) -> Tuple[bool, str]:
    """Check if migration is needed."""
    if not os.path.exists(path):
        return False, "File does not exist"

    with open(path, "r") as f:
        content = f.read()

    if not content.strip().startswith("---"):
        return True, "Missing YAML frontmatter"

    if "####" in content:
        return True, "Uses H4 headers instead of list items"

    if any(field in content for field in ["**Description**", "**Tools", "**Pain point"]):
        return True, "Contains custom narrative fields"

    return False, "Already compliant"


def migrate_from_narrative(content: str) -> Dict:
    """Migrate from cherry-chrome-mcp narrative format."""
    roadmap = {
        "version": "1.0",
        "created": timestamp(),
        "updated": timestamp(),
        "phases": []
    }

    current_phase = None
    current_topic = None

    for line in content.split("\n"):
        # Phase headers
        if match := re.match(r"^##\s+Phase\s+(\d+):\s+(.+?)(?:\s+\[([A-Z]+)\])?$", line):
            if current_topic and current_phase:
                if "summary_parts" in current_topic:
                    current_topic["summary"] = " | ".join(current_topic["summary_parts"])
                    del current_topic["summary_parts"]
                current_phase["topics"].append(current_topic)
                current_topic = None

            if current_phase:
                roadmap["phases"].append(current_phase)

            phase_num = int(match.group(1))
            status = match.group(3).lower() if match.group(3) else ("active" if phase_num == 1 else "queued")

            current_phase = {
                "number": phase_num,
                "name": match.group(2).strip(),
                "status": status,
                "topics": []
            }

        # Phase metadata
        elif current_phase and line.strip().startswith("Goal:"):
            current_phase["goal"] = line.split(":", 1)[1].strip()
        elif current_phase and line.strip().startswith("Status:"):
            current_phase["status"] = line.split(":", 1)[1].strip().lower()

        # Topic headers
        elif match := re.match(r"^####\s+([a-z0-9-]+)(?:\s+\[([A-Z\s]+)\])?", line):
            if current_topic and current_phase:
                if "summary_parts" in current_topic:
                    current_topic["summary"] = " | ".join(current_topic["summary_parts"])
                    del current_topic["summary_parts"]
                current_phase["topics"].append(current_topic)

            current_topic = {
                "name": match.group(1),
                "state": match.group(2).strip() if match.group(2) else "PROPOSED",
                "directory": f".agent_planning/{match.group(1)}/",
                "summary_parts": []
            }

        # Extract context from custom fields
        elif current_topic:
            if line.strip().startswith("**Description**:"):
                desc = line.split(":", 1)[1].strip()
                if desc:
                    current_topic["summary_parts"].append(desc)
            elif line.strip().startswith("**Pain point**:"):
                pain = line.split(":", 1)[1].strip()
                if pain:
                    current_topic["summary_parts"].append("Pain: " + pain)
            elif line.strip().startswith("**Directory**:"):
                current_topic["directory"] = line.split(":", 1)[1].strip()
            elif line.strip().startswith("-") and not line.strip().startswith("---"):
                detail = line.strip()[1:].strip()
                if detail and not detail.startswith("Summary:") and not detail.startswith("Epic:"):
                    current_topic["summary_parts"].append(detail)

    # Finalize
    if current_topic and current_phase:
        if "summary_parts" in current_topic:
            current_topic["summary"] = " | ".join(current_topic["summary_parts"])
            del current_topic["summary_parts"]
        current_phase["topics"].append(current_topic)

    if current_phase:
        roadmap["phases"].append(current_phase)

    return roadmap


def main():
    """Execute migration."""
    path = ".agent_planning/ROADMAP.md"

    if not os.path.exists(path):
        print(json.dumps({"error": "No ROADMAP.md found"}))
        return

    needs_migration, reason = detect_migration_needed(path)
    if not needs_migration:
        print(json.dumps({"status": "compliant", "reason": reason}))
        return

    # Backup
    backup_path = f"{path}.backup-{timestamp()}"
    os.system(f"cp {path} {backup_path}")

    try:
        with open(path, "r") as f:
            content = f.read()

        roadmap = migrate_from_narrative(content)

        if not roadmap.get("phases"):
            print(json.dumps({"error": "No phases found after migration"}))
            return

        write_roadmap(roadmap, path)

        total_topics = sum(len(p["topics"]) for p in roadmap["phases"])

        result = {
            "status": "migrated",
            "backup": backup_path,
            "phases": len(roadmap["phases"]),
            "topics": total_topics
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e), "backup": backup_path}))
        sys.exit(1)


if __name__ == "__main__":
    main()
