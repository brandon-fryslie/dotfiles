#!/usr/bin/env python3
"""
Canonical naming and reference rewriting for cross-platform compatibility.

This module handles the translation of extension names between different
platforms (Claude Code vs Copilot CLI) and ensures all references are
rewritten consistently.
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple


@dataclass
class NamingRule:
    """A rule for transforming extension names."""
    source_pattern: str
    target_format: str
    description: str

    def apply(self, name: str) -> str:
        """Apply this rule to a name.

        Args:
            name: Original name

        Returns:
            Transformed name
        """
        # Simple pattern replacement
        return re.sub(self.source_pattern, self.target_format, name)


class NameMapper:
    """Maps extension names between platforms and tracks all references."""

    # Rules for transforming Claude Code names to Copilot names
    CLAUDE_TO_COPILOT_RULES = [
        NamingRule(
            source_pattern=r':',
            target_format='-',
            description="Replace colons with hyphens (do:plan -> do-plan)"
        ),
        NamingRule(
            source_pattern=r'/',
            target_format='',
            description="Remove leading slashes (/do:plan -> do:plan)"
        ),
    ]

    # Rules for transforming Copilot names back to Claude Code
    COPILOT_TO_CLAUDE_RULES = [
        # Note: This is lossy - we can't reliably convert back without a mapping
    ]

    def __init__(self):
        """Initialize the name mapper."""
        # Canonical mapping: claude_name -> copilot_name
        self.canonical_map: Dict[str, str] = {}
        # Reverse mapping: copilot_name -> claude_name
        self.reverse_map: Dict[str, str] = {}
        # Track where each name is referenced: claude_name -> Set[file_paths]
        self.references: Dict[str, Set[str]] = {}

    def register_extension(self, claude_name: str, copilot_name: str = None) -> str:
        """Register an extension and get its canonical Copilot name.

        Args:
            claude_name: Original Claude Code name
            copilot_name: Optional explicit Copilot name (auto-computed if not provided)

        Returns:
            The canonical Copilot name for this extension
        """
        if claude_name in self.canonical_map:
            return self.canonical_map[claude_name]

        if copilot_name is None:
            copilot_name = self.transform_to_copilot(claude_name)

        # Handle collisions by appending numbers
        original_copilot_name = copilot_name
        counter = 2
        while copilot_name in self.reverse_map and self.reverse_map[copilot_name] != claude_name:
            copilot_name = f"{original_copilot_name}-{counter}"
            counter += 1

        self.canonical_map[claude_name] = copilot_name
        self.reverse_map[copilot_name] = claude_name
        self.references[claude_name] = set()

        return copilot_name

    def transform_to_copilot(self, claude_name: str) -> str:
        """Transform a Claude Code name to Copilot format.

        Args:
            claude_name: Claude Code extension name

        Returns:
            Copilot-compatible name
        """
        name = claude_name

        # Apply all transformation rules
        for rule in self.CLAUDE_TO_COPILOT_RULES:
            name = rule.apply(name)

        # Additional validation/cleanup
        name = name.lower()
        name = re.sub(r'[^a-z0-9-]', '-', name)
        name = re.sub(r'-+', '-', name)
        name = name.strip('-')
        name = name[:64]  # Max length for Copilot skill names

        return name

    def record_reference(self, claude_name: str, file_path: str) -> None:
        """Record that an extension is referenced in a file.

        Args:
            claude_name: Claude Code extension name being referenced
            file_path: Path to the file containing the reference
        """
        if claude_name not in self.references:
            self.references[claude_name] = set()
        self.references[claude_name].add(file_path)

    def is_registered(self, claude_name: str) -> bool:
        """Check whether an extension has been registered.

        Args:
            claude_name: Claude Code extension name

        Returns:
            True if the name was registered via register_extension
        """
        return claude_name in self.canonical_map

    def get_copilot_name(self, claude_name: str) -> str:
        """Get the Copilot name for a registered Claude Code extension.

        Args:
            claude_name: Claude Code extension name

        Returns:
            Copilot name

        Raises:
            KeyError: If the name was never registered.
                [LAW:effects-at-boundaries] a lookup must not mutate the
                map — auto-registering here let regex false-positives mint
                garbage canonical names and collision suffixes.
        """
        return self.canonical_map[claude_name]

    def get_claude_name(self, copilot_name: str) -> str:
        """Get the original Claude Code name from a Copilot name.

        Args:
            copilot_name: Copilot extension name

        Returns:
            Original Claude Code name, or copilot_name if not found
        """
        return self.reverse_map.get(copilot_name, copilot_name)

    def get_reference_locations(self, claude_name: str) -> Set[str]:
        """Get all files that reference this extension.

        Args:
            claude_name: Claude Code extension name

        Returns:
            Set of file paths that reference this extension
        """
        return self.references.get(claude_name, set())


class ReferenceRewriter:
    """Rewrites extension references in file content."""

    # Each entry: (pattern, extract claude name from match, build replacement
    # from match + copilot name). Extraction and replacement are declared per
    # pattern so validation can live at a single gate in rewrite_content.
    # [LAW:no-silent-failure] the command pattern is anchored to start-of-line
    # or whitespace — mid-token slash-colon text (paths like src/utils:helpers,
    # owner/repo:branch, timestamps) must never read as a command invocation.
    REFERENCE_PATTERNS = [
        # Command invocations: /do:plan
        (r'(?<!\S)/([\w-]+):([\w-]+)',
         lambda m: f'{m.group(1)}:{m.group(2)}',
         lambda m, copilot_name: f'skill {copilot_name}'),

        # Skill() calls: Skill("do:plan")
        (r'Skill\(["\']([^"\']+)["\']\)',
         lambda m: m.group(1),
         lambda m, copilot_name: f'Skill("{copilot_name}")'),

        # skill references: "skill do:plan"
        (r'\bskill\s+([\w-]+):([\w-]+)',
         lambda m: f'{m.group(1)}:{m.group(2)}',
         lambda m, copilot_name: f'skill {copilot_name}'),

        # agent_type/subagent_type: subagent_type="do:iterative-implementer"
        (r'(subagent_type|agent_type)=["\']([^"\']+)["\']',
         lambda m: m.group(2),
         lambda m, copilot_name: f'{m.group(1)}="{copilot_name}"'),
    ]

    @classmethod
    def rewrite_content(cls, content: str, name_mapper: NameMapper) -> str:
        """Rewrite registered extension references in content.

        Text that merely looks like a reference but does not name a
        registered extension is left verbatim.

        Args:
            content: Original content
            name_mapper: NameMapper with registered extensions

        Returns:
            Content with rewritten references
        """
        rewritten = content

        for pattern, extract_name, build_replacement in cls.REFERENCE_PATTERNS:
            # Find all matches
            matches = list(re.finditer(pattern, rewritten))

            # Rewrite in reverse order to preserve indices
            for match in reversed(matches):
                claude_name = extract_name(match)
                # [LAW:single-enforcer] the only rewrite-eligibility check:
                # a match is a reference iff it names a registered extension.
                if not name_mapper.is_registered(claude_name):
                    continue
                replacement = build_replacement(match, name_mapper.get_copilot_name(claude_name))
                start, end = match.span()
                rewritten = rewritten[:start] + replacement + rewritten[end:]

        return rewritten

    @classmethod
    def extract_references(cls, content: str) -> Set[str]:
        """Extract every syntactic extension reference from content.

        Purely syntactic and deliberately unfiltered: extraction serves
        dependency *discovery*, which runs before registration — so unlike
        rewrite_content it must not gate on a NameMapper. A name returned
        here is a candidate, not a promise that rewrite_content would
        rewrite it.

        Args:
            content: File content to analyze

        Returns:
            Set of candidate Claude Code extension names referenced
        """
        references = set()

        for pattern, extract_name, _ in cls.REFERENCE_PATTERNS:
            for match in re.finditer(pattern, content):
                references.add(extract_name(match))

        return references


def main():
    """Example usage."""
    mapper = NameMapper()

    # Register some extensions
    claude_names = [
        "do:plan",
        "do:it",
        "do:project-evaluator",
        "ralph-loop:ralph-loop",
    ]

    print("Name Transformations:")
    for name in claude_names:
        copilot_name = mapper.register_extension(name)
        print(f"  {name:30} -> {copilot_name}")

    # Example content rewriting
    content = """
    Use /do:plan to create a plan.
    Then invoke Skill("do:it") to implement.
    Use the project-evaluator agent with subagent_type="do:project-evaluator".
    You can also use skill ralph-loop:ralph-loop for iteration.
    """

    print("\n\nOriginal Content:")
    print(content)

    rewritten = ReferenceRewriter.rewrite_content(content, mapper)
    print("\nRewritten Content:")
    print(rewritten)


if __name__ == '__main__':
    main()
