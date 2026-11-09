---
name: find-reviews
description: List the code reviews of recent work PR by PR — each PR with its lit ticket and a summary of the ticket's premise, and per review its number, level, model, finding count and accepted count, with a pointer into the session transcript. Use when asked to list, count or look over code reviews, review findings or accepted findings for a session (including the sessions /clear chained to it) or a time range such as today, the last day, this week or the last 3 days.
---

# find-reviews

Scripts read the transcripts. You make only the two judgments they can't: a ticket's summary, and a count a script left pending. Never open a transcript yourself; every excerpt you need comes from a script.

Run every command from inside the project's git repository. `S` is this skill's `scripts` directory.

## 1. Gather

Map the request to a scope:
- a session id → `--session ID` (every session `/clear` chained to it is included)
- a time range → `--since` and/or `--until` as ISO 8601 ("today" → since local midnight; "last 3 days" → since now minus 72 hours)
- no scope given → no flags, which means the last 72 hours

```
python3 $S/find-reviews.py [scope flags] -o /tmp/find-reviews-<scope>.json
```

The run record on stderr ends with one line per group: its group id, its ticket, and what it still needs (`summary`, `<review id> findings`, `<review id> accepted`). That list is your work. Exit 2 means no true document could be made; report its message and stop.

## 2. Summarize each ticket

For each distinct ticket in the work list, spawn one Agent with model `haiku`, all in a single message so they run in parallel. Use this prompt, filling in the ticket id and the project root:

> Run `lit show <TICKET ID> --field description` in `<PROJECT ROOT>`. Summarize the ticket's premise in at most two sentences: what is wrong or missing, for whom, and what done means. Reply with the summary only: no preamble, no ticket id, no markdown.

## 3. Settle each pending count

For each pending count:

```
python3 $S/excerpt-review.py FILE REVIEW_ID findings|accepted
```

It prints one question, the excerpt that answers it, and the exact flag that records the answer. Answer from that output alone: a count, or `unknown:<why>` when the excerpt does not settle it. Never guess.

When there are more than about ten pending counts, hand them out instead of reading every excerpt yourself. Spawn one Agent per group, all in one message, each with this prompt and that group's pending list:

> For each line below, run `python3 <S>/excerpt-review.py <FILE> <REVIEW ID> <FIELD>` and answer the question it prints from its output alone, never from any other file. Reply with one line per item and nothing else: `<REVIEW ID> <FIELD>=<count>`, or `<REVIEW ID> <FIELD>=unknown:<why the excerpt does not settle it>`.
> <the group's pending items, one `<REVIEW ID> <FIELD>` per line>

## 4. Format

For each group, in the order the work list gives them:

```
python3 $S/format-review.py FILE GROUP_ID --summary "<summary>" [--findings ID=N]... [--accepted ID=N | ID=unknown:WHY]...
```

Exit 1 lists every value still pending and every fill it refused, each with the command that settles it. Settle them and rerun. Present the groups' output verbatim, one after another, adding nothing.
