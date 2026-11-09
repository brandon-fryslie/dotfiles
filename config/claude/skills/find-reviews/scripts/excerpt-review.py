#!/usr/bin/env python3
"""Step 3 of find-reviews: print the transcript excerpt a pending count must be judged from.

    excerpt-review.py FILE REVIEW_ID findings|accepted

FILE is the document find-reviews.py wrote. The output is the one question to answer,
the command that records the answer, and the excerpt as plain text. Judging the count
stays with the agent; reading transcripts does not. A count that is not pending is
refused, because there is nothing left to judge.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import readers as rd
from review_record import (
    Answered, Count, CountField, Excerpt, FoundPr, Group, Pending, RecordError, Review, Tally, Unanswered,
    parse_document,
)
from transcript_lib import iter_rows

FORMATTER = Path(__file__).resolve().parent / "format-review.py"
# The excerpt kinds that begin at the review's own launch row.
LAUNCH_OPENS = frozenset({"inline review", "thread after review"})


def subject(group: Group, review: Review, excerpt: Excerpt) -> str:
    """The review a question is about. A thread excerpt can interleave other reviews and verdicts,
    of other PRs or of this one at any level, so the review is named by its number in its PR and,
    where the excerpt holds its launch, by that launch's line: a level names no one review."""
    pr = f"PR {group.pr.number}" if isinstance(group.pr, FoundPr) else f"an unresolved PR ({group.pr.why})"
    launched = f", launched at [line {excerpt.first}]" if excerpt.source in LAUNCH_OPENS else ""
    return f"review #{review.n} of {pr}{launched}"


def question(field: CountField, findings: Tally, about: str) -> str:
    """The one question an excerpt answers. Phrased here only, so every agent is asked the same thing."""
    if field == "findings":
        return f"How many distinct findings did {about} return?"
    of = f"the {findings.n} findings of {about}" if isinstance(findings, Count) else f"the findings of {about}"
    return f"Of {of}, how many did triage accept (accepted, fixed or partly accepted)?"


def find(groups: tuple[Group, ...], review_id: str) -> tuple[Group, Review]:
    for group in groups:
        for review in group.reviews:
            if review.id == review_id:
                return group, review
    raise RecordError(f"no review {review_id} in the document")


def excerpt_rows(path: Path, first: int, last: int) -> list[rd.Row]:
    rows = []
    for line, row in iter_rows(path):
        if line > last:
            break
        if line >= first:
            rows.append((line, row))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("file", type=Path)
    ap.add_argument("review_id")
    ap.add_argument("field", choices=["findings", "accepted"])
    args = ap.parse_args()

    group, review = find(parse_document(json.loads(args.file.read_text())).groups, args.review_id)
    match review.result:
        case Unanswered(why):
            raise RecordError(f"review {review.id} never answered ({why}), so it has no counts")
        case Answered(findings, accepted):
            tally = findings if args.field == "findings" else accepted
    if not isinstance(tally, Pending):
        raise RecordError(f"review {review.id} {args.field} is already settled ({tally}); nothing to judge")

    e = tally.excerpt
    text = rd.render_excerpt(excerpt_rows(Path(e.path), e.first, e.last))
    print("\n".join([
        f"Review #{review.n} of group {group.id} ({review.id}): {args.field}",
        f"Question: {question(args.field, findings, subject(group, review, e))}",
        f"Record the answer: {FORMATTER} {args.file} {group.id} --{args.field} {review.id}=<count>",
        f"  or, if this excerpt does not settle it: --{args.field} {review.id}=unknown:<why>",
        f"Excerpt: {e.source}, {e.path} lines {e.first}-{e.last}, {len(text)} characters",
        "---",
        text,
    ]))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RecordError as e:
        print(f"excerpt-review: {e}", file=sys.stderr)
        sys.exit(1)
