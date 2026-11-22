---
id: validate-ticket
name: Validate the ticket before building it
events: [work_started]
---
Before you plan or build anything for <id>, run `/skillz:validate-ticket <id>`. A false premise or a misaimed criterion in a ticket otherwise shows up only at code review, after all the code is written.

- READY: start the work.
- NOT READY: repair the ticket with what the report says it should say instead, then run the skill again on the repaired ticket. Build only from a ticket that came back READY.
- COULD NOT CHECK: fix the reason the report gives, then run it again.
