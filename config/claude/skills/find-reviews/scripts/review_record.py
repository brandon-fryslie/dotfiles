"""The intermediate document find-reviews hands from gathering to formatting.

The gather step writes it, the excerpt step reads it, and the format step reads it
and applies the agent's fills in memory. Every one of them crosses `parse_document`
and `dump_document`, so the shape is enforced in exactly one place, and a value the
agent still has to settle is a distinct variant that nothing can render by accident.
[LAW:single-enforcer] [LAW:parse-dont-validate] [LAW:types-are-the-program]
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal, get_args

ExcerptSource = Literal["review answer", "triage verdict", "inline review", "thread after review"]
CountField = Literal["findings", "accepted"]


class RecordError(ValueError):
    """The document, or a fill applied to it, breaks the schema. The message names where."""


# --- counts --------------------------------------------------------------------------

@dataclass(frozen=True)
class Count:
    n: int


@dataclass(frozen=True)
class Excerpt:
    """The transcript lines a pending count must be judged from: a file and an inclusive range."""
    source: ExcerptSource
    path: str
    first: int
    last: int


@dataclass(frozen=True)
class Pending:
    excerpt: Excerpt


@dataclass(frozen=True)
class Unknown:
    """The agent read the excerpt and it does not settle the count."""
    why: str


Tally = Count | Pending | Unknown


# --- reviews ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Answered:
    findings: Tally
    accepted: Tally


@dataclass(frozen=True)
class Unanswered:
    """The review never returned an answer (stopped, or cut off by the harness), so it has no counts."""
    why: str


Result = Answered | Unanswered


@dataclass(frozen=True)
class Review:
    id: str
    n: int
    level: str | None
    models: tuple[str, ...]
    started: str
    transcript: str
    result: Result


# --- PRs and tickets -----------------------------------------------------------------

@dataclass(frozen=True)
class Merged:
    at: str


@dataclass(frozen=True)
class Closed:
    at: str


@dataclass(frozen=True)
class Open:
    pass


Outcome = Merged | Closed | Open


@dataclass(frozen=True)
class Unresolved:
    """A PR or ticket the gather step could not identify, and why."""
    why: str


@dataclass(frozen=True)
class FoundPr:
    number: int
    url: str
    outcome: Outcome


Pr = FoundPr | Unresolved


@dataclass(frozen=True)
class Written:
    text: str


@dataclass(frozen=True)
class SummaryPending:
    """The command whose output a summarizer reads to write the summary."""
    source: str


Summary = Written | SummaryPending


@dataclass(frozen=True)
class FoundTicket:
    id: str
    summary: Summary


Ticket = FoundTicket | Unresolved


@dataclass(frozen=True)
class Group:
    """One PR's reviews within one logical session."""
    id: str
    session: str
    pr: Pr
    ticket: Ticket
    reviews: tuple[Review, ...]


@dataclass(frozen=True)
class Document:
    groups: tuple[Group, ...]


# --- parse -----------------------------------------------------------------------------

def _object(value: object, path: str, keys: set[str]) -> dict:
    if not isinstance(value, dict):
        raise RecordError(f"{path}: expected an object, got {type(value).__name__}")
    if set(value) != keys:
        raise RecordError(f"{path}: expected keys {sorted(keys)}, got {sorted(value)}")
    return value


def _variant(value: object, path: str, tags: set[str]) -> tuple[str, object]:
    """A tagged union in JSON: an object whose one key is the tag."""
    if not isinstance(value, dict) or len(value) != 1 or next(iter(value)) not in tags:
        raise RecordError(f"{path}: expected one of {sorted(tags)} as the only key, got {value!r}")
    return next(iter(value.items()))


def _str(value: object, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RecordError(f"{path}: expected a non-empty string, got {value!r}")
    return value


def _int(value: object, path: str) -> int:
    # bool is an int subclass in Python, and true is not a count.
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise RecordError(f"{path}: expected a non-negative integer, got {value!r}")
    return value


def _list(value: object, path: str) -> list:
    if not isinstance(value, list):
        raise RecordError(f"{path}: expected a list, got {type(value).__name__}")
    return value


def _excerpt(value: object, path: str) -> Excerpt:
    d = _object(value, path, {"source", "path", "first", "last"})
    source = d["source"]
    if source not in get_args(ExcerptSource):
        raise RecordError(f"{path}.source: expected one of {list(get_args(ExcerptSource))}, got {source!r}")
    first, last = _int(d["first"], f"{path}.first"), _int(d["last"], f"{path}.last")
    if first > last:
        raise RecordError(f"{path}: first line {first} is after last line {last}")
    return Excerpt(source, _str(d["path"], f"{path}.path"), first, last)


def _tally(value: object, path: str) -> Tally:
    tag, inner = _variant(value, path, {"count", "pending", "unknown"})
    match tag:
        case "count":
            return Count(_int(inner, f"{path}.count"))
        case "pending":
            return Pending(_excerpt(inner, f"{path}.pending"))
        case _:
            return Unknown(_str(inner, f"{path}.unknown"))


def _result(value: object, path: str) -> Result:
    tag, inner = _variant(value, path, {"answered", "unanswered"})
    match tag:
        case "answered":
            d = _object(inner, f"{path}.answered", {"findings", "accepted"})
            return Answered(_tally(d["findings"], f"{path}.answered.findings"),
                            _tally(d["accepted"], f"{path}.answered.accepted"))
        case _:
            return Unanswered(_str(inner, f"{path}.unanswered"))


def _review(value: object, path: str) -> Review:
    d = _object(value, path, {"id", "n", "level", "models", "started", "transcript", "result"})
    level = d["level"]
    models = _list(d["models"], f"{path}.models")
    return Review(
        id=_str(d["id"], f"{path}.id"),
        n=_int(d["n"], f"{path}.n"),
        level=None if level is None else _str(level, f"{path}.level"),
        models=tuple(_str(m, f"{path}.models[{i}]") for i, m in enumerate(models)),
        started=_str(d["started"], f"{path}.started"),
        transcript=_str(d["transcript"], f"{path}.transcript"),
        result=_result(d["result"], f"{path}.result"),
    )


def _outcome(value: object, path: str) -> Outcome:
    tag, inner = _variant(value, path, {"merged", "closed", "open"})
    match tag:
        case "merged":
            return Merged(_str(inner, f"{path}.merged"))
        case "closed":
            return Closed(_str(inner, f"{path}.closed"))
        case _:
            if inner is not None:
                raise RecordError(f"{path}.open: expected null, got {inner!r}")
            return Open()


def _unresolved(value: object, path: str) -> Unresolved:
    return Unresolved(_str(_object(value, path, {"unresolved"})["unresolved"], f"{path}.unresolved"))


def _pr(value: object, path: str) -> Pr:
    if isinstance(value, dict) and "unresolved" in value:
        return _unresolved(value, path)
    d = _object(value, path, {"number", "url", "outcome"})
    return FoundPr(_int(d["number"], f"{path}.number"), _str(d["url"], f"{path}.url"),
                   _outcome(d["outcome"], f"{path}.outcome"))


def _summary(value: object, path: str) -> Summary:
    tag, inner = _variant(value, path, {"text", "pending"})
    match tag:
        case "text":
            return Written(_str(inner, f"{path}.text"))
        case _:
            return SummaryPending(_str(inner, f"{path}.pending"))


def _ticket(value: object, path: str) -> Ticket:
    if isinstance(value, dict) and "unresolved" in value:
        return _unresolved(value, path)
    d = _object(value, path, {"id", "summary"})
    return FoundTicket(_str(d["id"], f"{path}.id"), _summary(d["summary"], f"{path}.summary"))


def _group(value: object, path: str) -> Group:
    d = _object(value, path, {"id", "session", "pr", "ticket", "reviews"})
    reviews = _list(d["reviews"], f"{path}.reviews")
    return Group(
        id=_str(d["id"], f"{path}.id"),
        session=_str(d["session"], f"{path}.session"),
        pr=_pr(d["pr"], f"{path}.pr"),
        ticket=_ticket(d["ticket"], f"{path}.ticket"),
        reviews=tuple(_review(r, f"{path}.reviews[{i}]") for i, r in enumerate(reviews)),
    )


def parse_document(value: object) -> Document:
    """The only way into the document. Raises RecordError naming the first path that breaks the schema."""
    d = _object(value, "$", {"groups"})
    return Document(tuple(_group(g, f"$.groups[{i}]") for i, g in enumerate(_list(d["groups"], "$.groups"))))


# --- dump ------------------------------------------------------------------------------

def _dump_tally(t: Tally) -> dict:
    match t:
        case Count(n):
            return {"count": n}
        case Pending(e):
            return {"pending": {"source": e.source, "path": e.path, "first": e.first, "last": e.last}}
        case Unknown(why):
            return {"unknown": why}


def _dump_result(r: Result) -> dict:
    match r:
        case Answered(findings, accepted):
            return {"answered": {"findings": _dump_tally(findings), "accepted": _dump_tally(accepted)}}
        case Unanswered(why):
            return {"unanswered": why}


def _dump_outcome(o: Outcome) -> dict:
    match o:
        case Merged(at):
            return {"merged": at}
        case Closed(at):
            return {"closed": at}
        case Open():
            return {"open": None}


def _dump_pr(p: Pr) -> dict:
    match p:
        case FoundPr(number, url, outcome):
            return {"number": number, "url": url, "outcome": _dump_outcome(outcome)}
        case Unresolved(why):
            return {"unresolved": why}


def _dump_summary(s: Summary) -> dict:
    match s:
        case Written(text):
            return {"text": text}
        case SummaryPending(source):
            return {"pending": source}


def _dump_ticket(t: Ticket) -> dict:
    match t:
        case FoundTicket(id_, summary):
            return {"id": id_, "summary": _dump_summary(summary)}
        case Unresolved(why):
            return {"unresolved": why}


def dump_document(doc: Document) -> dict:
    """The only way out of the document; `parse_document(dump_document(d)) == d`."""
    return {"groups": [
        {
            "id": g.id,
            "session": g.session,
            "pr": _dump_pr(g.pr),
            "ticket": _dump_ticket(g.ticket),
            "reviews": [
                {"id": r.id, "n": r.n, "level": r.level, "models": list(r.models), "started": r.started,
                 "transcript": r.transcript, "result": _dump_result(r.result)}
                for r in g.reviews
            ],
        }
        for g in doc.groups
    ]}


# --- fills -----------------------------------------------------------------------------

def fill_summary(group: Group, text: str) -> Group:
    """Settle the group's pending ticket summary. Anything but a pending summary is refused."""
    match group.ticket:
        case FoundTicket(id_, SummaryPending()):
            return replace(group, ticket=FoundTicket(id_, Written(_str(text, "--summary"))))
        case FoundTicket(id_, Written()):
            raise RecordError(f"ticket {id_} already has a summary; only a pending summary is filled")
        case Unresolved(why):
            raise RecordError(f"group {group.id} has no ticket to summarize ({why})")


def fill_count(group: Group, review_id: str, field: CountField, value: Count | Unknown) -> Group:
    """Settle one pending count of one review in the group. Anything but a pending count is refused."""
    found = [r for r in group.reviews if r.id == review_id]
    if not found:
        raise RecordError(f"group {group.id} has no review {review_id}")
    review = found[0]
    match review.result:
        case Unanswered(why):
            raise RecordError(f"review {review_id} has no counts to fill: it never answered ({why})")
        case Answered(findings, accepted):
            current = findings if field == "findings" else accepted
            if not isinstance(current, Pending):
                raise RecordError(f"review {review_id} {field} is {_dump_tally(current)}, not pending")
            settled = Answered(value, accepted) if field == "findings" else Answered(findings, value)
    filled = replace(review, result=settled)
    return replace(group, reviews=tuple(filled if r.id == review_id else r for r in group.reviews))


@dataclass(frozen=True)
class SummaryGap:
    ticket: str
    source: str


@dataclass(frozen=True)
class CountGap:
    review: Review
    field: CountField
    excerpt: Excerpt


Gap = SummaryGap | CountGap


def gaps(group: Group) -> list[Gap]:
    """Every value in the group still waiting on the agent, in report order."""
    found: list[Gap] = []
    match group.ticket:
        case FoundTicket(id_, SummaryPending(source)):
            found.append(SummaryGap(id_, source))
    for r in group.reviews:
        match r.result:
            case Answered(findings, accepted):
                for field, tally in (("findings", findings), ("accepted", accepted)):
                    match tally:
                        case Pending(excerpt):
                            found.append(CountGap(r, field, excerpt))
    return found
