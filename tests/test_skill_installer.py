"""How the codex skill-installer scripts fail: a network failure is the script's own error
(never a traceback), --method auto falls through to git when the download fails, and a
multi-path install is all-or-nothing.

The network is dead for real (https_proxy points at a closed port) and the git path is
real (a gitconfig rewrites the GitHub URL to a local repo), so nothing is mocked.

Run: just test-skill-installer
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "config/codex/skills/system-copy/skill-installer/scripts"
INSTALL = SCRIPTS / "install-skill-from-github.py"
LIST_CURATED = SCRIPTS / "list-curated-skills.py"
REPO = "acme/skills"


def git(*args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


class InstallerTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.repo = self.root / "repo"
        self.dest = self.root / "dest"
        gitconfig = self.root / "gitconfig"
        gitconfig.write_text(
            f'[url "file://{self.repo}/"]\n'
            f"\tinsteadOf = https://github.com/{REPO}.git\n"
            f"\tinsteadOf = git@github.com:{REPO}.git\n"
            "[user]\n\tname = t\n\temail = t@t\n"
        )
        self.env = {
            "PATH": os.environ["PATH"],
            "HOME": str(self.root),
            "TMPDIR": str(self.root),
            "GIT_CONFIG_GLOBAL": str(gitconfig),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_TERMINAL_PROMPT": "0",
            "https_proxy": "http://127.0.0.1:9",
            "HTTPS_PROXY": "http://127.0.0.1:9",
            "PYTHONDONTWRITEBYTECODE": "1",  # must not drop __pycache__ into the linked ~/.codex skill
        }

    def make_repo(self, skills, links=None):
        """skills: {path: has_skill_md}; links: {path: symlink target} to commit"""
        self.repo.mkdir()
        git("init", "-q", "-b", "main", cwd=self.repo)
        # honour --filter as GitHub does, so checkout must lazy-fetch the blobs
        git("config", "uploadpack.allowFilter", "true", cwd=self.repo)
        for path, has_skill_md in skills.items():
            d = self.repo / path
            d.mkdir(parents=True)
            (d / ("SKILL.md" if has_skill_md else "README.md")).write_text("x\n")
        for link, target in (links or {}).items():
            (self.repo / link).symlink_to(target)
        git("add", "-A", cwd=self.repo)
        git("commit", "-q", "-m", "skills", cwd=self.repo)

    def install(self, *args):
        return self.run_script(INSTALL, "--repo", REPO, "--dest", str(self.dest), *args)

    def run_script(self, script, *args):
        return subprocess.run(
            [sys.executable, str(script), *args], env=self.env, capture_output=True, text=True
        )

    def assertCleanFailure(self, result, message):
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn(message, result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def installed(self):
        return sorted(p.name for p in self.dest.iterdir()) if self.dest.exists() else []

    def test_auto_falls_through_to_git_when_offline(self):
        self.make_repo({"skills/alpha": True})
        result = self.install("--path", "skills/alpha")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "alpha" / "SKILL.md").is_file())
        self.assertIn("Download failed", result.stderr)  # the fallback is never silent

    def test_auto_names_every_failed_attempt(self):
        result = self.install("--path", "skills/alpha")  # no repo behind the rewritten URLs
        self.assertCleanFailure(result, "Download failed")
        self.assertIn(f"https://github.com/{REPO}.git", result.stderr)
        self.assertIn(f"git@github.com:{REPO}.git", result.stderr)
        self.assertIn(str(self.repo), result.stderr)  # the clone's own cause, not just its URL

    def test_download_offline_is_the_scripts_own_error(self):
        result = self.install("--path", "skills/alpha", "--method", "download")
        self.assertCleanFailure(result, "Error: Download failed")

    def test_list_curated_offline_is_the_scripts_own_error(self):
        result = self.run_script(LIST_CURATED)
        self.assertCleanFailure(result, "Error: Failed to fetch curated skills")

    def test_invalid_second_path_copies_nothing(self):
        self.make_repo({"skills/alpha": True, "skills/beta": False})
        result = self.install("--path", "skills/alpha", "skills/beta")
        self.assertCleanFailure(result, "SKILL.md not found")
        self.assertEqual(self.installed(), [])

    def test_existing_second_destination_copies_nothing(self):
        self.make_repo({"skills/alpha": True, "skills/beta": True})
        (self.dest / "beta").mkdir(parents=True)
        result = self.install("--path", "skills/alpha", "skills/beta")
        self.assertCleanFailure(result, "Destination already exists")
        self.assertNotIn("Download failed", result.stderr)  # decided before touching the network
        self.assertEqual(self.installed(), ["beta"])

    def test_two_paths_with_one_name_copy_nothing(self):
        self.make_repo({"a/alpha": True, "b/alpha": True})
        result = self.install("--path", "a/alpha", "b/alpha")
        self.assertCleanFailure(result, "would both install as alpha")
        self.assertEqual(self.installed(), [])

    def test_git_installs_from_a_commit_sha(self):
        self.make_repo({"skills/alpha": True})
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=self.repo, check=True, capture_output=True, text=True
        ).stdout.strip()
        git("rm", "-rq", "skills/alpha", cwd=self.repo)
        git("commit", "-q", "-m", "drop alpha", cwd=self.repo)
        result = self.install("--path", "skills/alpha", "--ref", sha, "--method", "git")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.dest / "alpha" / "SKILL.md").is_file())

    def test_name_with_several_paths_is_rejected(self):
        self.make_repo({"skills/alpha": True, "skills/beta": True})
        result = self.install("--path", "skills/alpha", "skills/beta", "--name", "x")
        self.assertCleanFailure(result, "--name")
        self.assertEqual(self.installed(), [])

    def test_link_out_of_the_skill_is_refused(self):
        secret = self.root / "secret"
        secret.write_text("private\n")
        self.make_repo({"skills/alpha": True}, links={"skills/alpha/creds": str(secret)})
        result = self.install("--path", "skills/alpha")
        self.assertCleanFailure(result, "Skill links outside itself")
        self.assertEqual(self.installed(), [])

    def test_copy_failure_rolls_back_every_skill(self):
        # beta passes validation, but its dangling symlink fails copytree after alpha landed.
        self.make_repo({"skills/alpha": True, "skills/beta": True}, links={"skills/beta/gone": "does-not-exist"})
        result = self.install("--path", "skills/alpha", "skills/beta")
        self.assertCleanFailure(result, "Copy failed")
        self.assertEqual(self.installed(), [])


if __name__ == "__main__":
    unittest.main()
