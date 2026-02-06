---
name: "do-setup-testing"
description: "Set up a testing framework for a project that doesn't have one. Use when user wants to add testing infrastructure before writing tests. Detects project type, recommends framework, configures with best practices."
---

# Setup Testing Framework

Configure testing infrastructure for a project that lacks it.

## When to Use

- Project has no test framework configured
- User wants to establish testing before TDD workflow
- Migrating to a new test framework

## Process

**Step 1**: Detect project type

Examine manifest files: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.

**Step 2**: Recommend framework

| Language | Default | Details |
|----------|---------|---------|
| JavaScript/TypeScript | Vitest | See `references/vitest.md` |
| Python | pytest | See `references/pytest.md` |
| Go | go test | See `references/go-test.md` |
| Rust | cargo test | See `references/rust-test.md` |
| Java | JUnit 5 | Built-in to most IDEs |
| Ruby | RSpec | `gem install rspec` |

**Step 3**: Confirm with user

Use AskUserQuestion to confirm framework choice, test location, and extras (coverage, watch mode).

**Step 4**: Install and configure

1. Add dev dependencies
2. Create test directory
3. Add test scripts to manifest
4. Create example test file
5. Update `.gitignore` if needed

**Step 5**: Verify

Run the example test to confirm setup works.

## Output

```
═══════════════════════════════════════
Testing Framework Configured
  Framework: [name]
  Test dir: [path]
  Run: [command]
Next: /do:it test [target]
═══════════════════════════════════════
```
