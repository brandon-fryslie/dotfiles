#!/usr/bin/env python3
"""Probe one Claude Code session: context around matches, or one message by uuid.

Subcommands:
  context  Print N messages before/after each query match (overlaps merged).
  message  Print the full body of one message identified by its event uuid.

Both subcommands take <project> <session_id>, which together uniquely identify
a transcript file on disk. The <project> slug is the encoded directory name
shown by find_session.py.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from _session_lib import (
    MESSAGE_TYPES,
    extract_text,
    iter_events,
    locate_session_file,
    nonneg_int,
    positive_int,
    regex_arg,
)


@dataclass(frozen=True)
class Message:
    index: int
    uuid: str
    role: str
    timestamp: str
    text: str


def load_messages(path: Path) -> list[Message]:
    msgs: list[Message] = []
    for ev in iter_events(path):
        if ev.get("type") not in MESSAGE_TYPES:
            continue
        text = extract_text(ev)
        if not text:
            continue
        msgs.append(Message(
            index=len(msgs),
            uuid=ev.get("uuid", ""),
            role=ev.get("type", ""),
            timestamp=ev.get("timestamp", ""),
            text=text,
        ))
    return msgs


def fmt_ts(iso: str) -> str:
    if not iso:
        return "?"
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return iso


def truncate_head_tail(text: str, words_each: int) -> str:
    if words_each <= 0:
        return ""
    words = text.split()
    if len(words) <= 2 * words_each:
        return " ".join(words)
    head = " ".join(words[:words_each])
    tail = " ".join(words[-words_each:])
    return f"{head} … {tail}"


def truncate_around_match(text: str, m: re.Match, words_each_side: int) -> str:
    before_words = text[:m.start()].split()
    after_words = text[m.end():].split()
    match_text = text[m.start():m.end()]

    parts: list[str] = []
    if len(before_words) > words_each_side:
        parts.append("…")
        parts.extend(before_words[-words_each_side:])
    else:
        parts.extend(before_words)
    parts.append(f"«{match_text}»")
    if len(after_words) > words_each_side:
        parts.extend(after_words[:words_each_side])
        parts.append("…")
    else:
        parts.extend(after_words)
    return " ".join(parts)


def print_message(msg: Message, body: str, is_match: bool) -> None:
    suffix = "  ← MATCH" if is_match else ""
    print(f"[{msg.uuid}] {msg.role} {fmt_ts(msg.timestamp)}{suffix}")
    print(f"  {body}")


def cmd_context(args: argparse.Namespace) -> int:
    path = locate_session_file(args.project, args.session_id)
    pat = args.query
    msgs = load_messages(path)

    # One canonical display string per message: search AND truncation operate
    # on this same flat string, so match offsets are valid by construction.
    flats = [m.text.replace("\n", " ") for m in msgs]

    matches: list[tuple[int, re.Match]] = []
    for i, flat in enumerate(flats):
        match = pat.search(flat)
        if match:
            matches.append((i, match))

    if not matches:
        print(f"no matches for {args.query.pattern!r} in session", file=sys.stderr)
        return 1

    windows: list[tuple[int, int]] = []
    for idx, _match in matches:
        s = max(0, idx - args.before)
        e = min(len(msgs) - 1, idx + args.after)
        if windows and s <= windows[-1][1] + 1:
            ps, pe = windows[-1]
            windows[-1] = (ps, max(pe, e))
        else:
            windows.append((s, e))

    match_re_map = {idx: m for idx, m in matches}
    head_tail_words = args.word_budget // 2

    for n, (s, e) in enumerate(windows, 1):
        print(f"=== match block {n} of {len(windows)} (messages {s}..{e}) ===")
        for i in range(s, e + 1):
            if i in match_re_map:
                body = truncate_around_match(flats[i], match_re_map[i], args.word_budget)
                print_message(msgs[i], body, is_match=True)
            else:
                body = truncate_head_tail(flats[i], head_tail_words)
                print_message(msgs[i], body, is_match=False)
        print()
    return 0


def cmd_message(args: argparse.Namespace) -> int:
    path = locate_session_file(args.project, args.session_id)
    for ev in iter_events(path):
        if ev.get("uuid") != args.uuid:
            continue
        if ev.get("type") not in MESSAGE_TYPES:
            print(f"event {args.uuid} is type {ev.get('type')!r}, "
                  f"not a conversation message", file=sys.stderr)
            return 1
        text = extract_text(ev)
        print(f"[{ev.get('uuid')}] {ev.get('type')} {fmt_ts(ev.get('timestamp', ''))}")
        print(text)
        return 0
    print(f"uuid {args.uuid} not found in session", file=sys.stderr)
    return 1


DASH_SLUG_EPILOG = (
    "Note: project slugs always start with '-' (e.g. -Users-bmf-…), so "
    "invocations need a '--' separator with flags BEFORE and positionals "
    "AFTER, e.g.\n"
    "  show_session.py context -C 3 -- -Users-bmf-code-foo <session_id> 'query'\n"
    "Standard Unix convention (same as 'git checkout -- <pathspec>')."
)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0],
                                 epilog=DASH_SLUG_EPILOG,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    ctx = sub.add_parser("context", help="Print context around query matches",
                          epilog=DASH_SLUG_EPILOG,
                          formatter_class=argparse.RawDescriptionHelpFormatter)
    ctx.add_argument("project", help="Project slug (e.g. -Users-bmf-code-foo)")
    ctx.add_argument("session_id", help="Session UUID")
    ctx.add_argument("query", type=regex_arg, help="Case-insensitive regex")
    ctx.add_argument("-C", type=nonneg_int, default=2, dest="context_n",
                     help="Symmetric messages before AND after each match (default: 2)")
    ctx.add_argument("-A", type=nonneg_int, default=None, dest="after",
                     help="Messages AFTER match (overrides -C)")
    ctx.add_argument("-B", type=nonneg_int, default=None, dest="before",
                     help="Messages BEFORE match (overrides -C)")
    ctx.add_argument("--word-budget", type=positive_int, default=50,
                     help="Words on each side of match (default: 50). "
                          "Non-matched messages show first/last (budget//2) each.")

    msg = sub.add_parser("message", help="Print full body of one message by uuid",
                          epilog=DASH_SLUG_EPILOG,
                          formatter_class=argparse.RawDescriptionHelpFormatter)
    msg.add_argument("project")
    msg.add_argument("session_id")
    msg.add_argument("uuid")

    args = ap.parse_args()

    if args.cmd == "context":
        if args.before is None:
            args.before = args.context_n
        if args.after is None:
            args.after = args.context_n

    try:
        if args.cmd == "context":
            return cmd_context(args)
        return cmd_message(args)
    except OSError as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
