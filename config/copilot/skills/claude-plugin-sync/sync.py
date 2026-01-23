#!/usr/bin/env python3
"""
Sync Claude Code plugins to Copilot CLI.

Reads installed plugins from ~/.claude/plugins/installed_plugins.json
and creates symlinks for skills and copies/rewrites agents to ~/.copilot/skills and ~/.copilot/agents.

This module uses a functional programming style with simple primitives and collections.
"""

import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


# Constants
ALLOWED_SKILL_FIELDS = {
    'name',
    'description',
    'license',
    'compatibility',
    'metadata',
    'allowed-tools'
}

DEFAULT_PATHS = {
    'claude_plugins_file': Path.home() / ".claude" / "plugins" / "installed_plugins.json",
    'claude_settings_file': Path.home() / ".claude" / "settings.json",
    'copilot_skills_dir': Path.home() / ".copilot" / "skills",
    'copilot_agents_dir': Path.home() / ".copilot" / "agents",
    'manifest_file': Path.home() / ".copilot" / "claude-sync-manifest.json"
}


# ============================================================================
# Frontmatter Parsing
# ============================================================================

def extract_frontmatter(content: str) -> Tuple[Optional[List[str]], List[str]]:
    """Extract frontmatter lines and body lines from content.

    Args:
        content: File content as string

    Returns:
        (frontmatter_lines, body_lines) - frontmatter_lines is None if no frontmatter exists
    """
    lines = content.split('\n')

    if not lines or lines[0] != '---':
        return None, lines

    # Find the end of frontmatter
    for i in range(1, len(lines)):
        if lines[i] == '---':
            return lines[1:i], lines[i+1:]

    # Malformed frontmatter (no closing ---)
    return None, lines


def parse_frontmatter_to_dict(frontmatter_lines: List[str]) -> Dict[str, str]:
    """Parse frontmatter lines into a dictionary.

    Args:
        frontmatter_lines: List of frontmatter line strings

    Returns:
        Dictionary mapping field names to values
    """
    fields = {}
    for line in frontmatter_lines:
        if line.strip() and ':' in line:
            match = re.match(r'^\s*([a-z0-9-]+):\s*(.*)', line, re.IGNORECASE)
            if match:
                field_name = match.group(1).lower()
                field_value = match.group(2).strip()
                # Remove quotes if present
                if field_value.startswith('"') and field_value.endswith('"'):
                    field_value = field_value[1:-1]
                fields[field_name] = field_value
    return fields


def reconstruct_content(frontmatter_lines: List[str], body_lines: List[str]) -> str:
    """Reconstruct content from frontmatter and body lines.

    Args:
        frontmatter_lines: List of frontmatter line strings
        body_lines: List of body line strings

    Returns:
        Complete content string
    """
    return '\n'.join(['---'] + frontmatter_lines + ['---'] + body_lines)


def filter_allowed_fields(frontmatter_lines: List[str], allowed_fields: Set[str]) -> List[str]:
    """Filter frontmatter lines to only include allowed fields.

    Args:
        frontmatter_lines: List of frontmatter line strings
        allowed_fields: Set of allowed field names

    Returns:
        Filtered list of frontmatter lines
    """
    filtered = []
    for line in frontmatter_lines:
        if line.strip():
            match = re.match(r'^\s*([a-z0-9-]+):', line, re.IGNORECASE)
            if match:
                field_name = match.group(1)
                if field_name in allowed_fields:
                    filtered.append(line)
            else:
                # Keep continuation lines if we have content
                if filtered:
                    filtered.append(line)
    return filtered


# ============================================================================
# Field Normalization
# ============================================================================

def normalize_skill_name(name: str) -> str:
    """Normalize a skill name to conform to requirements.

    Requirements: Max 64 characters, lowercase letters, numbers, and hyphens only.
    Must not start or end with a hyphen.

    Args:
        name: Raw skill name

    Returns:
        Normalized skill name
    """
    name = name.lower()
    name = re.sub(r'[^a-z0-9-]', '-', name)
    name = re.sub(r'-+', '-', name)
    name = name.strip('-')
    return name[:64]


def normalize_description(desc: str) -> str:
    """Normalize description to conform to requirements.

    Requirements: Max 1024 characters, non-empty.

    Args:
        desc: Raw description

    Returns:
        Normalized description
    """
    desc = str(desc).strip()
    desc = desc[:1024]
    return desc if desc else "Skill"


def normalize_compatibility(compat: str) -> str:
    """Normalize compatibility to conform to requirements.

    Requirements: Max 500 characters.

    Args:
        compat: Raw compatibility string

    Returns:
        Normalized compatibility string
    """
    return str(compat).strip()[:500]


def normalize_fields(fields: Dict[str, str], plugin_name: str, skill_name: str) -> Dict[str, str]:
    """Normalize all fields in a fields dictionary.

    Ensures required fields exist and applies normalization rules.

    Args:
        fields: Dictionary of field name to value
        plugin_name: Name of the plugin
        skill_name: Name of the skill

    Returns:
        Normalized fields dictionary
    """
    normalized = {}

    # Normalize required fields
    if 'name' not in fields or not fields['name']:
        normalized['name'] = normalize_skill_name(f'{plugin_name}-{skill_name}')
    else:
        normalized['name'] = normalize_skill_name(fields['name'])

    if 'description' not in fields or not fields['description']:
        normalized['description'] = ''
    else:
        normalized['description'] = normalize_description(fields['description'])

    # Normalize optional fields if present
    if 'license' in fields:
        normalized['license'] = str(fields['license']).strip()
    if 'compatibility' in fields:
        normalized['compatibility'] = normalize_compatibility(fields['compatibility'])
    if 'metadata' in fields:
        normalized['metadata'] = str(fields['metadata']).strip()
    if 'allowed-tools' in fields:
        normalized['allowed-tools'] = str(fields['allowed-tools']).strip()

    return normalized


def fields_to_frontmatter_lines(fields: Dict[str, str]) -> List[str]:
    """Convert a fields dictionary to frontmatter lines in canonical order.

    Args:
        fields: Dictionary of field name to value

    Returns:
        List of frontmatter line strings
    """
    result = []
    for field in ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']:
        if field in fields:
            value = fields[field]
            if value or field in ['name', 'description']:
                # Quote if contains special characters or spaces
                if value and (' ' in value or ':' in value):
                    value = f'"{value}"'
                result.append(f'{field}: {value}')
    return result


# ============================================================================
# Plugin Reference Rewriting
# ============================================================================

def rewrite_plugin_references(content: str, plugin_name: str) -> str:
    """Rewrite plugin:name references to plugin-name format in content body.

    Handles patterns like:
    - /do:plan -> skill do-plan (command to skill invocation)
    - do:iterative-implementer -> do-iterative-implementer (agent/skill references)
    - Skill("do:beads") -> Skill("do-beads")

    Args:
        content: Content to rewrite
        plugin_name: Name of the plugin

    Returns:
        Rewritten content
    """
    # Convert command references: /plugin:name -> skill plugin-name
    command_pattern = f'/({re.escape(plugin_name)}):([a-zA-Z0-9_-]+)'
    content = re.sub(command_pattern, r'skill \1-\2', content)

    # Replace remaining plugin:name with plugin-name
    pattern = f'({re.escape(plugin_name)}):([a-zA-Z0-9_-]+)'
    replacement = r'\1-\2'
    return re.sub(pattern, replacement, content)


# ============================================================================
# Skill Transformation
# ============================================================================

def transform_skill(content: str, plugin_name: str, skill_name: str, allowed_fields: Set[str]) -> str:
    """Transform command content into skill content.

    Args:
        content: Original command file content
        plugin_name: Name of the plugin
        skill_name: Name of the skill
        allowed_fields: Set of allowed field names

    Returns:
        Transformed skill content
    """
    # Extract frontmatter and body
    frontmatter_lines, body_lines = extract_frontmatter(content)

    if frontmatter_lines is None:
        frontmatter_lines = []

    # Filter to allowed fields
    frontmatter_lines = filter_allowed_fields(frontmatter_lines, allowed_fields)

    # Parse, normalize, and rebuild frontmatter
    fields = parse_frontmatter_to_dict(frontmatter_lines)
    normalized = normalize_fields(fields, plugin_name, skill_name)
    frontmatter_lines = fields_to_frontmatter_lines(normalized)

    # Rewrite plugin references in body
    body_content = '\n'.join(body_lines)
    body_content = rewrite_plugin_references(body_content, plugin_name)
    body_lines = body_content.split('\n')

    # Reconstruct content
    return reconstruct_content(frontmatter_lines, body_lines)


# ============================================================================
# Agent Rewriting
# ============================================================================

def update_agent_field(line: str, plugin_name: str) -> str:
    """Update a single agent frontmatter field line.

    Args:
        line: Frontmatter line to update
        plugin_name: Name of the plugin

    Returns:
        Updated line
    """
    if line.startswith('name:'):
        match = re.match(r'name:\s*(.+)', line)
        if match:
            original_name = match.group(1).strip()
            original_name = original_name.replace(':', '-')

            # Remove consecutive duplicate parts
            parts = original_name.split('-')
            if len(parts) > 1:
                cleaned_parts = [parts[0]]
                for part in parts[1:]:
                    if part != cleaned_parts[-1]:
                        cleaned_parts.append(part)
                cleaned_name = '-'.join(cleaned_parts)
            else:
                cleaned_name = original_name

            # Add prefix if not present
            if not cleaned_name.startswith(f'{plugin_name}-'):
                return f'name: {plugin_name}-{cleaned_name}'
            return f'name: {cleaned_name}'

    elif line.startswith('tools:'):
        match = re.match(r'tools:\s*(.+)', line)
        if match:
            tools_str = match.group(1).strip()
            if not tools_str.startswith('['):
                tools = [t.strip() for t in tools_str.split(',')]
                return f'tools: [{", ".join(tools)}]'

    elif line.startswith('description:'):
        match = re.match(r'description:\s*(.+)', line)
        if match:
            desc_value = match.group(1).strip()
            if not ((desc_value.startswith('"') and desc_value.endswith('"')) or
                    (desc_value.startswith("'") and desc_value.endswith("'"))):
                escaped_desc = desc_value.replace('"', '\\"')
                return f'description: "{escaped_desc}"'

    return line


def rewrite_agent(content: str, plugin_name: str, agent_name: str) -> str:
    """Rewrite agent frontmatter to namespace the agent name.

    Args:
        content: Original agent file content
        plugin_name: Name of the plugin
        agent_name: Name of the agent

    Returns:
        Rewritten agent content
    """
    lines = content.split('\n')

    if not lines or lines[0] != '---':
        return content

    # Find the end of frontmatter
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i] == '---':
            end_idx = i
            break

    if end_idx is None:
        return content

    # Known YAML fields in agent frontmatter
    yaml_fields = {'name', 'description', 'model', 'color', 'tools'}

    # Rebuild frontmatter, handling multiline descriptions
    new_frontmatter = []
    i = 1
    while i < end_idx:
        line = lines[i]

        if line.startswith('description:'):
            # Collect multiline description
            desc_parts = []
            match = re.match(r'description:\s*(.*)', line)
            if match:
                desc_parts.append(match.group(1))

            i += 1
            while i < end_idx:
                next_line = lines[i]
                if next_line and not next_line[0].isspace():
                    field_match = re.match(r'(\w+):', next_line)
                    if field_match and field_match.group(1) in yaml_fields:
                        break
                if next_line.strip():
                    desc_parts.append(next_line.strip())
                i += 1

            full_desc = ' '.join(desc_parts)
            # Remove existing quotes
            if full_desc.startswith('"') and full_desc.endswith('"'):
                full_desc = full_desc[1:-1]
            elif full_desc.startswith("'") and full_desc.endswith("'"):
                full_desc = full_desc[1:-1]

            # Escape internal quotes
            full_desc = full_desc.replace('"', '\\"')
            new_line = f'description: "{full_desc}"'
            new_frontmatter.append(update_agent_field(new_line, plugin_name))
            continue

        new_frontmatter.append(update_agent_field(line, plugin_name))
        i += 1

    # Rewrite plugin:name references in the body
    body_content = '\n'.join(lines[end_idx:])
    body_content = rewrite_plugin_references(body_content, plugin_name)

    return '\n'.join(['---'] + new_frontmatter + [body_content])


# ============================================================================
# File System Operations
# ============================================================================

def create_symlink(source: Path, target: Path) -> bool:
    """Create a symlink, removing existing if necessary.

    Args:
        source: Source path to link to
        target: Target path for the symlink

    Returns:
        True if symlink was created/updated, False if already correct
    """
    if target.exists() or target.is_symlink():
        if target.is_symlink() and target.resolve() == source.resolve():
            return False
        target.unlink()

    target.symlink_to(source)
    return True


def write_if_changed(target: Path, content: str) -> bool:
    """Write content to file if it differs from current content.

    Args:
        target: Target file path
        content: Content to write

    Returns:
        True if file was written, False if content unchanged
    """
    if target.exists() and target.read_text() == content:
        return False

    target.write_text(content)
    return True


def clean_stale_items(directory: Path, valid_names: Set[str], previously_synced: Set[str], is_agents: bool = False) -> int:
    """Remove items that we previously synced but are no longer valid.

    Args:
        directory: Directory to clean
        valid_names: Set of currently valid item names
        previously_synced: Set of previously synced item names
        is_agents: True if cleaning agents, False if cleaning skills

    Returns:
        Count of removed items
    """
    if not directory.exists():
        return 0

    removed = 0
    for item in directory.iterdir():
        # For skills, only remove symlinks; for agents, remove regular files
        if is_agents:
            if item.is_symlink():
                continue
        else:
            if not item.is_symlink():
                continue

        # Only remove if it was in our manifest and is no longer valid
        if item.name in previously_synced and item.name not in valid_names:
            item.unlink()
            removed += 1

    return removed


# ============================================================================
# Plugin Discovery
# ============================================================================

def find_skills(plugin_path: Path) -> List[Tuple[str, Path]]:
    """Find all skills in a plugin directory.

    Args:
        plugin_path: Path to plugin directory

    Returns:
        List of (skill_name, skill_path) tuples
    """
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
    """Find all agents in a plugin directory.

    Args:
        plugin_path: Path to plugin directory

    Returns:
        List of (agent_name, agent_path) tuples
    """
    agents = []
    agents_dir = plugin_path / "agents"

    if not agents_dir.exists():
        return agents

    for agent_file in agents_dir.glob("*.md"):
        agents.append((agent_file.stem, agent_file))

    return agents


def find_commands(plugin_path: Path) -> List[Tuple[str, Path]]:
    """Find all commands in a plugin directory.

    Args:
        plugin_path: Path to plugin directory

    Returns:
        List of (command_name, command_path) tuples
    """
    commands = []
    commands_dir = plugin_path / "commands"

    if not commands_dir.exists():
        return commands

    for command_file in commands_dir.glob("*.md"):
        commands.append((command_file.stem, command_file))

    return commands


# ============================================================================
# Plugin Loading
# ============================================================================

def load_installed_plugins(plugins_file: Path) -> Dict:
    """Load the installed plugins manifest.

    Args:
        plugins_file: Path to installed plugins file

    Returns:
        Dictionary of plugin data
    """
    if not plugins_file.exists():
        return {}

    with open(plugins_file) as f:
        data = json.load(f)

    return data.get("plugins", {})


def load_enabled_plugins(settings_file: Path) -> Set[str]:
    """Load enabled plugins from settings.json.

    Args:
        settings_file: Path to settings file

    Returns:
        Set of enabled plugin keys
    """
    if not settings_file.exists():
        return set()

    try:
        with open(settings_file) as f:
            settings = json.load(f)

        enabled_plugins = settings.get("enabledPlugins", {})
        return {key for key, is_enabled in enabled_plugins.items() if is_enabled}

    except Exception:
        return set()


def get_plugin_path(plugin_info: list) -> Optional[Path]:
    """Get the install path for a plugin.

    Args:
        plugin_info: Plugin info list from manifest

    Returns:
        Path to plugin directory, or None if not found
    """
    if not plugin_info:
        return None

    install_path = plugin_info[0].get("installPath")
    if install_path:
        path = Path(install_path)
        if path.exists():
            return path
    return None


# ============================================================================
# Manifest Management
# ============================================================================

def load_manifest(manifest_file: Path) -> Dict:
    """Load the previous sync manifest.

    Args:
        manifest_file: Path to manifest file

    Returns:
        Manifest dictionary
    """
    if not manifest_file.exists():
        return {}

    try:
        with open(manifest_file) as f:
            return json.load(f)
    except Exception:
        return {}


def save_manifest(manifest_file: Path, manifest: Dict) -> None:
    """Save the sync manifest.

    Args:
        manifest_file: Path to manifest file
        manifest: Manifest dictionary to save
    """
    with open(manifest_file, "w") as f:
        json.dump(manifest, f, indent=2)


def create_manifest() -> Dict:
    """Create a new empty manifest.

    Returns:
        Empty manifest dictionary
    """
    return {
        "lastSync": datetime.now().isoformat(),
        "skills": {},
        "agents": {},
        "commands": {}
    }


def preserve_removed_entries(manifest: Dict, previous_manifest: Dict) -> None:
    """Preserve removed entries in manifest for history.

    Args:
        manifest: Current manifest dictionary (modified in place)
        previous_manifest: Previous manifest dictionary
    """
    for category in ['skills', 'agents', 'commands']:
        for name in previous_manifest.get(category, {}):
            if name not in manifest[category]:
                manifest[category][name] = {
                    **previous_manifest[category][name],
                    "status": "removed"
                }


# ============================================================================
# Syncing Operations
# ============================================================================

def sync_skills(plugin_path: Path, plugin_name: str, skills_dir: Path,
                synced_skills: Set[str], manifest: Dict) -> int:
    """Sync skills for a plugin.

    Args:
        plugin_path: Path to plugin directory
        plugin_name: Name of the plugin
        skills_dir: Target skills directory
        synced_skills: Set to track synced skill names (modified in place)
        manifest: Manifest dictionary (modified in place)

    Returns:
        Count of added skills
    """
    added = 0
    skills = find_skills(plugin_path)

    for skill_name, skill_path in skills:
        target_name = f"{plugin_name}-{skill_name}"
        target_path = skills_dir / target_name

        if create_symlink(skill_path, target_path):
            added += 1

        synced_skills.add(target_name)
        manifest["skills"][target_name] = {
            "source": str(skill_path),
            "plugin": plugin_name,
            "status": "active"
        }

    return added


def sync_agents(plugin_path: Path, plugin_name: str, agents_dir: Path,
                synced_agents: Set[str], manifest: Dict) -> int:
    """Sync agents for a plugin.

    Args:
        plugin_path: Path to plugin directory
        plugin_name: Name of the plugin
        agents_dir: Target agents directory
        synced_agents: Set to track synced agent names (modified in place)
        manifest: Manifest dictionary (modified in place)

    Returns:
        Count of added agents
    """
    added = 0
    agents = find_agents(plugin_path)

    for agent_name, agent_path in agents:
        # Determine target name
        if agent_name.endswith('.agent'):
            target_name = f"{plugin_name}-{agent_name}.md"
        else:
            target_name = f"{plugin_name}-{agent_name}.agent.md"

        target_path = agents_dir / target_name

        # Rewrite and copy
        content = agent_path.read_text()
        new_content = rewrite_agent(content, plugin_name, agent_name)

        if write_if_changed(target_path, new_content):
            added += 1

        synced_agents.add(target_name)
        manifest["agents"][target_name] = {
            "source": str(agent_path),
            "plugin": plugin_name,
            "status": "active"
        }

    return added


def sync_commands(plugin_path: Path, plugin_name: str, skills_dir: Path,
                  synced_commands: Set[str], manifest: Dict, allowed_fields: Set[str]) -> int:
    """Sync commands (transform to skills) for a plugin.

    Args:
        plugin_path: Path to plugin directory
        plugin_name: Name of the plugin
        skills_dir: Target skills directory
        synced_commands: Set to track synced command names (modified in place)
        manifest: Manifest dictionary (modified in place)
        allowed_fields: Set of allowed field names

    Returns:
        Count of added commands
    """
    added = 0
    commands = find_commands(plugin_path)

    for command_name, command_path in commands:
        target_skill_dir = skills_dir / command_name
        target_skill_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_skill_dir / "SKILL.md"

        # Transform command to skill
        content = command_path.read_text()
        skill_content = transform_skill(content, plugin_name, command_name, allowed_fields)

        if write_if_changed(target_file, skill_content):
            added += 1

        synced_commands.add(command_name)
        manifest["commands"][command_name] = {
            "source": str(command_path),
            "plugin": plugin_name,
            "status": "active"
        }

    return added


def clean_stale_commands(skills_dir: Path, synced_commands: Set[str], previously_synced: Set[str]) -> int:
    """Clean up stale command-generated skills.

    Args:
        skills_dir: Skills directory
        synced_commands: Set of currently synced command names
        previously_synced: Set of previously synced command names

    Returns:
        Count of removed commands
    """
    removed = 0
    for command_name in previously_synced:
        if command_name not in synced_commands:
            command_skill_dir = skills_dir / command_name
            if command_skill_dir.exists() and command_skill_dir.is_dir():
                shutil.rmtree(command_skill_dir)
                removed += 1
    return removed


# ============================================================================
# Main Sync Function
# ============================================================================

def sync_plugins(paths: Optional[Dict[str, Path]] = None) -> Dict[str, int]:
    """Main sync function.

    Args:
        paths: Optional dictionary of path overrides

    Returns:
        Dictionary with sync statistics
    """
    # Use provided paths or defaults
    if paths is None:
        paths = DEFAULT_PATHS

    print(f"Claude Plugin Sync - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Ensure target directories exist
    paths['copilot_skills_dir'].mkdir(parents=True, exist_ok=True)
    paths['copilot_agents_dir'].mkdir(parents=True, exist_ok=True)

    # Load plugins
    installed = load_installed_plugins(paths['claude_plugins_file'])
    enabled = load_enabled_plugins(paths['claude_settings_file'])

    if not installed:
        print("No plugins installed.")
        return {
            "added_skills": 0, "added_agents": 0, "added_commands": 0,
            "removed_skills": 0, "removed_agents": 0, "removed_commands": 0
        }

    # Filter to enabled plugins
    plugins_to_sync = {
        key: info for key, info in installed.items()
        if not enabled or key in enabled
    }

    # Track synced items
    synced_skills = set()
    synced_agents = set()
    synced_commands = set()
    stats = {
        "added_skills": 0,
        "added_agents": 0,
        "added_commands": 0
    }

    # Load previous manifest
    previous_manifest = load_manifest(paths['manifest_file'])
    manifest = create_manifest()

    # Sync each plugin
    for plugin_key, plugin_info in plugins_to_sync.items():
        plugin_path = get_plugin_path(plugin_info)
        if not plugin_path:
            continue

        plugin_name = plugin_key.split("@")[0]

        # Sync skills
        stats["added_skills"] += sync_skills(
            plugin_path, plugin_name, paths['copilot_skills_dir'],
            synced_skills, manifest
        )

        # Sync agents
        stats["added_agents"] += sync_agents(
            plugin_path, plugin_name, paths['copilot_agents_dir'],
            synced_agents, manifest
        )

        # Sync commands
        stats["added_commands"] += sync_commands(
            plugin_path, plugin_name, paths['copilot_skills_dir'],
            synced_commands, manifest, ALLOWED_SKILL_FIELDS
        )

    # Clean up stale items
    stats["removed_skills"] = clean_stale_items(
        paths['copilot_skills_dir'],
        synced_skills,
        set(previous_manifest.get("skills", {}).keys()),
        is_agents=False
    )

    stats["removed_agents"] = clean_stale_items(
        paths['copilot_agents_dir'],
        synced_agents,
        set(previous_manifest.get("agents", {}).keys()),
        is_agents=True
    )

    stats["removed_commands"] = clean_stale_commands(
        paths['copilot_skills_dir'],
        synced_commands,
        set(previous_manifest.get("commands", {}).keys())
    )

    # Preserve removed entries in manifest for history
    preserve_removed_entries(manifest, previous_manifest)

    # Save manifest
    save_manifest(paths['manifest_file'], manifest)

    # Print summary
    print(f"Skills: +{stats['added_skills']} -{stats['removed_skills']} (total: {len(synced_skills)})")
    print(f"Agents: +{stats['added_agents']} -{stats['removed_agents']} (total: {len(synced_agents)})")
    print(f"Commands: +{stats['added_commands']} -{stats['removed_commands']} (total: {len(synced_commands)})")

    return stats


def main():
    """Entry point for CLI execution."""
    try:
        sync_plugins()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
