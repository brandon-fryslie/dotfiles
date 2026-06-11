#!/usr/bin/env python3
"""
Enhanced sync tool that uses usage statistics, dependency graphs,
and manifest control to select which Claude Code extensions to sync to Copilot.

Selection (what to sync) lives here; materialization (how to sync) is owned
entirely by sync.py's per-item functions, so the two tools cannot drift.
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Set

from claude_config import ClaudeConfig
from dependency_graph import DependencyScanner, Extension, ExtensionType
from manifest import SyncManifest, ManifestGenerator
from sync import (
    sync_skill_item,
    sync_agent_item,
    sync_command_item,
    clean_stale_items,
    clean_stale_commands,
    load_manifest,
    create_manifest,
    save_manifest,
    preserve_removed_entries,
    ALLOWED_SKILL_FIELDS,
    DEFAULT_PATHS
)


def sync_extensions(extensions: Iterable[Extension], paths: Dict[str, Path],
                    remove_stale: bool = True) -> Dict[str, int]:
    """Materialize a selected set of extensions into the Copilot directories.

    Routes every extension through sync.py's per-item functions
    ([LAW:single-enforcer] — one owner for naming, transforms, and the
    manifest record) and records the result in the shared sync-record
    manifest that unsync.py reads. The record manifest reflects the latest
    sync run, whichever tool performed it.

    Args:
        extensions: Extensions to sync (skills, agents, commands)
        paths: Path configuration (same shape as sync.DEFAULT_PATHS)
        remove_stale: If True, remove previously synced items no longer selected

    Returns:
        Dictionary with sync statistics
    """
    skills_dir = paths['copilot_skills_dir']
    agents_dir = paths['copilot_agents_dir']
    skills_dir.mkdir(parents=True, exist_ok=True)
    agents_dir.mkdir(parents=True, exist_ok=True)

    previous_manifest = load_manifest(paths['manifest_file'])
    manifest = create_manifest()

    synced_skills: Set[str] = set()
    synced_agents: Set[str] = set()
    synced_commands: Set[str] = set()
    stats = {
        'added_skills': 0,
        'added_agents': 0,
        'added_commands': 0,
        'removed_skills': 0,
        'removed_agents': 0,
        'removed_commands': 0,
        'total_synced': 0
    }

    for ext in sorted(extensions, key=lambda e: e.full_name):
        if ext.type is ExtensionType.SKILL:
            # file_path is the SKILL.md; symlink the whole skill directory so
            # supporting files (bin/, references/, scripts) survive the sync
            if sync_skill_item(ext.name, ext.file_path.parent, ext.plugin,
                               skills_dir, synced_skills, manifest):
                stats['added_skills'] += 1
        elif ext.type is ExtensionType.AGENT:
            if sync_agent_item(ext.name, ext.file_path, ext.plugin,
                               agents_dir, synced_agents, manifest):
                stats['added_agents'] += 1
        elif ext.type is ExtensionType.COMMAND:
            if sync_command_item(ext.name, ext.file_path, ext.plugin,
                                 skills_dir, synced_commands, manifest,
                                 ALLOWED_SKILL_FIELDS):
                stats['added_commands'] += 1

    if remove_stale:
        stats['removed_skills'] = clean_stale_items(
            skills_dir, synced_skills,
            set(previous_manifest.get('skills', {}).keys()), is_agents=False
        )
        stats['removed_agents'] = clean_stale_items(
            agents_dir, synced_agents,
            set(previous_manifest.get('agents', {}).keys()), is_agents=True
        )
        stats['removed_commands'] = clean_stale_commands(
            skills_dir, synced_commands,
            set(previous_manifest.get('commands', {}).keys())
        )

    preserve_removed_entries(manifest, previous_manifest)
    save_manifest(paths['manifest_file'], manifest)

    stats['total_synced'] = len(synced_skills) + len(synced_agents) + len(synced_commands)
    return stats


def run_sync(manifest_path: Path = None, dry_run: bool = False,
             generate_manifest: bool = False) -> Dict[str, int]:
    """Run the enhanced sync process.

    Args:
        manifest_path: Path to selection manifest (defaults to ~/.copilot/sync-manifest.json)
        dry_run: If True, show what would be synced without actually syncing
        generate_manifest: If True, generate a new manifest from usage stats

    Returns:
        Dictionary with sync statistics
    """
    # Setup paths
    if manifest_path is None:
        manifest_path = Path.home() / ".copilot" / "sync-manifest.json"

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
        return {
            'added_skills': 0, 'added_agents': 0, 'added_commands': 0,
            'removed_skills': 0, 'removed_agents': 0, 'removed_commands': 0,
            'total_synced': 0
        }

    # Sync extensions through the shared materializers
    print("\n[5/6] Syncing extensions...")
    stats = sync_extensions(extensions_to_sync, DEFAULT_PATHS,
                            remove_stale=manifest.remove_stale)

    print("\n[6/6] Updating selection manifest...")
    manifest.sync_timestamp = datetime.now()
    manifest.save(manifest_path)

    # Print summary
    print("\n" + "="*60)
    print("SYNC COMPLETE")
    print("="*60)
    print(f"Skills:   +{stats['added_skills']} -{stats['removed_skills']}")
    print(f"Agents:   +{stats['added_agents']} -{stats['removed_agents']}")
    print(f"Commands: +{stats['added_commands']} -{stats['removed_commands']}")
    print(f"Total:    {stats['total_synced']} extensions synced")
    print(f"\nSelection manifest: {manifest_path}")
    print(f"Sync record:        {DEFAULT_PATHS['manifest_file']}")

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
