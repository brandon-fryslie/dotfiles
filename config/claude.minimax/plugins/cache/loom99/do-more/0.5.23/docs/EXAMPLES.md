# Real-World Examples

This guide walks through actual scenarios you'll encounter and shows exactly how to handle them with Do More Now.

---

## Scenario 1: "I Just Inherited a Codebase"

You've been handed a project you've never seen. What do you do?

### Step 1: Get the Lay of the Land

```bash
/do:plan status
```

Claude will:
- Run the app (if it can)
- Check what's broken
- Assess test coverage
- Identify obvious problems

**Output**: A STATUS report telling you what you're dealing with.

### Step 2: Understand the Architecture

```bash
/do:explore what's the overall architecture here
```

Claude reads the codebase and explains:
- How it's structured
- Where the main components are
- How data flows through the system

### Step 3: Find the Bodies

```bash
/do:plan audit
```

Comprehensive assessment of:
- Code quality issues
- Security concerns
- Tech debt
- Missing documentation

Now you know what you're working with.

---

## Scenario 2: "There's a Bug in Production"

Something's broken and users are complaining.

### Quick Fix (Known Bug)

If you know what's wrong:

```bash
/do:it fix the null pointer in user.ts line 47
```

Claude will:
1. Look at the code
2. Fix the specific issue
3. Verify it works
4. Commit

### Investigation (Unknown Bug)

If you don't know what's causing it:

```bash
/do:it debug users are getting logged out randomly
```

Claude will:
1. Look for causes
2. Form hypotheses
3. Test them
4. Identify root cause
5. Explain what's happening

Then fix it:

```bash
/do:it fix the session timeout issue
```

---

## Scenario 3: "Add a New Feature"

Product wants a new user settings page.

### Option A: TDD (Clear Requirements)

If you know exactly what it should do:

```bash
/do:it tdd add user settings page with email, password, and notification preferences
```

Claude will:
1. Write tests for each setting
2. Implement the UI
3. Connect to backend
4. Make all tests pass

### Option B: Iterative (Exploratory)

If you need to see it to know what you want:

```bash
/do:it iterate build a user settings page
```

Claude will:
1. Build a basic version
2. Show you
3. Refine based on feedback
4. Repeat until done

### Option C: Plan First (Complex Feature)

If it's a big feature with many parts:

```bash
/do:plan feature user settings with profile, security, notifications, and integrations
```

Claude creates a plan breaking it into pieces. Then:

```bash
/do:it
```

Execute the plan piece by piece.

---

## Scenario 4: "The Tests Are a Mess"

Tests exist but they're unreliable, slow, or don't catch real bugs.

### Assess the Situation

```bash
/do:plan audit
```

Look at the "Test Suite Assessment" section. It will tell you:
- Which tests actually catch bugs
- Which tests are "theater" (pass even when code is broken)
- Coverage gaps

### Fix the Tests

```bash
/do:it test improve the auth module tests to actually catch bugs
```

Claude will:
1. Identify what's missing
2. Write tests that verify real behavior
3. Delete useless tests
4. Ensure tests fail when code breaks

---

## Scenario 5: "This Code Needs to Be Cleaned Up"

The codebase has grown messy. Time to refactor.

### Small Cleanup

```bash
/do:chores
```

Quick wins: formatting, unused imports, obvious fixes.

### Targeted Refactoring

```bash
/do:it refactor the database connection handling (don't change the API)
```

Claude will:
1. Understand current behavior
2. Restructure the code
3. Verify behavior is unchanged
4. Commit incrementally

### Big Restructuring

```bash
/do:plan refactor the entire auth module
```

Get a plan first. Review it. Then:

```bash
/do:it
```

---

## Scenario 6: "I Need to Understand This Code"

You're staring at unfamiliar code and need to understand it.

### Quick Questions

```bash
/do:explore what does this calculatePricing function do
/do:explore where is the user session created
/do:explore how does authentication work here
```

Fast answers with file:line references.

### Deep Understanding

```bash
/do:explore trace the data flow from login to dashboard
```

Claude follows the code path and explains each step.

### External Context

```bash
/do:external-research what's the best practice for JWT refresh tokens
```

Web research when codebase context isn't enough.

---

## Scenario 7: "Add API Authentication"

You need to add auth to an API that doesn't have it.

### Research First

```bash
/do:external-research JWT vs session authentication for REST APIs
```

Claude researches options, explains tradeoffs, recommends an approach.

### Plan the Implementation

```bash
/do:plan feature JWT authentication with refresh tokens
```

Get a structured plan with all the pieces identified.

### Implement with TDD

```bash
/do:it tdd
```

Since this is API logic with clear requirements, TDD is perfect.

### Verify Security

```bash
/do:plan audit security
```

Check for common auth vulnerabilities.

---

## Scenario 8: "Working on Someone Else's PR"

You're reviewing or continuing someone else's work.

### Understand What Changed

```bash
/do:explore what are the main changes in this branch
```

### Review the Code

```bash
/do:it review the changes on this branch
```

Claude will assess:
- Correctness
- Quality
- Security concerns
- Missing tests

### Continue the Work

```bash
/do:it fix the issues identified in review
```

---

## Scenario 9: "Setting Up a New Project"

Starting from scratch.

### Initialize with Structure

```bash
/do:plan init my-new-api
```

Claude will:
1. Ask about project type, stack, requirements
2. Create appropriate structure
3. Set up tooling (tests, linting, etc.)
4. Document decisions

### Set Up Testing

```bash
/do:it setup testing
```

Claude detects your project type and configures the appropriate test framework.

---

## Scenario 10: "I Want Full Autonomy"

You trust Claude and want it to just work without asking.

### Autonomous Mode

```bash
/do:it autonomous fix all the linting errors and update the deprecated dependencies
```

Claude will:
1. Work through everything
2. Document decisions (not ask about them)
3. Show you summary at the end

### Review What It Did

```bash
cat .agent_planning/SUMMARY-*.txt
```

See exactly what happened.

---

## Scenario 11: "I Want to Approve Everything"

You want to review every decision before Claude makes it.

### Careful Mode

```bash
/do:it carefully add payment processing
```

Claude will stop and ask before:
- Choosing between approaches
- Making security-related changes
- Adding dependencies
- Any significant decision

---

## Scenario 12: "Complex Multi-Step Work"

Big feature with multiple phases.

### Chain Commands

```bash
/do:plan feature user management /do:it tdd /do:chores
```

Executes in sequence:
1. Plan the feature
2. Implement with TDD
3. Clean up

### Or Step by Step

```bash
/do:plan feature user management
# Review the plan
/do:it
# Review the implementation
/do:chores
```

Same result, more control.

---

## Scenario 13: "Update Documentation"

Docs are out of date.

### Quick README Update

```bash
/do:docs readme
```

Claude syncs README with current reality.

### API Documentation

```bash
/do:docs api
```

Generate/update API docs from code.

### Full Doc Refresh

```bash
/do:docs
```

Claude assesses what's stale and suggests updates.

---

## Scenario 14: "Performance Investigation"

App is slow, you don't know why.

### Research Performance Patterns

```bash
/do:external-research common React performance issues
/do:external-research database query optimization
```

### Audit the Code

```bash
/do:plan audit
```

Look at the "Efficiency" section for:
- N+1 queries
- Unnecessary re-renders
- Missing indexes
- Resource leaks

### Fix Specific Issues

```bash
/do:it fix the N+1 query in the user list
/do:it optimize the dashboard rendering
```

---

## Scenario 15: "Technical Debt Cleanup"

Time to pay down debt.

### Inventory the Debt

```bash
/do:chores debt
```

Creates an inventory of tech debt.

### Tackle It Piece by Piece

```bash
/do:it fix the deprecated API usage in auth module
/do:it refactor the duplicated validation logic
/do:it remove the dead code in utils/
```

---

## Pattern Quick Reference

| Situation | Commands |
|-----------|----------|
| New codebase | `/do:plan status` → `/do:explore` → `/do:plan audit` |
| Bug fix | `/do:it fix` or `/do:it debug` → `/do:it fix` |
| New feature (clear) | `/do:it tdd` |
| New feature (exploratory) | `/do:it iterate` |
| New feature (complex) | `/do:plan feature` → `/do:it` |
| Code cleanup | `/do:chores` or `/do:it refactor` |
| Understanding code | `/do:explore` |
| Learning best practices | `/do:external-research` |
| Full autonomy | `/do:it autonomous` |
| Full control | `/do:it carefully` |
| Security check | `/do:plan audit security` |
| Test improvement | `/do:plan audit` → `/do:it test` |
| New project | `/do:plan init` |
| Doc update | `/do:docs` |

---

## Tips for Success

### Be Specific

```bash
# Vague (could go anywhere)
/do:it fix things

# Specific (focused result)
/do:it fix the email validation that allows empty strings
```

### Use Constraints

```bash
# Might touch too much
/do:it refactor auth

# Constrained scope
/do:it refactor auth (just the token refresh logic, leave login alone)
```

### Build Iteratively

```bash
# Too big to get right
/do:it add complete user management system

# Manageable pieces
/do:plan feature user management
/do:it tdd add user registration
/do:it tdd add user login
/do:it iterate add user profile page
```

### Let Claude Pick

When unsure of the right mode, just say what you want:

```bash
/do:it add payment processing
```

Claude will assess and choose TDD vs iterative appropriately.

---

## Related Documentation

- [Getting Started](./GETTING-STARTED.md) - Quick introduction
- [Workflows Guide](./WORKFLOWS.md) - When to use which workflow
- [Commands Reference](./COMMANDS.md) - Full command documentation
