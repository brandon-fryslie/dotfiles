"""Tests for unsync.py — executed against a fake ~/.copilot tree.

The contract under test: the manifest is the single record of ownership.
unsync removes only manifest-recorded items that are no longer active,
and never touches anything it did not create.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from unsync import unsync_all, remove_path


def make_paths(tmp_path):
    """Build a fake ~/.copilot tree mirroring sync.DEFAULT_PATHS keys."""
    skills_dir = tmp_path / ".copilot" / "skills"
    agents_dir = tmp_path / ".copilot" / "agents"
    skills_dir.mkdir(parents=True)
    agents_dir.mkdir(parents=True)
    return {
        'copilot_skills_dir': skills_dir,
        'copilot_agents_dir': agents_dir,
        'manifest_file': tmp_path / ".copilot" / "claude-sync-manifest.json",
    }


def write_manifest(paths, skills=None, agents=None, commands=None):
    paths['manifest_file'].write_text(json.dumps({
        "skills": skills or {},
        "agents": agents or {},
        "commands": commands or {},
    }))


def entry(status):
    return {"source": "/somewhere", "plugin": "p", "status": status}


def make_synced_skill(tmp_path, paths, name):
    """A skill the way sync.py creates one: a symlink to a plugin dir."""
    source = tmp_path / "plugin-cache" / name
    source.mkdir(parents=True)
    (source / "SKILL.md").write_text("---\nname: x\n---\nbody")
    (paths['copilot_skills_dir'] / name).symlink_to(source)
    return source


def make_command_skill(paths, name):
    """A command-derived skill the way sync.py creates one: a real dir."""
    skill_dir = paths['copilot_skills_dir'] / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text("---\nname: x\n---\nbody")
    return skill_dir


def test_user_authored_skill_survives(tmp_path):
    """A skill the user wrote by hand is not in the manifest — never removed."""
    paths = make_paths(tmp_path)
    user_skill = make_command_skill(paths, "my-handmade-skill")
    write_manifest(paths)

    removed = unsync_all(paths)

    assert removed == 0
    assert user_skill.exists()
    assert (user_skill / "SKILL.md").exists()


def test_user_authored_agent_survives(tmp_path):
    paths = make_paths(tmp_path)
    user_agent = paths['copilot_agents_dir'] / "my-agent.md"
    user_agent.write_text("my agent")
    write_manifest(paths)

    removed = unsync_all(paths)

    assert removed == 0
    assert user_agent.exists()


def test_stale_symlinked_skill_removed_cleanly(tmp_path):
    """A symlinked skill no longer active is unlinked — source untouched."""
    paths = make_paths(tmp_path)
    source = make_synced_skill(tmp_path, paths, "plug-old-skill")
    write_manifest(paths, skills={"plug-old-skill": entry("removed")})

    removed = unsync_all(paths)

    assert removed == 1
    assert not (paths['copilot_skills_dir'] / "plug-old-skill").is_symlink()
    # unlink must not follow the symlink into the plugin cache
    assert source.exists()
    assert (source / "SKILL.md").exists()


def test_active_symlinked_skill_kept(tmp_path):
    paths = make_paths(tmp_path)
    make_synced_skill(tmp_path, paths, "plug-live-skill")
    write_manifest(paths, skills={"plug-live-skill": entry("active")})

    removed = unsync_all(paths)

    assert removed == 0
    assert (paths['copilot_skills_dir'] / "plug-live-skill").is_symlink()


def test_active_command_skill_kept(tmp_path):
    """Command-derived skills are recorded under manifest['commands']."""
    paths = make_paths(tmp_path)
    cmd_skill = make_command_skill(paths, "review")
    write_manifest(paths, commands={"review": entry("active")})

    removed = unsync_all(paths)

    assert removed == 0
    assert cmd_skill.exists()


def test_stale_command_skill_removed(tmp_path):
    paths = make_paths(tmp_path)
    make_command_skill(paths, "old-command")
    write_manifest(paths, commands={"old-command": entry("removed")})

    removed = unsync_all(paths)

    assert removed == 1
    assert not (paths['copilot_skills_dir'] / "old-command").exists()


def test_stale_agent_file_removed(tmp_path):
    paths = make_paths(tmp_path)
    agent = paths['copilot_agents_dir'] / "plug-old.agent.md"
    agent.write_text("agent body")
    write_manifest(paths, agents={"plug-old.agent.md": entry("removed")})

    removed = unsync_all(paths)

    assert removed == 1
    assert not agent.exists()


def test_active_agent_kept(tmp_path):
    paths = make_paths(tmp_path)
    agent = paths['copilot_agents_dir'] / "plug-live.agent.md"
    agent.write_text("agent body")
    write_manifest(paths, agents={"plug-live.agent.md": entry("active")})

    removed = unsync_all(paths)

    assert removed == 0
    assert agent.exists()


def test_mixed_tree_only_stale_synced_items_removed(tmp_path):
    """The full scenario from the ticket, in one tree."""
    paths = make_paths(tmp_path)
    user_skill = make_command_skill(paths, "handmade")
    cmd_skill = make_command_skill(paths, "active-cmd")
    make_synced_skill(tmp_path, paths, "plug-stale")
    live_source = make_synced_skill(tmp_path, paths, "plug-live")
    write_manifest(
        paths,
        skills={"plug-stale": entry("removed"), "plug-live": entry("active")},
        commands={"active-cmd": entry("active")},
    )

    removed = unsync_all(paths)

    assert removed == 1
    assert user_skill.exists()
    assert cmd_skill.exists()
    assert (paths['copilot_skills_dir'] / "plug-live").is_symlink()
    assert live_source.exists()
    assert not (paths['copilot_skills_dir'] / "plug-stale").exists()


def test_missing_manifest_removes_nothing(tmp_path):
    paths = make_paths(tmp_path)
    user_skill = make_command_skill(paths, "anything")

    removed = unsync_all(paths)

    assert removed == 0
    assert user_skill.exists()


def test_corrupt_manifest_raises(tmp_path):
    """A corrupt manifest must not be treated as 'nothing recorded'."""
    paths = make_paths(tmp_path)
    paths['manifest_file'].write_text("{not json")
    make_command_skill(paths, "anything")

    with pytest.raises(json.JSONDecodeError):
        unsync_all(paths)


@pytest.mark.parametrize("content", [
    "null",
    "[]",
    "42",
    '{"skills": null}',
    '{"skills": ["a-list"]}',
    '{"skills": {"name": "not-an-object"}}',
])
def test_structurally_invalid_manifest_raises(tmp_path, content):
    """Valid JSON with the wrong shape must abort, not crash or proceed."""
    paths = make_paths(tmp_path)
    paths['manifest_file'].write_text(content)
    survivor = make_command_skill(paths, "anything")

    with pytest.raises(ValueError):
        unsync_all(paths)
    assert survivor.exists()


def test_cli_removal_failure_exits_1_with_message(tmp_path):
    """A filesystem error during removal aborts with a clear message, not a traceback."""
    paths = make_paths(tmp_path)
    make_command_skill(paths, "stale")
    write_manifest(paths, commands={"stale": entry("removed")})
    paths['copilot_skills_dir'].chmod(0o555)

    try:
        result = subprocess.run(
            [sys.executable, "unsync.py"],
            env={**os.environ, "HOME": str(tmp_path)},
            capture_output=True, text=True,
            cwd=Path(__file__).parent,
        )
    finally:
        paths['copilot_skills_dir'].chmod(0o755)

    assert result.returncode == 1
    assert result.stderr.startswith("Error: could not remove item:")
    assert "Traceback" not in result.stderr


def test_remove_path_unlinks_symlink_to_dir(tmp_path):
    """is_dir() follows symlinks but rmtree refuses them — unlink wins."""
    source = tmp_path / "real-dir"
    source.mkdir()
    (source / "file.txt").write_text("content")
    link = tmp_path / "link"
    link.symlink_to(source)

    remove_path(link)

    assert not link.is_symlink()
    assert source.exists()
    assert (source / "file.txt").exists()
