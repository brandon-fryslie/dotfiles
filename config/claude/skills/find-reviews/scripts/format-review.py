#!/usr/bin/env python3
"""Step 4 of find-reviews: apply the agent's fills to one group and print it in the report format.

    format-review.py FILE GROUP_ID [--summary TEXT] [--findings ID=N]... [--accepted ID=N]...

A count fill is `ID=N`, or `ID=unknown:WHY` when its excerpt does not settle it. Fills
go through the schema's own fill functions, which refuse anything but a pending value.
The document is never written: the gather step's file keeps one writer, and every
fill lives in the command that prints it. Nothing pending is ever printed; a group
with gaps left exits 1 and names, for each gap, the command that settles it.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from review_record import (
    Answered, Closed, Count, CountGap, FoundPr, FoundTicket, Group, Merged, Open, Pending, RecordError,
    Review, SummaryGap, SummaryPending, Tally, Unanswered, Unknown, Unresolved, Written, fill_count,
    fill_summary, gaps, parse_document,
)

EXCERPTER = Path(__file__).resolve().parent / "excerpt-review.py"


def count_fill(text: str) -> tuple[str, Count | Unknown]:
    review_id, sep, value = text.partition("=")
    if sep and review_id and value.isdigit():
        return review_id, Count(int(value))
    if sep and review_id and value.startswith("unknown:") and value.removeprefix("unknown:").strip():
        return review_id, Unknown(value.removeprefix("unknown:").strip())
    raise argparse.ArgumentTypeError(f"expected ID=N or ID=unknown:WHY, got {text!r}")


def _tally(t: Tally) -> str:
    match t:
        case Count(n):
            return str(n)
        case Unknown():
            return "?"
        case Pending():
            raise RecordError("a pending count reached the renderer")


def _review(r: Review) -> list[str]:
    head = f"Review #{r.n} ({r.level or 'level unstated'}) // Model: {'+'.join(r.models) or 'none recorded'}"
    match r.result:
        case Answered(findings, accepted):
            line = f"{head} // Findings: {_tally(findings)} // Accepted: {_tally(accepted)}"
        case Unanswered(why):
            line = f"{head} // No answer: {why}"
    return [line, r.transcript]


def render(group: Group) -> str:
    """One group in the report format. The format is defined here and nowhere else. [LAW:one-source-of-truth]"""
    match group.pr:
        case FoundPr(_, url, Merged(at)):
            pr, outcome = url, f" // merged {at[:10]}"
        case FoundPr(_, url, Closed(at)):
            pr, outcome = url, f" // closed {at[:10]}"
        case FoundPr(_, url, Open()):
            pr, outcome = url, " // open"
        case Unresolved(why):
            pr, outcome = f"PR unresolved ({why})", ""
    match group.ticket:
        case FoundTicket(ticket, Written(text)):
            summary = text
        case FoundTicket(ticket, SummaryPending()):
            raise RecordError("a pending summary reached the renderer")
        case Unresolved(why):
            ticket, summary = "ticket unresolved", f"No ticket: {why}"
    lines = [f"{pr} {ticket} {group.session}{outcome}", summary]
    for r in group.reviews:
        lines.extend(_review(r))
    lines.append("===")
    return "\n".join(lines)


def describe(gap: CountGap | SummaryGap, file: Path) -> str:
    match gap:
        case SummaryGap(ticket, source):
            return f"ticket {ticket}: summary pending; summarize `{source}` and pass --summary"
        case CountGap(review, field):
            return (f"review #{review.n} ({review.id}): {field} pending; "
                    f"run {EXCERPTER} {file} {review.id} {field}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("file", type=Path)
    ap.add_argument("group_id")
    ap.add_argument("--summary", help="the ticket summary for this group's ticket")
    ap.add_argument("--findings", type=count_fill, action="append", default=[], metavar="ID=N")
    ap.add_argument("--accepted", type=count_fill, action="append", default=[], metavar="ID=N")
    args = ap.parse_args()

    doc = parse_document(json.loads(args.file.read_text()))
    chosen = [g for g in doc.groups if g.id == args.group_id]
    if not chosen:
        raise RecordError(f"no group {args.group_id}; the document's groups are: "
                          + ", ".join(g.id for g in doc.groups))
    group = chosen[0]

    refused = []
    if args.summary is not None:
        try:
            group = fill_summary(group, args.summary)
        except RecordError as e:
            refused.append(str(e))
    for field, fills in (("findings", args.findings), ("accepted", args.accepted)):
        for review_id, value in fills:
            try:
                group = fill_count(group, review_id, field, value)
            except RecordError as e:
                refused.append(str(e))
    left = gaps(group)
    if refused or left:
        for reason in refused:
            print(f"refused: {reason}", file=sys.stderr)
        for gap in left:
            print(describe(gap, args.file), file=sys.stderr)
        return 1
    print(render(group))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RecordError as e:
        print(f"format-review: {e}", file=sys.stderr)
        sys.exit(2)
