#!/usr/bin/env python3
"""
Add multiple topics in batch mode with priority-to-phase mapping.
"""

import os
import re
import sys
import json
from roadmap_lib import (
    parse_roadmap, write_roadmap, to_kebab_case,
    find_topic, add_topic_to_phase, detect_multiple_topics,
    RoadmapError
)


def parse_topic_input(topic_input: str) -> Dict:
    """Parse topic input to extract name, description, and priority."""
    # Extract priority marker
    priority = None
    if match := re.search(r"\bP(\d)\b", topic_input, re.IGNORECASE):
        priority = int(match.group(1))

    # Extract name and description
    if " - " in topic_input:
        name, desc = topic_input.split(" - ", 1)
    elif ": " in topic_input:
        name, desc = topic_input.split(": ", 1)
    else:
        name = topic_input
        desc = ""

    return {
        "input": topic_input,
        "name": name.strip(),
        "description": desc.strip(),
        "priority": priority
    }


def main():
    """Execute batch add."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No topics provided"}))
        sys.exit(1)

    topics_input = sys.argv[1]

    # Detect multiple topics
    topics = detect_multiple_topics(topics_input)

    if len(topics) < 2:
        print(json.dumps({"error": "Batch mode requires 2+ topics"}))
        sys.exit(1)

    # Load or initialize roadmap
    roadmap_path = ".agent_planning/ROADMAP.md"
    if os.path.exists(roadmap_path):
        roadmap = parse_roadmap(roadmap_path)
    else:
        roadmap = {
            "version": "1.0",
            "created": "",
            "updated": "",
            "phases": [
                {
                    "number": 1,
                    "name": "MVP",
                    "status": "active",
                    "goal": "Deliver core functionality",
                    "topics": []
                }
            ]
        }

    # Find default phase (active or first)
    default_phase = next(
        (p["number"] for p in roadmap["phases"] if p.get("status") == "active"),
        1
    )

    # Parse topics
    parsed_topics = []
    for topic_input in topics:
        parsed = parse_topic_input(topic_input)
        phase_num = parsed["priority"] if parsed["priority"] and parsed["priority"] <= len(roadmap["phases"]) else default_phase
        parsed["phase"] = phase_num
        parsed_topics.append(parsed)

    # Add topics
    added_count = 0
    skipped_count = 0

    for topic_data in parsed_topics:
        slug = to_kebab_case(topic_data["name"])

        # Skip duplicates
        if find_topic(slug, roadmap):
            skipped_count += 1
            continue

        # Create directory
        topic_dir = f".agent_planning/{slug}/"
        os.makedirs(topic_dir, exist_ok=True)

        # Add to roadmap
        try:
            roadmap = add_topic_to_phase(
                topic_name=slug,
                phase_num=topic_data["phase"],
                roadmap=roadmap,
                summary=topic_data["description"]
            )
            added_count += 1
        except RoadmapError as e:
            print(json.dumps({"error": str(e), "topic": slug}))
            sys.exit(1)

    # Write roadmap
    if added_count > 0:
        write_roadmap(roadmap, roadmap_path)

    # Phase distribution
    phase_counts = {}
    for topic_data in parsed_topics:
        phase_num = topic_data["phase"]
        phase_counts[phase_num] = phase_counts.get(phase_num, 0) + 1

    phase_dist = {}
    for phase_num in sorted(phase_counts.keys()):
        phase = next((p for p in roadmap["phases"] if p["number"] == phase_num), None)
        if phase:
            phase_dist[f"Phase {phase_num}: {phase['name']}"] = phase_counts[phase_num]

    result = {
        "status": "batch_added",
        "added": added_count,
        "skipped": skipped_count,
        "total": len(parsed_topics),
        "phases": phase_dist
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
