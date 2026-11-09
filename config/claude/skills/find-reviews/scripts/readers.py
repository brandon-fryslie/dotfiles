"""Pure readings of Claude Code transcript rows into the facts find-reviews reports.

Nothing here touches the disk, the network or the clock. Every function takes rows
already read and returns values, so each one is tested on real row shapes without
mocks. [LAW:effects-at-boundaries]

A row is `(line number, event)`, as `iter_rows` in find-session's `_session_lib` yields it.
"""
from __future__ import annotations

import bisect
import json
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta

from review_record import Closed, Count, Excerpt, FoundPr, Merged, Open, Pending, Unresolved

Row = tuple[int, dict]

LEVELS = frozenset({"low", "medium", "high", "xhigh", "max"})
SYNTHETIC = "<synthetic>"  # the model name Claude Code writes on rows the harness authored itself


def timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value)


def text_of(row: dict) -> str:
    """The text a message carries: its string content, or its text blocks joined."""
    content = (row.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    return "\n".join(b.get("text", "") for b in content or [] if isinstance(b, dict) and b.get("type") == "text")


def is_prompt(row: dict) -> bool:
    """A message a person (or an agent speaking for one) typed: user text that is not a tool result."""
    if row.get("type") != "user" or row.get("isMeta"):
        return False
    content = (row.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    blocks = [b for b in content or [] if isinstance(b, dict)]
    return any(b.get("type") == "text" for b in blocks) and not any(b.get("type") == "tool_result" for b in blocks)


# --- launches --------------------------------------------------------------------------

FORKED_SKILL_LAUNCH = re.compile(r"<forked-skill-launch>(\{.*?\})</forked-skill-launch>", re.S)


@dataclass(frozen=True)
class Forked:
    """A review run in its own subagent; its answer is in that subagent's transcript."""
    agent_id: str
    path: str
    line: int
    at: datetime
    branch: str | None
    level: str | None


@dataclass(frozen=True)
class Inline:
    """A review run inside the thread that launched it; its answer follows the launch in that thread."""
    path: str
    line: int
    at: datetime
    branch: str | None
    level: str | None
    args: str


@dataclass(frozen=True)
class Interrupted:
    """A review whose launch never returned: the Skill call left no launch record, yet the review's
    subagent started. Whatever its transcript holds, it handed no answer back."""
    agent_id: str
    path: str
    line: int
    at: datetime
    branch: str | None
    level: str | None


Launch = Forked | Inline | Interrupted


@dataclass(frozen=True)
class AgentLaunch:
    """Any row that starts a subagent, which is what ties a nested review to its session's main thread."""
    agent_id: str
    path: str
    line: int
    description: str | None


def level_of(args: str) -> str | None:
    words = args.split()
    return words[0].lower() if words and words[0].lower() in LEVELS else None


def _tool_use_id(row: dict) -> str | None:
    content = (row.get("message") or {}).get("content")
    for b in content if isinstance(content, list) else []:
        if isinstance(b, dict) and b.get("type") == "tool_result":
            return b.get("tool_use_id")
    return None


def skill_calls(rows: Iterable[Row]) -> dict[str, dict]:
    """The input of every code-review Skill call in a transcript, by tool-use id."""
    calls: dict[str, dict] = {}
    for _, row in rows:
        if row.get("type") != "assistant":
            continue
        for b in (row.get("message") or {}).get("content") or []:
            if (isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == "Skill"
                    and (b.get("input") or {}).get("skill") == "code-review"):
                calls[b["id"]] = b["input"]
    return calls


@dataclass(frozen=True)
class ReviewCall:
    """A code-review Skill call where it was made; its launch record, if any, names its id."""
    tool_use_id: str
    path: str
    line: int
    at: datetime
    branch: str | None
    level: str | None


def review_calls(path: str, rows: Iterable[Row]) -> list[ReviewCall]:
    return [ReviewCall(b["id"], path, line, timestamp(row["timestamp"]), row.get("gitBranch"),
                       level_of((b.get("input") or {}).get("args", "")))
            for line, row in rows if row.get("type") == "assistant" and row.get("timestamp")
            for b in (row.get("message") or {}).get("content") or []
            if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == "Skill"
            and (b.get("input") or {}).get("skill") == "code-review"]


def launched_call(row: dict) -> str | None:
    """The tool-use id of the Skill call a code-review launch record answers."""
    result = row.get("toolUseResult")
    return _tool_use_id(row) if isinstance(result, dict) and result.get("commandName") == "code-review" else None


# How the code-review skill opens the subagent it forks: its target line, or the recipe header alone.
REVIEW_OPENING = re.compile(r"\A(?:Review target: `|`(?:low|medium|high|xhigh|max) effort →)")
INTERRUPT_WINDOW = timedelta(seconds=1)


def pair_interrupted(calls: Iterable[ReviewCall], unlaunched: Iterable["AgentHead"]) -> list[Interrupted]:
    """Interrupted reviews: each call that left no launch record, paired with the review subagent
    nothing launched that started within a second after it, nearest first and one to one.

    The pair is two records of kinds that each exist only for an interrupted review, written
    milliseconds apart, so timing alone is not what links them. [LAW:no-silent-failure]
    """
    candidates = sorted(((head.started - call.at, call, head) for call in calls for head in unlaunched
                         if timedelta(0) <= head.started - call.at <= INTERRUPT_WINDOW
                         and REVIEW_OPENING.match(head.prompt)), key=lambda c: c[0])
    paired, used_calls, used_heads = [], set(), set()
    for _, call, head in candidates:
        if call.tool_use_id in used_calls or head.agent_id in used_heads:
            continue
        used_calls.add(call.tool_use_id)
        used_heads.add(head.agent_id)
        paired.append(Interrupted(head.agent_id, call.path, call.line, call.at, call.branch, call.level))
    return paired


def _forked_skill_launch(row: dict) -> dict | None:
    """The payload of a slash command the user typed that forked a skill into a subagent."""
    if row.get("type") != "system" or row.get("subtype") != "local_command":
        return None
    match = FORKED_SKILL_LAUNCH.search(row.get("content") or "")
    return json.loads(match.group(1)) if match else None


def parse_launch(path: str, line: int, row: dict, calls: Mapping[str, dict]) -> Launch | None:
    """A code-review launch in any of its three recorded shapes, or None for every other row.

    A review is its launch record, never the label on a subagent: foreground runs have no
    label, and an Agent wrapper labelled `/code-review` is not itself a review.
    [LAW:one-source-of-truth]
    """
    at = timestamp(row["timestamp"]) if row.get("timestamp") else None
    branch = row.get("gitBranch")
    result = row.get("toolUseResult")
    if row.get("type") == "user" and isinstance(result, dict) and result.get("commandName") == "code-review" and at:
        args = (calls.get(_tool_use_id(row) or "") or {}).get("args", "")
        if isinstance(result.get("agentId"), str):
            return Forked(result["agentId"], path, line, at, branch, level_of(args))
        return Inline(path, line, at, branch, level_of(args), args)
    typed = _forked_skill_launch(row)
    if typed and typed.get("skillName") == "code-review" and isinstance(typed.get("agentId"), str) and at:
        command = (typed.get("description") or "").removeprefix("/code-review")
        return Forked(typed["agentId"], path, line, at, branch, level_of(command))
    return None


def parse_agent_launch(path: str, line: int, row: dict) -> AgentLaunch | None:
    result = row.get("toolUseResult")
    if isinstance(result, dict) and isinstance(result.get("agentId"), str):
        return AgentLaunch(result["agentId"], path, line, result.get("description"))
    typed = _forked_skill_launch(row)
    if typed and isinstance(typed.get("agentId"), str):
        return AgentLaunch(typed["agentId"], path, line, typed.get("description"))
    return None


# --- targets ---------------------------------------------------------------------------

# What a review was pointed at, by how it finds its PR. `/code-review` takes `<pr#>|<branch>|<path>`;
# launches also pass commits, ranges and prose, which all mean code in the launching checkout.
# [LAW:one-type-per-behavior] one type per way of finding the PR, not per spelling.

@dataclass(frozen=True)
class PrTarget:
    """A PR number, unless no PR has it: then it is an all-digit commit hash."""
    number: int


@dataclass(frozen=True)
class BranchOrPathTarget:
    """The `<branch>` or relative `<path>` of the signature. The two are spelled alike
    (`src/config`, `fix/stall`), so only a PR whose head carries the name makes it a branch."""
    name: str


@dataclass(frozen=True)
class PathTarget:
    """An absolute path. Git forbids a branch name that starts with `/`, so it is a path,
    and one outside this repository is a review of some other repository's code."""
    path: str


@dataclass(frozen=True)
class CheckoutTarget:
    """Code in the launching checkout: no target (empty text), a commit, a range, or prose."""
    text: str


Target = PrTarget | BranchOrPathTarget | PathTarget | CheckoutTarget

REVIEW_TARGET = re.compile(r"\AReview target: `(.*?)`", re.S)
PR_REFERENCE = re.compile(r"(?:PR\s*#?|#|https?://\S+?/pull/)?(\d+)\b", re.I)


def review_target_text(first_row: dict) -> str:
    """The target a forked review was handed, from its own first message; empty when it was handed none."""
    match = REVIEW_TARGET.match(text_of(first_row))
    return match.group(1) if match else ""


def args_target_text(args: str) -> str:
    """The target in an inline review's Skill args: the args minus the level word and the flags."""
    rest = re.sub(r"--max-findings\s+\S+|--[\w-]+(?:=\S+)?", " ", args).split()
    return " ".join(rest[1:] if rest and rest[0].lower() in LEVELS else rest)


def parse_target(text: str) -> Target:
    t = text.strip().lstrip("—–-: ")
    pr = PR_REFERENCE.match(t)
    if pr:
        return PrTarget(int(pr.group(1)))
    first = t.split()[0] if t else ""
    if first.startswith("/"):
        return PathTarget(first)
    if ".." not in first and re.fullmatch(r"\w[\w./-]*", first) and re.search(r"[./-]", first):
        return BranchOrPathTarget(first.removeprefix("origin/"))
    return CheckoutTarget(t)


# --- PRs and tickets -------------------------------------------------------------------

PR_IN_DESCRIPTION = re.compile(r"\bPR\s*#?(\d+)", re.I)
TICKET_ID = r"[a-z0-9][\w-]*\.[a-z0-9]+(?:\.[a-z0-9]+)*"
TICKET_IN_TITLE = re.compile(rf"\(({TICKET_ID})\)\s*$")


@dataclass(frozen=True)
class PrInfo:
    number: int
    title: str
    head: str
    created: datetime
    pr: FoundPr


def parse_pr(p: dict) -> PrInfo:
    """One entry of `gh pr list --json number,url,title,headRefName,createdAt,state,mergedAt,closedAt`."""
    match p["state"]:
        case "MERGED":
            outcome = Merged(p["mergedAt"])
        case "CLOSED":
            outcome = Closed(p["closedAt"])
        case "OPEN":
            outcome = Open()
        case other:
            raise ValueError(f"PR {p['number']} is in a state this tool does not know: {other}")
    return PrInfo(p["number"], p["title"], p["headRefName"], timestamp(p["createdAt"]),
                  FoundPr(p["number"], p["url"], outcome))


def ticket_candidates(info: PrInfo) -> list[str]:
    """The lit tickets a PR may be for, strongest evidence first: its title's trailing parentheses,
    as this project titles PRs, then its head branch, which a lane names after its ticket.
    Each is only a candidate until lit knows it."""
    named = TICKET_IN_TITLE.search(info.title)
    found = ([named.group(1)] if named else []) + ([info.head] if re.fullmatch(TICKET_ID, info.head) else [])
    return list(dict.fromkeys(found))


def pr_for_branch(prs: Iterable[PrInfo], branch: str, at: datetime) -> PrInfo | Unresolved:
    """The PR opened from a branch: the latest opened by the review's time, else the first opened after."""
    opened = sorted((p for p in prs if p.head == branch), key=lambda p: p.created)
    if not opened:
        return Unresolved(f"no PR has head branch {branch}")
    before = [p for p in opened if p.created <= at]
    return before[-1] if before else opened[0]


def resolve_pr(prs: tuple[PrInfo, ...], target: Target, branch: str | None, wrapper: str | None,
               at: datetime, project: str) -> PrInfo | Unresolved:
    """The PR a review read.

    A target that names a PR, or a branch some PR has as its head, is the evidence. Every other
    target is code in the launching checkout. Then the job the launching agent was handed (its
    description, e.g. "High review of PR 694") names the PR, and only then the checkout's own
    branch, which is often a local name like `t2yz-fix` that no PR has as its head.
    """
    by_number = {p.number: p for p in prs}
    named = PR_IN_DESCRIPTION.search(wrapper or "")
    described = by_number.get(int(named.group(1))) if named else None

    def checkout(given: str) -> PrInfo | Unresolved:
        if described:
            return described
        if not branch or branch == "HEAD":
            return Unresolved(f"{given}, and the launching checkout was on a detached HEAD")
        return pr_for_branch(prs, branch, at)

    match target:
        case PrTarget(number):
            return by_number.get(number) or checkout(f"{number} is no PR here, so it is a commit")
        case BranchOrPathTarget(name):
            headed = pr_for_branch(prs, name, at)
            return headed if isinstance(headed, PrInfo) else checkout(f"no PR has head branch {name}, so it is a path")
        case PathTarget(path):
            inside = path == project or path.startswith(project.rstrip("/") + "/")
            return checkout(f"target {path}") if inside else Unresolved(f"target {path} is outside this repository")
        case CheckoutTarget(""):
            return checkout("no target given")
        case CheckoutTarget(text):
            return checkout(f"target {text!r} names no PR")


# --- answers ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Findings:
    """What a review answered: its count (or the excerpt that settles it) and a key per finding."""
    count: Count | Pending
    keys: tuple[str, ...]


@dataclass(frozen=True)
class NoAnswer:
    why: str


Answer = Findings | NoAnswer

FENCED_ARRAY = re.compile(r"```(?:json)?[ \t]*\n(\[.*?\])\s*\n```", re.S)
KEY_LENGTH = 40
KEY_MINIMUM = 20


def finding_key(text: str) -> str:
    """A finding's identity across transcripts: its first alphanumerics, lowercased.

    Quoting a finding into another agent's prompt re-escapes it as JSON and reflows its
    markdown; only its letters and digits survive both, so those are what get compared.
    """
    return finding_key_space(text)[:KEY_LENGTH]


def finding_key_space(text: str) -> str:
    """A text reduced the way `finding_key` reduces a finding, without the length cut."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def json_findings(text: str) -> list[dict] | None:
    fenced = FENCED_ARRAY.search(text)
    candidate = fenced.group(1) if fenced else text.strip()
    if not candidate.startswith("["):
        return None
    try:
        value = json.loads(candidate)
    except ValueError:
        return None
    return value if isinstance(value, list) and all(isinstance(v, dict) for v in value) else None


def read_answer(path: str, rows: list[Row], stopped_by_user: bool) -> Answer:
    if stopped_by_user:
        return NoAnswer("stopped by user")
    assistant = [(line, row) for line, row in rows if row.get("type") == "assistant"]
    if not assistant:
        return NoAnswer("no answer in its transcript")
    line, final = assistant[-1]
    text = text_of(final).strip()
    if (final.get("message") or {}).get("model") == SYNTHETIC:
        return NoAnswer(text.splitlines()[0] if text else "cut off by the harness")
    if not text:
        return NoAnswer("ended without an answer")
    items = json_findings(text)
    if items is not None:
        keys = tuple(k for k in (finding_key(i["summary"]) for i in items if isinstance(i.get("summary"), str))
                     if len(k) >= KEY_MINIMUM)
        return Findings(Count(len(items)), keys)
    if text.startswith("(none)"):
        return Findings(Count(0), ())
    return Findings(Pending(Excerpt("review answer", path, line, line)), ())


def inline_answer_range(rows: list[Row], launch_line: int) -> tuple[int, int]:
    """An inline review's answer: from its launch to the line before the thread's next prompt."""
    after = [line for line, row in rows if line > launch_line and is_prompt(row)]
    last = (after[0] - 1) if after else rows[-1][0]
    return launch_line, max(launch_line, last)


def models(rows: Iterable[Row]) -> tuple[str, ...]:
    """The models that wrote these rows, in order of first appearance; the harness is not a model."""
    seen: dict[str, None] = {}
    for _, row in rows:
        model = (row.get("message") or {}).get("model") if row.get("type") == "assistant" else None
        if isinstance(model, str) and model != SYNTHETIC:
            seen.setdefault(model)
    return tuple(seen)


# --- triage ----------------------------------------------------------------------------

@dataclass(frozen=True)
class AgentHead:
    """A subagent's identity, when it started, and the prompt it was given."""
    agent_id: str
    path: str
    started: datetime
    prompt: str


def link_triage(review_ended: datetime, keys: tuple[str, ...], agents: Iterable[AgentHead]) -> AgentHead | None:
    """The triage of a review: the earliest later subagent whose prompt quotes one of its findings.

    Linked by quoted content, not timing, because timing cannot tell a triage from the
    fix agent that follows it; a triage is handed the findings, so its prompt carries them.
    """
    def quotes(prompt: str) -> bool:
        space = finding_key_space(prompt)
        return any(k in space for k in keys)

    quoting = [a for a in agents if a.started > review_ended and quotes(a.prompt)]
    return min(quoting, key=lambda a: a.started) if quoting else None


VERDICT_WORD = re.compile(r"\b(accept|fix|reject|defer|repeat|duplicate|declin|no change|not a finding)", re.I)
SEPARATOR_CELL = re.compile(r":?-{2,}:?")


def _cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _tables(text: str) -> list[list[list[str]]]:
    tables: list[list[list[str]]] = []
    current: list[list[str]] = []
    for line in text.splitlines():
        if line.lstrip().startswith("|"):
            current.append(_cells(line))
        elif current:
            tables.append(current)
            current = []
    if current:
        tables.append(current)
    return tables


def read_verdicts(text: str, findings: int) -> int | None:
    """How many of `findings` a triage accepted, read from its verdict table, or None if it can't be read.

    The table is the first one with a Verdict column. It must give exactly one verdict to
    each finding 1..N and every verdict must classify, or the whole table is unread:
    a partly counted table would report a number nobody gave. Accept and fix both count
    as accepted, a partial acceptance included; reject, defer, repeat and decline do not.
    """
    for table in _tables(text):
        header = [c.lower() for c in table[0]]
        verdict_column = next((i for i, c in enumerate(header) if "verdict" in c), None)
        if verdict_column is None:
            continue
        verdicts: dict[int, str] = {}
        for cells in table[1:]:
            if all(SEPARATOR_CELL.fullmatch(c) for c in cells if c):
                continue
            number = re.fullmatch(r"[*#\s]*(\d+)[*\s]*", cells[0]) if cells else None
            if number is None or verdict_column >= len(cells):
                return None
            verdicts.setdefault(int(number.group(1)), cells[verdict_column])
        if set(verdicts) != set(range(1, findings + 1)):
            return None
        words = [VERDICT_WORD.search(v) for v in verdicts.values()]
        if not all(words):
            return None
        return sum(1 for w in words if w.group(1).lower() in ("accept", "fix"))
    return None


def written_before_close(texts: Iterable[tuple[int, datetime, str]], outcome: Merged | Closed | Open) -> list[int]:
    """The last line written before a PR merged or closed, as an end for the thread its triage
    sits in; an open PR gives no such end. Line 0 when nothing was written before the close."""
    match outcome:
        case Merged(at) | Closed(at):
            closed = timestamp(at)
            return [max((n for n, written, _ in texts if written <= closed), default=0)]
        case Open():
            return []


def verdicts_in(texts: Iterable[tuple[int, str]], findings: int) -> int | None:
    """The accepted count from the first message in a thread whose verdict table reads whole."""
    return next((n for n in (read_verdicts(text, findings) for _, text in texts) if n is not None), None)


# --- logical sessions ------------------------------------------------------------------

CLEAR_WINDOW_MS = 1000


def link_clears(history: Iterable[tuple[str, int]], clears: Iterable[tuple[str, int]]) -> dict[str, str]:
    """Pair each session that began with `/clear` with the session that `/clear` ended.

    Claude Code's prompt history records a `/clear` under the session it clears, and the
    new session's transcript opens with its own `/clear` row stamped within milliseconds.
    Nearest-in-time pairs win, each session used once, so two sessions cleared seconds
    apart in one folder are never crossed. Returns {new session: the session it continues}.
    """
    entries = sorted((ms, old) for old, ms in history)
    times = [ms for ms, _ in entries]
    candidates = []
    for new, ms in clears:
        lo = bisect.bisect_left(times, ms - CLEAR_WINDOW_MS)
        hi = bisect.bisect_right(times, ms + CLEAR_WINDOW_MS)
        candidates.extend((abs(times[i] - ms), new, entries[i][1]) for i in range(lo, hi) if entries[i][1] != new)
    links: dict[str, str] = {}
    used: set[str] = set()
    for _, new, old in sorted(candidates):
        if new not in links and old not in used:
            links[new] = old
            used.add(old)
    return links


def chain_order(links: Mapping[str, str], session: str) -> list[str]:
    """Every physical session of a session's chain, first to last."""
    successor = {old: new for new, old in links.items()}
    ordered = [chain_roots(links).get(session, session)]
    while ordered[-1] in successor:
        ordered.append(successor[ordered[-1]])
    return ordered


def chain_roots(links: Mapping[str, str]) -> dict[str, str]:
    """The first physical session of every linked session's chain, which names the logical session."""
    def root(session: str) -> str:
        while session in links:
            session = links[session]
        return session
    return {s: root(s) for s in {*links, *links.values()}}


# --- excerpts --------------------------------------------------------------------------

def _describe_call(block: dict) -> str:
    given = block.get("input") or {}
    command = (given.get("command") or "").strip()
    detail = (given.get("description")
              or " ".join(filter(None, [given.get("skill"), given.get("args")]))
              or (command.splitlines()[0] if command else ""))
    return f"(tool call: {block.get('name')} — {detail})" if detail else f"(tool call: {block.get('name')})"


def render_excerpt(rows: Iterable[Row]) -> str:
    """Messages as plain text, each headed `[line N] role:`; tool calls named, tool results left out.

    A triage verdict or an inline review's answer lives in what the model wrote, so that
    is what an excerpt carries. Tool output would bury it and hold nothing to count.
    """
    out = []
    for line, row in rows:
        role = row.get("type")
        if role not in ("user", "assistant") or row.get("isMeta"):
            continue
        content = (row.get("message") or {}).get("content")
        parts = [content] if isinstance(content, str) else [
            b.get("text", "") if b.get("type") == "text" else _describe_call(b)
            for b in content or [] if isinstance(b, dict) and b.get("type") in ("text", "tool_use")
        ]
        parts = [p for p in parts if p.strip()]
        if parts:
            out.append(f"[line {line}] {role}:\n" + "\n".join(parts))
    return "\n\n".join(out)
