"""The document's one parse, dump and fill."""
import copy
import unittest

from review_record import (
    Count, FoundTicket, RecordError, SummaryGap, CountGap, Unknown, Written, dump_document, fill_count,
    fill_summary, gaps, parse_document,
)

PENDING = {"pending": {"source": "triage verdict", "path": "/t/agent-a.jsonl", "first": 51, "last": 51}}

DOC = {"groups": [
    {"id": "702@s1", "session": "s1",
     "pr": {"number": 702, "url": "https://github.com/o/r/pull/702", "outcome": {"open": None}},
     "ticket": {"id": "e.pj1z", "summary": {"pending": "lit show e.pj1z --field description"}},
     "reviews": [
         {"id": "a1", "n": 1, "level": "medium", "models": ["claude-haiku-5-5"], "started": "2026-11-08T22:18:48+00:00",
          "transcript": "/t/s1.jsonl:12639", "result": {"answered": {"findings": {"count": 7}, "accepted": PENDING}}},
         {"id": "a2", "n": 2, "level": None, "models": [], "started": "2026-11-08T22:28:50+00:00",
          "transcript": "/t/s1.jsonl:12895", "result": {"unanswered": "stopped by user"}},
     ]},
    {"id": "unresolved-1@s1", "session": "s1", "pr": {"unresolved": "detached HEAD"},
     "ticket": {"unresolved": "its PR is unresolved"},
     "reviews": [
         {"id": "a3", "n": 1, "level": "low", "models": ["claude-opus-5-5"], "started": "2026-11-08T20:00:00+00:00",
          "transcript": "/t/s1.jsonl:10", "result": {"answered": {"findings": {"unknown": "prose list was ambiguous"},
                                                                  "accepted": {"count": 0}}}},
     ]},
]}


class Schema(unittest.TestCase):
    def test_a_document_round_trips(self):
        self.assertEqual(dump_document(parse_document(DOC)), DOC)

    def test_a_broken_document_is_refused_at_its_path(self):
        def broken(change):
            doc = copy.deepcopy(DOC)
            change(doc)
            return doc
        cases = {
            "$.groups[0]: expected keys": lambda d: d["groups"][0].pop("session"),
            "$.groups[0].reviews[0]: expected keys": lambda d: d["groups"][0]["reviews"][0].update(extra=1),
            "$.groups[0].reviews[0].n": lambda d: d["groups"][0]["reviews"][0].update(n=True),
            "$.groups[0].reviews[0].result.answered.findings.count": lambda d: d["groups"][0]["reviews"][0]
                ["result"]["answered"].update(findings={"count": -1}),
            "$.groups[0].reviews[0].result.answered.accepted.pending: first line": lambda d: d["groups"][0]["reviews"][0]
                ["result"]["answered"].update(accepted={"pending": {**PENDING["pending"], "first": 60}}),
            "$.groups[0].reviews[0].result.answered.accepted.pending.source": lambda d: d["groups"][0]["reviews"][0]
                ["result"]["answered"].update(accepted={"pending": {**PENDING["pending"], "source": "a guess"}}),
            "$.groups[0].reviews[0].result: expected one of": lambda d: d["groups"][0]["reviews"][0]
                .update(result={"answered": {}, "unanswered": "x"}),
            "$.groups[1].pr.unresolved": lambda d: d["groups"][1].update(pr={"unresolved": "  "}),
            "$.groups[0].pr.outcome.open": lambda d: d["groups"][0]["pr"].update(outcome={"open": "yes"}),
        }
        for message, change in cases.items():
            with self.subTest(message=message):
                with self.assertRaises(RecordError) as caught:
                    parse_document(broken(change))
                self.assertIn(message, str(caught.exception))


class Fills(unittest.TestCase):
    def setUp(self):
        self.doc = parse_document(DOC)
        self.group = self.doc.groups[0]

    def test_a_pending_summary_and_count_are_filled(self):
        group = fill_count(fill_summary(self.group, "A pruned act leaves its group running."), "a1", "accepted", Count(1))
        self.assertEqual(group.ticket, FoundTicket("e.pj1z", Written("A pruned act leaves its group running.")))
        self.assertEqual(group.reviews[0].result.accepted, Count(1))
        self.assertEqual(gaps(group), [])

    def test_only_pending_values_are_filled(self):
        refusals = {
            "already has a summary": lambda: fill_summary(fill_summary(self.group, "x"), "y"),
            "has no ticket to summarize": lambda: fill_summary(self.doc.groups[1], "x"),
            "not pending": lambda: fill_count(self.group, "a1", "findings", Count(3)),
            "never answered": lambda: fill_count(self.group, "a2", "accepted", Count(0)),
            "has no review a9": lambda: fill_count(self.group, "a9", "accepted", Unknown("why")),
            "non-empty string": lambda: fill_summary(self.group, " "),
        }
        for message, fill in refusals.items():
            with self.subTest(message=message):
                with self.assertRaises(RecordError) as caught:
                    fill()
                self.assertIn(message, str(caught.exception))

    def test_gaps_name_every_pending_value(self):
        found = gaps(self.group)
        self.assertEqual(found[0], SummaryGap("e.pj1z", "lit show e.pj1z --field description"))
        self.assertIsInstance(found[1], CountGap)
        self.assertEqual((found[1].review.id, found[1].field, found[1].excerpt.first), ("a1", "accepted", 51))


if __name__ == "__main__":
    unittest.main()
