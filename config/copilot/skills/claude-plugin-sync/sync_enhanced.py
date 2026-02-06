#!/usr/bin/env python3
"""
Enhanced sync tool that uses usage statistics, dependency graphs,
and manifest control to sync Claude Code extensions to Copilot.
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Set

from claude_config import ClaudeConfig
from dependency_graph import DependencyScanner, Extension
from manifest import SyncManifest, ManifestGenerator
from name_mapping import NameMapper, ReferenceRewriter
from sync import (
    write_if_changed,
    create_symlink,
    clean_stale_items,
    clean_stale_commands,
    DEFAULT_PATHS
)


def sync_extension(extension: Extension, copilot_dir: Path, name_mapper: NameMapper,
                   synced_set: Set[str], is_skill: bool = True) -> bool:
    """Sync a single extension to Copilot.

    Args:
        extension: Extension to sync
        copilot_dir: Target directory (skills or agents)
        name_mapper: NameMapper for consistent naming
        synced_set: Set to track synced names (modified in place)
        is_skill: True if syncing to skills, False if agents

    Returns:
        True if extension was added/updated
    """
    # Get Copilot-compatible name
    copilot_name = name_mapper.register_extension(extension.full_name)

    # Read and rewrite content
    content = extension.file_path.read_text()
    rewritten_content = ReferenceRewriter.rewrite_content(content, name_mapper)

    if is_skill:
        # Skills are directories with SKILL.md
        target_dir = copilot_dir / copilot_name
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / "SKILL.md"
    else:
        # Agents are .agent.md files
        if not copilot_name.endswith('.agent'):
            copilot_name = f"{copilot_name}.agent"
        target_file = copilot_dir / f"{copilot_name}.md"
        # Ensure parent directory exists
        target_file.parent.mkdir(parents=True, exist_ok=True)

    # Write if changed
    changed = write_if_changed(target_file, rewritten_content)

    synced_set.add(copilot_name)
    return changed


def run_sync(manifest_path: Path = None, dry_run: bool = False,
             generate_manifest: bool = False) -> Dict[str, int]:
    """Run the enhanced sync process.

    Args:
        manifest_path: Path to sync manifest (defaults to ~/.copilot/sync-manifest.json)
        dry_run: If True, show what would be synced without actually syncing
        generate_manifest: If True, generate a new manifest from usage stats

    Returns:
        Dictionary with sync statistics
    """
    stats = {
        'added_skills': 0,
        'added_agents': 0,
        'removed_skills': 0,
        'removed_agents': 0,
        'total_synced': 0
    }

    # Setup paths
    if manifest_path is None:
        manifest_path = Path.home() / ".copilot" / "sync-manifest.json"

    copilot_skills_dir = DEFAULT_PATHS['copilot_skills_dir']
    copilot_agents_dir = DEFAULT_PATHS['copilot_agents_dir']
    plugins_cache = Path.home() / ".claude" / "plugins" / "cache"

    print(f"Claude Plugin Enhanced Sync - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Load Claude configuration
    print("\n[1/6] Loading Claude configuration...")
    config = ClaudeConfig.from_file()
    print(f"  ✓ Found {len(config.skill_usage)} skill usage records")

    # Build dependency graph
    print("\n[2/6] Building dependency graph...")
    graph = DependencyScanner.scan_all_plugins(plugins_cache)
    print(f"  ✓ Found {len(graph.extensions)} extensions")

    # Load or generate manifest
    print("\n[3/6] Processing sync manifest...")
    if generate_manifest or not manifest_path.exists():
        print("  → Generating manifest from usage statistics...")
        manifest = ManifestGenerator.generate_from_usage(config, graph, top_n=10, min_usage=3)
        manifest.save(manifest_path)
        print(f"  ✓ Generated manifest with {len(manifest.sync_rules)} rules")
    else:
        manifest = SyncManifest.load(manifest_path)
        print(f"  ✓ Loaded manifest with {len(manifest.sync_rules)} rules")

    # Determine what to sync
    print("\n[4/6] Determining sync set...")
    extensions_to_sync = manifest.get_extensions_to_sync(config, graph)
    print(f"  ✓ Will sync {len(extensions_to_sync)} extensions (with dependencies)")

    if dry_run:
        print("\n[DRY RUN] Would sync:")
        for ext in sorted(extensions_to_sync, key=lambda e: e.full_name):
            deps = graph.get_all_dependencies(ext.full_name)
            dep_indicator = f" (+{len(deps)} deps)" if deps else ""
            print(f"  - {ext.full_name} ({ext.type.value}){dep_indicator}")
        return stats

    # Initialize name mapper
    name_mapper = NameMapper()

    # Pre-register all extensions for consistent naming
    for ext in extensions_to_sync:
        name_mapper.register_extension(ext.full_name)

    # Track what we sync
    synced_skills = set()
    synced_agents = set()

    # Sync extensions
    print("\n[5/6] Syncing extensions...")
    for ext in extensions_to_sync:
        if ext.type.value in ['skill', 'command']:
            changed = sync_extension(ext, copilot_skills_dir, name_mapper, synced_skills, is_skill=True)
            if changed:
                stats['added_skills'] += 1
        elif ext.type.value == 'agent':
            changed = sync_extension(ext, copilot_agents_dir, name_mapper, synced_agents, is_skill=False)
            if changed:
                stats['added_agents'] += 1

    stats['total_synced'] = len(extensions_to_sync)

    # Clean stale items
    print("\n[6/6] Cleaning stale items...")
    if manifest.remove_stale:
        # For now, skip cleaning since we don't have previous manifest state
        # In a real implementation, we'd track previously synced items
        print("  ℹ Skipping stale cleanup (not implemented in this version)")

    # Update manifest timestamp
    manifest.sync_timestamp = datetime.now()
    manifest.save(manifest_path)

    # Print summary
    print("\n" + "="*60)
    print("SYNC COMPLETE")
    print("="*60)
    print(f"Skills:  +{stats['added_skills']} (total: {len(synced_skills)})")
    print(f"Agents:  +{stats['added_agents']} (total: {len(synced_agents)})")
    print(f"Total:   {stats['total_synced']} extensions synced")
    print(f"\nManifest: {manifest_path}")

    return stats


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Enhanced Claude Code plugin sync with dependency tracking"
    )
    parser.add_argument(
        '--manifest',
        type=Path,
        help='Path to sync manifest (default: ~/.copilot/sync-manifest.json)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be synced without actually syncing'
    )
    parser.add_argument(
        '--generate-manifest',
        action='store_true',
        help='Generate a new manifest from usage statistics'
    )
    parser.add_argument(
        '--init',
        action='store_true',
        help='Initialize with a template manifest'
    )

    args = parser.parse_args()

    try:
        if args.init:
            manifest_path = args.manifest or (Path.home() / ".copilot" / "sync-manifest.json")
            manifest = ManifestGenerator.generate_empty_template()
            manifest.save(manifest_path)
            print(f"✓ Template manifest created at: {manifest_path}")
            print("\nEdit this file to customize which extensions are synced.")
            return 0

        run_sync(
            manifest_path=args.manifest,
            dry_run=args.dry_run,
            generate_manifest=args.generate_manifest
        )
        return 0

    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
