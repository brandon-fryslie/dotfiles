---
name: make-a-commit
description: Use when the user wants Codex to force an immediate git commit by delegating the commit action to the local claude CLI with add-all, no-tests, and clean-worktree instructions.
---

# Make A Commit

Use this skill when the user explicitly wants the local `claude` CLI to take over commit creation.

Run the bundled script exactly once from the target repository root:

```bash
bash <path-to-skill>/scripts/make_commit.sh
```

After it finishes, verify the result with:

```bash
git log --oneline -1
git status --short
```

Report the new commit hash and whether the worktree is clean.
