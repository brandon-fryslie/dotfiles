#!/usr/bin/env python3
"""
Build and analyze dependency graphs for Claude Code extensions.

This module scans skills, agents, and commands to identify cross-references
and builds a dependency graph that can be used to determine what needs to
be synced together.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from enum import Enum


class ExtensionType(Enum):
    """Types of Claude Code extensions."""
    SKILL = "skill"
    AGENT = "agent"
    COMMAND = "command"


@dataclass
class Extension:
    """Represents a Claude Code extension (skill, agent, or command)."""
    name: str
    type: ExtensionType
    plugin: str
    file_path: Path
    references: Set[str] = field(default_factory=set)

    @property
    def full_name(self) -> str:
        """Get the full namespaced name."""
        return f"{self.plugin}:{self.name}" if self.plugin else self.name

    def __hash__(self):
        return hash((self.name, self.type, self.plugin))

    def __eq__(self, other):
        if not isinstance(other, Extension):
            return False
        return (self.name == other.name and
                self.type == other.type and
                self.plugin == other.plugin)


@dataclass
class DependencyGraph:
    """Dependency graph for Claude Code extensions."""
    extensions: Dict[str, Extension] = field(default_factory=dict)
    # Map from extension full_name to set of full_names it references
    dependencies: Dict[str, Set[str]] = field(default_factory=dict)
    # Reverse mapping: which extensions reference this one
    reverse_dependencies: Dict[str, Set[str]] = field(default_factory=dict)

    def add_extension(self, extension: Extension) -> None:
        """Add an extension to the graph."""
        full_name = extension.full_name
        self.extensions[full_name] = extension
        if full_name not in self.dependencies:
            self.dependencies[full_name] = set()
        if full_name not in self.reverse_dependencies:
            self.reverse_dependencies[full_name] = set()

    def add_dependency(self, from_ext: str, to_ext: str) -> None:
        """Add a dependency edge from one extension to another.

        Args:
            from_ext: Full name of the extension that has the dependency
            to_ext: Full name of the extension being referenced
        """
        if from_ext not in self.dependencies:
            self.dependencies[from_ext] = set()
        if to_ext not in self.reverse_dependencies:
            self.reverse_dependencies[to_ext] = set()

        self.dependencies[from_ext].add(to_ext)
        self.reverse_dependencies[to_ext].add(from_ext)

    def get_all_dependencies(self, extension_name: str, visited: Optional[Set[str]] = None) -> Set[str]:
        """Get all transitive dependencies for an extension.

        Args:
            extension_name: Full name of the extension
            visited: Set of already visited extensions (for cycle detection)

        Returns:
            Set of all dependency full names (transitively)
        """
        if visited is None:
            visited = set()

        if extension_name in visited:
            return set()  # Cycle detection

        visited.add(extension_name)
        deps = set(self.dependencies.get(extension_name, set()))

        # Recursively get dependencies of dependencies
        for dep in list(deps):
            deps.update(self.get_all_dependencies(dep, visited))

        return deps

    def get_all_dependents(self, extension_name: str, visited: Optional[Set[str]] = None) -> Set[str]:
        """Get all extensions that depend on this one (transitively).

        Args:
            extension_name: Full name of the extension
            visited: Set of already visited extensions (for cycle detection)

        Returns:
            Set of all dependent extension full names
        """
        if visited is None:
            visited = set()

        if extension_name in visited:
            return set()

        visited.add(extension_name)
        dependents = set(self.reverse_dependencies.get(extension_name, set()))

        # Recursively get dependents of dependents
        for dep in list(dependents):
            dependents.update(self.get_all_dependents(dep, visited))

        return dependents

    def get_sync_set(self, extension_names: List[str]) -> Set[Extension]:
        """Get the complete set of extensions that need to be synced together.

        This includes all requested extensions plus their transitive dependencies.

        Args:
            extension_names: List of extension full names to sync

        Returns:
            Set of Extension objects to sync
        """
        sync_names = set(extension_names)

        # Add all transitive dependencies
        for name in extension_names:
            sync_names.update(self.get_all_dependencies(name))

        # Convert names to Extension objects
        return {self.extensions[name] for name in sync_names if name in self.extensions}


class DependencyScanner:
    """Scans Claude Code extension files to build dependency graphs."""

    # Patterns to match extension references
    PATTERNS = {
        # Skill references: "skill do:plan", "/do:plan", "skill(\"do:plan\")"
        'skill': [
            r'skill\s+([a-z0-9-]+:[a-z0-9-]+)',
            r'/([a-z0-9-]+:[a-z0-9-]+)',
            r'[Ss]kill\(["\']([a-z0-9:-]+)["\']\)',
        ],
        # Agent references: "use the project-evaluator agent", "Task(subagent_type=\"do:iterative-implementer\")"
        'agent': [
            r'(?:use|spawn|launch|call)\s+(?:the\s+)?([a-z0-9-]+(?:-[a-z0-9-]+)*)\s+agent',
            r'subagent_type=["\']([a-z0-9:-]+)["\']',
            r'agent_type=["\']([a-z0-9:-]+)["\']',
        ],
    }

    @classmethod
    def scan_file(cls, file_path: Path) -> Set[str]:
        """Scan a file for extension references.

        Args:
            file_path: Path to the file to scan

        Returns:
            Set of referenced extension names
        """
        references = set()

        try:
            content = file_path.read_text()

            # Try all patterns
            for patterns in cls.PATTERNS.values():
                for pattern in patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        ref = match.group(1)
                        # Normalize reference
                        references.add(ref)

        except Exception as e:
            # Silently skip files we can't read
            pass

        return references

    @classmethod
    def scan_plugin(cls, plugin_path: Path, plugin_name: str) -> DependencyGraph:
        """Scan a plugin directory and build its dependency graph.

        Args:
            plugin_path: Path to the plugin directory
            plugin_name: Name of the plugin

        Returns:
            DependencyGraph with all extensions and their dependencies
        """
        graph = DependencyGraph()

        # Scan skills
        skills_dir = plugin_path / "skills"
        if skills_dir.exists():
            for skill_dir in skills_dir.iterdir():
                if skill_dir.is_dir():
                    skill_file = skill_dir / "SKILL.md"
                    if skill_file.exists():
                        ext = Extension(
                            name=skill_dir.name,
                            type=ExtensionType.SKILL,
                            plugin=plugin_name,
                            file_path=skill_file,
                            references=cls.scan_file(skill_file)
                        )
                        graph.add_extension(ext)

        # Scan agents
        agents_dir = plugin_path / "agents"
        if agents_dir.exists():
            for agent_file in agents_dir.glob("*.md"):
                ext = Extension(
                    name=agent_file.stem.replace('.agent', ''),
                    type=ExtensionType.AGENT,
                    plugin=plugin_name,
                    file_path=agent_file,
                    references=cls.scan_file(agent_file)
                )
                graph.add_extension(ext)

        # Scan commands
        commands_dir = plugin_path / "commands"
        if commands_dir.exists():
            for command_file in commands_dir.glob("*.md"):
                ext = Extension(
                    name=command_file.stem,
                    type=ExtensionType.COMMAND,
                    plugin=plugin_name,
                    file_path=command_file,
                    references=cls.scan_file(command_file)
                )
                graph.add_extension(ext)

        # Build dependency edges
        for ext in graph.extensions.values():
            for ref in ext.references:
                # Try to resolve the reference
                resolved = cls._resolve_reference(ref, plugin_name, graph)
                if resolved:
                    graph.add_dependency(ext.full_name, resolved)

        return graph

    @classmethod
    def _resolve_reference(cls, ref: str, current_plugin: str, graph: DependencyGraph) -> Optional[str]:
        """Resolve a reference to a full extension name.

        Args:
            ref: The reference string (e.g., "do:plan", "project-evaluator")
            current_plugin: The plugin making the reference
            graph: The current dependency graph

        Returns:
            Full extension name if resolved, None otherwise
        """
        # If reference already has plugin prefix, use as-is
        if ':' in ref:
            return ref

        # Try with current plugin prefix first
        candidate = f"{current_plugin}:{ref}"
        if candidate in graph.extensions:
            return candidate

        # Try without plugin prefix (built-in or global)
        if ref in graph.extensions:
            return ref

        # Try all known extensions (fuzzy match)
        for ext_name in graph.extensions:
            if ext_name.endswith(f":{ref}") or ext_name.endswith(f"-{ref}"):
                return ext_name

        return None

    @classmethod
    def scan_all_plugins(cls, plugins_dir: Path) -> DependencyGraph:
        """Scan all plugins and build a unified dependency graph.

        Args:
            plugins_dir: Path to the plugins cache directory

        Returns:
            Unified DependencyGraph with all plugins
        """
        unified_graph = DependencyGraph()

        if not plugins_dir.exists():
            return unified_graph

        # Find all plugin paths in the cache
        # Structure can be: cache/plugin-name/ or cache/org/plugin-name/version/
        plugin_paths = []

        for item in plugins_dir.rglob("*"):
            if not item.is_dir():
                continue

            # Check if this directory looks like a plugin root
            # (has skills/, agents/, or commands/ subdirectories)
            has_extensions = (
                (item / "skills").exists() or
                (item / "agents").exists() or
                (item / "commands").exists()
            )

            if has_extensions:
                # Determine plugin name from path
                # For loom99/do/0.5.23 -> "do"
                # For plugin-name -> "plugin-name"
                parts = item.relative_to(plugins_dir).parts
                if len(parts) >= 2:
                    plugin_name = parts[1] if parts[0] != plugins_dir.name else parts[0]
                else:
                    plugin_name = parts[0]

                plugin_paths.append((plugin_name, item))

        # Scan each plugin
        for plugin_name, plugin_path in plugin_paths:
            plugin_graph = cls.scan_plugin(plugin_path, plugin_name)

            # Merge into unified graph
            for ext in plugin_graph.extensions.values():
                unified_graph.add_extension(ext)
            for from_ext, to_exts in plugin_graph.dependencies.items():
                for to_ext in to_exts:
                    unified_graph.add_dependency(from_ext, to_ext)

        return unified_graph


def main():
    """Example usage."""
    plugins_cache = Path.home() / ".claude" / "plugins" / "cache"

    print("Scanning plugins...")
    graph = DependencyScanner.scan_all_plugins(plugins_cache)

    print(f"\nFound {len(graph.extensions)} extensions")

    # Example: show dependencies for do:plan
    if "do:do-plan" in graph.extensions:
        ext = graph.extensions["do:do-plan"]
        deps = graph.get_all_dependencies(ext.full_name)
        print(f"\n{ext.full_name} dependencies:")
        for dep in sorted(deps):
            print(f"  - {dep}")

        # Show what needs to be synced together
        sync_set = graph.get_sync_set([ext.full_name])
        print(f"\nTo sync {ext.full_name}, need {len(sync_set)} extensions total:")
        for s_ext in sorted(sync_set, key=lambda e: e.full_name):
            print(f"  - {s_ext.full_name} ({s_ext.type.value})")


if __name__ == '__main__':
    main()
