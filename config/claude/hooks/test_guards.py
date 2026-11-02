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

    def test_redirecting_core_hooks_path_is_a_bypass(self):
        self.assert_decisions("deny", [
            "git -c core.hooksPath=/dev/null commit -m x",
            "git -c core.hooksPath=/dev/null push",
            "git -C repo -c user.name=x -c core.hooksPath=/dev/null commit -m x",
            "git -c CORE.HOOKSPATH=/dev/null commit -m x",
            "git -c core.hooksPath commit -m x",
            "git -c core.hooksPath=/dev/null merge topic",
            "git --config-env=core.hooksPath=HOOKS commit -m x",
            "git --config-env core.hooksPath=HOOKS commit -m x",
            "GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\" git commit -m x",
            "GIT_CONFIG_PARAMETERS=\"'user.name=x' 'core.hooksPath'='/dev/null'\" git commit -m x",
            "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x",
            "env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git push",
            "sudo env FOO=1 GIT_CONFIG_KEY_3=core.hooksPath git commit -m x",
            "git add . && git -c core.hooksPath=/dev/null commit -m x",
            "bash -c 'git -c core.hooksPath=/dev/null commit -m x'",
        ])

    def test_writing_or_unsetting_core_hooks_path_in_git_config_is_a_bypass(self):
        self.assert_decisions("deny", [
            "git config core.hooksPath /dev/null",
            "git config --global core.hooksPath /dev/null",
            "git config --local --add core.hooksPath x",
            "git config --replace-all core.hooksPath x",
            "git config --global --unset core.hooksPath",
            "git config --unset-all core.hooksPath",
            "git config --unset core.hooksPath 'regex'",
            "git config CORE.HOOKSPATH /dev/null",
            "git -C repo config core.hooksPath /dev/null",
            "git config --unset-a core.hooksPath",
            "git config --repl core.hooksPath x",
            "git config --file=.git/config core.hooksPath x",
            "git config -f .git/config core.hooksPath x",
            "git config --type=path core.hooksPath ~/hooks",
            "git config set core.hooksPath x",
            "git config unset --global core.hooksPath",
            "git config --remove-section core",
            "git config --rename-section core other",
            "git config --rename-section evil core",
            "git config --rename-section evil CORE",
            "git config remove-section core",
            "git config remove-section --global core",
            "git config rename-section core other",
            "git config rename-section evil core",
            "git config unset --value x core.hooksPath",
            "git config set --value x core.hooksPath y",
            "git config set -- core.hooksPath x",
            "git config -t path core.hooksPath ~/hooks",
            "git config --type path core.hooksPath ~/hooks",
            "git config --global --unset core.hooksPath && git commit -m x",
            "bash -c 'git config --global --unset core.hooksPath'",
        ])

    def test_reading_core_hooks_path_or_configuring_other_keys_is_not_a_bypass(self):
        self.assert_decisions("allow", [
            "git config core.hooksPath",
            "git config --get core.hooksPath",
            "git config --global --get core.hooksPath",
            "git config --get-all core.hooksPath",
            "git config --get core.hooksPath '^x'",
            "git config --show-origin --get core.hooksPath",
            "git config --type=path core.hooksPath",
            "git config --default x --get core.hooksPath",
            "git config --get-regexp hooks",
            "git config get core.hooksPath",
            "git config get --value x core.hooksPath",
            "git config -t path core.hooksPath",
            "git config -t path --get core.hooksPath",
            "git config list",
            "git config --list",
            "git config -l",
            "git config user.name x",
            "git config --global core.editor vim",
            "git config --unset user.name",
            "git config --remove-section user",
            "git config --rename-section user other",
            "git config --rename-section other user",
            "git config remove-section user",
            "git config rename-section other user",
            "echo 'git config core.hooksPath /dev/null' | grep config",
            'lit comment add k "git config --global --unset core.hooksPath"',
        ])

    def test_the_environment_of_a_shell_reaches_the_commands_it_runs(self):
        self.assert_decisions("deny", [
            "GIT_CONFIG_KEY_0=core.hooksPath bash -c 'git commit -m x'",
            "GIT_CONFIG_KEY_0=core.hooksPath eval 'git commit -m x'",
            "GIT_CONFIG_KEY_0=core.hooksPath sh <<'EOF'\ngit commit -m x\nEOF",
            "env GIT_CONFIG_KEY_0=core.hooksPath sh -c 'git push'",
        ])

    def test_other_config_overrides_and_environment_are_not_a_bypass(self):
        self.assert_decisions("allow", [
            "git -c user.name=x commit -m y",
            "git -c user.name=x -c core.editor=true commit -m y",
            "git --config-env=user.name=NAME commit -m y",
            "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=x git commit -m y",
            "GIT_CONFIG_PARAMETERS=\"'user.name=x'\" git commit -m y",
            "FOO=core.hooksPath git commit -m y",
            "git commit -m y core.hooksPath",
            "GIT_CONFIG_KEY_0=core.hooksPath true && git commit -m y",
            "git config core.hooksPath",
            'lit comment add k "denied: git -c core.hooksPath=/dev/null commit -m x"',
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

    def test_publishing_a_session_url_through_gh_comments_and_reviews_is_denied(self):
        self.assert_decisions("deny", [
            f"gh pr comment 3 --body {SESSION_URL}",
            f"gh issue comment 3 --body {SESSION_URL}",
            f"gh pr review 3 --comment --body {SESSION_URL}",
            f"gh pr review 3 --request-changes -b {SESSION_URL}",
            f"gh pr merge 3 --squash --body {SESSION_URL}",
            f"gh issue close 3 --comment {SESSION_URL}",
            f"gh pr reopen 3 -c {SESSION_URL}",
            f"gh -R o/r pr comment 3 -b '{SESSION_URL}'",
        ])

    def test_publishing_a_session_url_as_a_description_or_workflow_input_is_denied(self):
        self.assert_decisions("deny", [
            f"gh repo edit --description {SESSION_URL}",
            f"gh repo create o/r -d {SESSION_URL}",
            f"gh label create bug --description {SESSION_URL}",
            f"gh label edit bug --description {SESSION_URL}",
            f"gh workflow run ci.yml -f note={SESSION_URL}",
        ])

    def test_a_gh_api_call_that_writes_is_a_publication(self):
        self.assert_decisions("deny", [
            f"gh api repos/o/r/issues -f body={SESSION_URL}",
            f"gh api repos/o/r/issues -fbody={SESSION_URL}",
            f"gh api repos/o/r/issues --raw-field body={SESSION_URL}",
            f"gh api repos/o/r/issues -F body={SESSION_URL}",
            f"gh api repos/o/r/issues --field=body={SESSION_URL}",
            f"gh api repos/o/r/issues/3/comments -f body='{SESSION_URL}'",
            f"gh api repos/o/r/issues -X POST -f body={SESSION_URL}",
            f"gh api repos/o/r/issues/3 -XPATCH -f body={SESSION_URL}",
            f"gh api --method=PUT repos/o/r/contents/f -f content={SESSION_URL}",
            f"gh api -X post repos/o/r/issues -f body={SESSION_URL}",
            f"gh api repos/o/r/issues --input - <<'EOF'\n{{\"body\": \"{SESSION_URL}\"}}\nEOF",
            f"gh api -X GET repos/o/r/issues -f q=1 && gh api repos/o/r/issues -f body={SESSION_URL}",
            f"gh -R o/r api repos/o/r/issues -f body={SESSION_URL}",
            f"gh api -H 'Accept: x' -X DELETE repos/o/r/issues/comments/1 -f note={SESSION_URL}",
            f"gh api repos/o/r/issues?q={SESSION_URL} -X",  # a method flag with no value is not a read
            f"gh api repos/o/r/issues?q={SESSION_URL} --method=",
        ])

    def test_reading_and_auditing_session_urls_is_allowed(self):
        self.assert_decisions("allow", [
            f'grep -rn "{SESSION_URL}" .',
            f"git log --grep {SESSION_URL}",
            f'gh pr view 3 --json body | grep "{SESSION_URL}"',
            f"gh pr view 3 --comments | grep {SESSION_URL}",
            f"gh api repos/o/r/issues | grep {SESSION_URL}",
            f"gh api repos/o/r/issues?q={SESSION_URL}",
            f"gh api -X GET search/issues -f q={SESSION_URL}",
            f"gh api --method get search/issues -f q={SESSION_URL}",
            f"gh api -XGET search/code -F q={SESSION_URL}",
            f"gh api --method=HEAD repos/o/r/issues -f q={SESSION_URL}",
            f"gh api -X POST repos/o/r/issues -f body=x -X GET -f q={SESSION_URL}",
            f"gh api repos/o/r/issues -H 'X-Note: {SESSION_URL}'",
            f"gh pr list --search {SESSION_URL}",
            f"gh repo view o/r --json description | grep {SESSION_URL}",
            f"gh label list --search {SESSION_URL}",
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
