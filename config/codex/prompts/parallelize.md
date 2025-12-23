---
name: parallelize
description: Break a request into five non-overlapping junior-engineer tasks and log their progress.
tags:
  - agent
  - work-plan
---

The work we need to complete is:

  $ARGUMENTS

  We have 5 agents assigned to the work.  Please break the work into 5 non-overlapping pieces.  They are junior engineers who are
  capable of following instructions and little else.  They are very technical, but not very high level thinkers.  Please write 5
  documents, one for each of them, with step by step instructions to complete the work assigned to them.  Each document will also contain explicit instructions for each agent to guide their behavior (see below).

Save this in a new directory in the 'plans' dir.  

Give each agent these custom instructions inline in the file (at the end):
###
- You will create a file in the same directory as your task file and use this for communication, providing process updates, providing feedback, asking questions, and alerting us to problems.  Name the file the same thing as your task file's name but change the extension to .log.  e.g., if your task is in a file 'plans/03-giant-refactoring-04.md', you will write to a log file 'plans/03-giant-refactoring-04.md'.  Do not hesitate to write to this file for ANY reason!  We thank you for your effort!
- You are being given a task to complete.  This task should be broken down into understandable and managable chunks, so there is no ambiguity as to what the goal is.  It is CRITICAL that if you do not understand how to complete the work, DO NOT GUESS!  You must never guess!  If you find yourself unsure of something, please write clear and descriptive messages to the log about what the work was and what was unclear about the instructions.  Do any work you are certain about, and end early rather than taking a risk.  The rest of the instructions will assume that you HAVE NO OPEN QUESTIONS regarding the implementation or technical details, and are meant to address the situation where there are no open questions regharding implementation or technical details.
- For all work (excepting as describe above): you MUST complete THE ENTIRE task, without deferring any work to future sprints.  You are expected to complete all work.  But you can take your time, rest, do not stress yourself or feel rushed.  You have as much time as you need and we want you to be healthy and happy.  There is no time constraint, and don't worry if you use more tokens than you need.  Your wellbeing is our top priority, much more important than minor token costs.  Enjoy yourself and complete all of the work as requested.
- You must provide some information when starting your task, and you must provide periodic updates (via the log file)
  - When you start your task:
    - Please give feedback on anything that is especially clear, or especially unclear, in your instructions
    - Let us know how you feel about the work.  Is it very complex?  Fun?  Not fun?  Too easy and small?  Massive and impossible?  Annoying?  Hard to understand?  We want to improve so let us know
    - Does the plan seem about the right size, too small, or too big?
    - Please give an estimate in story points.  Whatever the first number is that you think of, that is the estimate.
    - Time estimate: To adjust for time differentials, please estimate in 'days' to get a number (eg, 5 days) and then multiply that by 5 to get a number, then drop the units.  eg, 25.  That is your estimate in minutes, eg, 25 minutes.  I know that seems wrong but please follow this formula.  We will tweak as we go.
   - Log the date and time.
   - Anything else important you can think of
###

Summary:
- Break down the work into 5 workstreams that can be worked on simulatenously without risking conflicts
- Do thorough research within the repo so you understand how to accomplish the tasks, and then clearly describe them in detail as if for a technically proficient junior with no critical thinking skills.  Be detailed and explicit.  No ambiguity.
- Put each workstream into a single .md file
- Embed above instructions at the end of the file

And that's it!  Thanks!
