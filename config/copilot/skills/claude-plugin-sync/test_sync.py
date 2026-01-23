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


def test_rewrite_plugin_references_skill_calls():
    """Test rewriting Skill() calls."""
    content = 'Skill("do:beads") is useful'

    rewritten = rewrite_plugin_references(content, 'do')

    assert rewritten == 'Skill("do-beads") is useful'


def test_rewrite_plugin_references_mixed():
    """Test rewriting multiple types of references."""
    content = """
/do:plan is used with do:iterative-implementer
Call Skill("do:beads") for tracking
"""

    rewritten = rewrite_plugin_references(content, 'do')

    assert "skill do-plan" in rewritten
    assert "do-iterative-implementer" in rewritten
    assert 'Skill("do-beads")' in rewritten


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
---
Use do:beads for tracking"""

    rewritten = rewrite_agent(content, 'do', 'implementer')

    assert 'name: do-implementer' in rewritten
    assert '[Read, Write]' in rewritten
    assert 'do-beads' in rewritten


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


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
