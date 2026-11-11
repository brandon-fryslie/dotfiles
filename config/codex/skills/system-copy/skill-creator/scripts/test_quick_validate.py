"""Which SKILL.md frontmatter quick_validate accepts: an empty or whitespace-only name or
description is rejected with a message naming the field, never reported as valid.

Run: just test-skill-creator
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from quick_validate import validate_skill

SCRIPT = Path(__file__).with_name("quick_validate.py")


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
        self.assertIn(field, message)

    def test_empty_name(self):
        self.check('""', "Does a thing.", "Name")

    def test_whitespace_name(self):
        self.check('"   "', "Does a thing.", "Name")

    def test_empty_description(self):
        self.check("my-skill", '""', "Description")

    def test_whitespace_description(self):
        self.check("my-skill", '"   "', "Description")

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
