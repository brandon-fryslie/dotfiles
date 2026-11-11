"""Which SKILL.md frontmatter the codex skill-creator's quick_validate accepts: an empty,
whitespace-only, or bare-key (YAML null) name or description is rejected with a message
naming the field as empty, never reported as valid.

Run: just test-skill-creator
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "config/codex/skills/system-copy/skill-creator/scripts"
sys.path.insert(0, str(SCRIPTS))
from quick_validate import validate_skill  # noqa: E402

SCRIPT = SCRIPTS / "quick_validate.py"


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

    def test_valid_skill_passes(self):
        with tempfile.TemporaryDirectory() as root:
            valid, message = validate_skill(skill_dir(root, "my-skill", "Does a thing."))
        self.assertTrue(valid, message)

    def test_cli_exits_nonzero_on_empty_name(self):
        with tempfile.TemporaryDirectory() as root:
            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(skill_dir(root, '""', "Does a thing."))],
                capture_output=True,
                text=True,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Name", result.stdout)


if __name__ == "__main__":
    unittest.main()
