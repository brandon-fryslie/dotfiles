#!/usr/bin/env python3
"""
Comprehensive tests for the sync.py module.

Tests cover all major functionality using a functional style.
"""

import tempfile
import json
from pathlib import Path
import pytest

# Import functions to test
from sync import (
    # Frontmatter parsing
    extract_frontmatter,
    parse_frontmatter_to_dict,
    reconstruct_content,
    filter_allowed_fields,
    # Field normalization
    normalize_skill_name,
    normalize_description,
    normalize_compatibility,
    normalize_fields,
    fields_to_frontmatter_lines,
    # Plugin reference rewriting
    rewrite_plugin_references,
    # Skill transformation
    transform_skill,
    # Agent rewriting
    update_agent_field,
    rewrite_agent,
    # File system operations
    create_symlink,
    write_if_changed,
    # Plugin discovery
    find_skills,
    find_agents,
    find_commands,
    # Command sync
    sync_commands,
    clean_stale_commands,
    # Manifest management
    create_manifest,
    preserve_removed_entries,
    # Constants
    ALLOWED_SKILL_FIELDS
)


# ============================================================================
# Frontmatter Parsing Tests
# ============================================================================

def test_extract_frontmatter_valid():
    """Test extracting valid frontmatter."""
    content = """---
name: test-skill
description: A test skill
---
Body content here
More body"""

    frontmatter, body = extract_frontmatter(content)

    assert frontmatter is not None
    assert len(frontmatter) == 2
    assert frontmatter[0] == 'name: test-skill'
    assert frontmatter[1] == 'description: A test skill'
    assert body[0] == 'Body content here'
    assert body[1] == 'More body'


def test_extract_frontmatter_no_frontmatter():
    """Test extracting from content without frontmatter."""
    content = "Just body content\nNo frontmatter"

    frontmatter, body = extract_frontmatter(content)

    assert frontmatter is None
    assert body == content.split('\n')


def test_extract_frontmatter_malformed():
    """Test extracting malformed frontmatter (no closing ---)."""
    content = """---
name: test
description: test
More content"""

    frontmatter, body = extract_frontmatter(content)

    assert frontmatter is None
    assert body == content.split('\n')


def test_parse_frontmatter_to_dict():
    """Test parsing frontmatter lines to dictionary."""
    lines = [
        'name: my-skill',
        'description: "A skill with description"',
        'license: MIT'
    ]

    fields = parse_frontmatter_to_dict(lines)

    assert fields['name'] == 'my-skill'
    assert fields['description'] == 'A skill with description'  # Quotes removed
    assert fields['license'] == 'MIT'


def test_reconstruct_content():
    """Test reconstructing content from frontmatter and body."""
    frontmatter = ['name: test', 'description: Test']
    body = ['', 'Body line 1', 'Body line 2']

    content = reconstruct_content(frontmatter, body)

    expected = "---\nname: test\ndescription: Test\n---\n\nBody line 1\nBody line 2"
    assert content == expected


def test_filter_allowed_fields():
    """Test filtering frontmatter fields."""
    lines = [
        'name: test',
        'description: A test',
        'invalid-field: should be removed',
        'license: MIT'
    ]
    allowed = {'name', 'description', 'license'}

    filtered = filter_allowed_fields(lines, allowed)

    assert len(filtered) == 3
    assert 'name: test' in filtered
    assert 'description: A test' in filtered
    assert 'license: MIT' in filtered
    assert 'invalid-field: should be removed' not in filtered


# ============================================================================
# Field Normalization Tests
# ============================================================================

def test_normalize_skill_name_basic():
    """Test basic skill name normalization."""
    assert normalize_skill_name('Test_Skill') == 'test-skill'
    assert normalize_skill_name('test skill') == 'test-skill'
    assert normalize_skill_name('Test@Skill!') == 'test-skill'


def test_normalize_skill_name_hyphens():
    """Test hyphen handling in skill names."""
    assert normalize_skill_name('--test--') == 'test'
    assert normalize_skill_name('test---skill') == 'test-skill'
    assert normalize_skill_name('-test-') == 'test'


def test_normalize_skill_name_length():
    """Test skill name length truncation."""
    long_name = 'a' * 100
    normalized = normalize_skill_name(long_name)
    assert len(normalized) == 64


def test_normalize_description_basic():
    """Test basic description normalization."""
    assert normalize_description('A test') == 'A test'
    assert normalize_description('  Trimmed  ') == 'Trimmed'


def test_normalize_description_empty():
    """Test description normalization with empty string."""
    assert normalize_description('') == 'Skill'
    assert normalize_description('   ') == 'Skill'


def test_normalize_description_length():
    """Test description length truncation."""
    long_desc = 'x' * 2000
    normalized = normalize_description(long_desc)
    assert len(normalized) == 1024


def test_normalize_compatibility():
    """Test compatibility normalization."""
    long_compat = 'x' * 1000
    normalized = normalize_compatibility(long_compat)
    assert len(normalized) == 500


def test_normalize_fields_complete():
    """Test normalizing a complete fields dictionary."""
    fields = {
        'name': 'Test_Skill',
        'description': 'A test skill',
        'license': 'MIT',
        'compatibility': 'Python 3.8+',
        'metadata': 'key=value',
        'allowed-tools': 'Read Write'
    }

    normalized = normalize_fields(fields, 'plugin', 'skill')

    assert normalized['name'] == 'test-skill'
    assert normalized['description'] == 'A test skill'
    assert normalized['license'] == 'MIT'
    assert normalized['compatibility'] == 'Python 3.8+'
    assert normalized['metadata'] == 'key=value'
    assert normalized['allowed-tools'] == 'Read Write'


def test_normalize_fields_missing_required():
    """Test normalizing fields with missing required fields."""
    fields = {}

    normalized = normalize_fields(fields, 'plugin', 'skill')

    assert normalized['name'] == 'plugin-skill'
    assert normalized['description'] == ''


def test_fields_to_frontmatter_lines():
    """Test converting fields dict to frontmatter lines."""
    fields = {
        'name': 'test-skill',
        'description': 'A test: with colon',  # Should be quoted
        'license': 'MIT'
    }

    lines = fields_to_frontmatter_lines(fields)

    assert lines[0] == 'name: test-skill'
    assert lines[1] == 'description: "A test: with colon"'
    assert lines[2] == 'license: MIT'


# ============================================================================
# Plugin Reference Rewriting Tests
# ============================================================================

def test_rewrite_plugin_references_commands():
    """Test rewriting command references."""
    content = "Use /do:plan to plan your work"

    rewritten = rewrite_plugin_references(content, 'do')

    assert rewritten == "Use skill do-plan to plan your work"


def test_rewrite_plugin_references_agent_names():
    """Test rewriting agent name references."""
    content = "The do:iterative-implementer agent"

    rewritten = rewrite_plugin_references(content, 'do')

    assert rewritten == "The do-iterative-implementer agent"


def test_rewrite_plugin_references_mixed():
    """Test rewriting multiple types of references."""
    content = """
/do:plan is used with do:iterative-implementer
"""

    rewritten = rewrite_plugin_references(content, 'do')

    assert "skill do-plan" in rewritten
    assert "do-iterative-implementer" in rewritten


# ============================================================================
# Skill Transformation Tests
# ============================================================================

def test_transform_skill_basic():
    """Test basic skill transformation."""
    content = """---
name: old-name
description: Test skill
extra-field: should be removed
---
Body with /plugin:command reference"""

    transformed = transform_skill(content, 'plugin', 'skill', ALLOWED_SKILL_FIELDS)

    assert 'name: old-name' in transformed
    assert 'description: "Test skill"' in transformed  # Quoted because normalization adds quotes
    assert 'extra-field' not in transformed
    assert 'skill plugin-command' in transformed


def test_transform_skill_no_frontmatter():
    """Test transforming skill without frontmatter."""
    content = "Just body content"

    transformed = transform_skill(content, 'plugin', 'skill', ALLOWED_SKILL_FIELDS)

    assert 'name: plugin-skill' in transformed
    assert 'description:' in transformed  # Empty but present
    assert 'Just body content' in transformed


def test_transform_skill_special_characters_in_name():
    """Test transforming skill with special characters in name."""
    content = """---
name: Test@Skill#123
description: Test
---
Body"""

    transformed = transform_skill(content, 'plugin', 'skill', ALLOWED_SKILL_FIELDS)

    assert 'name: test-skill-123' in transformed


# ============================================================================
# Agent Rewriting Tests
# ============================================================================

def test_update_agent_field_name():
    """Test updating agent name field."""
    line = 'name: iterative-implementer'

    updated = update_agent_field(line, 'do')

    assert updated == 'name: do-iterative-implementer'


def test_update_agent_field_name_with_prefix():
    """Test updating agent name that already has prefix."""
    line = 'name: do-iterative-implementer'

    updated = update_agent_field(line, 'do')

    assert updated == 'name: do-iterative-implementer'


def test_update_agent_field_tools():
    """Test updating tools field from comma-separated to array."""
    line = 'tools: Read, Write, Bash'

    updated = update_agent_field(line, 'do')

    assert updated == 'tools: [Read, Write, Bash]'


def test_update_agent_field_description():
    """Test updating description field (adding quotes)."""
    line = 'description: A test description'

    updated = update_agent_field(line, 'do')

    assert updated == 'description: "A test description"'


def test_rewrite_agent_basic():
    """Test basic agent rewriting."""
    content = """---
name: implementer
description: An implementer agent
tools: Read, Write
---"""

    rewritten = rewrite_agent(content, 'do', 'implementer')

    assert 'name: do-implementer' in rewritten
    assert '[Read, Write]' in rewritten


def test_rewrite_agent_no_frontmatter():
    """Test rewriting agent without frontmatter."""
    content = "Just body content"

    rewritten = rewrite_agent(content, 'do', 'agent')

    assert rewritten == content  # Should return unchanged


# ============================================================================
# File System Operations Tests
# ============================================================================

def test_create_symlink_new():
    """Test creating a new symlink."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        source = tmppath / "source"
        target = tmppath / "target"

        source.mkdir()

        created = create_symlink(source, target)

        assert created is True
        assert target.is_symlink()
        assert target.resolve() == source.resolve()


def test_create_symlink_existing_correct():
    """Test creating symlink when correct one already exists."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        source = tmppath / "source"
        target = tmppath / "target"

        source.mkdir()
        target.symlink_to(source)

        created = create_symlink(source, target)

        assert created is False  # Already correct


def test_create_symlink_existing_wrong():
    """Test creating symlink when wrong one exists."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        source1 = tmppath / "source1"
        source2 = tmppath / "source2"
        target = tmppath / "target"

        source1.mkdir()
        source2.mkdir()
        target.symlink_to(source1)

        created = create_symlink(source2, target)

        assert created is True
        assert target.resolve() == source2.resolve()


def test_write_if_changed_new():
    """Test writing to a new file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        target = tmppath / "file.txt"

        written = write_if_changed(target, "content")

        assert written is True
        assert target.read_text() == "content"


def test_write_if_changed_same_content():
    """Test writing when content is unchanged."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        target = tmppath / "file.txt"

        target.write_text("content")
        written = write_if_changed(target, "content")

        assert written is False


def test_write_if_changed_different_content():
    """Test writing when content has changed."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        target = tmppath / "file.txt"

        target.write_text("old content")
        written = write_if_changed(target, "new content")

        assert written is True
        assert target.read_text() == "new content"


# ============================================================================
# Plugin Discovery Tests
# ============================================================================

def test_find_skills():
    """Test finding skills in a plugin directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        skills_dir = tmppath / "skills"
        skills_dir.mkdir()

        # Create two skills
        skill1 = skills_dir / "skill1"
        skill1.mkdir()
        (skill1 / "SKILL.md").write_text("skill 1")

        skill2 = skills_dir / "skill2"
        skill2.mkdir()
        (skill2 / "SKILL.md").write_text("skill 2")

        # Create a directory without SKILL.md
        not_skill = skills_dir / "not_skill"
        not_skill.mkdir()

        skills = find_skills(tmppath)

        assert len(skills) == 2
        skill_names = [name for name, _ in skills]
        assert 'skill1' in skill_names
        assert 'skill2' in skill_names
        assert 'not_skill' not in skill_names


def test_find_agents():
    """Test finding agents in a plugin directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        agents_dir = tmppath / "agents"
        agents_dir.mkdir()

        (agents_dir / "agent1.md").write_text("agent 1")
        (agents_dir / "agent2.md").write_text("agent 2")
        (agents_dir / "not_agent.txt").write_text("not an agent")

        agents = find_agents(tmppath)

        assert len(agents) == 2
        agent_names = [name for name, _ in agents]
        assert 'agent1' in agent_names
        assert 'agent2' in agent_names


def test_find_commands():
    """Test finding commands in a plugin directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        commands_dir = tmppath / "commands"
        commands_dir.mkdir()

        (commands_dir / "command1.md").write_text("command 1")
        (commands_dir / "command2.md").write_text("command 2")

        commands = find_commands(tmppath)

        assert len(commands) == 2
        command_names = [name for name, _ in commands]
        assert 'command1' in command_names
        assert 'command2' in command_names


# ============================================================================
# Manifest Management Tests
# ============================================================================

def test_create_manifest():
    """Test creating a new manifest."""
    manifest = create_manifest()

    assert 'lastSync' in manifest
    assert 'skills' in manifest
    assert 'agents' in manifest
    assert 'commands' in manifest
    assert manifest['skills'] == {}
    assert manifest['agents'] == {}
    assert manifest['commands'] == {}


def test_preserve_removed_entries():
    """Test preserving removed entries in manifest."""
    previous_manifest = {
        'skills': {
            'skill1': {'source': '/path1', 'status': 'active'},
            'skill2': {'source': '/path2', 'status': 'active'}
        },
        'agents': {},
        'commands': {}
    }

    current_manifest = {
        'skills': {
            'skill1': {'source': '/path1', 'status': 'active'}
        },
        'agents': {},
        'commands': {}
    }

    preserve_removed_entries(current_manifest, previous_manifest)

    assert 'skill1' in current_manifest['skills']
    assert 'skill2' in current_manifest['skills']
    assert current_manifest['skills']['skill1']['status'] == 'active'
    assert current_manifest['skills']['skill2']['status'] == 'removed'


# ============================================================================
# Integration Tests
# ============================================================================

def test_full_skill_transformation_pipeline():
    """Test the complete skill transformation pipeline."""
    input_content = """---
name: Original_Name
description: A test skill for transformation
invalid_field: this should be removed
license: MIT
---
This uses /my-plugin:command and my-plugin:agent references.
"""

    # Transform the skill
    result = transform_skill(input_content, 'my-plugin', 'my-skill', ALLOWED_SKILL_FIELDS)

    # Verify frontmatter
    assert 'name: original-name' in result
    assert 'description: "A test skill for transformation"' in result  # Quoted
    assert 'license: MIT' in result
    assert 'invalid_field' not in result

    # Verify body rewriting
    assert 'skill my-plugin-command' in result
    assert 'my-plugin-agent' in result


def test_field_normalization_edge_cases():
    """Test field normalization with various edge cases."""
    fields = {
        'name': '!!!Test@@@Skill###',
        'description': '  ' + ('x' * 2000),  # Too long
        'compatibility': 'y' * 1000,  # Too long
    }

    normalized = normalize_fields(fields, 'plugin', 'skill')

    # Name: special chars replaced, length OK
    assert normalized['name'] == 'test-skill'

    # Description: trimmed and truncated
    assert len(normalized['description']) == 1024
    assert normalized['description'].startswith('x')

    # Compatibility: truncated
    assert len(normalized['compatibility']) == 500


# ============================================================================
# Command Sync Tests
# ============================================================================

def make_plugin_with_command(root: Path, plugin_name: str, command_name: str) -> Path:
    """Create a minimal plugin directory containing one command."""
    plugin_path = root / plugin_name
    commands_dir = plugin_path / "commands"
    commands_dir.mkdir(parents=True)
    (commands_dir / f"{command_name}.md").write_text(
        f"---\ndescription: {plugin_name} {command_name}\n---\nBody of {plugin_name}\n"
    )
    return plugin_path


def test_sync_commands_namespaces_dirs_and_manifest_keys():
    """Two plugins providing the same command name get separate namespaced dirs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        skills_dir = tmppath / "skills"
        skills_dir.mkdir()
        manifest = create_manifest()
        synced = set()

        for plugin in ("alpha", "beta"):
            plugin_path = make_plugin_with_command(tmppath / "plugins", plugin, "review")
            added = sync_commands(plugin_path, plugin, skills_dir, synced, manifest, ALLOWED_SKILL_FIELDS)
            assert added == 1

        # Two distinct namespaced dirs, neither clobbered the other
        assert (skills_dir / "alpha-review" / "SKILL.md").is_file()
        assert (skills_dir / "beta-review" / "SKILL.md").is_file()
        assert "Body of alpha" in (skills_dir / "alpha-review" / "SKILL.md").read_text()
        assert "Body of beta" in (skills_dir / "beta-review" / "SKILL.md").read_text()

        # Two manifest entries; key equals on-disk dir name (unsync.py contract)
        assert set(manifest["commands"].keys()) == {"alpha-review", "beta-review"}
        assert synced == {"alpha-review", "beta-review"}
        for key in manifest["commands"]:
            assert (skills_dir / key).is_dir()


def test_sync_commands_refuses_symlink_target(capsys):
    """A pre-existing skill symlink at the command target is never written through."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        skills_dir = tmppath / "skills"
        skills_dir.mkdir()

        # Source skill directory in the "plugin cache" — must survive untouched
        source_skill = tmppath / "cache" / "review-skill"
        source_skill.mkdir(parents=True)
        original_content = "---\nname: alpha-review\n---\nORIGINAL SKILL\n"
        (source_skill / "SKILL.md").write_text(original_content)

        # Skill symlink occupying the command's namespaced target
        (skills_dir / "alpha-review").symlink_to(source_skill)

        plugin_path = make_plugin_with_command(tmppath / "plugins", "alpha", "review")
        manifest = create_manifest()
        synced = set()
        added = sync_commands(plugin_path, "alpha", skills_dir, synced, manifest, ALLOWED_SKILL_FIELDS)

        # Command skipped: nothing written, nothing recorded
        assert added == 0
        assert synced == set()
        assert manifest["commands"] == {}

        # Source plugin untouched; symlink still a symlink
        assert (source_skill / "SKILL.md").read_text() == original_content
        assert (skills_dir / "alpha-review").is_symlink()

        # Refusal is loud
        assert "alpha:review" in capsys.readouterr().err


def test_clean_stale_commands_removes_dirs_skips_symlinks():
    """Stale real dirs are removed; a symlink at a stale path is left alone."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        skills_dir = tmppath / "skills"
        skills_dir.mkdir()

        # Stale real dir from a previous sync (e.g. pre-namespacing bare name)
        stale_dir = skills_dir / "review"
        stale_dir.mkdir()
        (stale_dir / "SKILL.md").write_text("old")

        # Stale manifest entry whose path is now a symlink — not ours to delete
        source = tmppath / "source"
        source.mkdir()
        (skills_dir / "linked").symlink_to(source)

        removed = clean_stale_commands(skills_dir, {"alpha-review"}, {"review", "linked", "alpha-review"})

        assert removed == 1
        assert not stale_dir.exists()
        assert (skills_dir / "linked").is_symlink()
        assert source.exists()


# ============================================================================
# Enhanced Sync Tests (sync_enhanced routes through sync.py materializers)
# ============================================================================

from sync_enhanced import sync_extensions
from dependency_graph import Extension, ExtensionType


def make_paths(root: Path) -> dict:
    """Build a paths dict for sync_extensions rooted in a temp directory."""
    return {
        'copilot_skills_dir': root / "copilot" / "skills",
        'copilot_agents_dir': root / "copilot" / "agents",
        'manifest_file': root / "copilot" / "claude-sync-manifest.json",
    }


def make_skill_extension(root: Path, plugin: str, skill: str,
                         supporting_files: dict = None) -> Extension:
    """Create a skill directory (with optional supporting files) and its Extension."""
    skill_dir = root / "cache" / plugin / "skills" / skill
    skill_dir.mkdir(parents=True)
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(f"---\nname: {skill}\ndescription: test\n---\nUse bin/helper.sh\n")
    for rel_path, content in (supporting_files or {}).items():
        path = skill_dir / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    return Extension(name=skill, type=ExtensionType.SKILL, plugin=plugin, file_path=skill_file)


def make_agent_extension(root: Path, plugin: str, agent: str) -> Extension:
    """Create an agent file and its Extension."""
    agents_dir = root / "cache" / plugin / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    agent_file = agents_dir / f"{agent}.md"
    agent_file.write_text(f"---\nname: {agent}\ndescription: agent of {plugin}\n---\nAgent body\n")
    return Extension(name=agent, type=ExtensionType.AGENT, plugin=plugin, file_path=agent_file)


def make_command_extension(root: Path, plugin: str, command: str) -> Extension:
    """Create a command file (with command-only frontmatter) and its Extension."""
    commands_dir = root / "cache" / plugin / "commands"
    commands_dir.mkdir(parents=True, exist_ok=True)
    command_file = commands_dir / f"{command}.md"
    command_file.write_text(
        f"---\ndescription: {command} command\nargument-hint: <target>\n---\nCommand body of {plugin}\n"
    )
    return Extension(name=command, type=ExtensionType.COMMAND, plugin=plugin, file_path=command_file)


def test_sync_extensions_skill_symlinks_whole_directory():
    """A skill with supporting files is synced as the whole directory, not a lone SKILL.md."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        paths = make_paths(tmppath)
        ext = make_skill_extension(tmppath, "plug", "myskill", supporting_files={
            "bin/helper.sh": "#!/bin/sh\necho hi\n",
            "references/doc.md": "supporting doc\n",
        })

        stats = sync_extensions([ext], paths)

        target = paths['copilot_skills_dir'] / "plug-myskill"
        assert stats['added_skills'] == 1
        assert target.is_symlink()
        assert target.resolve() == ext.file_path.parent.resolve()
        # Supporting files reachable at the destination
        assert (target / "SKILL.md").is_file()
        assert (target / "bin" / "helper.sh").read_text() == "#!/bin/sh\necho hi\n"
        assert (target / "references" / "doc.md").is_file()


def test_sync_extensions_command_transformed_and_namespaced():
    """A command is transformed to a valid Copilot skill in a namespaced dir."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        paths = make_paths(tmppath)
        ext = make_command_extension(tmppath, "plug", "deploy")

        stats = sync_extensions([ext], paths)

        target_file = paths['copilot_skills_dir'] / "plug-deploy" / "SKILL.md"
        assert stats['added_commands'] == 1
        assert not (paths['copilot_skills_dir'] / "deploy").exists()  # no bare dir
        assert target_file.is_file() and not target_file.parent.is_symlink()
        content = target_file.read_text()
        # transform_skill applied: disallowed command field stripped, name normalized
        assert "argument-hint" not in content
        assert "name: plug-deploy" in content
        assert "Command body of plug" in content


def test_sync_extensions_same_named_agents_namespaced_per_plugin():
    """Same-named agents from two plugins get distinct internal names and files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        paths = make_paths(tmppath)
        exts = [make_agent_extension(tmppath, plugin, "impl") for plugin in ("alpha", "beta")]

        stats = sync_extensions(exts, paths)

        assert stats['added_agents'] == 2
        alpha = paths['copilot_agents_dir'] / "alpha-impl.agent.md"
        beta = paths['copilot_agents_dir'] / "beta-impl.agent.md"
        # rewrite_agent applied: internal names are namespaced and distinct
        assert "name: alpha-impl" in alpha.read_text()
        assert "name: beta-impl" in beta.read_text()


def test_sync_extensions_command_refuses_symlink_target():
    """The .8 symlink-refusal invariant holds on the enhanced path too."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        paths = make_paths(tmppath)
        ext = make_command_extension(tmppath, "plug", "deploy")

        # A skill symlink already occupies the command's namespaced target
        source = tmppath / "occupant"
        source.mkdir()
        paths['copilot_skills_dir'].mkdir(parents=True)
        (paths['copilot_skills_dir'] / "plug-deploy").symlink_to(source)

        stats = sync_extensions([ext], paths)

        assert stats['added_commands'] == 0
        assert (paths['copilot_skills_dir'] / "plug-deploy").is_symlink()
        assert not (source / "SKILL.md").exists()  # never written through
        manifest = json.loads(paths['manifest_file'].read_text())
        assert manifest['commands'] == {}


def test_sync_extensions_writes_shared_manifest_and_cleans_stale():
    """Sync record lands in the shared manifest; deselected items are cleaned up."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmppath = Path(tmpdir)
        paths = make_paths(tmppath)
        skill = make_skill_extension(tmppath, "plug", "keeper")
        stale_skill = make_skill_extension(tmppath, "plug", "goner")
        command = make_command_extension(tmppath, "plug", "deploy")

        sync_extensions([skill, stale_skill, command], paths)

        manifest = json.loads(paths['manifest_file'].read_text())
        # manifest key == on-disk name, the unsync.py contract
        assert set(manifest['skills'].keys()) == {"plug-keeper", "plug-goner"}
        assert set(manifest['commands'].keys()) == {"plug-deploy"}
        for key in manifest['skills']:
            assert (paths['copilot_skills_dir'] / key).is_symlink()

        # Second run deselects 'goner' and the command
        stats = sync_extensions([skill], paths)

        assert stats['removed_skills'] == 1
        assert stats['removed_commands'] == 1
        assert not (paths['copilot_skills_dir'] / "plug-goner").exists()
        assert not (paths['copilot_skills_dir'] / "plug-deploy").exists()
        assert (paths['copilot_skills_dir'] / "plug-keeper").is_symlink()
        manifest = json.loads(paths['manifest_file'].read_text())
        assert manifest['skills']['plug-keeper']['status'] == "active"
        assert manifest['skills']['plug-goner']['status'] == "removed"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
