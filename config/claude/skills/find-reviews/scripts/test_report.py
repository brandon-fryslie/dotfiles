"""Numbering, grouping and the printed report."""
import importlib.util
import unittest
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from assembly import Placed, assemble, thread_after
from review_record import (
    Answered, Closed, Count, Excerpt, FoundPr, FoundTicket, Merged, Open, Pending, RecordError, SummaryPending,
    Unanswered, Unknown, Unresolved, Written, parse_document, dump_document,
)

spec = importlib.util.spec_from_file_location("format_review", Path(__file__).parent / "format-review.py")
format_review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(format_review)
spec = importlib.util.spec_from_file_location("excerpt_review", Path(__file__).parent / "excerpt-review.py")
excerpt_review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(excerpt_review)

PR701 = FoundPr(701, "https://github.com/o/r/pull/701", Merged("2026-11-08T22:40:00Z"))
TICKET = FoundTicket("e.t2yz", Written("A layout edit leaves stale state behind."))


def placed(id_, minute, pr=PR701, logical="root", result=Answered(Count(5), Count(1)), **kw):
    return Placed(id_, datetime(2026, 11, 8, 21, minute, tzinfo=timezone.utc), logical, pr,
                  kw.get("ticket", TICKET), kw.get("level", "medium"), kw.get("models", ("claude-haiku-5-5",)),
                  f"/t/{logical}.jsonl:{minute}", result)


class Assembly(unittest.TestCase):
    def test_reviews_are_numbered_within_their_pr_across_sessions(self):
        doc = assemble([placed("c", 30, logical="later"), placed("a", 10), placed("x", 15, pr=FoundPr(
            702, "u", Open())), placed("b", 20)])
        numbers = {r.id: (g.id, r.n) for g in doc.groups for r in g.reviews}
        self.assertEqual(numbers, {"a": ("701@root", 1), "b": ("701@root", 2), "x": ("702@root", 1),
                                   "c": ("701@later", 3)})
        self.assertEqual([g.id for g in doc.groups], ["701@root", "702@root", "701@later"])

    def test_levels_come_in_any_number_and_order(self):
        levels = ["high", "low", "high", None, "xhigh", "low"]
        doc = assemble([placed(f"r{i}", 10 + i, level=level) for i, level in enumerate(levels)])
        heads = format_review.render(doc.groups[0]).splitlines()[2:-1:2]
        self.assertEqual([head.split(" // ")[0] for head in heads],
                         [f"Review #{i + 1} ({level or 'level unstated'})" for i, level in enumerate(levels)])

    def test_unresolved_prs_group_by_their_reason(self):
        doc = assemble([placed("a", 10, pr=Unresolved("detached HEAD")), placed("b", 11, pr=Unresolved("no PR"))])
        self.assertEqual([(g.id, g.reviews[0].n) for g in doc.groups],
                         [("unresolved-1@root", 1), ("unresolved-2@root", 1)])

    def test_the_thread_after_a_review_stops_before_the_next_review_of_its_pr(self):
        self.assertEqual(thread_after(100, [100, 250, 400], [900]), (100, 249))
        self.assertEqual(thread_after(400, [100, 250, 400], [900]), (400, 900))

    def test_the_thread_after_a_review_stops_where_its_pr_closed(self):
        self.assertEqual(thread_after(400, [100, 250, 400], [900, 520]), (400, 520))
        self.assertEqual(thread_after(400, [400], [900, 120]), (400, 400))


class Report(unittest.TestCase):
    def group(self, **kw):
        doc = assemble([placed("a", 10), placed("b", 20, result=Unanswered("stopped by user"), level=None, models=()),
                        placed("c", 25, result=Answered(Unknown("ambiguous prose"), Count(0)),
                               models=("claude-opus-5-5", "claude-haiku-5-5"))])
        return replace(doc.groups[0], **kw)

    def test_the_report_format(self):
        self.assertEqual(format_review.render(self.group()), "\n".join([
            "https://github.com/o/r/pull/701 e.t2yz root // merged 2026-11-08",
            "A layout edit leaves stale state behind.",
            "Review #1 (medium) // Model: claude-haiku-5-5 // Findings: 5 // Accepted: 1",
            "/t/root.jsonl:10",
            "Review #2 (level unstated) // Model: none recorded // No answer: stopped by user",
            "/t/root.jsonl:20",
            "Review #3 (medium) // Model: claude-opus-5-5+claude-haiku-5-5 // Findings: ? // Accepted: 0",
            "/t/root.jsonl:25",
            "===",
        ]))

    def test_outcomes_and_unresolved_slots(self):
        closed = replace(PR701, outcome=Closed("2026-11-07T10:00:00Z"))
        self.assertTrue(format_review.render(self.group(pr=closed)).splitlines()[0].endswith(" // closed 2026-11-07"))
        self.assertTrue(format_review.render(self.group(pr=replace(PR701, outcome=Open()))).splitlines()[0]
                        .endswith(" // open"))
        lines = format_review.render(self.group(pr=Unresolved("detached HEAD"),
                                                ticket=Unresolved("its PR is unresolved"))).splitlines()
        self.assertEqual(lines[:2], ["PR unresolved (detached HEAD) ticket unresolved root",
                                     "No ticket: its PR is unresolved"])

    def test_nothing_pending_is_ever_printed(self):
        with self.assertRaises(RecordError):
            format_review.render(self.group(ticket=FoundTicket("e.t2yz", SummaryPending("lit show e.t2yz"))))
        pending = Answered(Count(4), Pending(Excerpt("triage verdict", "/t/a.jsonl", 51, 51)))
        group = self.group()
        group = replace(group, reviews=(replace(group.reviews[0], result=pending),))
        with self.assertRaises(RecordError):
            format_review.render(group)

    def test_count_fills(self):
        self.assertEqual(format_review.count_fill("a1=3"), ("a1", Count(3)))
        self.assertEqual(format_review.count_fill("a1=unknown:no verdict table"), ("a1", Unknown("no verdict table")))
        for bad in ("a1", "a1=", "=3", "a1=-1", "a1=unknown:", "a1=three"):
            with self.subTest(bad=bad):
                with self.assertRaises(Exception):
                    format_review.count_fill(bad)

    def test_an_assembled_document_survives_the_schema(self):
        doc = assemble([placed("a", 10)])
        self.assertEqual(parse_document(dump_document(doc)), doc)


class Question(unittest.TestCase):
    def test_the_question_names_its_review_by_number_never_by_level(self):
        group = assemble([placed("a", 10, level="low"), placed("b", 20, level="low")]).groups[0]
        thread = Excerpt("thread after review", "/t/root.jsonl", 20, 90)
        self.assertEqual(excerpt_review.question("accepted", Count(1), excerpt_review.subject(
            group, group.reviews[1], thread)),
                         "Of the 1 findings of review #2 of PR 701, launched at [line 20], how many did triage"
                         " accept (accepted, fixed or partly accepted)?")
        answer = Excerpt("review answer", "/t/a.jsonl", 40, 40)
        self.assertEqual(excerpt_review.subject(replace(group, pr=Unresolved("detached HEAD")), group.reviews[0],
                                                answer), "review #1 of an unresolved PR (detached HEAD)")

if __name__ == "__main__":
    unittest.main()
