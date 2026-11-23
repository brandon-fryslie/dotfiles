"""What the tmux-resurrect save strategy prints for each pane of a save: nothing for a pane at its
shell's prompt, a program's exact command line, and a Claude session the program runs - directly
or through a wrapper that passes its command line on - as that command line resuming the
session. Each line is one a shell reads back into the same words. A Claude session the pane's
runs outside what its pane shows is reported, and a strategy that cannot read what it needs fails.

Run: just test-tmux-resurrect
"""

import importlib.util
import json
import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "config/tmux/scripts/tmux-resurrect-command.py"
spec = importlib.util.spec_from_file_location("resurrect_command", SCRIPT)
strategy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(strategy)
Process, Session, Record = strategy.Process, strategy.Session, strategy.Record
from claude_process import options  # noqa: E402  the strategy put its library on sys.path

# The options the fake `claude` below lists, in the shape `claude --help` prints them.
HELP = """Options:
  -c, --continue                 Continue the most recent conversation
  --model <model>                Model for the current session
  -w, --worktree [name]          Create a new git worktree for this session
"""
GRAMMAR = options(HELP)


def record(program, sessions=()):
    return strategy.recorded(program, program.path, "/bin/zsh", list(sessions), GRAMMAR)


class Recorded(unittest.TestCase):
    def test_a_claude_session_is_resumed_with_its_settings(self):
        session = Session("S", 1, ["claude", "-w", "feat", "--model", "opus", "fix the bug"])
        self.assertEqual(record(Process("/c", session.argv, {}), [session]),
                         Record(["claude", "--model", "opus", "--resume", "S"], session))

    def test_a_wrapper_keeps_its_own_words_and_resumes_the_session_it_runs(self):
        session = Session("S", 1, ["claude", "--model", "opus"])
        wrapper = Process("/f", ["fritter", "--tap", "x", "--", "claude", "--model", "opus"], {})
        self.assertEqual(record(wrapper, [session]).argv,
                         ["fritter", "--tap", "x", "--", "claude", "--model", "opus", "--resume", "S"])

    def test_sessions_a_program_spawns_with_other_words_leave_it_as_launched(self):
        remote = Process("/c", ["claude", "remote-control", "--name", "rc"], {})
        self.assertEqual(record(remote, [Session("S", 1, ["claude", "--print", "--sdk-url", "u"])]), Record(remote.argv, None))

    def test_the_default_shell_given_only_options_is_at_its_prompt(self):
        for argv in (["-zsh"], ["/bin/zsh", "-l"]):
            self.assertEqual(record(Process("/bin/zsh", argv, {}), [Session("S", 1, ["claude"])]), Record([], None), argv)

    def test_a_shell_running_a_command_or_another_shell_is_a_program(self):
        for program in (Process("/bin/zsh", ["/bin/zsh", "-c", "make"], {}), Process("/bin/bash", ["bash"], {})):
            self.assertEqual(record(program).argv, program.argv)


class ShellWord(unittest.TestCase):
    def test_words_come_back_from_one_line(self):
        words = ["plain", "two words", "it's", '{"a": 1}', "line\nbreak", "tab\there", "back\\slash", "\x1b[0m", "it's\nboth\\"]
        line = " ".join(map(strategy.shell_word, words))
        self.assertNotIn("\n", line)
        self.assertNotIn("\t", line)
        for shell in ("/bin/zsh", "/bin/bash", "/bin/sh"):
            out = subprocess.run([shell, "-c", f"printf '%s\\0' {line}"], check=True, capture_output=True).stdout
            self.assertEqual(out.decode().split("\0")[:-1], words, shell)


class AgainstTmux(unittest.TestCase):
    """The strategy run as resurrect runs it, for the panes of a private tmux server, with a fake
    `claude` on PATH whose agent list names the sessions each test chooses."""

    def setUp(self):
        self.server = f"resurrect-command-test-{os.getpid()}"
        self.tmux("-f", "/dev/null", "new-session", "-d", "-s", "t")
        # Cleanups run last-first: the server exits with its only session, then its socket file goes.
        self.addCleanup(Path(self.tmux("display", "-p", "#{socket_path}").strip()).unlink, missing_ok=True)
        self.addCleanup(self.tmux, "kill-session", "-t", "t")
        self.tmux("set", "-g", "default-shell", "/bin/zsh")
        bin_dir = tempfile.TemporaryDirectory()
        self.addCleanup(bin_dir.cleanup)
        self.agents = Path(bin_dir.name) / "agents.json"
        fake = Path(bin_dir.name) / "claude"
        fake.write_text(f'#!/bin/sh\ncase "$1" in\n  agents) cat {self.agents} ;;\n  --help) cat <<"EOF"\n{HELP}EOF\n  ;;\n'
                        '  *) exit 2 ;;\nesac\n')
        fake.chmod(0o755)
        self.environment = {**os.environ, "PATH": f"{bin_dir.name}:{os.environ['PATH']}",
                            "TMUX": self.tmux("display", "-p", "#{socket_path},0,0").strip()}

    def tmux(self, *args):
        return subprocess.run(["tmux", "-L", self.server, *args], check=True, capture_output=True, text=True).stdout

    def pane(self, command, argv):
        """A new pane running `command`, once its foreground program has exec'd as `argv`."""
        pid = int(self.tmux("new-window", "-t", "t:", "-P", "-F", "#{pane_pid}", command))
        deadline = time.monotonic() + 10
        while (program := self.foreground(pid)) != argv:
            self.assertLess(time.monotonic(), deadline, f"pane {pid} shows {program}, not {argv}")
            time.sleep(0.05)
        return pid

    def foreground(self, pid):
        try:
            leader = int(subprocess.run(["ps", "-o", "tpgid=", "-p", str(pid)], capture_output=True, text=True).stdout)
            return strategy.started_with(leader).argv
        except (ValueError, strategy.Unreadable):
            return None

    def saved(self, panes, sessions):
        self.agents.write_text(json.dumps([{"kind": "background", "sessionId": "B"}] + [
            {"kind": "interactive", "pid": pid, "sessionId": session} for pid, session in sessions]))
        return subprocess.run([str(SCRIPT), *map(str, panes)], capture_output=True, text=True, env=self.environment)

    def test_each_pane_records_what_it_shows(self):
        # At its prompt, with a job in the background: the session that job runs is not brought back.
        idle = self.pane("/bin/zsh -fc 'sleep 300 & exec /bin/zsh -f'", ["/bin/zsh", "-f"])
        program = self.pane("sleep 300; :", ["zsh", "-c", "sleep 300; :"])
        # A long-running process whose command line is a Claude launch: -c and the words after it are the
        # shell's, which Claude's grammar reads as --continue and a prompt.
        claude = self.pane("exec -a claude /bin/sh -c 'sleep 300; :' x --model opus",
                           ["claude", "-c", "sleep 300; :", "x", "--model", "opus"])
        saved = self.saved([idle, program, claude], [(claude, "S1"), (self.child(idle), "S2"), (self.child(program), "S3")])
        self.assertEqual((saved.returncode, saved.stdout), (0, "\nzsh -c 'sleep 300; :'\nclaude --model opus --resume S1\n"))
        # S3 runs under the program the pane shows, and comes back with it.
        self.assertEqual(saved.stderr, f"tmux-resurrect-command: pane {idle}: Claude session S2 runs outside what the pane"
                                       " shows, so a restore does not bring it back\n")

    def child(self, pid):
        return int(subprocess.run(["pgrep", "-P", str(pid)], capture_output=True, text=True).stdout)

    def test_a_claude_that_cannot_list_its_sessions_fails_the_save(self):
        idle = self.pane("/bin/zsh -f", ["/bin/zsh", "-f"])
        self.agents.unlink(missing_ok=True)  # the fake's `cat` fails
        saved = subprocess.run([str(SCRIPT), str(idle)], capture_output=True, text=True, env=self.environment)
        self.assertNotEqual(saved.returncode, 0)
        self.assertEqual(saved.stdout, "")
        self.assertIn("claude agents --json exited", saved.stderr)


if __name__ == "__main__":
    unittest.main()
