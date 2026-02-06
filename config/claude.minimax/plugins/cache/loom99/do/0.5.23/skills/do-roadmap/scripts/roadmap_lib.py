#!/usr/bin/env python3
"""
Shared utilities for roadmap skill scripts.
Handles ROADMAP.md parsing, writing, and manipulation.
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class RoadmapError(Exception):
    """Base exception for roadmap operations."""
    pass


def timestamp() -> str:
    """Get current timestamp in YYYY-MM-DD-HHmmss format."""
    return datetime.now().strftime("%Y-%m-%d-%H%M%S")


def to_kebab_case(text: str) -> str:
    """Convert text to kebab-case slug."""
    text = text.lower().replace("_", "-").replace(" ", "-")
    text = re.sub(r"[^a-z0-9-]", "", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def parse_roadmap(path: str = ".agent_planning/ROADMAP.md") -> Dict:
    """Parse ROADMAP.md into structured data."""
    if not os.path.exists(path):
        return {"version": "1.0", "created": "", "updated": "", "phases": []}

    with open(path, "r") as f:
        content = f.read()

    roadmap = {
        "version": "1.0",
        "created": "",
        "updated": "",
        "phases": []
    }

    # Parse YAML frontmatter
    if content.startswith("---"):
        match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
        if match:
            fm = match.group(1)
            version_match = re.search(r'version:\s*"([^"]+)"', fm)
            if version_match:
                roadmap["version"] = version_match.group(1)
            created_match = re.search(r'created:\s*(\S+)', fm)
            if created_match:
                roadmap["created"] = created_match.group(1)
            updated_match = re.search(r'updated:\s*(\S+)', fm)
            if updated_match:
                roadmap["updated"] = updated_match.group(1)

    # Parse phases and topics
    lines = content.split("\n")
    current_phase = None
    current_topic = None

    for line in lines:
        # Phase header: ## Phase N: Name
        if match := re.match(r"^##\s+Phase\s+(\d+):\s+(.+)$", line):
            if current_phase:
                roadmap["phases"].append(current_phase)

            current_phase = {
                "number": int(match.group(1)),
                "name": match.group(2).strip(),
                "status": "queued",
                "topics": []
            }
            current_topic = None

        # Phase status
        elif current_phase and line.strip().startswith("Status:"):
            current_phase["status"] = line.split(":", 1)[1].strip().lower()

        # Phase goal
        elif current_phase and line.strip().startswith("Goal:"):
            current_phase["goal"] = line.split(":", 1)[1].strip()

        # Topic line: - topic-slug [STATE]
        elif match := re.match(r"^-\s+([a-z0-9-]+)\s+\[([A-Z\s]+)\]", line):
            if current_topic and current_phase:
                current_phase["topics"].append(current_topic)

            current_topic = {
                "name": match.group(1),
                "state": match.group(2).strip()
            }

        # Topic metadata
        elif current_topic:
            if line.strip().startswith("- Summary:"):
                current_topic["summary"] = line.split(":", 1)[1].strip()
            elif line.strip().startswith("- Epic:"):
                current_topic["epic"] = line.split(":", 1)[1].strip()
            elif line.strip().startswith("- Directory:"):
                current_topic["directory"] = line.split(":", 1)[1].strip()
            elif line.strip().startswith("- Dependencies:"):
                deps = line.split(":", 1)[1].strip()
                current_topic["dependencies"] = [d.strip() for d in deps.split(",")]
            elif line.strip().startswith("- Labels:"):
                labels = line.split(":", 1)[1].strip()
                current_topic["labels"] = [l.strip() for l in labels.split(",")]

    # Add final phase and topic
    if current_topic and current_phase:
        current_phase["topics"].append(current_topic)
    if current_phase:
        roadmap["phases"].append(current_phase)

    return roadmap


def write_roadmap(roadmap: Dict, path: str = ".agent_planning/ROADMAP.md") -> None:
    """Write roadmap structure to ROADMAP.md file."""
    lines = []

    # YAML frontmatter
    lines.append("---")
    lines.append(f'version: "{roadmap.get("version", "1.0")}"')
    lines.append(f"created: {roadmap.get('created', timestamp())}")
    lines.append(f"updated: {timestamp()}")
    lines.append("---")
    lines.append("")
    lines.append("# Project Roadmap")
    lines.append("")

    # Phases
    for phase in roadmap.get("phases", []):
        lines.append(f"## Phase {phase['number']}: {phase['name']}")
        lines.append("")

        if "goal" in phase:
            lines.append(f"Goal: {phase['goal']}")

        status = phase.get("status", "queued")
        lines.append(f"Status: {status}")
        lines.append("")
        lines.append("### Topics")
        lines.append("")

        # Topics
        for topic in phase.get("topics", []):
            lines.append(f"- {topic['name']} [{topic['state']}]")

            if "summary" in topic:
                lines.append(f"  - Summary: {topic['summary']}")
            if "epic" in topic:
                lines.append(f"  - Epic: {topic['epic']}")
            if "directory" in topic:
                lines.append(f"  - Directory: {topic['directory']}")
            if "dependencies" in topic and topic["dependencies"]:
                deps = ", ".join(topic["dependencies"])
                lines.append(f"  - Dependencies: {deps}")
            if "labels" in topic and topic["labels"]:
                labels = ", ".join(topic["labels"])
                lines.append(f"  - Labels: {labels}")

            lines.append("")

    # Ensure directory exists
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    with open(path, "w") as f:
        f.write("\n".join(lines))


def find_topic(slug: str, roadmap: Dict) -> Optional[Dict]:
    """Find a topic by slug, return with phase context."""
    for phase in roadmap.get("phases", []):
        for topic in phase.get("topics", []):
            if topic["name"] == slug:
                return {
                    "topic": topic,
                    "phase": phase
                }
    return None


def has_planning_files(topic_slug: str) -> bool:
    """Check if planning files exist for a topic."""
    directory = f".agent_planning/{topic_slug}/"
    if not os.path.isdir(directory):
        return False

    patterns = ["PLAN-", "EVALUATION-", "DOD-", "STATUS-"]
    try:
        files = os.listdir(directory)
        return any(any(p in f for p in patterns) for f in files)
    except:
        return False


def add_topic_to_phase(
    topic_name: str,
    phase_num: int,
    roadmap: Dict,
    summary: Optional[str] = None,
    epic: Optional[str] = None
) -> Dict:
    """Add a new topic to a phase."""
    phase = next((p for p in roadmap["phases"] if p["number"] == phase_num), None)
    if not phase:
        raise RoadmapError(f"Phase {phase_num} not found")

    slug = to_kebab_case(topic_name)

    topic = {
        "name": slug,
        "state": "PLANNING" if has_planning_files(slug) else "PROPOSED",
        "directory": f".agent_planning/{slug}/"
    }

    if summary:
        topic["summary"] = summary
    if epic:
        topic["epic"] = epic

    phase["topics"].append(topic)
    return roadmap


def detect_multiple_topics(text: str) -> List[str]:
    """Detect if input contains multiple topics."""
    text = text.strip()

    # File reference - treat as single
    if text.endswith(".md"):
        return [text]

    # Semicolon-separated
    if ";" in text:
        items = [t.strip() for t in text.split(";") if t.strip()]
        if len(items) >= 2:
            return items

    # Newline-separated
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if len(lines) >= 3:
        topic_like = all(len(line) < 100 and not line.endswith(".") for line in lines)
        if topic_like:
            return lines

    # Numbered list
    numbered = re.findall(r"^\d+\.\s+(.+)$", text, re.MULTILINE)
    if len(numbered) >= 2:
        return numbered

    # Bullet list
    bullets = re.findall(r"^[-*•]\s+(.+)$", text, re.MULTILINE)
    if len(bullets) >= 2:
        return bullets

    return [text]
