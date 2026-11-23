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
import sys
import tempfile
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "config/tmux/scripts/tmux-resurrect-command.py"
spec = importlib.util.spec_from_file_location("resurrect_command", SCRIPT)
strategy = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = strategy  # dataclasses resolve its string annotations there
spec.loader.exec_module(strategy)
Process, Session, Record, Launch = strategy.Process, strategy.Session, strategy.Record, strategy.Launch
from claude_process import options  # noqa: E402  the strategy put its library on sys.path

CONF = Path(__file__).resolve().parent.parent / "config/tmux/tmux.conf"

# The options the fake `claude` below lists, in the shape `claude --help` prints them.
HELP = """Options:
  -c, --continue                 Continue the most recent conversation
  --model <model>                Model for the current session
  -w, --worktree [name]          Create a new git worktree for this session
"""
GRAMMAR = options(HELP)


def record(program, sessions=()):
    return strategy.recorded(program, list(sessions), GRAMMAR)


def claude(id, *words):
    return Session(id, 1, Launch(["claude"], list(words)))


def restored_by_resurrect(command):
    """Whether resurrect's restore relaunches a recorded `command`: tmux.conf's resume entry, matched the way
    the fork's _proc_matches_full_command matches a tilde entry, with bash's =~."""
    entry = next(line for line in CONF.read_text().splitlines() if line.startswith("set -g @resurrect-processes"))
    pattern = entry.split('"~', 1)[1].split('"', 1)[0]
    return subprocess.run(["bash", "-c", '[[ "$1" =~ ($2) ]]', "_", command, pattern]).returncode == 0


class Recorded(unittest.TestCase):
    def test_a_claude_session_is_resumed_with_its_settings(self):
        session = claude("S", "-w", "feat", "--model", "opus", "fix the bug")
        self.assertEqual(record(Process("/c", ["claude", *session.started.words], {}), [session]),
                         Record(["claude", "--model", "opus", "--resume", "S"], session))

    def test_a_wrapper_keeps_its_own_words_and_resumes_the_session_it_runs(self):
        wrapper = Process("/f", ["fritter", "--tap", "x", "--", "claude", "--model", "opus"], {})
        self.assertEqual(record(wrapper, [claude("S", "--model", "opus")]).argv,
                         ["fritter", "--tap", "x", "--", "claude", "--model", "opus", "--resume", "S"])

    def test_npx_resumes_the_node_script_it_runs(self):
        npx = Process("/n", ["node", "/opt/bin/npx", "claude", "--model", "opus", "fix the bug"], {})
        session = Session("S", 2, Launch(["node", "/cache/cli.js"], ["--model", "opus", "fix the bug"]))
        self.assertEqual(record(npx, [session]).argv, ["node", "/opt/bin/npx", "claude", "--model", "opus", "--resume", "S"])

    def test_sessions_a_program_starts_with_other_words_leave_it_as_launched(self):
        remote = Process("/c", ["claude", "remote-control", "--name", "rc"], {})
        self.assertEqual(record(remote, [claude("S", "--print", "--sdk-url", "u")]), Record(remote.argv, None))

    def test_a_program_running_no_session_is_kept_as_launched(self):
        program = Process("/bin/zsh", ["/bin/zsh", "-c", "make"], {})
        self.assertEqual(record(program), Record(program.argv, None))

    def test_restore_relaunches_exactly_the_commands_that_resume_a_session(self):
        resume = " ".join(record(Process("/c", ["claude"], {}), [claude("1bf43610-853e-4f1e-9fa6-d7ddb207537c")]).argv)
        self.assertTrue(restored_by_resurrect(resume), resume)
        for kept in ("just test-claude-lib", "vim ~/.claude/settings.json", "claude -p 'deploy X'"):
            self.assertFalse(restored_by_resurrect(kept), kept)


class AtPrompt(unittest.TestCase):
    def test_the_default_shell_given_only_options_is_at_its_prompt(self):
        for argv in (["-zsh"], ["/bin/zsh", "-l"]):
            self.assertTrue(strategy.at_prompt(Process("/bin/zsh", argv, {}), "/bin/zsh", "/bin/zsh"), argv)

    def test_a_shell_running_a_command_or_another_shell_is_a_program(self):
        self.assertFalse(strategy.at_prompt(Process("/bin/zsh", ["/bin/zsh", "-c", "make"], {}), "/bin/zsh", "/bin/zsh"))
        self.assertFalse(strategy.at_prompt(Process("/bin/bash", ["bash"], {}), "/bin/bash", "/bin/zsh"))


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
                                       " shows; a restore does not bring it back\n")

    def children(self, pid):
        return list(map(int, subprocess.run(["pgrep", "-P", str(pid)], capture_output=True, text=True).stdout.split()))

    def child(self, pid):
        (only,) = self.children(pid)
        return only

    def test_the_session_in_the_foreground_is_resumed_not_a_suspended_one_with_the_same_words(self):
        shell = self.pane("/bin/zsh -f", ["/bin/zsh", "-f"])
        launch = "(exec -a claude /bin/sh -c 'sleep 300; :' x)"
        self.tmux("send-keys", "-t", "t:1", f"{launch} &", "Enter", launch, "Enter")
        words = ["claude", "-c", "sleep 300; :", "x"]
        deadline = time.monotonic() + 10
        while self.foreground(shell) != words or len(self.children(shell)) != 2:
            self.assertLess(time.monotonic(), deadline, "the two launches did not start")
            time.sleep(0.05)
        leader = int(subprocess.run(["ps", "-o", "tpgid=", "-p", str(shell)], capture_output=True, text=True).stdout)
        (background,) = [pid for pid in self.children(shell) if pid != leader]
        saved = self.saved([shell], [(background, "SUSPENDED"), (leader, "LIVE")])
        self.assertEqual((saved.returncode, saved.stdout), (0, "claude --resume LIVE\n"))
        self.assertEqual(saved.stderr, f"tmux-resurrect-command: pane {shell}: Claude session SUSPENDED runs outside what"
                                       " the pane shows; a restore does not bring it back\n")

    def test_a_pane_that_cannot_be_read_is_reported_and_the_others_still_saved(self):
        program = self.pane("sleep 300; :", ["zsh", "-c", "sleep 300; :"])
        gone = 99_999_999  # a pane whose process exited between tmux listing it and the save reading it
        saved = self.saved([gone, program], [])
        self.assertEqual((saved.returncode, saved.stdout), (0, "\nzsh -c 'sleep 300; :'\n"))
        self.assertEqual(saved.stderr, f"tmux-resurrect-command: pane {gone}: cannot record its program (its process"
                                       " exited during the save); a restore starts a shell there\n")

    def test_an_agent_kind_it_does_not_know_fails_the_save(self):
        idle = self.pane("/bin/zsh -f", ["/bin/zsh", "-f"])
        self.agents.write_text(json.dumps([{"kind": "foreground", "pid": idle, "sessionId": "S"}]))
        saved = subprocess.run([str(SCRIPT), str(idle)], capture_output=True, text=True, env=self.environment)
        self.assertEqual((saved.returncode, saved.stdout), (1, ""))
        self.assertIn("kinds this strategy does not know: ['foreground']", saved.stderr)

    def test_a_claude_that_cannot_list_its_sessions_fails_the_save(self):
        idle = self.pane("/bin/zsh -f", ["/bin/zsh", "-f"])
        self.agents.unlink(missing_ok=True)  # the fake's `cat` fails
        saved = subprocess.run([str(SCRIPT), str(idle)], capture_output=True, text=True, env=self.environment)
        self.assertNotEqual(saved.returncode, 0)
        self.assertEqual(saved.stdout, "")
        self.assertIn("claude agents --json exited", saved.stderr)


if __name__ == "__main__":
    unittest.main()
