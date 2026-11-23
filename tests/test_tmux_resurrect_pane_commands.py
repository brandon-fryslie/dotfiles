"""What the tmux-resurrect post-save-layout hook records for each pane: a Claude Code
session as a resume of that session with the flags it was started with, any other
foreground program (an idle pane's shell included) as its exact command line, a pane
that closed mid-save as nothing - and a save that resurrect corrupted with multi-line
commands comes out with one line per record.

Run: just test-tmux-resurrect
"""

import importlib.util
import shlex
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "config/tmux/scripts/tmux-resurrect-pane-commands.py"
spec = importlib.util.spec_from_file_location("pane_commands", SCRIPT)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)

# A save as resurrect writes it: the claude pane's command is one of its MCP servers,
# and the remote-control pane's two children spilled onto a line of their own.
SAVE = "\n".join([
    "pane\twork\t1\t1\t*\t1\tclaude\t:/code/work\t1\t2.1.299\t:/usr/local/bin/vhid mcp",
    "pane\twork\t2\t0\t-\t1\tshell\t:/code/work\t1\tzsh\t:",
    "pane\trc\t1\t1\t*\t1\trc\t:/code/rc\t1\t2.1.299\t:claude --print --sdk-url a",
    "claude --print --sdk-url b",
    "window\twork\t1\t:claude\t1\t*\tlayout\t:",
    "state\twork\t",
]) + "\n"


def full_command(save: str, session: str, window: str) -> list[str]:
    line = next(l for l in save.splitlines() if l.startswith(f"pane\t{session}\t{window}\t"))
    return shlex.split(line.split("\t")[10][1:])


class RewriteSave(unittest.TestCase):
    def setUp(self):
        self.save = hook.rewrite_save(SAVE, {
            ("work", "1", "1"): hook.restore_command(
                ["/Users/me/.local/bin/claude", "--settings", '{"a": true}', "--resume", "old"], "sid-1"),
            ("rc", "1", "1"): hook.restore_command(
                ["/Users/me/.local/bin/claude", "remote-control", "--name", "rc"], None),
        })  # ("work", "2", "1") closed while resurrect was saving

    def test_claude_session_resumes_with_its_flags(self):
        self.assertEqual(full_command(self.save, "work", "1"),
                         ["claude", "--settings", '{"a": true}', "--resume", "sid-1"])

    def test_other_program_restarts_as_it_was_launched(self):
        self.assertEqual(full_command(self.save, "rc", "1"),
                         ["/Users/me/.local/bin/claude", "remote-control", "--name", "rc"])

    def test_pane_closed_mid_save_records_no_command(self):
        self.assertEqual(full_command(self.save, "work", "2"), [])

    def test_every_line_is_a_record(self):
        self.assertEqual([l.split("\t")[0] for l in self.save.splitlines()],
                         ["pane", "pane", "pane", "window", "state"])


class RestoreCommand(unittest.TestCase):
    def test_flags_choosing_a_conversation_give_way_to_the_resume(self):
        argv = ["claude", "--continue", "--resume=x", "-r", "y", "--session-id", "z", "--model", "opus"]
        self.assertEqual(hook.restore_command(argv, "s"), ["claude", "--model", "opus", "--resume", "s"])


class ProcessArgv(unittest.TestCase):
    def test_reads_args_with_spaces_and_json_intact(self):
        args = ["-c", "import time; time.sleep(30)", "two words", '{"k": 1}']
        child = subprocess.Popen([sys.executable, *args])
        try:
            self.assertEqual(hook.process_argv(child.pid)[1:], args)
        finally:
            child.kill()
            child.wait()


if __name__ == "__main__":
    unittest.main()
