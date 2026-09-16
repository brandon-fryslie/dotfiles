"""The PreToolUse guards' contract: each hook is fed a hook payload on stdin, exactly as
Claude Code feeds it, and must allow or deny.

Run: just test-hooks
"""

import json
import subprocess
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
# Assembled, never written whole: the git pre-commit hook refuses a file carrying the literal.
SESSION_URL = "https://claude" + ".ai/code/session_01ABCDEF"


def run_hook(name, payload):
    return subprocess.run([str(HOOKS / name)], input=json.dumps(payload), capture_output=True, text=True)


def bash(command):
    return {"tool_name": "Bash", "tool_input": {"command": command}}


class SessionUrlGuard(unittest.TestCase):
    """guard-session-url.sh denies by printing a deny decision and exiting 0."""

    def decide(self, command):
        result = run_hook("guard-session-url.sh", bash(command))
        self.assertEqual(result.returncode, 0, result.stderr)
        if not result.stdout.strip():
            return "allow"
        return json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"]

    def assert_decisions(self, expected, commands):
        for command in commands:
            with self.subTest(command=command):
                self.assertEqual(self.decide(command), expected)

    def test_flags_of_other_commands_are_not_a_bypass(self):
        self.assert_decisions("allow", [
            "sed -n 1p README.md && git commit -m x",
            "grep -n foo file && git commit -m x",
            "head -n 5 file; git commit -m x",
            "git log -n1 && git commit -m x",
            "sed -i '' 's/a/b/' f && sed -n 82,85p f && npx vitest run && git add f && git commit -q -m \"fix: thing\"",
        ])

    def test_text_that_only_describes_a_bypass_is_not_a_bypass(self):
        self.assert_decisions("allow", [
            'lit new --description "REPRO: sed -n 1p README.md && git commit -m x"',
            'lit comment add k21 "denied: git commit -n -m x && git commit --no-verify"',
            "git commit -F - <<'EOF'\nfix: don't read sed -n as a bypass\n\ngit commit -n is still denied\nEOF",
            "cat > notes.md <<EOF\ngit commit --no-verify\nEOF",
            "echo 'git commit -n' # git commit --no-verify",
        ])

    def test_option_values_are_not_flags(self):
        self.assert_decisions("allow", [
            "git commit -mnew-feature",
            "git commit -uno -m x",
            'git commit -m "-n is the dry-run flag on push"',
            "git commit --message --no-verify-docs",
            "git commit -Snightly -m x",
        ])

    def test_real_bypasses_stay_denied(self):
        self.assert_decisions("deny", [
            "git commit -n",
            "git commit -n -m x",
            "git commit -qn -m x",
            "git commit -nm x",
            "git commit -m x -n",
            "git commit --no-verify -m x",
            "git commit --no-veri -m x",
            "git -C repo commit -n -m x",
            "FOO=1 git commit -n -m x",
            "/usr/bin/git commit -n -m x",
        ])

    def test_real_bypasses_inside_compound_commands_stay_denied(self):
        self.assert_decisions("deny", [
            "git add . && git commit -n -m x",
            "sed -n 1p f && git commit -qn -m x",
            "true; git commit --no-verify -m x",
            "git status\ngit commit -n -m x",
            "if true; then git commit -n -m x; fi",
            "(cd sub && git commit -n -m x)",
            "echo $(git commit -n -m x)",
            "bash -c 'git commit -n -m x'",
            "bash -euo pipefail -c 'git add . && git commit -n -m x'",
            "bash <<'EOF'\ngit commit -n -m x\nEOF",
            "git commit -n -F - <<'EOF'\ndon't let the apostrophe hide the flag\nEOF",
            "git commit -F - <<'EOF' && git commit -n -m y\nmessage\nEOF",
            'echo "$(git commit -n -m x)"',
            'echo "`git commit --no-verify -m x`"',
            "echo `git commit -n -m x`",
            "cat <<EOF\n$(git commit -n -m x)\nEOF",
            "echo $'it\\'s'; git commit -n -m x",
            "echo ${x:-(}; git commit -n -m x",
            "env git commit -n -m x",
            "command git commit -n -m x",
            "nohup git commit -n -m x",
            "timeout 60 git commit -n -m x",
            "nice -n 10 git commit --no-verify -m x",
            "sudo -u me env FOO=1 git commit -n -m x",
            "xargs git commit -n < /dev/null",
        ])

    def test_text_in_a_quoted_heredoc_body_does_not_run(self):
        self.assert_decisions("allow", [
            "cat <<'EOF'\n$(git commit -n -m x)\nEOF",
            'cat <<"EOF"\n`git commit --no-verify`\nEOF',
            "git commit -F - <<'EOF'\nrecord that $(git commit -n) is denied\nEOF",
        ])

    def test_push_dry_run_is_not_a_bypass_and_push_no_verify_is(self):
        self.assert_decisions("allow", ["git push -n origin master", "git push --dry-run", "git push origin HEAD"])
        self.assert_decisions("deny", [
            "git push --no-verify",
            "git push --no-verify origin HEAD",
            "git commit -m x && git push --no-verify",
        ])

    def test_publishing_a_session_url_is_denied(self):
        self.assert_decisions("deny", [
            f'git commit -m "see {SESSION_URL}"',
            f"git tag -a v1 -m {SESSION_URL}",
            f"git commit -F - <<'EOF'\nfix\n\n{SESSION_URL}\nEOF",
            f'gh pr create --title t --body "{SESSION_URL}"',
            f'gh issue edit 3 --body "$(cat <<EOF\n{SESSION_URL}\nEOF\n)"',
        ])

    def test_reading_and_auditing_session_urls_is_allowed(self):
        self.assert_decisions("allow", [
            f'grep -rn "{SESSION_URL}" .',
            f"git log --grep {SESSION_URL}",
            f'gh pr view 3 --json body | grep "{SESSION_URL}"',
        ])


class GeneratedWorkflowGuard(unittest.TestCase):
    """guard-generated-workflow.sh denies by exiting 2."""

    def assert_decisions(self, expected, commands):
        for command in commands:
            with self.subTest(command=command):
                result = run_hook("guard-generated-workflow.sh", bash(command))
                self.assertEqual("deny" if result.returncode == 2 else "allow", expected, result.stderr)
                self.assertIn(result.returncode, (0, 2), result.stderr)

    def test_stash_limited_to_paths_that_cannot_reach_the_workflow_is_allowed(self):
        self.assert_decisions("allow", [
            "git stash -- test/seam/workflow-pins.ts",
            "git stash push -- src/foo.ts",
            "git stash push src/foo.ts src/bar.ts",
            'git stash push -m "wip: .github" -- src/foo.ts',
            "git stash push -k -u -- src/a.ts",
            "git stash -u -- src/foo.ts",
            "git stash push -- .github/workflows/other.yml",
            "git stash push -- src/workflows",
            "git stash push -- '*.ts'",
            "git stash push -- src/foo.ts 2>&1",
        ])

    def test_read_and_restore_stash_subcommands_are_allowed(self):
        self.assert_decisions("allow", [
            "git stash list", "git stash show -p", "git stash pop", "git stash apply stash@{0}",
            "git stash drop stash@{0}",
        ])

    def test_stash_of_the_whole_tree_is_denied(self):
        self.assert_decisions("deny", [
            "git stash",
            "git stash push",
            "git stash save",
            "git stash save -- src/foo.ts",
            "git stash -k",
            'git stash push -m "wip"',
            "git stash push --pathspec-from-file=paths.txt",
            "git stash push --pathspec-from-file paths.txt",
            "git add . && git stash",
        ])

    def test_stash_whose_pathspec_can_reach_the_workflow_is_denied(self):
        self.assert_decisions("deny", [
            "git stash push -- .",
            "git stash push -- ./",
            "git stash push -- '*'",
            "git stash push -- .github",
            "git stash push -- .github/",
            "git stash push -- .github/workflows",
            "git stash push -- ./.github/workflows/code-review.yml",
            "git stash push -- .GitHub/Workflows",
            "git stash push -- code-review.yml",
            "git stash push -- workflows",
            "git stash -- src/foo.ts .github",
            "git stash push -- '.git*'",
            "git stash push -- '*.yml'",
            "git stash push -- :/",
            "git stash push -- ':(exclude)src'",
            "git stash push -- ../.github",
            "git stash push -- /repo/.github",
            'git stash push -- "$FILE"',
            "cd .github && git stash push -- workflows",
            "git -C .github stash push -- workflows",
            "git stash push -- $(cat paths.txt)",
            'echo "$(git stash)"',
            "cat <<EOF\n$(git stash)\nEOF",
            "env git stash",
        ])

    def test_other_destructive_verbs_are_unchanged(self):
        self.assert_decisions("deny", [
            "git checkout -- .github/workflows/code-review.yml",
            "git checkout .",
            "git restore .",
            "git clean -fd",
            "git reset --hard",
        ])
        self.assert_decisions("allow", [
            "git checkout main",
            "git add .github/workflows/code-review.yml && git commit -m x",
            'git commit -m "never git stash here"',
        ])

    def test_hand_editing_the_workflow_is_denied(self):
        result = run_hook("guard-generated-workflow.sh", {
            "tool_name": "Edit", "tool_input": {"file_path": "/repo/.github/workflows/code-review.yml"}})
        self.assertEqual(result.returncode, 2, result.stderr)


if __name__ == "__main__":
    unittest.main()
