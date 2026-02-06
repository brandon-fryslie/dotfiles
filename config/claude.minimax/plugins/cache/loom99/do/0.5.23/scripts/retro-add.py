#!/usr/bin/env python3
"""
Utility to add a retro item from command line or agent code.

Usage:
  echo '{"category": "friction", "text": "Tests failed mysteriously"}' | ./retro-add.py
  ./retro-add.py --category friction --text "Tests failed mysteriously"

Can be called from agents or hooks to silently add retro items.
"""
import sys
import json
import os
from pathlib import Path
from datetime import datetime, timezone
import argparse


def get_retro_dir():
    """Get or create retro directory."""
    retro_dir = Path(".agent_planning/retro")
    retro_dir.mkdir(parents=True, exist_ok=True)
    return retro_dir


def get_retro_items_path():
    """Get path to items.jsonl file."""
    return get_retro_dir() / "items.jsonl"


def add_retro_item(category: str, text: str, source: str = "agent", context: dict = None):
    """
    Add a retro item to items.jsonl.

    Args:
        category: One of: friction, success, confusion, observation, debt, tooling
        text: Description of the item
        source: "user" or "agent" (default: "agent")
        context: Optional metadata dict
    """
    valid_categories = {"friction", "success", "confusion", "observation", "debt", "tooling"}
    if category not in valid_categories:
        raise ValueError(f"Invalid category '{category}'. Must be one of: {', '.join(sorted(valid_categories))}")

    item = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "category": category,
        "text": text,
        "context": context or {}
    }

    items_path = get_retro_items_path()
    with open(items_path, "a") as f:
        f.write(json.dumps(item) + "\n")

    return item


def count_items():
    """Count total items in items.jsonl."""
    items_path = get_retro_items_path()
    if not items_path.exists():
        return 0

    with open(items_path) as f:
        return sum(1 for _ in f)


def main():
    parser = argparse.ArgumentParser(description="Add a retro item")
    parser.add_argument("--category", "-c", help="Item category")
    parser.add_argument("--text", "-t", help="Item text")
    parser.add_argument("--source", "-s", default="agent", help="Source: user or agent (default: agent)")
    parser.add_argument("--context", help="JSON context object")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin")

    args = parser.parse_args()

    try:
        if args.stdin or (not args.category and not args.text):
            # Read from stdin
            data = json.load(sys.stdin)
            category = data.get("category", "observation")
            text = data.get("text", "")
            source = data.get("source", "agent")
            context = data.get("context", {})
        else:
            # Use command line args
            category = args.category or "observation"
            text = args.text or ""
            source = args.source
            context = json.loads(args.context) if args.context else {}

        if not text:
            print(json.dumps({"error": "text is required"}), file=sys.stderr)
            sys.exit(1)

        add_retro_item(category, text, source, context)
        total = count_items()

        result = {
            "success": True,
            "category": category,
            "total_items": total
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
