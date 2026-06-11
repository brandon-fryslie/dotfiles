#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import textwrap
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


DEFAULT_SOURCE_CONFIG_DIR = Path.home() / ".claude"
MESSAGE_TYPES = {"user", "assistant"}


@dataclass(frozen=True)
class ConfigDirs:
    source: Path
    target: Path


@dataclass(frozen=True)
class ProjectScope:
    cwd: Path
    slug: str
    source_dir: Path
    target_dir: Path


@dataclass(frozen=True)
class Message:
    role: str
    timestamp: str | None
    uuid: str | None
    text: str


@dataclass(frozen=True)
class SessionReport:
    index: int
    session_id: str
    source_path: Path
    target_path: Path
    target_state: str
    size_bytes: int
    last_updated: str
    last_event_at: str | None
    title: str | None
    message_count: int
    recent_messages: tuple[Message, ...]


def z_ai_config_dir() -> Path:
    # [LAW:no-silent-failure] No filesystem fallback: deriving the target from
    # this file's resolved location follows the dotbot symlink into the git
    # checkout, silently making the repo the copy target for private transcripts.
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    if not env:
        raise SystemExit(
            "CLAUDE_CONFIG_DIR is not set; the copy target cannot be derived "
            "from the script location.\n"
            "Run this skill from the z.ai Claude config, which sets "
            "CLAUDE_CONFIG_DIR to its config root."
        )
    return Path(env).expanduser().resolve()


def config_dirs() -> ConfigDirs:
    source = DEFAULT_SOURCE_CONFIG_DIR.expanduser().resolve()
    target = z_ai_config_dir()
    if source == target:
        raise SystemExit(
            f"source and target config dirs are identical: {source}\n"
            "Run this skill from the z.ai Claude config."
        )
    return ConfigDirs(source=source, target=target)


def encode_project_path(cwd: Path) -> str:
    # [LAW:one-source-of-truth] Claude project state is keyed by the absolute cwd slug.
    return re.sub(r"[/.]", "-", str(cwd.resolve()))


def project_dir_from_transcripts(projects_dir: Path, cwd: Path) -> Path | None:
    matches: list[Path] = []
    cwd_s = str(cwd.resolve())
    for project_dir in projects_dir.iterdir() if projects_dir.is_dir() else ():
        if not project_dir.is_dir():
            continue
        for path in project_dir.glob("*.jsonl"):
            for event in iter_jsonl(path):
                if event.get("cwd") == cwd_s:
                    matches.append(project_dir)
                    break
            if matches and matches[-1] == project_dir:
                break
    return max(matches, key=lambda p: p.stat().st_mtime) if matches else None


def project_scope(cwd: Path, dirs: ConfigDirs) -> ProjectScope:
    slug = encode_project_path(cwd)
    source_dir = dirs.source / "projects" / slug
    found = source_dir if source_dir.is_dir() else project_dir_from_transcripts(dirs.source / "projects", cwd)
    if found is None:
        raise SystemExit(
            f"no Claude source sessions found for {cwd.resolve()}\n"
            f"tried: {source_dir}"
        )
    return ProjectScope(
        cwd=cwd.resolve(),
        slug=found.name,
        source_dir=found,
        target_dir=dirs.target / "projects" / found.name,
    )


def iter_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                yield value


def text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return ""


def event_message(event: dict[str, Any]) -> Message | None:
    # [LAW:single-enforcer] Transcript schema tolerance stays at the parse boundary.
    if event.get("type") not in MESSAGE_TYPES or event.get("isMeta"):
        return None
    message = event.get("message")
    if not isinstance(message, dict):
        return None
    text = text_from_content(message.get("content")).strip()
    if not text:
        return None
    role = str(message.get("role") or event.get("type"))
    timestamp = event.get("timestamp") if isinstance(event.get("timestamp"), str) else None
    uuid = event.get("uuid") if isinstance(event.get("uuid"), str) else None
    return Message(role=role, timestamp=timestamp, uuid=uuid, text=text)


def event_title(event: dict[str, Any]) -> str | None:
    title = event.get("aiTitle")
    return title.strip() if isinstance(title, str) and title.strip() else None


def session_id_from_path(path: Path) -> str:
    return path.stem


def iso_from_mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).astimezone().isoformat(timespec="seconds")


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def target_state(source: Path, target: Path) -> str:
    if target.is_symlink():
        return "target-symlink"
    if not target.exists():
        return "missing"
    if not target.is_file():
        return "target-not-file"
    if source.stat().st_size != target.stat().st_size:
        return "exists-different"
    return "exists-same" if file_sha256(source) == file_sha256(target) else "exists-different"


def summarize_session(index: int, path: Path, target_dir: Path, recent_count: int) -> SessionReport:
    title: str | None = None
    messages: list[Message] = []
    last_event_at: str | None = None
    for event in iter_jsonl(path):
        title = event_title(event) or title
        timestamp = event.get("timestamp")
        if isinstance(timestamp, str):
            last_event_at = timestamp
        msg = event_message(event)
        if msg is not None:
            messages.append(msg)
    target = target_dir / path.name
    return SessionReport(
        index=index,
        session_id=session_id_from_path(path),
        source_path=path,
        target_path=target,
        target_state=target_state(path, target),
        size_bytes=path.stat().st_size,
        last_updated=iso_from_mtime(path),
        last_event_at=last_event_at,
        title=title,
        message_count=len(messages),
        recent_messages=tuple(messages[-recent_count:]),
    )


def recent_sessions(scope: ProjectScope, limit: int, recent_messages: int) -> list[SessionReport]:
    paths = sorted(scope.source_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        summarize_session(index, path, scope.target_dir, recent_messages)
        for index, path in enumerate(paths[:limit], start=1)
    ]


def compact_text(text: str, width: int) -> str:
    one_line = re.sub(r"\s+", " ", text).strip()
    return textwrap.shorten(one_line, width=width, placeholder="...")


def report_text(scope: ProjectScope, dirs: ConfigDirs, reports: list[SessionReport], width: int) -> str:
    lines = [
        f"cwd: {scope.cwd}",
        f"project_slug: {scope.slug}",
        f"source_project_dir: {scope.source_dir}",
        f"target_project_dir: {scope.target_dir}",
        f"source_config_dir: {dirs.source}",
        f"target_config_dir: {dirs.target}",
        "",
    ]
    for report in reports:
        lines.extend(
            [
                f"{report.index}. {report.session_id}",
                f"   last_updated: {report.last_updated}",
                f"   last_event_at: {report.last_event_at or 'unknown'}",
                f"   title: {report.title or 'untitled'}",
                f"   message_count: {report.message_count}",
                f"   size_bytes: {report.size_bytes}",
                f"   target_state: {report.target_state}",
                f"   source_path: {report.source_path}",
                f"   target_path: {report.target_path}",
                "   recent_messages:",
            ]
        )
        for message in report.recent_messages:
            prefix = f"      - {message.role}"
            stamp = f" {message.timestamp}" if message.timestamp else ""
            uuid = f" uuid={message.uuid}" if message.uuid else ""
            lines.append(f"{prefix}{stamp}{uuid}: {compact_text(message.text, width)}")
        lines.append("")
    return "\n".join(lines).rstrip()


def report_json(scope: ProjectScope, dirs: ConfigDirs, reports: list[SessionReport]) -> str:
    return json.dumps(
        {
            "cwd": str(scope.cwd),
            "project_slug": scope.slug,
            "source_project_dir": str(scope.source_dir),
            "target_project_dir": str(scope.target_dir),
            "source_config_dir": str(dirs.source),
            "target_config_dir": str(dirs.target),
            "sessions": [
                {
                    "index": r.index,
                    "session_id": r.session_id,
                    "source_path": str(r.source_path),
                    "target_path": str(r.target_path),
                    "target_state": r.target_state,
                    "size_bytes": r.size_bytes,
                    "last_updated": r.last_updated,
                    "last_event_at": r.last_event_at,
                    "title": r.title,
                    "message_count": r.message_count,
                    "recent_messages": [m.__dict__ for m in r.recent_messages],
                }
                for r in reports
            ],
        },
        indent=2,
        sort_keys=True,
    )


def resolve_session_id(scope: ProjectScope, session_id: str, recent_messages: int) -> SessionReport:
    for path in scope.source_dir.glob("*.jsonl"):
        if session_id_from_path(path) == session_id:
            return summarize_session(0, path, scope.target_dir, recent_messages)
    raise SystemExit(f"session not found in {scope.source_dir}: {session_id}")


def copy_session(report: SessionReport, replace: bool) -> str:
    state = report.target_state
    if state == "exists-same":
        return f"already copied: {report.target_path}"
    if state != "missing" and not replace:
        raise SystemExit(
            f"target is {state}: {report.target_path}\n"
            "Use --replace only after confirming the target copy should be overwritten."
        )
    if state in {"target-symlink", "target-not-file"}:
        raise SystemExit(f"unsafe target state {state}: {report.target_path}")
    report.target_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = report.target_path.with_name(f".{report.target_path.name}.tmp-{os.getpid()}")
    try:
        shutil.copy2(report.source_path, tmp, follow_symlinks=True)
        os.replace(tmp, report.target_path)
    finally:
        if tmp.exists():
            tmp.unlink()
    return f"copied: {report.source_path} -> {report.target_path}"


def positive_int(raw: str) -> int:
    value = int(raw)
    if value < 1:
        raise argparse.ArgumentTypeError(f"must be >= 1, got {value}")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="session_copy.py")
    sub = parser.add_subparsers(dest="command", required=True)

    list_p = sub.add_parser("list", help="print recent source sessions for a project")
    list_p.add_argument("project_path", help="absolute or relative project path")
    list_p.add_argument("--limit", type=positive_int, default=5)
    list_p.add_argument("--recent-messages", type=positive_int, default=5)
    list_p.add_argument("--message-width", type=positive_int, default=220)
    list_p.add_argument("--json", action="store_true")

    copy_p = sub.add_parser("copy", help="copy a selected source session into the target config dir")
    copy_p.add_argument("project_path", help="absolute or relative project path")
    copy_p.add_argument("session_id", help="session id from the list output")
    copy_p.add_argument("--recent-messages", type=positive_int, default=5)
    copy_p.add_argument("--replace", action="store_true")
    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    dirs = config_dirs()
    scope = project_scope(Path(args.project_path), dirs)
    if args.command == "list":
        reports = recent_sessions(scope, args.limit, args.recent_messages)
        if not reports:
            raise SystemExit(f"no session JSONL files found in {scope.source_dir}")
        print(report_json(scope, dirs, reports) if args.json else report_text(scope, dirs, reports, args.message_width))
        return 0
    if args.command == "copy":
        report = resolve_session_id(scope, args.session_id, args.recent_messages)
        print(copy_session(report, args.replace))
        print(f"session_id: {report.session_id}")
        print(f"target_path: {report.target_path}")
        return 0
    parser.error(f"unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
