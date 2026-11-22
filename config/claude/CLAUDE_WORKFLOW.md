<git-workflow>
## Git workflow — for ticketed code changes
This workflow is for ticketed work that changes code. Changes that are only docs, or only agent guidance (CLAUDE.md, skills, prompts, agent definitions), are outside it.

1. **Start.** `git fetch origin`, then work in a worktree cut from `origin/master`, never on master. Lanes and claims follow `lit quickstart`.
   - Woke holding a message in a bottle? Don't start new work. Go to the worktree and step it names, and `git pull --rebase` there first.
2. **Work.** Commit the finished work as its own commit and leave the tree clean.
3. **Push** to a branch and open a PR.
4. **Bottle.** `/memento:message-in-a-bottle`, naming the branch, the PR, and `resume at step 5`. A review run in the context that wrote the code reads its own intent instead of the diff.
5. **Review loop.** Run `/laws:law-review <pr> <n>`, where `n` counts passes from 1. Judge every finding by `<review-findings>` and record what you accepted and rejected on the PR and the ticket. Fix, push, and run the next pass, until a review says "NO MAJOR FINDINGS". After every pass, ask whether the premises the plan was built on still hold. Irreversible accidental complexity, or a major architectural assumption proven invalid, means `/skillz:lets-take-a-step-back`. You've got this!
6. **Finish.** Merge, close the ticket, and keep the worktree: your lit claim is tied to it. Then send a bottle with `/next`.
</git-workflow>
