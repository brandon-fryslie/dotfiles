"""How a Claude process's launch is read and turned back into the command that resumes its
session: its settings kept with the words they took, the options that chose a conversation or
acted once at launch and the prompt dropped, `--resume <id>` added, and a launch the grammar
cannot read refused.

Run: just test-claude-lib
"""

import shutil
import subprocess
import sys
import unittest

from claude_process import (KINDS, Arity, Launch, Option, Process, Unreadable, Unresumable, claude_options, config_dir,
                            in_config_dir, launch,
                            options, resumed, shell_line, started_with)

# Option lines in the shape `claude --help` prints them, continuation lines included.
HELP = """Usage: claude [options] [command] [prompt]

Options:
  --add-dir <directories...>            Additional directories to allow tool
                                        access to
  -c, --continue                        Continue the most recent conversation in
  --dangerously-skip-permissions        Bypass all permission checks.
  -d, --debug [filter]                  Enable debug mode with optional category
                                        --resume <id> to pick the session)
  --model <model>                       Model for the current session. Provide
  -r, --resume [value]                  Resume a conversation by session ID
  --session-id <uuid>                   Use a specific session ID
  --settings <file-or-json>             Path to a settings JSON file
  --tmux                                Create a tmux session for the worktree
  -w, --worktree [name]                 Create a new git worktree for this session

Commands:
  agents [options]                      Manage background agents
"""
TABLE = options(HELP)


class Options(unittest.TestCase):
    def test_each_spelling_names_its_long_option_and_arity(self):
        self.assertEqual(TABLE["-r"], Option("--resume", Arity.OPTIONAL))
        self.assertEqual(TABLE["--add-dir"], Option("--add-dir", Arity.VARIADIC))
        self.assertEqual(TABLE["-c"], Option("--continue", Arity.NONE))
        self.assertEqual(TABLE["--model"], Option("--model", Arity.REQUIRED))

    def test_only_option_lines_are_read(self):
        self.assertNotIn("agents", TABLE)
        self.assertEqual(len(TABLE), 14)


class Resumed(unittest.TestCase):
    def resume(self, *words):
        return resumed(Launch(["claude"], list(words)), "S", TABLE)

    def test_launch_options_are_kept(self):
        self.assertEqual(self.resume("--dangerously-skip-permissions", "--settings", '{"a": 1}'),
                         ["claude", "--dangerously-skip-permissions", "--settings", '{"a": 1}', "--resume", "S"])

    def test_options_choosing_a_conversation_give_way(self):
        self.assertEqual(self.resume("--continue", "--session-id=z", "-r", "old", "--model", "opus"),
                         ["claude", "--model", "opus", "--resume", "S"])

    def test_an_optional_value_is_not_taken_from_the_next_option(self):
        self.assertEqual(self.resume("-r", "--model", "opus"), ["claude", "--model", "opus", "--resume", "S"])

    def test_the_prompt_is_not_sent_again(self):
        self.assertEqual(self.resume("--model", "opus", "fix the bug"), ["claude", "--model", "opus", "--resume", "S"])

    def test_a_variadic_option_keeps_every_value(self):
        self.assertEqual(self.resume("--add-dir", "a", "b", "-d"), ["claude", "--add-dir", "a", "b", "-d", "--resume", "S"])

    def test_what_was_done_once_at_launch_is_not_done_again(self):
        self.assertEqual(self.resume("-w", "feat", "--tmux", "--model", "opus"), ["claude", "--model", "opus", "--resume", "S"])

    def test_words_after_a_double_dash_are_the_prompt(self):
        self.assertEqual(self.resume("--model", "opus", "--", "-fix the bug"), ["claude", "--model", "opus", "--resume", "S"])

    def test_a_launch_the_grammar_cannot_read_is_refused(self):
        for argv in (["--sdk-url", "u"], ["--model"]):
            with self.assertRaises(Unresumable, msg=argv):
                self.resume(*argv)

    def test_an_option_of_no_known_kind_is_refused_not_kept(self):
        table = options("  --brand-new                     An option KINDS has not met\n")
        with self.assertRaisesRegex(Unresumable, "--brand-new"):
            resumed(Launch(["claude"], ["--brand-new"]), "S", table)

    def test_a_script_run_by_node_keeps_its_script(self):
        started = launch(Process("/opt/homebrew/bin/node", ["node", "/opt/x/cli.js", "--model", "opus", "hi"], {}))
        self.assertEqual(resumed(started, "S", TABLE), ["node", "/opt/x/cli.js", "--model", "opus", "--resume", "S"])

    def test_an_interpreter_given_its_own_options_first_is_refused(self):
        with self.assertRaises(Unresumable):
            launch(Process("/opt/homebrew/bin/node", ["node", "--max-old-space-size", "8192", "/opt/x/cli.js"], {}))

    def test_claude_as_its_own_executable_is_its_first_word(self):
        started = launch(Process("/v/2.1.299", ["claude", "--model", "opus"], {}))
        self.assertEqual(started, Launch(["claude"], ["--model", "opus"]))


class ConfigDir(unittest.TestCase):
    def test_a_session_outside_the_default_config_dir_is_resumed_naming_it(self):
        process = Process("/v", ["claude"], {"CLAUDE_CONFIG_DIR": "/alt", "HOME": "/h"})
        self.assertEqual(in_config_dir(["claude", "--resume", "S"], config_dir(process)),
                         ["env", "CLAUDE_CONFIG_DIR=/alt", "claude", "--resume", "S"])
        self.assertEqual(in_config_dir(["claude"], config_dir(Process("/v", ["claude"], {}))), ["claude"])


class Kinds(unittest.TestCase):
    def test_every_option_the_installed_claude_lists_has_a_kind(self):
        """Fails when a Claude update adds an option, which then needs a kind before a launch using it resumes."""
        if shutil.which("claude") is None:
            self.skipTest("no claude on PATH")
        self.assertEqual({option.name for option in claude_options().values()} - KINDS.keys(), set())


class ShellLine(unittest.TestCase):
    def test_words_come_back_from_one_line(self):
        words = ["plain", "two words", "it's", '{"a": 1}', "line\nbreak", "tab\there", "back\\slash", "\x1b[0m", "it's\nboth\\"]
        line = shell_line(words)
        self.assertNotIn("\n", line)
        self.assertNotIn("\t", line)
        for shell in ("/bin/zsh", "/bin/bash", "/bin/sh"):
            out = subprocess.run([shell, "-c", f"printf '%s\\0' {line}"], check=True, capture_output=True).stdout
            self.assertEqual(out.decode().split("\0")[:-1], words, shell)


class StartedWith(unittest.TestCase):
    def test_reads_the_exec_path_and_exact_argv(self):
        args = ["-c", "import time; time.sleep(30)", "two words", '{"k": 1}', "line\nbreak"]
        child = subprocess.Popen([sys.executable, *args], env={"MARK": "a=b"})
        try:
            process = started_with(child.pid)
        finally:
            child.kill()
            child.wait()
        self.assertEqual(process.argv[1:], args)
        self.assertEqual(process.path, sys.executable)
        self.assertEqual(process.environment["MARK"], "a=b")

    def test_a_process_that_is_gone_is_unreadable(self):
        child = subprocess.Popen(["true"])
        child.wait()
        with self.assertRaises(Unreadable):
            started_with(child.pid)


if __name__ == "__main__":
    unittest.main()
