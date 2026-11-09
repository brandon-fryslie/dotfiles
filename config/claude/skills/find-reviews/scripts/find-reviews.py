#!/usr/bin/env python3
"""Step 1 of find-reviews: gather the code reviews in scope into the intermediate document.

    find-reviews.py [--session ID] [--since ISO] [--until ISO] [-o FILE]

The project is the git repository the command runs in, with its worktrees. Scope is
a logical session (every physical session chained to ID by /clear) or a time window
on review launches; with neither, the last 72 hours. Values that need judgment are
left pending, each with the excerpt that settles it. A run record goes to stderr.

Effects live here and only here: reading transcripts, asking gh and lit, writing the
document. Every reading in between is a pure function in readers.py and assembly.py.
[LAW:effects-at-boundaries]
"""
from __future__ import annotations

import argparse
import functools
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import readers as rd
from assembly import Placed, assemble, thread_after
from review_record import (
    Answered, Count, CountGap, Excerpt, FoundTicket, Pending, Pr, SummaryGap, SummaryPending, Tally, Ticket,
    Unanswered, Unresolved, dump_document, gaps, parse_document,
)
from transcript_lib import iter_rows, projects_root, slug_for

DEFAULT_WINDOW = timedelta(hours=72)
LAUNCH_NEEDLES = (b"code-review", b"agentId")


class GatherError(Exception):
    """The run cannot produce a true document; the message says what failed and where."""


# --- scope -----------------------------------------------------------------------------

def when(value: str) -> datetime:
    """An ISO 8601 instant; one without an offset is local time."""
    try:
        moment = datetime.fromisoformat(value)
    except ValueError as e:
        raise argparse.ArgumentTypeError(f"not an ISO 8601 time: {value!r} ({e})")
    return moment if moment.tzinfo else moment.astimezone()


@dataclass(frozen=True)
class Window:
    since: datetime | None
    until: datetime | None

    def admits(self, at: datetime) -> bool:
        return (self.since is None or at >= self.since) and (self.until is None or at < self.until)


def window_of(args: argparse.Namespace) -> Window:
    """The listing is always limited: no session and no time means the last 72 hours."""
    if args.session and not (args.since or args.until):
        return Window(None, None)
    until = args.until
    since = args.since or (until or datetime.now().astimezone()) - DEFAULT_WINDOW
    return Window(since, until)


@dataclass(frozen=True)
class Session:
    id: str
    main: Path

    @property
    def subagents(self) -> Path:
        return self.main.with_suffix("") / "subagents"

    def files(self) -> list[Path]:
        return [self.main, *sorted(self.subagents.glob("*.jsonl"))]


def project_root() -> Path:
    run = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                         capture_output=True, text=True)
    if run.returncode != 0:
        raise GatherError(f"not inside a git repository: {run.stderr.strip()}")
    return Path(run.stdout.strip()).parent


def project_sessions(root: Path) -> list[Session]:
    """Every session of the project: its main checkout's and its worktrees' transcript folders."""
    slug = slug_for(root)
    base = projects_root()
    if not base.is_dir():
        raise GatherError(f"no transcripts folder at {base}")
    folders = [d for d in base.iterdir()
               if d.is_dir() and (d.name == slug or d.name.startswith(slug + "--claude-worktrees-"))]
    return [Session(f.stem, f) for d in folders for f in sorted(d.glob("*.jsonl"))]


# --- logical sessions ------------------------------------------------------------------

def opening_clear(session: Session) -> tuple[str, int] | None:
    """When a session began with /clear, the moment of that /clear, read from its opening rows."""
    for _, row in iter_rows(session.main):
        if row.get("type") == "assistant":
            return None
        if row.get("type") == "user" and rd.text_of(row).lstrip().startswith("<command-name>/clear</command-name>"):
            return session.id, int(rd.timestamp(row["timestamp"]).timestamp() * 1000)
    return None


def history_clears() -> list[tuple[str, int]]:
    history = projects_root().parent / "history.jsonl"
    if not history.is_file():
        raise GatherError(f"no prompt history at {history}, so sessions linked by /clear cannot be found")
    return [(row["sessionId"], int(row["timestamp"]))
            for _, row in iter_rows(history, b'"/clear"')
            if row.get("display") == "/clear" and isinstance(row.get("sessionId"), str)
            and isinstance(row.get("timestamp"), int)]


# --- PRs and tickets -------------------------------------------------------------------

class Resolver:
    """Every outside lookup, each made at most once: one gh call for all PRs, one lit call per ticket."""

    def __init__(self, root: Path):
        self.root = root
        run = subprocess.run(
            ["gh", "pr", "list", "--state", "all", "--limit", "5000",
             "--json", "number,url,title,headRefName,createdAt,state,mergedAt,closedAt"],
            cwd=root, capture_output=True, text=True)
        if run.returncode != 0:
            raise GatherError(f"gh pr list failed in {root}: {run.stderr.strip()}")
        try:
            self.prs = tuple(rd.parse_pr(p) for p in json.loads(run.stdout))
        except ValueError as e:
            raise GatherError(f"gh pr list returned what this tool cannot read: {e}")
        self.tickets: dict[str, Ticket] = {}

    def pr(self, target: rd.Target, branch: str | None, wrapper: str | None, at: datetime) -> rd.PrInfo | Unresolved:
        return rd.resolve_pr(self.prs, target, branch, wrapper, at, str(self.root))

    def ticket(self, info: rd.PrInfo) -> Ticket:
        candidates = rd.ticket_candidates(info)
        if not candidates:
            return Unresolved(f"neither the title nor the head branch of PR {info.number} names a ticket")
        checked = []
        for ticket_id in candidates:
            checked.append(self.lit_ticket(ticket_id))
            if isinstance(checked[-1], FoundTicket):
                return checked[-1]
        return checked[0]

    def lit_ticket(self, ticket_id: str) -> Ticket:
        if ticket_id not in self.tickets:
            run = subprocess.run(["lit", "show", ticket_id, "--field", "title"],
                                 cwd=self.root, capture_output=True, text=True)
            said = run.stderr.strip().splitlines()
            self.tickets[ticket_id] = (
                FoundTicket(ticket_id, SummaryPending(f"lit show {ticket_id} --field description"))
                if run.returncode == 0 else
                Unresolved(f"lit show {ticket_id} failed: {said[0] if said else f'exit {run.returncode}'}"))
        return self.tickets[ticket_id]


# --- gather ----------------------------------------------------------------------------

@dataclass(frozen=True)
class Read:
    """One review as read from its transcript, before its PR is known."""
    launch: rd.Launch
    session: Session
    outer: tuple[Path, int]
    target: rd.Target
    wrapper: str | None
    models: tuple[str, ...]
    answer: rd.Answer
    verdict: Tally | None  # read from a linked triage; None when no triage quotes the review


class Transcripts:
    """Reads each transcript at most once, and remembers what each one launched."""

    def __init__(self):
        self.rows: dict[Path, list[rd.Row]] = {}
        self.texts: dict[Path, list[tuple[int, datetime, str]]] = {}
        self.launches: dict[str, rd.AgentLaunch] = {}
        self.heads: dict[Path, list[rd.AgentHead]] = {}
        self.orphans: list[rd.AgentHead] = []

    def all_rows(self, path: Path) -> list[rd.Row]:
        if path not in self.rows:
            self.rows[path] = list(iter_rows(path))
        return self.rows[path]

    def assistant_texts(self, path: Path) -> list[tuple[int, datetime, str]]:
        """What the model wrote in a transcript, by line and time. Kept as text alone, because
        main threads run to hundreds of megabytes and only their prose can hold a verdict."""
        if path not in self.texts:
            self.texts[path] = [(n, rd.timestamp(row["timestamp"]), text)
                                for n, row in iter_rows(path, b'"type":"assistant"')
                                if row.get("type") == "assistant" and row.get("timestamp")
                                and (text := rd.text_of(row).strip())]
        return self.texts[path]

    def scan(self, session: Session) -> list[rd.Launch]:
        found, calls, answered = [], [], set()
        for path in session.files():
            rows = list(iter_rows(path, *LAUNCH_NEEDLES))
            inputs = rd.skill_calls(rows)
            calls += rd.review_calls(str(path), rows)
            for line, row in rows:
                launch = rd.parse_launch(str(path), line, row, inputs)
                if launch:
                    found.append(launch)
                answered.add(rd.launched_call(row))
                agent = rd.parse_agent_launch(str(path), line, row)
                if agent:
                    self.launches[agent.agent_id] = agent
        launched = {launch.agent_id for launch in found if isinstance(launch, rd.Forked)}
        unlaunched = [h for h in self.agent_heads(session) if h.agent_id not in launched]
        interrupted = rd.pair_interrupted((c for c in calls if c.tool_use_id not in answered), unlaunched)
        paired = {i.agent_id for i in interrupted}
        # A review subagent no record launches and no call explains is reported, never dropped. [LAW:nothing-unseen]
        self.orphans += [h for h in unlaunched if rd.REVIEW_OPENING.match(h.prompt) and h.agent_id not in paired]
        return found + interrupted

    def outer(self, session: Session, path: Path, line: int) -> tuple[Path, int]:
        """The main-thread row that led to a launch: climb from each subagent to the row that launched it."""
        while path != session.main:
            agent_id = path.stem.removeprefix("agent-")
            launch = self.launches.get(agent_id)
            if launch is None:
                raise GatherError(f"{path}: no row in session {session.id} launches subagent {agent_id}")
            path, line = Path(launch.path), launch.line
        return path, line

    def agent_heads(self, session: Session) -> list[rd.AgentHead]:
        if session.subagents not in self.heads:
            heads = []
            for path in sorted(session.subagents.glob("agent-*.jsonl")):
                first = next(iter_rows(path), None)
                if first and first[1].get("timestamp"):
                    heads.append(rd.AgentHead(path.stem.removeprefix("agent-"), str(path),
                                              rd.timestamp(first[1]["timestamp"]), rd.text_of(first[1])))
            self.heads[session.subagents] = heads
        return self.heads[session.subagents]


def final_text_row(rows: list[rd.Row]) -> rd.Row | None:
    texts = [(line, row) for line, row in rows if row.get("type") == "assistant" and rd.text_of(row).strip()]
    return texts[-1] if texts else None


def read_review(t: Transcripts, chain: list[Session], session: Session, launch: rd.Launch,
                reviews: set[str]) -> Read:
    outer = t.outer(session, Path(launch.path), launch.line)
    # A review launched from inside a subagent was handed its job by that subagent's own
    # launch, whose description often names the PR a diff-range target leaves unsaid.
    launcher = Path(launch.path)
    wrapper = (None if launcher == session.main
               else t.launches[launcher.stem.removeprefix("agent-")].description)
    match launch:
        case rd.Inline(path, line, _, _, _, args):
            rows = t.all_rows(Path(path))
            first, last = rd.inline_answer_range(rows, line)
            answer = rd.Findings(Pending(Excerpt("inline review", path, first, last)), ())
            return Read(launch, session, outer, rd.parse_target(rd.args_target_text(args)), wrapper,
                        rd.models((n, r) for n, r in rows if first <= n <= last), answer, None)
        case rd.Forked(agent_id) | rd.Interrupted(agent_id):
            # A review still running when its session is cleared finishes in the successor session's
            # files, so its transcript is its segments across the logical session, in order.
            segments = [p for s in chain if (p := s.subagents / f"agent-{agent_id}.jsonl").is_file()]
            if not segments:
                return Read(launch, session, outer, rd.CheckoutTarget(""), wrapper, (),
                            rd.NoAnswer(f"its transcript agent-{agent_id}.jsonl is in none of its sessions"), None)
            metas = [json.loads(m.read_text()) for p in segments if (m := p.with_suffix(".meta.json")).is_file()]
            rows = [row for p in segments for row in t.all_rows(p)]
            answering = [p for p in segments if final_text_row(t.all_rows(p))] or segments
            answer = (rd.NoAnswer("its launch was interrupted before the review returned")
                      if isinstance(launch, rd.Interrupted)
                      else rd.read_answer(str(answering[-1]), t.all_rows(answering[-1]),
                                          any(m.get("stoppedByUser") for m in metas)))
            return Read(launch, session, outer, rd.parse_target(rd.review_target_text(t.all_rows(segments[0])[0][1])),
                        wrapper, rd.models(rows), answer, read_triage(t, chain, rows, answer, reviews))


def read_triage(t: Transcripts, chain: list[Session], rows: list[rd.Row], answer: rd.Answer,
                reviews: set[str]) -> Tally | None:
    """The accepted count from the triage that quotes this review's findings, if one does."""
    match answer:
        case rd.Findings(Count(n), keys) if n > 0 and keys:
            ended = max(rd.timestamp(r["timestamp"]) for _, r in rows if r.get("timestamp"))
            heads = [h for s in chain for h in t.agent_heads(s) if h.agent_id not in reviews]
            triage = rd.link_triage(ended, keys, heads)
            if triage is None:
                return None
            final = final_text_row(t.all_rows(Path(triage.path)))
            if final is None:
                return None
            accepted = rd.read_verdicts(rd.text_of(final[1]), n)
            return (Count(accepted) if accepted is not None
                    else Pending(Excerpt("triage verdict", triage.path, final[0], final[0])))
    return None


@functools.cache
def last_line(path: Path) -> int:
    with path.open("rb") as f:
        return sum(1 for _ in f)


def place(reads: list[Read], resolver: Resolver, roots: dict[str, str], t: Transcripts) -> list[Placed]:
    resolved = [(r, resolver.pr(r.target, r.launch.branch, r.wrapper, r.launch.at)) for r in reads]

    def pr_key(info: rd.PrInfo | Unresolved) -> object:
        return info.number if isinstance(info, rd.PrInfo) else info

    def inline_triage(r: Read, info: rd.PrInfo | Unresolved, findings: Count | Pending) -> Tally:
        """With no triage subagent, the verdicts sit in the thread the review reported back to:
        its launcher's own transcript, up to that thread's next review of the same PR, or up
        to the PR's merge or close."""
        launcher = Path(r.launch.path)
        texts = t.assistant_texts(launcher)
        # A later review of the PR shows in this thread at its own launch, or at the launch
        # of the subagent it ran under when this thread is the main one.
        same_pr = [line for o, o_info in resolved if pr_key(o_info) == pr_key(info)
                   for path, line in ((Path(o.launch.path), o.launch.line), o.outer) if path == launcher]
        closing = rd.written_before_close(texts, info.pr.outcome) if isinstance(info, rd.PrInfo) else []
        first, last = thread_after(r.launch.line, same_pr, [last_line(launcher), *closing])
        if isinstance(findings, Count):
            within = [(n, text) for n, _, text in texts if first < n <= last]
            accepted = rd.verdicts_in(within, findings.n)
            if accepted is not None:
                return Count(accepted)
        return Pending(Excerpt("thread after review", str(launcher), first, last))

    placed = []
    for r, info in resolved:
        outer_path, outer_line = r.outer
        match r.answer:
            case rd.NoAnswer(why):
                result = Unanswered(why)
            case rd.Findings(Count(0) as none, _):
                result = Answered(none, Count(0))
            case rd.Findings(findings, _):
                result = Answered(findings, r.verdict or inline_triage(r, info, findings))
        pr: Pr = info.pr if isinstance(info, rd.PrInfo) else info
        ticket: Ticket = resolver.ticket(info) if isinstance(info, rd.PrInfo) else Unresolved("its PR is unresolved")
        review_id = (f"inline-{r.session.id}-{r.launch.line}" if isinstance(r.launch, rd.Inline)
                     else r.launch.agent_id)
        placed.append(Placed(review_id, r.launch.at, roots.get(r.session.id, r.session.id), pr, ticket,
                             r.launch.level, r.models, f"{outer_path}:{outer_line}", result))
    return placed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--session", help="a session id; its whole /clear chain is in scope")
    ap.add_argument("--since", type=when, help="ISO 8601; reviews launched at or after this")
    ap.add_argument("--until", type=when, help="ISO 8601; reviews launched before this")
    ap.add_argument("-o", "--output", type=Path, help="write the document here instead of stdout")
    args = ap.parse_args()
    window = window_of(args)

    root = project_root()
    sessions = project_sessions(root)
    links = rd.link_clears(history_clears(), filter(None, (opening_clear(s) for s in sessions)))
    roots = rd.chain_roots(links)
    by_id = {s.id: s for s in sessions}

    def chain(s: Session) -> list[Session]:
        return [by_id[i] for i in rd.chain_order(links, s.id) if i in by_id]

    def logical(s: Session) -> str:
        return roots.get(s.id, s.id)

    if args.session:
        named = [s for s in sessions if s.id == args.session]
        if not named:
            raise GatherError(f"no session {args.session} among {root}'s transcripts")
        sessions = [s for s in sessions if logical(s) == logical(named[0])]
    if window.since:
        cutoff = window.since.timestamp()
        sessions = [s for s in sessions if any(f.stat().st_mtime >= cutoff for f in s.files())]

    t = Transcripts()
    launched = [(s, launch) for s in sessions for launch in t.scan(s) if window.admits(launch.at)]
    review_ids = {launch.agent_id for _, launch in launched if isinstance(launch, (rd.Forked, rd.Interrupted))}
    reads = [read_review(t, chain(s), s, launch, review_ids) for s, launch in launched]
    orphans = [h for h in t.orphans if window.admits(h.started)]
    doc = assemble(place(reads, Resolver(root), roots, t))

    dumped = dump_document(doc)
    parse_document(dumped)  # the writer is held to the schema the readers enforce [LAW:single-enforcer]
    text = json.dumps(dumped, indent=2) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        sys.stdout.write(text)

    pending = [g for group in doc.groups for g in gaps(group)]
    tickets = {g.ticket.id for g in doc.groups if isinstance(g.ticket, FoundTicket)}

    def worklist(group) -> str:
        """One group's line in the run record: what the agent settles before formatting it."""
        ticket = group.ticket.id if isinstance(group.ticket, FoundTicket) else "ticket unresolved"
        todo = ["summary" if isinstance(g, SummaryGap) else f"{g.review.id} {g.field}" for g in gaps(group)]
        return f"    {group.id}  {ticket}  {len(group.reviews)} reviews  pending: {', '.join(todo) or 'none'}"
    scope = (f"session chain of {args.session}" if args.session else "all sessions") + (
        f", launched {window.since.isoformat() if window.since else 'any time'}"
        f" to {window.until.isoformat() if window.until else 'now'}" if window.since or window.until else "")
    print("\n".join([
        f"find-reviews: {root}",
        f"  scope: {scope}",
        f"  sessions read: {len(sessions)} physical, {len({logical(s) for s in sessions})} logical"
        + (f" ({', '.join(s.id for s in sessions)})" if args.session else ""),
        f"  reviews: {len(reads)} ({sum(isinstance(r.launch, rd.Inline) for r in reads)} inline,"
        f" {sum(isinstance(r.launch, rd.Interrupted) for r in reads)} interrupted)",
        *([f"  review transcripts nothing launched (not listed): {', '.join(h.path for h in orphans)}"]
          if orphans else []),
        f"  groups: {len(doc.groups)}; tickets to summarize: {len(tickets)}",
        f"  pending counts: {sum(isinstance(g, CountGap) and g.field == 'findings' for g in pending)} findings,"
        f" {sum(isinstance(g, CountGap) and g.field == 'accepted' for g in pending)} accepted",
        f"  document: {args.output or 'stdout'}",
        "  groups and what each still needs:",
        *map(worklist, doc.groups),
    ]), file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except GatherError as e:
        print(f"find-reviews: {e}", file=sys.stderr)
        sys.exit(2)
