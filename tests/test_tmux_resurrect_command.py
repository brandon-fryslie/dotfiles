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
import re
import shutil
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
Process, Session, Record, Listed = strategy.Process, strategy.Session, strategy.Record, strategy.Listed
from claude_process import options  # noqa: E402  the strategy put its library on sys.path

CONF = Path(__file__).resolve().parent.parent / "config/tmux/tmux.conf"
PLUGIN = Path.home() / ".config/tmux/plugins/tmux-resurrect/scripts"

# The options the fake `claude` below lists, in the shape `claude --help` prints them.
HELP = """Options:
  -c, --continue                 Continue the most recent conversation
  --model <model>                Model for the current session
  -w, --worktree [name]          Create a new git worktree for this session
"""
GRAMMAR = options(HELP)


def record(leader, program, sessions=()):
    return strategy.recorded(leader, program, list(sessions), GRAMMAR)


def claude(id, pid, *words, config_dir=None):
    return Session(Listed(id, config_dir), pid, Process("/v/2.1.299", ["claude", *words], {}))


def restored_by_resurrect(command):
    """Whether resurrect's restore relaunches a recorded `command`, decided by resurrect's own matcher (the
    installed plugin's scripts) given tmux.conf's @resurrect-processes, with its default list as tmux would."""
    processes = re.search(r"^set -g @resurrect-processes '(.*)'$", CONF.read_text(), re.M)[1]
    script = (f"source {PLUGIN}/variables.sh; source {PLUGIN}/helpers.sh; source {PLUGIN}/process_restore_helpers.sh;"
              ' get_tmux_option() { if [ "$1" = "$restore_processes_option" ]; then printf %s "$PROCESSES";'
              ' else printf %s "$2"; fi; }; _process_on_the_restore_list "$1"')
    return subprocess.run(["bash", "-c", script, "_", command], env={**os.environ, "PROCESSES": processes}).returncode == 0


class Recorded(unittest.TestCase):
    def test_a_program_that_is_a_claude_session_is_resumed_with_its_settings(self):
        session = claude("S", 7, "-w", "feat", "--model", "opus", "fix the bug")
        self.assertEqual(record(7, session.process, [session]), Record(["claude", "--model", "opus", "--resume", "S"], session))

    def test_a_session_kept_outside_the_default_config_dir_is_resumed_there(self):
        session = claude("S", 7, "--model", "opus", config_dir="/Users/u/.hands/brain")
        self.assertEqual(record(7, session.process, [session]).argv,
                         ["env", "CLAUDE_CONFIG_DIR=/Users/u/.hands/brain", "claude", "--model", "opus", "--resume", "S"])

    def test_the_session_in_the_foreground_is_resumed_not_another_launched_the_same_way(self):
        suspended, live = claude("SUSPENDED", 100), claude("LIVE", 200)
        self.assertEqual(record(200, live.process, [suspended, live]).session, live)

    def test_a_wrapper_keeps_its_own_words_and_resumes_the_command_line_it_passes_after_a_double_dash(self):
        wrapper = Process("/f", ["fritter", "--tap", "x", "--", "claude", "--model", "opus"], {})
        self.assertEqual(record(1, wrapper, [claude("S", 2, "--model", "opus")]).argv,
                         ["fritter", "--tap", "x", "--", "claude", "--model", "opus", "--resume", "S"])

    def test_a_program_that_only_starts_a_claude_is_kept_as_launched(self):
        bare = claude("S", 2)
        for argv in (["/bin/bash", "./dev.sh"], ["zsh", "-c", "claude"], ["just", "chat"], ["claude", "remote-control"]):
            self.assertEqual(record(1, Process("/p", argv, {}), [bare]), Record(argv, None), argv)

    def test_restore_relaunches_exactly_the_commands_a_save_resumes_and_remote_control(self):
        session = claude("1bf43610-853e-4f1e-9fa6-d7ddb207537c", 7)
        resume = strategy.shell_line(record(7, session.process, [session]).argv)
        for relaunched in (resume, "/Users/bmf/.local/bin/claude remote-control --spawn worktree --name lit_v2"):
            self.assertTrue(restored_by_resurrect(relaunched), relaunched)
        for kept in ("just test-claude-lib", "cat ~/.claude/settings.json", "claude -p 'deploy X'", "cat claude remote-control"):
            self.assertFalse(restored_by_resurrect(kept), kept)


class AtPrompt(unittest.TestCase):
    def test_the_default_shell_given_only_options_is_at_its_prompt(self):
        for argv in (["-zsh"], ["/bin/zsh", "-l"]):
            self.assertTrue(strategy.at_prompt(Process("/bin/zsh", argv, {}), "/bin/zsh", "/bin/zsh"), argv)

    def test_a_shell_running_a_command_or_another_shell_is_a_program(self):
        self.assertFalse(strategy.at_prompt(Process("/bin/zsh", ["/bin/zsh", "-c", "make"], {}), "/bin/zsh", "/bin/zsh"))
        self.assertFalse(strategy.at_prompt(Process("/bin/bash", ["bash"], {}), "/bin/bash", "/bin/zsh"))


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
        # It lists the agents of the config dir it runs with, as Claude does: each dir keeps its own list.
        fake.write_text(f'#!/bin/sh\ncase "$1" in\n  agents) cat "${{CLAUDE_CONFIG_DIR:-{bin_dir.name}}}/agents.json" ;;\n'
                        f'  --help) cat <<"EOF"\n{HELP}EOF\n  ;;\n  *) exit 2 ;;\nesac\n')
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

    def saved(self, panes, sessions, listed_in=None):
        (listed_in or self.agents).write_text(json.dumps([{"kind": "background", "sessionId": "B"}] + [
            {"kind": "interactive", "pid": pid, "sessionId": session} for pid, session in sessions]))
        return subprocess.run([str(SCRIPT), *map(str, panes)], capture_output=True, text=True, env=self.environment)

    def test_each_pane_records_what_it_shows(self):
        idle = self.pane("/bin/zsh -fc 'sleep 300 & exec /bin/zsh -f'", ["/bin/zsh", "-f"])
        program = self.pane("sleep 300; :", ["zsh", "-c", "sleep 300; :"])
        # A long-running process whose command line is a Claude launch: -c and the words after it are the
        # shell's, which Claude's grammar reads as --continue and a prompt.
        claude = self.pane("exec -a claude /bin/sh -c 'sleep 300; :' x --model opus",
                           ["claude", "-c", "sleep 300; :", "x", "--model", "opus"])
        # S2 is a background job, S3 a session a non-Claude program started, and S4 one S1 started, which is S1's.
        sessions = [(claude, "S1"), (self.child(idle), "S2"), (self.child(program), "S3"), (self.child(claude), "S4")]
        saved = self.saved([idle, program, claude], sessions)
        self.assertEqual((saved.returncode, saved.stdout), (0, "\nzsh -c 'sleep 300; :'\nclaude --model opus --resume S1\n"))
        self.assertEqual(saved.stderr, f"tmux-resurrect-command: pane {idle}: a restore does not bring back Claude session S2\n"
                                       f"tmux-resurrect-command: pane {program}: a restore does not bring back Claude session S3\n")

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
        self.assertEqual(saved.stderr, f"tmux-resurrect-command: pane {shell}: a restore does not bring back Claude session"
                                       " SUSPENDED\n")

    def test_a_session_listed_only_in_its_own_config_dir_is_resumed_there(self):
        directory = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, directory)
        (self.agents.parent / "agents.json").write_text("[]")
        # Built here, because macOS reads out no environment for its own system binaries (/bin/sh), and Claude
        # is not one; homebrew's python re-execs itself and loses the name it was run as.
        waits = directory / "waits"
        subprocess.run(["cc", "-x", "c", "-o", str(waits), "-"], input="#include <unistd.h>\nint main(void) { pause(); }\n",
                       text=True, check=True)
        pane = self.pane(f"export CLAUDE_CONFIG_DIR={directory}; exec -a claude {waits} --model opus",
                         ["claude", "--model", "opus"])
        saved = self.saved([pane], [(pane, "S")], listed_in=directory / "agents.json")
        self.assertEqual((saved.returncode, saved.stdout, saved.stderr),
                         (0, f"env CLAUDE_CONFIG_DIR={directory} claude --model opus --resume S\n", ""))

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
