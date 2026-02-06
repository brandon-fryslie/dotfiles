#!/usr/bin/env python3
"""
Manifest-based sync control for Claude Code extensions.

This module provides a manifest file format that allows manual control
over what gets synced to Copilot, with support for auto-including
dependencies and usage-based suggestions.
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set

from claude_config import ClaudeConfig, SkillUsageStats
from dependency_graph import DependencyGraph, Extension, DependencyScanner


@dataclass
class SyncRule:
    """A rule for syncing an extension."""
    extension_name: str
    include_dependencies: bool = True
    priority: int = 0  # Higher priority = synced first
    notes: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            'extension': self.extension_name,
            'includeDependencies': self.include_dependencies,
            'priority': self.priority,
            'notes': self.notes
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'SyncRule':
        """Create from dictionary."""
        return cls(
            extension_name=data['extension'],
            include_dependencies=data.get('includeDependencies', True),
            priority=data.get('priority', 0),
            notes=data.get('notes', '')
        )


@dataclass
class SyncManifest:
    """Manifest controlling what gets synced to Copilot."""

    # Manual sync rules
    sync_rules: List[SyncRule] = field(default_factory=list)

    # Auto-sync rules
    auto_sync_most_used: bool = False
    auto_sync_count: int = 10
    auto_sync_min_usage: int = 5

    # Global options
    remove_stale: bool = True
    sync_timestamp: Optional[datetime] = None

    # Sync history - tracks what was synced for unsync
    last_sync_files: List[str] = field(default_factory=list)

    # Metadata
    version: str = "1.0"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'version': self.version,
            'syncRules': [rule.to_dict() for rule in self.sync_rules],
            'autoSync': {
                'enabled': self.auto_sync_most_used,
                'count': self.auto_sync_count,
                'minUsage': self.auto_sync_min_usage
            },
            'options': {
                'removeStale': self.remove_stale
            },
            'metadata': {
                'lastSync': self.sync_timestamp.isoformat() if self.sync_timestamp else None
            }
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'SyncManifest':
        """Create from dictionary."""
        sync_rules = [SyncRule.from_dict(rule) for rule in data.get('syncRules', [])]
        auto_sync = data.get('autoSync', {})
        options = data.get('options', {})
        metadata = data.get('metadata', {})

        last_sync = metadata.get('lastSync')
        if last_sync:
            last_sync = datetime.fromisoformat(last_sync)

        return cls(
            sync_rules=sync_rules,
            auto_sync_most_used=auto_sync.get('enabled', False),
            auto_sync_count=auto_sync.get('count', 10),
            auto_sync_min_usage=auto_sync.get('minUsage', 5),
            remove_stale=options.get('removeStale', True),
            sync_timestamp=last_sync,
            version=data.get('version', '1.0')
        )

    @classmethod
    def load(cls, path: Path) -> 'SyncManifest':
        """Load manifest from file."""
        if not path.exists():
            return cls()

        with open(path) as f:
            data = json.load(f)

        return cls.from_dict(data)

    def save(self, path: Path) -> None:
        """Save manifest to file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)

    def add_sync_rule(self, extension_name: str, include_deps: bool = True,
                      priority: int = 0, notes: str = "") -> None:
        """Add a sync rule to the manifest.

        Args:
            extension_name: Name of the extension to sync
            include_deps: Whether to include dependencies
            priority: Priority level (higher = synced first)
            notes: Optional notes about this rule
        """
        # Remove existing rule for this extension
        self.sync_rules = [r for r in self.sync_rules if r.extension_name != extension_name]

        # Add new rule
        self.sync_rules.append(SyncRule(
            extension_name=extension_name,
            include_dependencies=include_deps,
            priority=priority,
            notes=notes
        ))

    def remove_sync_rule(self, extension_name: str) -> bool:
        """Remove a sync rule from the manifest.

        Args:
            extension_name: Name of the extension

        Returns:
            True if a rule was removed, False otherwise
        """
        original_count = len(self.sync_rules)
        self.sync_rules = [r for r in self.sync_rules if r.extension_name != extension_name]
        return len(self.sync_rules) < original_count

    def get_extensions_to_sync(self, claude_config: ClaudeConfig,
                               dependency_graph: DependencyGraph) -> Set[Extension]:
        """Determine which extensions should be synced based on manifest rules.

        Args:
            claude_config: Claude Code configuration with usage stats
            dependency_graph: Dependency graph of all extensions

        Returns:
            Set of Extension objects to sync
        """
        extensions_to_sync = set()

        # Add manually specified extensions
        for rule in self.sync_rules:
            ext_name = rule.extension_name
            if ext_name in dependency_graph.extensions:
                extensions_to_sync.add(dependency_graph.extensions[ext_name])

                # Add dependencies if requested
                if rule.include_dependencies:
                    deps = dependency_graph.get_all_dependencies(ext_name)
                    for dep_name in deps:
                        if dep_name in dependency_graph.extensions:
                            extensions_to_sync.add(dependency_graph.extensions[dep_name])

        # Add auto-sync extensions based on usage
        if self.auto_sync_most_used:
            most_used = claude_config.get_most_used_skills(self.auto_sync_count)
            for stats in most_used:
                if stats.usage_count >= self.auto_sync_min_usage:
                    # Try to find this extension in the graph
                    for ext_name, ext in dependency_graph.extensions.items():
                        if (ext_name == stats.skill_name or
                            ext_name.endswith(f":{stats.skill_name}") or
                            ext_name.endswith(f"-{stats.skill_name}")):
                            extensions_to_sync.add(ext)

                            # Include dependencies for auto-sync too
                            deps = dependency_graph.get_all_dependencies(ext_name)
                            for dep_name in deps:
                                if dep_name in dependency_graph.extensions:
                                    extensions_to_sync.add(dependency_graph.extensions[dep_name])
                            break

        return extensions_to_sync


class ManifestGenerator:
    """Generate sync manifests from usage statistics."""

    @staticmethod
    def generate_from_usage(claude_config: ClaudeConfig,
                           dependency_graph: DependencyGraph,
                           top_n: int = 10,
                           min_usage: int = 5) -> SyncManifest:
        """Generate a manifest based on most-used skills.

        Args:
            claude_config: Claude Code configuration
            dependency_graph: Dependency graph
            top_n: Number of top skills to include
            min_usage: Minimum usage count to include

        Returns:
            Generated SyncManifest
        """
        manifest = SyncManifest()

        most_used = claude_config.get_most_used_skills(top_n)

        for stats in most_used:
            if stats.usage_count < min_usage:
                continue

            # Find the extension in the graph
            for ext_name, ext in dependency_graph.extensions.items():
                if (ext_name == stats.skill_name or
                    ext_name.endswith(f":{stats.skill_name}") or
                    ext_name.endswith(f"-{stats.skill_name}")):

                    manifest.add_sync_rule(
                        extension_name=ext_name,
                        include_deps=True,
                        priority=stats.usage_count,
                        notes=f"Used {stats.usage_count} times, last used {stats.days_since_last_use} days ago"
                    )
                    break

        return manifest

    @staticmethod
    def generate_empty_template() -> SyncManifest:
        """Generate an empty template manifest with examples.

        Returns:
            Template SyncManifest with example rules
        """
        manifest = SyncManifest()

        # Add example rules
        manifest.add_sync_rule(
            extension_name="do:plan",
            include_deps=True,
            priority=100,
            notes="Essential planning workflow"
        )

        manifest.add_sync_rule(
            extension_name="do:it",
            include_deps=True,
            priority=90,
            notes="Essential implementation workflow"
        )

        # Enable auto-sync
        manifest.auto_sync_most_used = True
        manifest.auto_sync_count = 10
        manifest.auto_sync_min_usage = 5

        return manifest


def main():
    """Example usage."""
    # Load Claude config and dependency graph
    print("Loading Claude configuration...")
    config = ClaudeConfig.from_file()

    print("Building dependency graph...")
    plugins_cache = Path.home() / ".claude" / "plugins" / "cache"
    graph = DependencyScanner.scan_all_plugins(plugins_cache)

    # Generate manifest from usage
    print("\nGenerating manifest from usage statistics...")
    manifest = ManifestGenerator.generate_from_usage(config, graph, top_n=5)

    print(f"\nGenerated {len(manifest.sync_rules)} sync rules:")
    for rule in sorted(manifest.sync_rules, key=lambda r: r.priority, reverse=True):
        print(f"  [{rule.priority:3d}] {rule.extension_name}")
        if rule.notes:
            print(f"        {rule.notes}")

    # Get extensions to sync
    extensions = manifest.get_extensions_to_sync(config, graph)
    print(f"\nTotal extensions to sync (with dependencies): {len(extensions)}")

    # Save manifest
    manifest_path = Path.home() / ".copilot" / "sync-manifest.json"
    manifest.save(manifest_path)
    print(f"\nManifest saved to: {manifest_path}")


if __name__ == '__main__':
    main()
