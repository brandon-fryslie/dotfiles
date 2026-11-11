"""Which SKILL.md frontmatter the codex skill-creator's quick_validate accepts: an empty,
whitespace-only, or bare-key (YAML null) name or description is rejected with a message
naming the field as empty, never reported as valid; a skill fresh from init_skill is
rejected for its unfilled description placeholder.

Run: just test-skill-creator
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "config/codex/skills/system-copy/skill-creator/scripts"
sys.path.insert(0, str(SCRIPTS))
sys.dont_write_bytecode = True  # importing must not drop __pycache__ into the linked ~/.codex skill
from quick_validate import validate_skill  # noqa: E402

SCRIPT = SCRIPTS / "quick_validate.py"
INIT_SCRIPT = SCRIPTS / "init_skill.py"


def skill_dir(root, name, description):
    path = Path(root)
    (path / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n\nBody.\n"
    )
    return path


class EmptyFieldsTest(unittest.TestCase):
    def check(self, name, description, field):
        with tempfile.TemporaryDirectory() as root:
            valid, message = validate_skill(skill_dir(root, name, description))
        self.assertFalse(valid, message)
        self.assertEqual(message, f"{field} is empty in frontmatter")

    def test_empty_name(self):
        self.check('""', "Does a thing.", "Name")

    def test_whitespace_name(self):
        self.check('"   "', "Does a thing.", "Name")

    def test_bare_name_key(self):
        self.check("", "Does a thing.", "Name")

    def test_empty_description(self):
        self.check("my-skill", '""', "Description")

    def test_whitespace_description(self):
        self.check("my-skill", '"   "', "Description")

    def test_bare_description_key(self):
        self.check("my-skill", "", "Description")

    def test_non_string_name(self):
        with tempfile.TemporaryDirectory() as root:
            valid, message = validate_skill(skill_dir(root, "123", "Does a thing."))
        self.assertFalse(valid, message)
        self.assertEqual(message, "Name must be a string, got int")

    def test_valid_skill_passes(self):
        with tempfile.TemporaryDirectory() as root:
            valid, message = validate_skill(skill_dir(root, "my-skill", "Does a thing."))
        self.assertTrue(valid, message)

    def test_cli_exits_nonzero_on_empty_name(self):
        with tempfile.TemporaryDirectory() as root:
            result = subprocess.run(
                [sys.executable, "-B", str(SCRIPT), str(skill_dir(root, '""', "Does a thing."))],
                capture_output=True,
                text=True,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "Name is empty in frontmatter")


class InitPlaceholderTest(unittest.TestCase):
    def test_fresh_init_skill_is_rejected_for_its_placeholder(self):
        with tempfile.TemporaryDirectory() as root:
            subprocess.run(
                [sys.executable, "-B", str(INIT_SCRIPT), "my-skill", "--path", root],
                capture_output=True,
                check=True,
            )
            valid, message = validate_skill(Path(root) / "my-skill")
        self.assertFalse(valid, message)
        self.assertEqual(
            message,
            "Description is still the init_skill placeholder; "
            "replace it with what the skill does and when to use it",
        )

    def test_description_starting_with_todo_is_valid(self):
        with tempfile.TemporaryDirectory() as root:
            valid, message = validate_skill(skill_dir(root, "my-skill", "TODO-list manager."))
        self.assertTrue(valid, message)


if __name__ == "__main__":
    unittest.main()
