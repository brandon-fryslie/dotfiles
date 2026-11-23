"""How a Claude process's launch is read and turned back into the command that resumes its
session: every option kept with the words it took, the ones choosing a conversation and the
prompt dropped, and `--resume <id>` added.

Run: just test-claude-lib
"""

import subprocess
import sys
import unittest

from claude_process import Arity, Option, options, resumed, started_with

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
        self.assertEqual(len(TABLE), 11)


class Resumed(unittest.TestCase):
    def resume(self, *argv):
        return resumed(["claude", *argv], "S", TABLE)

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


if __name__ == "__main__":
    unittest.main()
