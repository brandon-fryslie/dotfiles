"""Readers against the row shapes Claude Code actually writes (taken from real transcripts)."""
import unittest
from datetime import datetime, timezone

import readers as rd
from review_record import Count, Excerpt, Pending

AT = "2026-11-08T21:43:09.422Z"


def skill_result(agent_id=None, tool_use_id="toolu_1"):
    result = {"success": True, "commandName": "code-review"}
    if agent_id:
        result.update(status="forked", agentId=agent_id)
    return {"type": "user", "timestamp": AT, "gitBranch": "t2yz-fix", "toolUseResult": result,
            "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tool_use_id}]}}


def skill_call(args, tool_use_id="toolu_1"):
    return {"type": "assistant", "message": {"content": [
        {"type": "tool_use", "id": tool_use_id, "name": "Skill", "input": {"skill": "code-review", "args": args}}]}}


def assistant(text=None, model="claude-haiku-5-5", tool=None):
    content = ([{"type": "text", "text": text}] if text is not None else []) + ([tool] if tool else [])
    return {"type": "assistant", "timestamp": AT, "message": {"model": model, "content": content}}


def prompt(text):
    return {"type": "user", "timestamp": AT, "message": {"role": "user", "content": text}}


class Launches(unittest.TestCase):
    def test_a_forked_skill_launch_takes_its_level_from_the_skill_args(self):
        calls = rd.skill_calls([(11786, skill_call("medium --max-findings all PR 700 (branch x)"))])
        launch = rd.parse_launch("main.jsonl", 11787, skill_result("a47a4991350e27c0e"), calls)
        self.assertEqual(launch, rd.Forked("a47a4991350e27c0e", "main.jsonl", 11787,
                                           rd.timestamp(AT), "t2yz-fix", "medium"))

    def test_a_skill_launch_without_an_agent_ran_inline(self):
        calls = rd.skill_calls([(110, skill_call("low --max-findings all"))])
        launch = rd.parse_launch("main.jsonl", 111, skill_result(), calls)
        self.assertIsInstance(launch, rd.Inline)
        self.assertEqual((launch.level, launch.args), ("low", "low --max-findings all"))

    def test_a_typed_command_is_a_forked_launch(self):
        row = {"type": "system", "subtype": "local_command", "timestamp": AT, "gitBranch": "brandon-menus-sjhy.bc0",
               "content": "<local-command-stdout>Running in the background as @code-review</local-command-stdout>\n"
                          '<forked-skill-launch>{"agentId":"a9ab8c0959146be40","skillName":"code-review",'
                          '"description":"/code-review medium --max-findings all"}</forked-skill-launch>'}
        launch = rd.parse_launch("main.jsonl", 5436, row, {})
        self.assertEqual((launch.agent_id, launch.level), ("a9ab8c0959146be40", "medium"))
        self.assertEqual(rd.parse_agent_launch("main.jsonl", 5436, row).agent_id, "a9ab8c0959146be40")

    def test_an_agent_wrapper_labelled_code_review_is_not_a_review(self):
        row = {"type": "user", "timestamp": AT,
               "toolUseResult": {"status": "async_launched", "agentId": "a9f8c4351b8ae6c7a",
                                 "description": "/code-review low 325"}}
        self.assertIsNone(rd.parse_launch("main.jsonl", 9, row, {}))
        self.assertEqual(rd.parse_agent_launch("main.jsonl", 9, row).description, "/code-review low 325")

    def test_a_launch_with_no_level_word_has_no_level(self):
        calls = rd.skill_calls([(1, skill_call("PR 700"))])
        self.assertIsNone(rd.parse_launch("m", 2, skill_result("a1"), calls).level)


class InterruptedReviews(unittest.TestCase):
    """The shapes left by a foreground review the user interrupted (b8d15062.jsonl:53, agent a0a9bb7b)."""

    def call(self, tool_use_id="toolu_016g", at="2026-11-06T05:47:53.337Z"):
        row = skill_call("high 627", tool_use_id) | {"timestamp": at, "gitBranch": "x.1ql"}
        return rd.review_calls("main.jsonl", [(53, row)])[0]

    def head(self, agent_id="a0a9bb7b", at="2026-11-06T05:47:53.508Z", text="Review target: `627`\n\n`high effort → …`"):
        return rd.AgentHead(agent_id, f"agent-{agent_id}.jsonl", rd.timestamp(at), text)

    def test_a_call_records_where_it_was_made_and_its_level(self):
        self.assertEqual(self.call(), rd.ReviewCall("toolu_016g", "main.jsonl", 53, rd.timestamp("2026-11-06T05:47:53.337Z"),
                                                    "x.1ql", "high"))

    def test_a_launch_record_names_the_call_it_answers(self):
        self.assertEqual(rd.launched_call(skill_result("a1", "toolu_9")), "toolu_9")
        self.assertIsNone(rd.launched_call({"type": "user", "toolUseResult": "User rejected tool use", "message": {
            "content": [{"type": "tool_result", "tool_use_id": "toolu_016g"}]}}))

    def test_an_unlaunched_call_pairs_with_the_review_subagent_that_started_after_it(self):
        self.assertEqual(rd.pair_interrupted([self.call()], [self.head()]), [rd.Interrupted(
            "a0a9bb7b", "main.jsonl", 53, rd.timestamp("2026-11-06T05:47:53.337Z"), "x.1ql", "high")])

    def test_pairs_are_one_to_one_nearest_first(self):
        calls = [self.call("t1", "2026-11-06T05:47:53.000Z"), self.call("t2", "2026-11-06T05:47:53.400Z")]
        heads = [self.head("near", "2026-11-06T05:47:53.450Z"), self.head("later", "2026-11-06T05:47:53.900Z")]
        self.assertEqual({(i.agent_id, i.at) for i in rd.pair_interrupted(calls, heads)},
                         {("near", calls[1].at), ("later", calls[0].at)})

    def test_what_is_not_a_review_or_not_close_never_pairs(self):
        self.assertEqual(rd.pair_interrupted([self.call()], [self.head(text="Triage these findings")]), [])
        self.assertEqual(rd.pair_interrupted([self.call()], [self.head(at="2026-11-06T05:47:55.000Z")]), [])
        self.assertEqual(rd.pair_interrupted([self.call()], [self.head(at="2026-11-06T05:47:53.000Z")]), [])


class Targets(unittest.TestCase):
    def test_target_shapes(self):
        cases = {
            "PR 700 (brandon-unfiled-3248.8a7z, branch brandon-unfiled-3248.8a7z)": rd.PrTarget(700),
            "694": rd.PrTarget(694),
            "#702": rd.PrTarget(702),
            "https://github.com/promptctl/cc-candybar/pull/701": rd.PrTarget(701),
            "origin/main...HEAD (diff base: merge-base 06ac017c6)": rd.CheckoutTarget(
                "origin/main...HEAD (diff base: merge-base 06ac017c6)"),
            "": rd.CheckoutTarget(""),
            "/Users/bmf/code/other/.claude/worktrees/plugin": rd.PathTarget("/Users/bmf/code/other/.claude/worktrees/plugin"),
            "fix/stall-polled-watches": rd.BranchOrPathTarget("fix/stall-polled-watches"),
            "origin/brandon-unfiled-3248.t2yz": rd.BranchOrPathTarget("brandon-unfiled-3248.t2yz"),
            "src/config src/click (diff of branch x)": rd.BranchOrPathTarget("src/config"),
            "2c49054392ab": rd.CheckoutTarget("2c49054392ab"),
            "Review the rebased diff": rd.CheckoutTarget("Review the rebased diff"),
        }
        for text, target in cases.items():
            with self.subTest(text=text):
                self.assertEqual(rd.parse_target(text), target)

    def test_a_forked_review_states_its_target_in_its_first_message(self):
        self.assertEqual(rd.review_target_text(prompt("Review target: `PR 701 (x)`\n\n`low effort → …`")), "PR 701 (x)")
        self.assertEqual(rd.review_target_text(prompt("`high effort → 8 inline angles`")), "")

    def test_inline_args_lose_their_level_and_flags(self):
        self.assertEqual(rd.args_target_text("medium --max-findings all PR 700"), "PR 700")
        self.assertEqual(rd.args_target_text("low --max-findings all"), "")


class Answers(unittest.TestCase):
    def test_a_fenced_json_array_is_counted_and_keyed(self):
        text = ('```json\n[{"file": "a.ts", "summary": "modelIdOf uses ?? where the pre-diff code used a truthy test"},'
                ' {"file": "b.ts", "summary": "Every usage-bearing entry on the fold path allocates a Usage object"}]\n```')
        answer = rd.read_answer("r.jsonl", [(1, prompt("go")), (9, assistant(text))], False)
        self.assertEqual(answer.count, Count(2))
        self.assertEqual(answer.keys[0], rd.finding_key("modelIdOf uses ?? where the pre-diff code used a truthy test"))

    def test_a_bare_array_and_none_are_counted(self):
        self.assertEqual(rd.read_answer("r", [(2, assistant('[{"summary": "x"}]'))], False).count, Count(1))
        self.assertEqual(rd.read_answer("r", [(2, assistant("(none)\n\nThe diff only changes a test file."))],
                                        False).count, Count(0))

    def test_prose_is_left_pending_at_its_message(self):
        answer = rd.read_answer("r.jsonl", [(4, assistant("1. `src/a.ts`: a named watch …"))], False)
        self.assertEqual(answer.count, Pending(Excerpt("review answer", "r.jsonl", 4, 4)))

    def test_a_review_that_never_answered_has_no_answer(self):
        self.assertEqual(rd.read_answer("r", [(2, assistant("partial"))], True), rd.NoAnswer("stopped by user"))
        limit = assistant("You've hit your weekly limit · resets Nov 13 at 4am", model="<synthetic>")
        self.assertEqual(rd.read_answer("r", [(2, assistant("x")), (3, limit)], False),
                         rd.NoAnswer("You've hit your weekly limit · resets Nov 13 at 4am"))
        midway = assistant(tool={"type": "tool_use", "id": "t", "name": "Bash", "input": {"command": "git diff"}})
        self.assertEqual(rd.read_answer("r", [(2, assistant("thinking aloud")), (3, midway)], False),
                         rd.NoAnswer("ended without an answer"))

    def test_models_leave_out_the_harness(self):
        rows = [(1, assistant("a", "claude-opus-5-5")), (2, assistant("b", "<synthetic>")),
                (3, assistant("c", "claude-haiku-5-5")), (4, assistant("d", "claude-opus-5-5"))]
        self.assertEqual(rd.models(rows), ("claude-opus-5-5", "claude-haiku-5-5"))

    def test_an_inline_answer_runs_to_the_next_prompt(self):
        rows = [(10, assistant("launch")), (11, assistant("finding one")), (12, prompt("next request")),
                (13, assistant("x"))]
        self.assertEqual(rd.inline_answer_range(rows, 10), (10, 11))
        self.assertEqual(rd.inline_answer_range(rows[:2], 10), (10, 11))


class Triage(unittest.TestCase):
    ENDED = datetime(2026, 11, 8, 21, 44, tzinfo=timezone.utc)
    KEY = rd.finding_key("When the write error already carries a cause, a failed tmp cleanup is discarded")

    def head(self, agent_id, minute, prompt_text):
        return rd.AgentHead(agent_id, f"agent-{agent_id}.jsonl",
                            datetime(2026, 11, 8, 21, minute, tzinfo=timezone.utc), prompt_text)

    def test_the_earliest_later_agent_quoting_a_finding_is_the_triage(self):
        quoted = 'Findings (JSON): [{"summary":"When the write error already carries a `cause`, a failed tmp cleanup is discarded"}]'
        agents = [self.head("before", 40, quoted), self.head("fixer", 50, quoted),
                  self.head("triage", 45, quoted), self.head("other", 46, "unrelated work")]
        self.assertEqual(rd.link_triage(self.ENDED, (self.KEY,), agents).agent_id, "triage")

    def test_no_quoting_agent_means_no_triage(self):
        self.assertIsNone(rd.link_triage(self.ENDED, (self.KEY,), [self.head("x", 50, "something else")]))

    def test_verdict_tables(self):
        accept_reject = ("ARCHITECTURAL: no\n\n| # | Verdict | Reason / law |\n|---|---|---|\n"
                         "| 1 | REJECT | Speculative. |\n| 2 | ACCEPT | `[LAW:no-silent-failure]` |\n"
                         "| 3 | REJECT | A nit. |\n\naccepted 1 of 3")
        self.assertEqual(rd.read_verdicts(accept_reject, 3), 1)
        fixed = ("| # | Verdict | Reason |\n|---|---|---|\n| **1** | **Fixed** | Confirmed. |\n"
                 "| 2 | Partly accepted. Comment fixed, cure rejected | x |\n| 3 | Rejected | y |")
        self.assertEqual(rd.read_verdicts(fixed, 3), 2)

    def test_a_table_that_cannot_be_read_whole_is_not_read(self):
        lettered = "| Finding | Verdict | One line |\n|---|---|---|\n| A | ACCEPT | x |\n| B | REJECT | y |"
        self.assertIsNone(rd.read_verdicts(lettered, 2))
        missing = "| # | Verdict |\n|---|---|\n| 1 | ACCEPT |"
        self.assertIsNone(rd.read_verdicts(missing, 2))
        unclassified = "| # | Verdict |\n|---|---|\n| 1 | ACCEPT |\n| 2 | maybe later |"
        self.assertIsNone(rd.read_verdicts(unclassified, 2))
        no_verdict_column = "| # | File |\n|---|---|\n| 1 | a.ts |"
        self.assertIsNone(rd.read_verdicts(no_verdict_column, 1))

    def test_an_inline_triage_is_the_first_message_whose_table_reads(self):
        thread = [(10, "Waiting on the review."), (12, "| # | Verdict |\n|---|---|\n| 1 | ACCEPT |"),
                  (15, "| # | Verdict |\n|---|---|\n| 1 | REJECT |\n| 2 | Fixed |"),
                  (18, "| # | Verdict |\n|---|---|\n| 1 | REJECT |\n| 2 | REJECT |")]
        self.assertEqual(rd.verdicts_in(thread, 2), 1)
        self.assertIsNone(rd.verdicts_in(thread[:2], 2))


class PullRequests(unittest.TestCase):
    def pr(self, number, head, day, state="MERGED"):
        return rd.parse_pr({"number": number, "url": f"https://github.com/o/r/pull/{number}",
                            "title": f"fix: a thing ({head})", "headRefName": head,
                            "createdAt": f"2026-11-0{day}T10:00:00Z", "state": state,
                            "mergedAt": f"2026-11-0{day}T12:00:00Z", "closedAt": f"2026-11-0{day}T12:00:00Z"})

    def setUp(self):
        self.prs = (self.pr(694, "fix/stall", 7), self.pr(700, "e.8a7z", 8), self.pr(701, "e.t2yz", 8, "OPEN"),
                    self.pr(650, "reused", 2, "CLOSED"), self.pr(690, "reused", 6))
        self.at = datetime(2026, 11, 8, 21, 0, tzinfo=timezone.utc)

    def resolve(self, target, branch=None, wrapper=None, at=None):
        found = rd.resolve_pr(self.prs, target, branch, wrapper, at or self.at, "/r/candybar")
        return found.number if isinstance(found, rd.PrInfo) else found

    def test_a_target_naming_a_pr_or_branch_is_the_evidence(self):
        self.assertEqual(self.resolve(rd.PrTarget(700), wrapper="High review of PR 694"), 700)
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("fix/stall")), 694)

    def test_without_a_named_target_the_launching_job_names_the_pr_before_the_branch(self):
        self.assertEqual(self.resolve(rd.CheckoutTarget(""), "t2yz-fix", "Medium review of PR 701"), 701)
        self.assertEqual(self.resolve(rd.CheckoutTarget("origin/main...HEAD"), None, "High review of PR 694"), 694)
        self.assertEqual(self.resolve(rd.CheckoutTarget(""), "e.8a7z"), 700)

    def test_a_commit_range_or_prose_target_is_the_launching_checkout(self):
        for text in ("5f4e472e", "origin/main...HEAD", "Review the rebased diff"):
            with self.subTest(text=text):
                self.assertEqual(self.resolve(rd.CheckoutTarget(text), "e.8a7z"), 700)

    def test_an_absolute_path_is_the_checkout_only_inside_this_repository(self):
        self.assertEqual(self.resolve(rd.PathTarget("/r/candybar/.claude/worktrees/x/src"), "e.8a7z"), 700)
        self.assertEqual(self.resolve(rd.PathTarget("/r/candybar-other/src"), "e.8a7z"),
                         rd.Unresolved("target /r/candybar-other/src is outside this repository"))

    def test_a_number_that_is_no_pr_is_a_commit(self):
        self.assertEqual(self.resolve(rd.PrTarget(72920844), wrapper="Low gate on PR 700"), 700)
        self.assertEqual(self.resolve(rd.PrTarget(72920844), "e.8a7z"), 700)
        self.assertEqual(self.resolve(rd.PrTarget(72920844)), rd.Unresolved(
            "72920844 is no PR here, so it is a commit, and the launching checkout was on a detached HEAD"))

    def test_what_cannot_be_resolved_says_why(self):
        self.assertIn("detached HEAD", self.resolve(rd.CheckoutTarget(""), "HEAD").why)
        self.assertIn("names no PR", self.resolve(rd.CheckoutTarget("5f4e472e")).why)
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("triage-0463"), "HEAD"), rd.Unresolved(
            "no PR has head branch triage-0463, so it is a path, and the launching checkout was on a detached HEAD"))

    def test_a_name_no_pr_has_as_its_head_is_a_path_in_the_launching_checkout(self):
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("src/config"), "e.8a7z"), 700)
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("src/config"), "e.8a7z", "Low review of PR 694"), 694)

    def test_a_reused_branch_means_the_pr_open_at_the_review(self):
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("reused"), at=datetime(2026, 11, 4, tzinfo=timezone.utc)), 650)
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("reused")), 690)
        self.assertEqual(self.resolve(rd.BranchOrPathTarget("reused"), at=datetime(2026, 11, 1, tzinfo=timezone.utc)), 650)

    def test_outcomes_and_tickets_come_from_gh(self):
        self.assertEqual(self.prs[2].pr.outcome, rd.Open())
        def info(title, head):
            return rd.PrInfo(1, title, head, self.at, rd.FoundPr(1, "u", rd.Open()))
        self.assertEqual(rd.ticket_candidates(info("fix(update-act): an overdue act … (brandon-unfiled-3248.pj1z)",
                                                   "brandon-unfiled-3248.pj1z")), ["brandon-unfiled-3248.pj1z"])
        self.assertEqual(rd.ticket_candidates(info("fix(update-act): an act … after its budget",
                                                   "brandon-unfiled-3248.7cay")), ["brandon-unfiled-3248.7cay"])
        self.assertEqual(rd.ticket_candidates(info("x (a.b1)", "feat/home-dmd")), ["a.b1"])
        self.assertEqual(rd.ticket_candidates(info("chore(release): set package.json to 1.212.3 [skip ci]", "fix/stall")), [])
        with self.assertRaises(ValueError):
            rd.parse_pr({"number": 1, "url": "u", "title": "t", "headRefName": "h",
                         "createdAt": "2026-11-01T00:00:00Z", "state": "DRAFTISH"})

    def test_a_closed_pr_ends_the_thread_its_triage_sits_in(self):
        texts = [(10, datetime(2026, 11, 8, 11, tzinfo=timezone.utc), "a"),
                 (20, datetime(2026, 11, 8, 13, tzinfo=timezone.utc), "b")]
        self.assertEqual(rd.written_before_close(texts, rd.Merged("2026-11-08T12:00:00Z")), [10])
        self.assertEqual(rd.written_before_close(texts, rd.Closed("2026-11-08T10:00:00Z")), [0])
        self.assertEqual(rd.written_before_close(texts, rd.Open()), [])

    def test_a_leading_dash_does_not_hide_a_pr(self):
        self.assertEqual(rd.parse_target("— PR #633 branch candybar-gather-renderer-76bb.1dh.c3l"), rd.PrTarget(633))


class LogicalSessions(unittest.TestCase):
    def test_each_clear_pairs_with_the_history_entry_nearest_in_time(self):
        t = 1794053743223
        history = [("b2a412e3", t), ("9b7c84ec-old", t - 24335)]
        clears = [("7bdd3654", t + 2), ("9b7c84ec", t - 24335 + 3), ("lonely", t + 60000)]
        self.assertEqual(rd.link_clears(history, clears), {"7bdd3654": "b2a412e3", "9b7c84ec": "9b7c84ec-old"})

    def test_a_history_entry_continues_one_session_only(self):
        self.assertEqual(rd.link_clears([("old", 1000)], [("near", 1001), ("far", 1500)]), {"near": "old"})

    def test_a_chain_is_named_by_its_first_session(self):
        self.assertEqual(rd.chain_roots({"b": "a", "c": "b"}), {"a": "a", "b": "a", "c": "a"})

    def test_a_chain_runs_first_to_last_from_any_of_its_sessions(self):
        for session in ("a", "b", "c"):
            self.assertEqual(rd.chain_order({"b": "a", "c": "b"}, session), ["a", "b", "c"])
        self.assertEqual(rd.chain_order({"b": "a"}, "lone"), ["lone"])


class Excerpts(unittest.TestCase):
    def test_messages_render_with_their_lines_and_tool_results_drop(self):
        rows = [
            (5, prompt("triage these")),
            (6, assistant("I accepted one.", tool={"type": "tool_use", "id": "t", "name": "Bash",
                                                    "input": {"command": "git show e955\nmore", "description": "Read the PR"}})),
            (7, {"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "t", "content": "diff"}]}}),
            (8, {"type": "user", "isMeta": True, "message": {"content": "caveat"}}),
            (9, {"type": "attachment"}),
        ]
        self.assertEqual(rd.render_excerpt(rows),
                         "[line 5] user:\ntriage these\n\n"
                         "[line 6] assistant:\nI accepted one.\n(tool call: Bash — Read the PR)")


if __name__ == "__main__":
    unittest.main()
