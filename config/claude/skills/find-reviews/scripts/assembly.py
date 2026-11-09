"""Numbering and grouping: placed reviews in, the intermediate document out. Pure.

A review is numbered within its PR, never globally, because a PR's reviews are read
as one sequence; the count runs on across sessions when a PR's reviews span them.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

from review_record import Document, FoundPr, Group, Pr, Result, Review, Ticket, Unresolved


@dataclass(frozen=True)
class Placed:
    """A review with everything known about it except its number."""
    id: str
    at: datetime
    logical: str
    pr: Pr
    ticket: Ticket
    level: str | None
    models: tuple[str, ...]
    transcript: str
    result: Result


def _group_key(p: Placed) -> tuple:
    match p.pr:
        case FoundPr(number):
            return ("pr", number, p.logical)
        case Unresolved(why):
            # Reviews whose PR is unknown for different reasons are different unknowns.
            return ("unresolved", why, p.logical)


def assemble(placed: Iterable[Placed]) -> Document:
    ordered = sorted(placed, key=lambda p: p.at)
    numbers: dict[str, int] = {}
    counters: dict[object, int] = {}
    for p in ordered:
        sequence = p.pr.number if isinstance(p.pr, FoundPr) else _group_key(p)
        counters[sequence] = counters.get(sequence, 0) + 1
        numbers[p.id] = counters[sequence]

    members: dict[tuple, list[Placed]] = {}
    for p in ordered:  # insertion order is the order of each group's first review
        members.setdefault(_group_key(p), []).append(p)

    unresolved_seen: dict[str, int] = {}
    groups = []
    for key, reviews in members.items():
        first = reviews[0]
        match first.pr:
            case FoundPr(number):
                group_id = f"{number}@{first.logical}"
            case Unresolved():
                unresolved_seen[first.logical] = unresolved_seen.get(first.logical, 0) + 1
                group_id = f"unresolved-{unresolved_seen[first.logical]}@{first.logical}"
        groups.append(Group(
            id=group_id,
            session=first.logical,
            pr=first.pr,
            ticket=first.ticket,
            reviews=tuple(
                Review(r.id, numbers[r.id], r.level, r.models, r.at.isoformat(), r.transcript, r.result)
                for r in reviews
            ),
        ))
    return Document(tuple(groups))


def thread_after(launch_line: int, later_launches: Iterable[int], ends: Iterable[int]) -> tuple[int, int]:
    """The thread a review's inline triage sits in: from the review's launch to the earliest of
    the line before the next review of the same PR there and each given end (the transcript's
    last line, and the last line written before the PR merged or closed, since triage precedes
    both). Never shorter than the launch line itself."""
    last = min([*ends, *(line - 1 for line in later_launches if line > launch_line)])
    return launch_line, max(launch_line, last)
