#!/usr/bin/env python3
"""
Validate if topic has sufficient planning context.
"""

import sys
import json


def validate_context_sufficiency(summary: str) -> tuple[bool, str]:
    """Check if topic summary has sufficient context."""
    summary = summary.strip()

    if len(summary) < 20:
        return False, "Summary too brief (min 20 chars)"

    # Problem words
    problem_words = [
        "fix", "bug", "issue", "error", "problem", "broken", "fails",
        "correct", "improve", "resolve", "handle"
    ]
    has_problem = any(word in summary.lower() for word in problem_words)

    # Outcome words
    outcome_words = [
        "add", "implement", "create", "enable", "support", "improve",
        "refactor", "enhance", "consolidate", "centralize"
    ]
    has_outcome = any(word in summary.lower() for word in outcome_words)

    # Area patterns
    area_patterns = [
        "tool", "module", "component", "system", "handler", "manager",
        "service", "layer", "interface", "bridge", "adapter", "endpoint"
    ]
    has_area = any(pattern in summary.lower() for pattern in area_patterns)

    # Need 2 of 3
    indicators = sum([has_problem, has_outcome, has_area])
    if indicators >= 2:
        return True, ""

    # Build feedback
    missing = []
    if not has_problem and not has_outcome:
        missing.append("problem/outcome")
    if not has_area:
        missing.append("project areas")

    feedback = f"Need: {', '.join(missing)}"
    return False, feedback


def main():
    """Validate context."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No summary provided"}))
        sys.exit(1)

    summary = sys.argv[1]
    is_sufficient, feedback = validate_context_sufficiency(summary)

    result = {
        "valid": is_sufficient,
        "feedback": feedback
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
