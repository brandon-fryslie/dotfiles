"""The PreToolUse guards' contract: each hook is fed a hook payload on stdin, exactly as
Claude Code feeds it, and must allow or deny.

Run: just test-hooks
"""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
# Assembled, never written whole: the git pre-commit hook refuses a file carrying the literal.
SESSION_URL = "https://claude" + ".ai/code/session_01ABCDEF"


def run_hook(name, payload):
    return subprocess.run([str(HOOKS / name)], input=json.dumps(payload), capture_output=True, text=True)


def bash(command):
    return {"tool_name": "Bash", "tool_input": {"command": command}}


class TmuxServerGuard(unittest.TestCase):
    VERB = "kill-" + "server"  # assembled: the file check reads this file too

    def decide(self, command):
        result = run_hook("guard-tmux-server.sh", {"hook_event_name": "PreToolUse", **bash(command)})
        self.assertEqual(result.returncode, 0, result.stderr)
        return "deny" if result.stdout.strip() else "allow"

    def test_running_it_is_denied(self):
        for command in ("tmux {}", "tmux {} ; ls", "cd /tmp && tmux {}", "bash -c 'tmux {}'",
                        "timeout 5 tmux {}", "tmux kill-ser", "tmux -f conf {}", "tmux ls \\; {}"):
            with self.subTest(command=command):
                self.assertEqual(self.decide(command.format(self.VERB)), "deny")

    def test_mentioning_it_or_another_server_is_allowed(self):
        for command in ("grep {} file", "git commit -m 'tmux {}'", "echo tmux {}",
                        "tmux -L test {}", "tmux -S /tmp/sock {}", "tmux kill-session -t a"):
            with self.subTest(command=command):
                self.assertEqual(self.decide(command.format(self.VERB)), "allow")

    def test_a_file_that_runs_it_is_flagged(self):
        with tempfile.TemporaryDirectory() as directory:
            script, notes = Path(directory, "t.sh"), Path(directory, "n.md")
            script.write_text(f"tmux {self.VERB}\n")
            notes.write_text(f"the {self.VERB} verb\n")
            flagged = [
                run_hook("guard-tmux-server.sh", {"hook_event_name": "PostToolUse",
                                                  "tool_input": {"file_path": str(path)}}).stdout != ""
                for path in (script, notes)]
        self.assertEqual(flagged, [True, False])


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

    def test_option_values_and_operands_are_read_as_git_reads_them(self):
        self.assert_decisions("deny", ["git commit --message=x -n"])
        self.assert_decisions("allow", ["git commit -m x -- -n"])

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
            'x="$(git commit -n -m y)"',
            'echo "`git commit -n -m y`"',
            'echo "$(git commit --no-verify -m y)"',
            "cat <<'EOF' | bash\ngit commit --no-verify -m x\nEOF",
            "echo 'git commit -n -m x' | sh",
            "printf '%s\\n' 'git add .' 'git commit -n -m x' |\n  tee log | bash",
            "bash <<< 'git commit -n -m x'",
            "GIT commit -n -m x",
            "Git push --no-verify",
            "git --config-env core.x=HOME commit -n -m x",
            "eval 'git commit -n -m x'",
            "function f { git commit -n -m x; }; f",
            "coproc git commit -n -m x",
            "(( x <<= 1 ))\ngit commit -n -m x",
            "let 'x<<=1'; (( y << 2 ))\ngit commit -n -m x",
            "echo 'git commit -n -m x' | source /dev/stdin",
            ". /dev/stdin <<< 'git commit -n -m x'",
            "find . -maxdepth 0 -exec git commit -n -m x \\;",
        ])

    def test_a_pipe_into_a_non_shell_is_data_and_or_is_not_a_pipe(self):
        self.assert_decisions("allow", [
            "echo 'git commit -n -m x' | grep commit",
            "echo 'git commit -n -m x' || bash -c 'true'",
            'lit new --description "sed -n 1p f && git commit -m x"',
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
            f'x="$(git commit -m {SESSION_URL})"',
            f'GH pr create --body "{SESSION_URL}"',
            f"gh -R o/r pr create --body '{SESSION_URL}'",
        ])

    def test_reading_and_auditing_session_urls_is_allowed(self):
        self.assert_decisions("allow", [
            f'grep -rn "{SESSION_URL}" .',
            f"git log --grep {SESSION_URL}",
            f'gh pr view 3 --json body | grep "{SESSION_URL}"',
        ])


class SessionUrlPattern(unittest.TestCase):
    """The shared definition of a session URL, tested where both consumers read it:
    the git hooks and guard-session-url.sh grep the same file, so the contract belongs
    to the pattern rather than to either caller.

    A session id's first path segment after /code/ carries a digit or an underscore;
    a product route is a plain word. The discriminator fails closed -- an unfamiliar
    id shape is still refused."""

    PATTERN = (Path(__file__).resolve().parents[2] / "git" / "hooks" / "claude-session-url.pattern").read_text().strip()
    # Assembled, never written whole, for the same reason as SESSION_URL above.
    HOST = "https://claude" + ".ai/code"

    def matches(self, url):
        return subprocess.run(["grep", "-qiE", "-e", self.PATTERN], input=url, text=True).returncode == 0

    def test_session_links_are_refused(self):
        for suffix in ("/session_01ABCDEF", "/186b92c4-e723-4b0b-800b-3d3567406237",
                       "/SESSION_01ABCDEF", "/session_01ABCDEF?tab=files", "/session_01ABCDEF#top"):
            for prefix in (self.HOST, self.HOST.replace("https", "http"), self.HOST.replace("https://", "")):
                with self.subTest(url=prefix + suffix):
                    self.assertTrue(self.matches(prefix + suffix))

    def test_product_routes_are_allowed(self):
        """Claude Code's own source ships these in user-facing strings, so a repo
        vendoring that source must remain committable."""
        for suffix in ("", "/", "/scheduled", "/scheduled/{TRIGGER_ID}", "/routines",
                       "/onboarding?magic=github-app-setup", "/onboarding?magic=env-setup",
                       "/artifact", "/artifacts"):
            with self.subTest(url=self.HOST + suffix):
                self.assertFalse(self.matches(self.HOST + suffix))


if __name__ == "__main__":
    unittest.main()
