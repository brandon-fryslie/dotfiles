"""What the tmux-resurrect save strategy prints for a pane: nothing for a pane at its shell's
prompt, a program's exact command line, and a Claude session run by the program - directly or
through a wrapper that passes its command line on - as that command line resuming the
session. The output is one line a shell reads back into the same words.

Run: just test-tmux-resurrect
"""

import importlib.util
import os
import subprocess
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "config/tmux/scripts/tmux-resurrect-command.py"
spec = importlib.util.spec_from_file_location("resurrect_command", SCRIPT)
strategy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(strategy)
Process = strategy.Process


def resume(argv, session):
    return [*argv, "--resume", session]


class Restored(unittest.TestCase):
    def test_a_claude_session_is_resumed(self):
        claude = Process("/c", ["/bin/claude", "--model", "opus"], {})
        self.assertEqual(strategy.restored(claude, [("S", claude.argv)], resume),
                         ["/bin/claude", "--model", "opus", "--resume", "S"])

    def test_a_wrapper_keeps_its_own_words_and_resumes_the_session_it_runs(self):
        wrapper = Process("/f", ["fritter", "--tap", "x", "--", "/bin/claude", "--model", "opus"], {})
        self.assertEqual(strategy.restored(wrapper, [("S", ["/bin/claude", "--model", "opus"])], resume),
                         ["fritter", "--tap", "x", "--", "/bin/claude", "--model", "opus", "--resume", "S"])

    def test_sessions_a_program_spawns_with_other_words_leave_it_as_launched(self):
        remote = Process("/c", ["/bin/claude", "remote-control", "--name", "rc"], {})
        self.assertEqual(strategy.restored(remote, [("S", ["/bin/claude", "--print", "--sdk-url", "u"])], resume),
                         remote.argv)


class AtPrompt(unittest.TestCase):
    def test_the_default_shell_given_only_options_is_at_its_prompt(self):
        for argv in (["-zsh"], ["/bin/zsh", "-l"]):
            self.assertTrue(strategy.at_prompt(Process("/bin/zsh", argv, {}), "/bin/zsh", "/bin/zsh"), argv)

    def test_a_shell_running_a_command_or_another_shell_is_a_program(self):
        self.assertFalse(strategy.at_prompt(Process("/bin/zsh", ["/bin/zsh", "-c", "make"], {}), "/bin/zsh", "/bin/zsh"))
        self.assertFalse(strategy.at_prompt(Process("/bin/bash", ["bash"], {}), "/bin/bash", "/bin/zsh"))


class ShellWord(unittest.TestCase):
    def test_words_come_back_from_one_line(self):
        words = ["plain", "two words", "it's", '{"a": 1}', "line\nbreak", "tab\there", "back\\slash", "\x1b[0m"]
        line = " ".join(map(strategy.shell_word, words))
        self.assertNotIn("\n", line)
        self.assertNotIn("\t", line)
        for shell in ("/bin/zsh", "/bin/bash"):
            out = subprocess.run([shell, "-c", f"printf '%s\\0' {line}"], check=True, capture_output=True).stdout
            self.assertEqual(out.decode().split("\0")[:-1], words, shell)


class AgainstTmux(unittest.TestCase):
    """The strategy run as resurrect runs it, for panes of a private tmux server."""

    def setUp(self):
        self.server = f"resurrect-command-test-{os.getpid()}"
        self.tmux("-f", "/dev/null", "new-session", "-d", "-s", "t")
        # Cleanups run last-first: the server exits with its only session, then its socket file goes.
        self.addCleanup(Path(self.tmux("display", "-p", "#{socket_path}").strip()).unlink, missing_ok=True)
        self.addCleanup(self.tmux, "kill-session", "-t", "t")
        self.tmux("set", "-g", "default-shell", "/bin/zsh")
        self.tmux("new-window", "-t", "t:", "/bin/zsh", "-f")  # an idle shell
        self.tmux("new-window", "-t", "t:", "sleep 300; :")  # a program: the shell running a command

    def tmux(self, *args):
        return subprocess.run(["tmux", "-L", self.server, *args], check=True, capture_output=True, text=True).stdout

    def saved(self, window):
        pid = self.tmux("display", "-p", "-t", f"t:{window}", "#{pane_pid}").strip()
        env = {**os.environ, "TMUX": self.tmux("display", "-p", "#{socket_path},0,0").strip()}
        return subprocess.run([str(SCRIPT), pid], check=True, capture_output=True, text=True, env=env).stdout

    def test_each_pane_records_what_it_shows(self):
        time.sleep(0.5)  # [LAW:no-ambient-temporal-coupling] exception: tmux gives no signal that a new pane's program has exec'd
        self.assertEqual(self.saved(1), "\n")
        self.assertEqual(self.saved(2), "zsh -c 'sleep 300; :'\n")


if __name__ == "__main__":
    unittest.main()
