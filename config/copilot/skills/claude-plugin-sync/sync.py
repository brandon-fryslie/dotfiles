#!/usr/bin/env python3
"""
Sync Claude Code plugins to Copilot CLI.

Reads installed plugins from ~/.claude/plugins/installed_plugins.json
and creates symlinks for skills and agents in ~/.copilot/skills and ~/.copilot/agents.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

# Paths
CLAUDE_PLUGINS_FILE = Path.home() / ".claude" / "plugins" / "installed_plugins.json"
CLAUDE_SETTINGS_FILE = Path.home() / ".claude" / "settings.json"
CLAUDE_CACHE_DIR = Path.home() / ".claude" / "plugins" / "cache"
COPILOT_SKILLS_DIR = Path.home() / ".copilot" / "skills"
COPILOT_AGENTS_DIR = Path.home() / ".copilot" / "agents"
MANIFEST_FILE = Path.home() / ".copilot" / "claude-sync-manifest.json"

# No prefix - skills and agents use their natural names
SYNC_PREFIX = ""


def load_installed_plugins() -> Dict:
    """Load the installed plugins manifest."""
    if not CLAUDE_PLUGINS_FILE.exists():
        print(f"No installed plugins file found at {CLAUDE_PLUGINS_FILE}")
        return {}
    
    with open(CLAUDE_PLUGINS_FILE) as f:
        data = json.load(f)
    
    return data.get("plugins", {})


def load_enabled_plugins() -> Set[str]:
    """Load enabled plugins from settings.json."""
    if not CLAUDE_SETTINGS_FILE.exists():
        print(f"Warning: No settings file found at {CLAUDE_SETTINGS_FILE}")
        return set()
    
    try:
        with open(CLAUDE_SETTINGS_FILE) as f:
            settings = json.load(f)
        
        # Extract enabled plugins from enabledPlugins
        enabled_plugins = settings.get("enabledPlugins", {})
        enabled = set()
        
        for plugin_key, is_enabled in enabled_plugins.items():
            if is_enabled:
                enabled.add(plugin_key)
        
        return enabled
    except Exception as e:
        print(f"Error: Could not load settings: {e}")
        return set()


def get_plugin_path(plugin_info: list) -> Optional[Path]:
    """Get the install path for a plugin."""
    if not plugin_info:
        return None
    
    # Use the first (most recent) installation
    install_path = plugin_info[0].get("installPath")
    if install_path:
        path = Path(install_path)
        if path.exists():
            return path
    return None


def find_skills(plugin_path: Path) -> List[Tuple[str, Path]]:
    """Find all skills in a plugin directory."""
    skills = []
    skills_dir = plugin_path / "skills"
    
    if not skills_dir.exists():
        return skills
    
    for skill_dir in skills_dir.iterdir():
        if skill_dir.is_dir():
            skill_file = skill_dir / "SKILL.md"
            if skill_file.exists():
                skills.append((skill_dir.name, skill_dir))
    
    return skills


def find_agents(plugin_path: Path) -> List[Tuple[str, Path]]:
    """Find all agents in a plugin directory."""
    agents = []
    agents_dir = plugin_path / "agents"
    
    if not agents_dir.exists():
        return agents
    
    for agent_file in agents_dir.glob("*.md"):
        agents.append((agent_file.stem, agent_file))
    
    return agents


def load_manifest() -> Dict:
    """Load the previous sync manifest."""
    if not MANIFEST_FILE.exists():
        return {}

    try:
        with open(MANIFEST_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def clean_stale_symlinks(directory: Path, valid_names: Set[str], manifest: Dict) -> int:
    """Remove symlinks that we previously synced but are no longer valid. Returns count of removed."""
    if not directory.exists():
        return 0

    # Get names we previously synced from manifest
    manifest_key = "skills" if "skills" in str(directory) else "agents"
    previously_synced = set(manifest.get(manifest_key, {}).keys())

    removed = 0
    for item in directory.iterdir():
        if not item.is_symlink():
            continue

        # Only remove if it was in our manifest and is no longer valid
        if item.name in previously_synced and item.name not in valid_names:
            item.unlink()
            removed += 1

    return removed


def create_symlink(source: Path, target: Path, name: str) -> bool:
    """Create a symlink, removing existing if necessary. Returns True if created."""
    if target.exists() or target.is_symlink():
        if target.is_symlink() and target.resolve() == source.resolve():
            return False  # Already correct
        target.unlink()
    
    target.symlink_to(source)
    return True


def sync_plugins():
    """Main sync function."""
    print(f"Claude Plugin Sync - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Ensure target directories exist
    COPILOT_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    COPILOT_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    
    installed = load_installed_plugins()
    enabled = load_enabled_plugins()
    
    if not installed:
        print("No plugins installed.")
        return
    
    # Filter to only enabled plugins
    plugins_to_sync = {}
    for plugin_key, plugin_info in installed.items():
        if not enabled or plugin_key in enabled:
            plugins_to_sync[plugin_key] = plugin_info
    
    synced_skills = set()
    synced_agents = set()
    added_skills = 0
    added_agents = 0

    # Load previous manifest before we start syncing (for cleanup)
    previous_manifest = load_manifest()

    manifest = {
        "lastSync": datetime.now().isoformat(),
        "skills": {},
        "agents": {}
    }

    for plugin_key, plugin_info in plugins_to_sync.items():
        plugin_path = get_plugin_path(plugin_info)
        if not plugin_path:
            continue
        
        plugin_name = plugin_key.split("@")[0]
        
        # Sync skills
        skills = find_skills(plugin_path)
        for skill_name, skill_path in skills:
            target_name = f"{plugin_name}-{skill_name}"
            target_path = COPILOT_SKILLS_DIR / target_name
            
            if create_symlink(skill_path, target_path, target_name):
                added_skills += 1
            synced_skills.add(target_name)
            manifest["skills"][target_name] = {
                "source": str(skill_path),
                "plugin": plugin_name,
                "status": "active"
            }
        
        # Sync agents
        agents = find_agents(plugin_path)
        for agent_name, agent_path in agents:
            target_name = f"{plugin_name}-{agent_name}.agent.md"
            target_path = COPILOT_AGENTS_DIR / target_name
            
            if create_symlink(agent_path, target_path, target_name):
                added_agents += 1
            synced_agents.add(target_name)
            manifest["agents"][target_name] = {
                "source": str(agent_path),
                "plugin": plugin_name,
                "status": "active"
            }

    # Clean up stale symlinks (only remove what we previously synced)
    removed_skills = clean_stale_symlinks(COPILOT_SKILLS_DIR, synced_skills, previous_manifest)
    removed_agents = clean_stale_symlinks(COPILOT_AGENTS_DIR, synced_agents, previous_manifest)

    # Preserve removed entries in manifest for history
    for name in previous_manifest.get("skills", {}):
        if name not in manifest["skills"]:
            manifest["skills"][name] = {**previous_manifest["skills"][name], "status": "removed"}

    for name in previous_manifest.get("agents", {}):
        if name not in manifest["agents"]:
            manifest["agents"][name] = {**previous_manifest["agents"][name], "status": "removed"}
    
    # Write manifest
    with open(MANIFEST_FILE, "w") as f:
        json.dump(manifest, f, indent=2)
    
    # Summary
    print(f"Skills: +{added_skills} -{removed_skills} (total: {len(synced_skills)})")
    print(f"Agents: +{added_agents} -{removed_agents} (total: {len(synced_agents)})")


if __name__ == "__main__":
    try:
        sync_plugins()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
