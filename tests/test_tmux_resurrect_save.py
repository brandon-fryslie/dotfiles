"""What the periodic save wrapper tells an attached tmux client about a save: a failure every time,
and any other report only when it differs from the last save's, so a standing condition is told
once rather than every interval. The exit status is the save's.

Run: just test-tmux-resurrect
"""

import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

WRAPPER = Path(__file__).resolve().parent.parent / "config/tmux/scripts/tmux-resurrect-save.sh"


class SaveReport(unittest.TestCase):
    def setUp(self):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        self.root = Path(root.name)
        save = self.root / "home/.config/tmux/plugins/tmux-resurrect/scripts/save.sh"
        save.parent.mkdir(parents=True)
        # The fake save prints the report it is given and exits with the status it is given.
        save.write_text('#!/bin/sh\ncat "$HOME/report"\nexit "$(cat "$HOME/status")"\n')
        save.chmod(0o755)
        # Without TMUX, tmux finds its server through TMUX_TMPDIR: a private one, never the shared server.
        self.environment = {**{k: v for k, v in os.environ.items() if k != "TMUX"}, "HOME": str(self.root / "home"),
                            "TMUX_TMPDIR": str(self.root), "XDG_STATE_HOME": str(self.root / "state")}
        self.tmux("-f", "/dev/null", "new-session", "-d", "-s", "t")
        self.addCleanup(self.tmux, "kill-session", "-t", "t")
        self.client_output = self.root / "client"
        client = subprocess.Popen(["tmux", "-C", "attach", "-t", "t"], stdin=subprocess.PIPE,
                                  stdout=self.client_output.open("w"), env=self.environment)
        self.addCleanup(client.wait)
        self.addCleanup(client.stdin.close)  # an empty line on stdin ends a control client
        deadline = time.monotonic() + 10
        while "1" not in self.tmux("list-clients", "-F", "#{client_control_mode}"):
            self.assertLess(time.monotonic(), deadline, "the control client did not attach")
            time.sleep(0.05)

    def tmux(self, *args):
        return subprocess.run(["tmux", *args], check=True, capture_output=True, text=True, env=self.environment).stdout

    def save(self, report, status=0):
        (self.root / "home/report").write_text(report)
        (self.root / "home/status").write_text(str(status))
        return subprocess.run([str(WRAPPER)], capture_output=True, text=True, env=self.environment).returncode

    def shown(self):
        """The messages the client has been shown, once tmux has delivered everything sent before this call."""
        self.tmux("display-message", "-c", self.tmux("list-clients", "-F", "#{client_name}").strip(), "-l", "MARK")
        deadline = time.monotonic() + 10
        while "%message MARK" not in (lines := self.client_output.read_text()):
            self.assertLess(time.monotonic(), deadline, "the client was not shown the marker")
            time.sleep(0.05)
        return [line.removeprefix("%message ") for line in lines.splitlines()
                if line.startswith("%message ") and line != "%message MARK"]

    def test_a_report_is_shown_when_it_changes(self):
        self.assertEqual([self.save("pane 1: lost S\n"), self.save("pane 1: lost S\n"), self.save("")], [0, 0, 0])
        log = " (log: ~/Library/Logs/com.bmf.tmux-resurrect-save.log)"
        self.assertEqual(self.shown(), [f"tmux-resurrect: pane 1: lost S{log}"])

    def test_a_failure_is_shown_every_time_and_is_the_exit_status(self):
        self.assertEqual([self.save("save aborted\n", 1), self.save("save aborted\n", 1)], [1, 1])
        self.assertEqual(len(self.shown()), 2)

    def test_a_save_with_nothing_to_report_shows_nothing(self):
        self.assertEqual(self.save(""), 0)
        self.assertEqual(self.shown(), [])


if __name__ == "__main__":
    unittest.main()
