#!/usr/bin/env python3
"""Excise text from the running Claude Code session's transcript, then bring the session back without it.

    excise.py restart CUTS   from inside the session: CUTS is a JSON file holding a list of exact strings.
    excise.py rewrite PLAN   what the tmux pane runs once the session is replaced; not run by hand.

`restart` checks every string is in the transcript, then replaces the session's tmux pane with `rewrite`. `rewrite`
waits for the old Claude to exit, cuts the strings from the transcript, and starts Claude again on the same session,
with the argv and environment it was first started with. When that Claude exits, the pane drops to a login shell.

What the cut removes, so the resumed session cannot see it:
- every occurrence of each string, in every string value of every entry, and its JSON-escaped form;
- every thinking block from the turn where a string first appears onward: they are stored encrypted, so whether one
  mentions a string cannot be read, and a block that might is not kept;
- the turn that asked for the excision: everything from the last typed prompt on;
- any message left with nothing in it, with its children linked to its parent.

macOS and tmux only: the session is read from the kernel and replaced in its pane.
"""

import ctypes
import json
import os
import struct
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path

# How long the old Claude has to exit after the pane is replaced before it is killed.
EXIT_SECONDS = 10.0
# Flags that pick which session Claude starts on; the resumed Claude gets `--resume <id>` in their place.
SESSION_FLAGS_WITH_VALUE = {"--resume", "-r", "--session-id"}
SESSION_FLAGS = {"--continue", "-c", "--fork-session"}
THINKING = {"thinking", "redacted_thinking"}
LINKS = ("parentUuid", "logicalParentUuid", "leafUuid")


class Refused(Exception):
    """The excision cannot be done as asked. The message says why; nothing has been changed."""


@dataclass(frozen=True)
class Plan:
    """Everything `rewrite` needs, gathered while the session is alive."""

    pid: int
    transcript: str
    cuts: list[str]
    argv: list[str]
    environment: dict[str, str]
    cwd: str


# ---- the transcript: pure, lines in, lines out ----


def excised(lines: list[str], cuts: list[str]) -> list[str]:
    """The transcript `lines` with `cuts` removed, as the module docstring says. Raises Refused if a cut is empty or
    never appears, or if there is no typed prompt to truncate at."""
    if any(not cut for cut in cuts):
        raise Refused("an empty string cannot be cut")
    entries = [json.loads(line) for line in lines]
    prompts = [index for index, entry in enumerate(entries) if _typed(entry)]
    if not prompts:
        raise Refused("the transcript has no typed prompt, so there is no excision request to truncate at")
    entries = entries[: prompts[-1]]
    forms = {cut: {cut, json.dumps(cut)[1:-1]} for cut in cuts}
    found: set[str] = set()
    first = None
    for index, entry in enumerate(entries):
        cut_entry, hit = _cut(entry, forms)
        if hit:
            entries[index] = cut_entry
            found |= hit
            first = index if first is None else first
    missing = [cut for cut in cuts if cut not in found]
    if missing:
        raise Refused(f"not in the transcript before the excision request: {missing!r}")
    turn = max(index for index in prompts if index <= first)
    kept, dropped = [], {}
    for index, entry in enumerate(entries):
        entry = _without_thinking(entry) if index >= turn else entry
        if _empty(entry):
            dropped[entry["uuid"]] = entry.get("parentUuid")
        else:
            kept.append(entry)
    kept = [_relinked(entry, dropped) for entry in kept]
    out = [json.dumps(entry, ensure_ascii=False, separators=(",", ":")) for entry in kept]
    _check(lines, out, forms)
    return out


def _typed(entry: dict) -> bool:
    return entry.get("type") == "user" and (entry.get("origin") or {}).get("kind") == "human"


def _cut(value, forms: dict[str, set[str]]):
    """`value` with every form of every cut removed from its strings, and which cuts were found."""
    match value:
        case str():
            hit = {cut for cut, cut_forms in forms.items() if any(form in value for form in cut_forms)}
            for cut in hit:
                for form in sorted(forms[cut], key=len, reverse=True):
                    value = value.replace(form, "")
            return value, hit
        case dict():
            pairs = {key: _cut(item, forms) for key, item in value.items()}
            return {key: pair[0] for key, pair in pairs.items()}, set().union(*(pair[1] for pair in pairs.values()))
        case list():
            pairs = [_cut(item, forms) for item in value]
            return [pair[0] for pair in pairs], set().union(*(pair[1] for pair in pairs))
        case _:
            return value, set()


def _blocks(entry: dict):
    message = entry.get("message")
    return message.get("content") if isinstance(message, dict) and entry.get("type") in ("user", "assistant") else None


def _without_thinking(entry: dict) -> dict:
    content = _blocks(entry)
    if entry.get("type") != "assistant" or not isinstance(content, list):
        return entry
    return {**entry, "message": {**entry["message"], "content": [block for block in content if block.get("type") not in THINKING]}}


def _empty(entry: dict) -> bool:
    """A message with nothing left to say: no content, or only text that the cut emptied."""
    match _blocks(entry):
        case None:
            return False
        case str(text):
            return not text.strip()
        case list(blocks):
            return all(block.get("type") == "text" and not block.get("text", "").strip() for block in blocks)


def _relinked(entry: dict, dropped: dict[str, str | None]) -> dict:
    def through(uuid):
        while uuid in dropped:
            uuid = dropped[uuid]
        return uuid

    content = _blocks(entry)
    if isinstance(content, list):
        content = [block for block in content if not (block.get("type") == "text" and not block.get("text", "").strip())]
        entry = {**entry, "message": {**entry["message"], "content": content}}
    return {**entry, **{link: through(entry[link]) for link in LINKS if link in entry}}


def _check(before: list[str], after: list[str], forms: dict[str, set[str]]) -> None:
    """The cut is complete and the chain is whole: no form of any cut remains, and no link points nowhere that did
    not already."""
    left = [form for cut_forms in forms.values() for form in cut_forms if any(form in line for line in after)]
    if left:
        raise Refused(f"still in the transcript after the cut: {left!r}")
    new = _dangling(after) - _dangling(before)
    if new:
        raise Refused(f"the cut would leave links pointing at messages that are gone: {sorted(new)!r}")


def _dangling(lines: list[str]) -> set[str]:
    entries = [json.loads(line) for line in lines]
    uuids = {entry["uuid"] for entry in entries if "uuid" in entry}
    return {entry[link] for entry in entries for link in ("parentUuid", "logicalParentUuid") if entry.get(link) and entry[link] not in uuids}


# ---- the process: what Claude was started with ----


def started_with(pid: int) -> tuple[list[str], dict[str, str]]:
    """The argv and environment process `pid` was exec'd with, as the kernel kept them (macOS KERN_PROCARGS2)."""
    libc = ctypes.CDLL(None, use_errno=True)
    size = ctypes.c_size_t(4)
    argmax = ctypes.c_int()
    if libc.sysctl((ctypes.c_int * 2)(1, 8), 2, ctypes.byref(argmax), ctypes.byref(size), None, 0) != 0:
        raise Refused(f"cannot read the kernel's argument limit: {os.strerror(ctypes.get_errno())}")
    buffer = ctypes.create_string_buffer(argmax.value)
    size = ctypes.c_size_t(argmax.value)
    if libc.sysctl((ctypes.c_int * 3)(1, 49, pid), 3, buffer, ctypes.byref(size), None, 0) != 0:
        raise Refused(f"cannot read how process {pid} was started: {os.strerror(ctypes.get_errno())}")
    raw = buffer.raw[: size.value]
    (argc,) = struct.unpack_from("i", raw)
    # After argc: the exec path, NUL padding, then argc arguments and the environment, each NUL-terminated.
    rest = raw[4:]
    rest = rest[rest.index(b"\0") :].lstrip(b"\0")
    strings = rest.split(b"\0")
    argv = [item.decode() for item in strings[:argc]]
    environment = {}
    for item in strings[argc:]:
        if not item:
            break
        key, _, value = item.decode().partition("=")
        environment[key] = value
    return argv, environment


def resumed(argv: list[str], session: str) -> list[str]:
    """`argv` with whatever chose its session replaced by `--resume session`."""
    out, skip = [], False
    for arg in argv:
        if skip:
            skip = False
        elif arg in SESSION_FLAGS_WITH_VALUE:
            skip = True
        elif arg in SESSION_FLAGS or any(arg.startswith(flag + "=") for flag in SESSION_FLAGS_WITH_VALUE):
            pass
        else:
            out.append(arg)
    return [*out, "--resume", session]


# ---- the two commands ----


def restart(cuts_path: Path) -> None:
    pane = os.environ.get("TMUX_PANE")
    if not pane:
        raise Refused("this session is not in tmux, so there is no pane to bring it back in")
    pid = int(os.environ["CLAUDE_PID"])
    session = os.environ["CLAUDE_CODE_SESSION_ID"]
    matches = list((Path.home() / ".claude" / "projects").glob(f"*/{session}.jsonl"))
    if len(matches) != 1:
        raise Refused(f"expected one transcript for session {session}, found {matches}")
    transcript = matches[0]
    cuts = json.loads(cuts_path.read_text())
    if not isinstance(cuts, list) or not all(isinstance(cut, str) for cut in cuts) or not cuts:
        raise Refused(f"{cuts_path} must hold a non-empty JSON list of strings")
    # Checked now, while the session can still be told: the rewrite runs after it is gone.
    lines = transcript.read_text().splitlines()
    excised(lines, cuts)
    argv, environment = started_with(pid)
    # Where the session last was, which is where its transcript is filed: it can have moved since Claude started.
    cwd = [entry["cwd"] for entry in map(json.loads, lines) if "cwd" in entry][-1]
    plan = Plan(pid, str(transcript), cuts, resumed(argv, session), {**environment, "PWD": cwd}, cwd)
    descriptor, plan_path = tempfile.mkstemp(prefix="excise-", suffix=".json")
    with os.fdopen(descriptor, "w") as out:
        json.dump(asdict(plan), out)
    cuts_path.unlink()
    print(f"excising {len(cuts)} string(s) from {transcript.name}; the session restarts in pane {pane} now", flush=True)
    subprocess.run(["tmux", "respawn-pane", "-k", "-t", pane, "-c", plan.cwd, sys.executable, str(Path(__file__).resolve()), "rewrite", plan_path], check=True)


def rewrite(plan_path: Path) -> None:
    plan = Plan(**json.loads(plan_path.read_text()))
    plan_path.unlink()
    shell = plan.environment.get("SHELL", "/bin/sh")
    try:
        _gone(plan.pid)
        transcript = Path(plan.transcript)
        lines = excised(transcript.read_text().splitlines(), plan.cuts)
        staged = transcript.with_suffix(".excising")
        staged.write_text("".join(line + "\n" for line in lines))
        os.replace(staged, transcript)
        print(f"excised {len(plan.cuts)} string(s); resuming", flush=True)
        subprocess.run(plan.argv, env=plan.environment, cwd=plan.cwd)
    except Exception as error:
        print(f"excise: {error}\nThe transcript was not changed unless this says it was excised.", file=sys.stderr, flush=True)
    os.execve(shell, [shell, "-l"], plan.environment)


def _gone(pid: int) -> None:
    """Returns once `pid` has exited, killing it if it has not within EXIT_SECONDS."""
    deadline = time.monotonic() + EXIT_SECONDS
    while time.monotonic() < deadline:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return
        time.sleep(0.1)
    os.kill(pid, 9)
    while True:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return
        time.sleep(0.1)


def main() -> None:
    match sys.argv[1:]:
        case ["restart", cuts]:
            restart(Path(cuts))
        case ["rewrite", plan]:
            rewrite(Path(plan))
        case _:
            sys.exit(__doc__)


if __name__ == "__main__":
    try:
        main()
    except Refused as refused:
        sys.exit(f"excise: {refused}")
