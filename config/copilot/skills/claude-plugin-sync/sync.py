#!/usr/bin/env python3
"""
Sync Claude Code plugins to Copilot CLI.

Reads installed plugins from ~/.claude/plugins/installed_plugins.json
and creates symlinks for skills and copies/rewrites agents to ~/.copilot/skills and ~/.copilot/agents.
"""

import json
import os
import re
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


def find_commands(plugin_path: Path) -> List[Tuple[str, Path]]:
    """Find all commands in a plugin directory."""
    commands = []
    commands_dir = plugin_path / "commands"
    
    if not commands_dir.exists():
        return commands
    
    for command_file in commands_dir.glob("*.md"):
        commands.append((command_file.stem, command_file))
    
    return commands


def load_manifest() -> Dict:
    """Load the previous sync manifest."""
    if not MANIFEST_FILE.exists():
        return {}

    try:
        with open(MANIFEST_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def clean_stale_items(directory: Path, valid_names: Set[str], manifest: Dict, is_agents: bool = False) -> int:
    """Remove items that we previously synced but are no longer valid. Returns count of removed."""
    if not directory.exists():
        return 0

    # Get names we previously synced from manifest
    manifest_key = "skills" if "skills" in str(directory) else "agents"
    previously_synced = set(manifest.get(manifest_key, {}).keys())

    removed = 0
    for item in directory.iterdir():
        # For skills, only remove symlinks; for agents, remove regular files
        if is_agents:
            if item.is_symlink():
                continue  # Don't remove non-synced items
        else:
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


def parse_frontmatter(content: str) -> Tuple[Optional[Dict[str, str]], int, int]:
    """Parse YAML frontmatter from content. Returns (frontmatter_dict, start_idx, end_idx)."""
    lines = content.split('\n')
    
    if not lines or lines[0] != '---':
        return None, 0, 0
    
    # Find the end of frontmatter
    for i in range(1, len(lines)):
        if lines[i] == '---':
            # Parse frontmatter into dict
            fm_dict = {}
            for line in lines[1:i]:
                if ':' in line:
                    key, _, value = line.partition(':')
                    fm_dict[key.strip()] = value.strip()
            return fm_dict, 0, i
    
    return None, 0, 0


def extract_frontmatter_and_body(content: str) -> Tuple[Optional[List[str]], List[str]]:
    """Extract frontmatter lines and body lines from content.
    
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


def add_or_update_frontmatter_field(frontmatter_lines: List[str], field_name: str, field_value: str) -> List[str]:
    """Add or update a field in frontmatter lines.
    
    If the field exists, it's updated. If not, it's added at the beginning.
    """
    new_lines = []
    field_found = False
    
    for line in frontmatter_lines:
        if line.strip().startswith(f'{field_name}:'):
            new_lines.append(f'{field_name}: {field_value}')
            field_found = True
        else:
            new_lines.append(line)
    
    if not field_found:
        # Add at the beginning
        new_lines.insert(0, f'{field_name}: {field_value}')
    
    return new_lines


def reconstruct_with_frontmatter(frontmatter_lines: List[str], body_lines: List[str]) -> str:
    """Reconstruct content from frontmatter and body lines."""
    return '\n'.join(['---'] + frontmatter_lines + ['---'] + body_lines)


def rewrite_plugin_references(content: str, plugin_name: str) -> str:
    """Rewrite plugin:name references to plugin-name format in content body.
    
    Handles patterns like:
    - /do:plan -> skill do-plan (command to skill invocation)
    - do:iterative-implementer -> do-iterative-implementer (agent/skill references)
    - Skill("do:beads") -> Skill("do-beads")
    """
    # First, convert command references: /plugin:name -> skill plugin-name
    command_pattern = f'/({re.escape(plugin_name)}):([a-zA-Z0-9_-]+)'
    content = re.sub(command_pattern, r'skill \1-\2', content)
    
    # Then, replace remaining plugin:name with plugin-name (for agent names, Skill() calls, etc.)
    pattern = f'({re.escape(plugin_name)}):([a-zA-Z0-9_-]+)'
    replacement = r'\1-\2'
    return re.sub(pattern, replacement, content)


def update_frontmatter_field(line: str, plugin_name: str) -> str:
    """Update a single frontmatter field line."""
    # Update name field to include plugin namespace (using hyphen instead of colon)
    if line.startswith('name:'):
        match = re.match(r'name:\s*(.+)', line)
        if match:
            original_name = match.group(1).strip()
            
            # Replace colons with hyphens in the name
            original_name = original_name.replace(':', '-')
            
            # Remove any duplicate prefixes (e.g., "plugin-plugin-name" -> "plugin-name")
            parts = original_name.split('-')
            if len(parts) > 1:
                # Remove consecutive duplicate parts
                cleaned_parts = [parts[0]]
                for part in parts[1:]:
                    if part != cleaned_parts[-1]:
                        cleaned_parts.append(part)
                cleaned_name = '-'.join(cleaned_parts)
            else:
                cleaned_name = original_name
            
            # Only add prefix if not already present
            if not cleaned_name.startswith(f'{plugin_name}-'):
                return f'name: {plugin_name}-{cleaned_name}'
            return f'name: {cleaned_name}'
    
    # Convert tools field from comma-separated string to array
    elif line.startswith('tools:'):
        match = re.match(r'tools:\s*(.+)', line)
        if match:
            tools_str = match.group(1).strip()
            # Check if it's already an array
            if not tools_str.startswith('['):
                tools = [t.strip() for t in tools_str.split(',')]
                return f'tools: [{", ".join(tools)}]'
    
    # Quote description field if not already quoted
    elif line.startswith('description:'):
        match = re.match(r'description:\s*(.+)', line)
        if match:
            desc_value = match.group(1).strip()
            # Check if already quoted
            if not ((desc_value.startswith('"') and desc_value.endswith('"')) or 
                    (desc_value.startswith("'") and desc_value.endswith("'"))):
                # Escape any internal double quotes and wrap in quotes
                escaped_desc = desc_value.replace('"', '\\"')
                return f'description: "{escaped_desc}"'
    
    return line


def rewrite_agent_frontmatter(content: str, plugin_name: str, agent_name: str) -> str:
    """Rewrite agent frontmatter to namespace the agent name and fix tool_calls format."""
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
    
    # Known YAML fields in frontmatter
    YAML_FIELDS = {'name', 'description', 'model', 'color', 'tools'}
    
    # Rebuild frontmatter, handling multiline description fields properly
    new_frontmatter = []
    i = 1
    while i < end_idx:
        line = lines[i]
        
        # Handle description field that may span multiple lines with XML examples
        if line.startswith('description:'):
            # Collect description and all following lines until we hit a true YAML field
            desc_parts = []
            
            # Get the value after 'description:' on this line
            match = re.match(r'description:\s*(.*)', line)
            if match:
                desc_parts.append(match.group(1))
            
            i += 1
            # Collect all lines until we hit a known YAML field
            while i < end_idx:
                next_line = lines[i]
                # Check if this is a YAML field (known field: at start, no leading space)
                if next_line and not next_line[0].isspace():
                    # Extract the field name
                    field_match = re.match(r'(\w+):', next_line)
                    if field_match and field_match.group(1) in YAML_FIELDS:
                        break
                if next_line.strip():  # Skip empty lines but keep non-empty content
                    desc_parts.append(next_line.strip())
                i += 1
            
            # Combine all parts into a single string
            full_desc = ' '.join(desc_parts)
            
            # Remove any existing quotes
            if full_desc.startswith('"') and full_desc.endswith('"'):
                full_desc = full_desc[1:-1]
            elif full_desc.startswith("'") and full_desc.endswith("'"):
                full_desc = full_desc[1:-1]
            
            # Escape internal quotes
            full_desc = full_desc.replace('"', '\\"')
            
            # Create properly quoted field
            new_line = f'description: "{full_desc}"'
            new_frontmatter.append(update_frontmatter_field(new_line, plugin_name))
            continue
        
        new_frontmatter.append(update_frontmatter_field(line, plugin_name))
        i += 1
    
    # Rewrite plugin:name references in the body
    body_content = '\n'.join(lines[end_idx:])
    body_content = rewrite_plugin_references(body_content, plugin_name)
    
    # Reconstruct the content
    return '\n'.join(['---'] + new_frontmatter + [body_content])


def copy_and_rewrite_agent(source: Path, target: Path, plugin_name: str, agent_name: str) -> bool:
    """Copy agent file and rewrite frontmatter. Returns True if created/updated."""
    content = source.read_text()
    new_content = rewrite_agent_frontmatter(content, plugin_name, agent_name)
    
    # Check if target exists and has same content
    if target.exists() and target.read_text() == new_content:
        return False
    
    target.write_text(new_content)
    return True


def transform_command_to_skill(source: Path, target_dir: Path, plugin_name: str, command_name: str) -> bool:
    """Transform a command file into a skill directory. Returns True if created/updated."""
    # Create the skill directory structure
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "SKILL.md"
    
    # Read the command content
    content = source.read_text()
    
    # Extract frontmatter and body
    frontmatter_lines, body_lines = extract_frontmatter_and_body(content)
    
    # If no frontmatter, create new
    if frontmatter_lines is None:
        frontmatter_lines = []
    
    # Add or update the name field with plugin-command format (using hyphen)
    frontmatter_lines = add_or_update_frontmatter_field(frontmatter_lines, 'name', f'{plugin_name}-{command_name}')
    
    # Rewrite plugin:name references in the body to plugin-name
    body_content = '\n'.join(body_lines)
    body_content = rewrite_plugin_references(body_content, plugin_name)
    body_lines = body_content.split('\n')
    
    # Reconstruct the content
    skill_content = reconstruct_with_frontmatter(frontmatter_lines, body_lines)
    
    # Check if target exists and has same content
    if target_file.exists() and target_file.read_text() == skill_content:
        return False
    
    target_file.write_text(skill_content)
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
    synced_commands = set()
    added_skills = 0
    added_agents = 0
    added_commands = 0

    # Load previous manifest before we start syncing (for cleanup)
    previous_manifest = load_manifest()

    manifest = {
        "lastSync": datetime.now().isoformat(),
        "skills": {},
        "agents": {},
        "commands": {}
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
        
        # Sync agents (copy and rewrite instead of symlink)
        agents = find_agents(plugin_path)
        for agent_name, agent_path in agents:
            # Don't add .agent.md suffix if the file already has it
            if agent_name.endswith('.agent'):
                target_name = f"{plugin_name}-{agent_name}.md"
            else:
                target_name = f"{plugin_name}-{agent_name}.agent.md"
            target_path = COPILOT_AGENTS_DIR / target_name
            
            if copy_and_rewrite_agent(agent_path, target_path, plugin_name, agent_name):
                added_agents += 1
            synced_agents.add(target_name)
            manifest["agents"][target_name] = {
                "source": str(agent_path),
                "plugin": plugin_name,
                "status": "active"
            }
        
        # Sync commands (transform into skills)
        commands = find_commands(plugin_path)
        for command_name, command_path in commands:
            # Create skill directory: skills/command_name/SKILL.md
            target_skill_dir = COPILOT_SKILLS_DIR / command_name
            
            if transform_command_to_skill(command_path, target_skill_dir, plugin_name, command_name):
                added_commands += 1
            synced_commands.add(command_name)
            manifest["commands"][command_name] = {
                "source": str(command_path),
                "plugin": plugin_name,
                "status": "active"
            }

    # Clean up stale items (only remove what we previously synced)
    removed_skills = clean_stale_items(COPILOT_SKILLS_DIR, synced_skills, previous_manifest, is_agents=False)
    removed_agents = clean_stale_items(COPILOT_AGENTS_DIR, synced_agents, previous_manifest, is_agents=True)
    
    # Clean up stale command-generated skills (remove directories)
    removed_commands = 0
    previously_synced_commands = set(previous_manifest.get("commands", {}).keys())
    for command_name in previously_synced_commands:
        if command_name not in synced_commands:
            command_skill_dir = COPILOT_SKILLS_DIR / command_name
            if command_skill_dir.exists() and command_skill_dir.is_dir():
                # Remove the entire skill directory
                import shutil
                shutil.rmtree(command_skill_dir)
                removed_commands += 1

    # Preserve removed entries in manifest for history
    for name in previous_manifest.get("skills", {}):
        if name not in manifest["skills"]:
            manifest["skills"][name] = {**previous_manifest["skills"][name], "status": "removed"}

    for name in previous_manifest.get("agents", {}):
        if name not in manifest["agents"]:
            manifest["agents"][name] = {**previous_manifest["agents"][name], "status": "removed"}
    
    for name in previous_manifest.get("commands", {}):
        if name not in manifest["commands"]:
            manifest["commands"][name] = {**previous_manifest["commands"][name], "status": "removed"}
    
    # Write manifest
    with open(MANIFEST_FILE, "w") as f:
        json.dump(manifest, f, indent=2)
    
    # Summary
    print(f"Skills: +{added_skills} -{removed_skills} (total: {len(synced_skills)})")
    print(f"Agents: +{added_agents} -{removed_agents} (total: {len(synced_agents)})")
    print(f"Commands: +{added_commands} -{removed_commands} (total: {len(synced_commands)})")


if __name__ == "__main__":
    try:
        sync_plugins()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
