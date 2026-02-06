---
name: "do-init-project"
description: "Initialize a new project or major architectural component. Guides you through setup with minimal effort and maximum alignment through adaptive questioning and technology recommendations. Entry point for /do-more:init-project command."
context: fork
---

You want to initialize a project or make major architectural decisions. This command guides you through the process with the project-architect agent, which asks targeted questions, makes informed technology recommendations, and generates comprehensive specifications.

Project description from user:
<project-description>
$ARGUMENTS
</project-description>

## Workflow

### Step 1: Understand Context

**Goal**: Determine which initialization scenario this is

Analyze the current working directory and project description to classify the scenario:

**A. Brand New Project (Blank Slate)**
- No existing codebase or minimal/empty directory
- User wants to start from scratch
- **Example**: "Build a CLI tool for task management"

**B. Major Architectural Change to Existing Project**
- Existing codebase with established structure
- User wants fundamental restructuring affecting most/all components
- **Examples**: "Migrate monolith to microservices", "Change from REST to GraphQL", "Switch to event-driven architecture"

**C. Adding Major Component to Existing Project (Greenfield Addition)**
- Existing codebase functioning in one domain
- User wants entirely new subsystem with different architecture
- **Examples**: "Add frontend to backend-only project", "Add web UI to CLI tool", "Add mobile app to web app"

**D. Technology Migration**
- Existing codebase with functionality to preserve
- User wants to rewrite using different technology
- **Examples**: "Migrate JavaScript to TypeScript", "Migrate Python 2 to Python 3", "Migrate MySQL to PostgreSQL"

**E. Designing New Feature from Scratch**
- Existing codebase
- User wants new feature/module with zero existing implementation
- **Examples**: "Add payment processing to e-commerce site", "Add real-time collaboration to editor"

**Detection Logic**:

```
Check for existing codebase indicators:
- Git repository (.git/ exists)
- Package files (package.json, pyproject.toml, go.mod, Cargo.toml)
- Source files (*.py, *.js, *.go, *.rs)
- PROJECT_SPEC.md in .agent_planning/

If NO codebase indicators → Scenario A (New Project)

If codebase exists:
  Parse user description for keywords:
    - "migrate", "rewrite", "change to" → Scenario B or D
    - "add [major component]", "create [subsystem]" → Scenario C
    - "add [feature]", "implement [capability]" → Scenario E
    - "architecture", "restructure", "refactor" → Scenario B

If ambiguous, ASK USER:
  "I see an existing project. Are you:
   1. Making major architectural changes to the whole system
   2. Adding a new major component (like a frontend or mobile app)
   3. Migrating to different technology while preserving functionality
   4. Designing a new feature within the existing architecture"
```

**Output**: Clear scenario classification (A, B, C, D, or E)

---

### Step 2: Initialize with project-architect Agent

**Goal**: Generate comprehensive project specification through guided interview

Use the `do:project-architect` agent to:

1. **Classify project archetype** (CLI, web app, API, library, mobile app, etc.)
2. **Conduct adaptive interview** (15-25 targeted questions based on archetype)
   - Cover 12 concern areas: Identity, Technology Stack, Structure, Workflow, Testing, Dependencies, Configuration, Documentation, Deployment, Error Handling, Security, License
   - Skip irrelevant questions (e.g., don't ask CLI tool about databases unless needed)
   - Explain WHY each question matters before asking
   - Present 2-3 options with tradeoffs for major decisions
3. **Research ambiguities** (invoke do:researcher if user is uncertain)
4. **Generate PROJECT_SPEC.md** in `.agent_planning/` with:
   - Project Overview (purpose, users, goals, success criteria)
   - Architecture (system design, components, data flow)
   - Technology Stack (all choices with rationale)
   - Development Workflow (Git, testing, CI/CD)
   - Architecture Decisions (ADR-style: decision, context, options, rationale)
   - Implementation Roadmap (phased: MVP → Enhancement → Polish)
   - Future Considerations (deferred decisions with triggers and upgrade paths)
5. **Generate ARCHITECTURE.md** in `.agent_planning/` (if complex system)
6. **Generate scaffolding** (Scenario A only):
   - Create directory structure following language conventions
   - Generate skeleton files (entry point, config, tests)
   - Initialize version control with .gitignore
   - Initialize package manager
   - Create initial README.md
   - Validate: project builds and test runner works

**Important Instructions for project-architect**:

Pass the scenario context to project-architect:
```
<scenario>
{Scenario classification from Step 1}
</scenario>

<project-description>
{User's original input}
</project-description>

<existing-codebase>
{If Scenarios B-E: Summary of current codebase structure, technologies, key components}
{If Scenario A: "None - new project"}
</existing-codebase>
```

---

### Step 3: Validate Outputs

**Goal**: Verify generated artifacts are correct and complete

#### For Scenario A (New Project with Scaffolding):

1. **Verify PROJECT_SPEC.md exists and is complete**:
   - [ ] All 7 main sections present (Overview, Architecture, Tech Stack, Workflow, Decisions, Roadmap, Future)
   - [ ] 5-10 ADRs documenting major decisions
   - [ ] Roadmap is phased with clear deliverables
   - [ ] Future Considerations includes deferred decisions with triggers

2. **Verify scaffolding structure**:
   - [ ] Directory structure follows language conventions
   - [ ] All expected files created (.gitignore, README.md, package config, etc.)
   - [ ] No placeholder content in skeleton files

3. **Test scaffolding functionality**:
   ```bash
   # Verify project builds without errors
   {language-specific build command: python -c "import project_name", pnpm install, go build, cargo build}

   # Verify test runner works
   {language-specific test command: pytest, pnpm test, go test ./..., cargo test}
   ```

   **If validation fails**:
   - Report specific error to user
   - Suggest fix: "Build failed with: [error]. To fix: [suggestion]"
   - Do NOT proceed to Step 4 until scaffolding is valid

4. **Verify git repository**:
   - [ ] Git initialized (if not already)
   - [ ] .gitignore appropriate for language
   - [ ] Initial commit created

#### For Scenarios B-E (No Scaffolding):

1. **Verify PROJECT_SPEC.md exists and is complete** (same checks as Scenario A)

2. **Scenario-specific checks**:

   **Scenario B (Architectural Change)**:
   - [ ] Current architecture documented in PROJECT_SPEC.md
   - [ ] Target architecture documented
   - [ ] Migration plan is phased with clear steps
   - [ ] Rollback plan for each phase
   - [ ] Integration points identified

   **Scenario C (Greenfield Addition)**:
   - [ ] New component architecture documented
   - [ ] Integration points with existing system identified
   - [ ] Shared code/libraries identified
   - [ ] Deployment impact documented

   **Scenario D (Technology Migration)**:
   - [ ] Feature parity checklist included (what must be preserved)
   - [ ] Migration strategy (incremental vs. big bang) documented
   - [ ] Data migration approach documented
   - [ ] Testing strategy for equivalence validation

   **Scenario E (Feature Design)**:
   - [ ] Feature requirements clearly specified
   - [ ] Acceptance criteria defined
   - [ ] Integration points identified
   - [ ] Success metrics defined

---

### Step 4: Display Summary and Handoff

**Goal**: Show user what was created and guide to next steps

#### Generate Summary Display

Create formatted summary with scenario-specific details:

```
═══════════════════════════════════════════════════════════════
Project Initialization Complete
═══════════════════════════════════════════════════════════════

Scenario: {Scenario Name}

📄 Documentation Generated:
  • PROJECT_SPEC.md: .agent_planning/PROJECT_SPEC.md
  • ARCHITECTURE.md: .agent_planning/ARCHITECTURE.md (if created)

{IF SCENARIO A - SHOW SCAFFOLDING INFO}
🏗️  Scaffolding Created:
  • {N} files generated
  • Git repository initialized
  • Package manager configured ({tool name})
  • Build verified: ✓
  • Test runner verified: ✓

───────────────────────────────────────────────────────────────
Key Decisions Made
───────────────────────────────────────────────────────────────

{List 3-5 most important decisions from PROJECT_SPEC.md ADRs}

1. Language: {Language Name}
   Rationale: {One sentence}

2. {Framework/Database/etc.}: {Choice}
   Rationale: {One sentence}

3. {Another major decision}: {Choice}
   Rationale: {One sentence}

───────────────────────────────────────────────────────────────
Next Steps
───────────────────────────────────────────────────────────────

1. 📖 Review the PROJECT_SPEC.md
   Read through .agent_planning/PROJECT_SPEC.md and verify it matches
   your vision.

2. 💬 Discuss & Refine (if needed)
   If anything doesn't match your expectations, let's discuss and
   update the spec before implementation begins.

3. ▶️  Start Implementation
   Once you're satisfied with the spec, run:

   {SCENARIO-SPECIFIC COMMAND - see below}

═══════════════════════════════════════════════════════════════
```

#### Scenario-Specific Next Step Recommendations

**Scenario A: New Project from Scratch**
```
/do:plan

This will:
  • Evaluate current state (will show ~0% complete - that's expected!)
  • Generate prioritized backlog from PROJECT_SPEC.md
  • Create implementation plan

Then choose your workflow:
  • /do:tdd (for TDD approach)
  • /do:it (for iterative approach)
```

**Scenario B: Major Architectural Change**
```
/do:plan "architectural-migration"

This will:
  • Analyze gap between current and target architecture
  • Identify migration steps
  • Create phased implementation plan

Focus on incremental migration to minimize risk. Implement Phase 1,
validate thoroughly, then proceed to Phase 2.
```

**Scenario C: Greenfield Component Addition**
```
/do:plan "{component-name}"

This will:
  • Evaluate existing system + new component design
  • Identify integration points
  • Create backlog focused on new component

Implement the new component while respecting existing architecture
patterns and code conventions.
```

**Scenario D: Technology Migration**
```
Before running /plan, create your feature parity checklist:
  1. Review PROJECT_SPEC.md migration plan
  2. List all functionality that must be preserved
  3. Identify high-risk areas (complex logic, critical paths)

Then run:
/do:plan "migration-to-{new-tech}"

Consider incremental migration if possible (less risky than big bang).
The PROJECT_SPEC.md includes a phased approach.
```

**Scenario E: Feature Design**
```
/do:plan "{feature-name}"

This will:
  • Evaluate existing system
  • Create backlog for new feature
  • Identify integration points

Then implement using your preferred workflow:
  • /do:tdd (for features with clear requirements)
  • /do:it (for exploratory/UI features)
```

---

## Error Handling

### Error 1: Missing or Empty Project Description

**If `$ARGUMENTS` is empty or only whitespace**:

```
❌ Error: No project description provided

Please provide a brief description of what you want to build.

Examples:
  /do:init-project "Build a CLI tool for managing TODO lists"
  /do:init-project "Add React frontend to this backend API"
  /do:init-project "Migrate this project from JavaScript to TypeScript"

Usage: /do:init-project [project description]
```

**Stop execution. Wait for user to provide description.**

---

### Error 2: Ambiguous Scenario Detection

**If scenario cannot be determined from codebase + description**:

```
⚠️  Ambiguous Request

I see an existing project, but I'm not sure what you want to do.

Are you:
  A. Making major architectural changes to the whole system
  B. Adding a new major component (like a frontend or mobile app)
  C. Migrating to different technology while preserving functionality
  D. Designing a new feature within the existing architecture

Please clarify, and I'll proceed with the appropriate approach.
```

**Wait for user clarification before proceeding.**

---

### Error 3: Scaffolding Validation Failure

**If project fails to build or test runner fails** (Scenario A only):

```
❌ Scaffolding Validation Failed

Build Error:
{actual error message}

This usually means:
{interpretation of error - missing dependency, syntax error, etc.}

Suggested fix:
{specific action to resolve}

I'll fix this and re-validate.
```

**Attempt automatic fix if possible. Otherwise, report to user and pause.**

---

### Error 4: PROJECT_SPEC.md Conflict

**If PROJECT_SPEC.md already exists in `.agent_planning/`**:

```
⚠️  PROJECT_SPEC.md Already Exists

A project specification already exists:
  .agent_planning/PROJECT_SPEC.md

Do you want to:
  1. Overwrite the existing spec (previous spec will be archived)
  2. Create a new version (PROJECT_SPEC_v2.md)
  3. Cancel and review existing spec first

Please choose 1, 2, or 3.
```

**Wait for user choice before proceeding.**

**If user chooses 1**: Archive existing spec to `.agent_planning/archive/PROJECT_SPEC-{timestamp}.md`, then create new spec.

**If user chooses 2**: Create `PROJECT_SPEC_v2.md` (or v3, v4, etc. if those exist).

**If user chooses 3**: Display existing spec summary and exit gracefully.

**Tip:** Add to CLAUDE.md to customize: `do: auto-archive existing specs without asking`

---

### Error 5: Excessive Research Invocations

**If project-architect invokes do:researcher >3 times**:

```
⚠️  Multiple Ambiguities Detected

The project-architect has encountered several areas requiring research:
{list ambiguous areas}

This suggests the project requirements may need more upfront discussion.

I can continue with research-based decisions, OR we can discuss these
decisions together to ensure they match your intent.

Continue with automated research? (yes/no)
```

**If user says yes**: Continue with researcher invocations.

**If user says no**: Switch to interactive mode, asking user directly for decisions.

---

## Tips for Users

### Writing Effective Project Descriptions

**Good descriptions include**:
- **What**: What are you building?
- **Who**: Who will use it?
- **Why**: What problem does it solve?

**Examples**:

✅ **Good**: "Build a CLI tool for validating JSON files against JSON Schema. For developers on my team who need to validate config files before deployment."

✅ **Good**: "Add a React frontend to this FastAPI backend. Users need a web interface to view and edit tasks."

✅ **Good**: "Migrate this JavaScript project to TypeScript to catch type errors at compile time."

❌ **Too vague**: "Build an app" (What kind of app? For what purpose?)

❌ **Too detailed**: [200-word essay with every detail] (Let the agent ask questions!)

**Sweet spot**: 1-3 sentences giving project type, purpose, and users.

---

### When to Use init-project vs plan

**Use `/do:init-project` when**:
- Starting a brand new project with no spec
- Making major architectural changes requiring new decisions
- Adding an entirely new subsystem to existing project
- Migrating to different technology
- Designing a new feature with no existing spec

**Use `/do:plan` directly when**:
- Project already has PROJECT_SPEC.md
- Implementing features defined in existing spec
- Continuing work after initialization complete
- Minor changes or bug fixes

**Think of it this way**:
- `init-project` = Architecture and planning (design phase)
- `plan` = Implementation planning (what to build next)

---

### Refining Specs After Generation

**It's OK to iterate!** If generated PROJECT_SPEC.md doesn't match your vision:

1. **Review carefully**: Read all sections, especially ADRs
2. **Identify mismatches**: Which decisions don't align with your intent?
3. **Discuss changes**: Tell me what needs adjusting and why
4. **Update spec**: I can regenerate specific sections or the whole spec
5. **Re-validate**: Once satisfied, proceed to /plan

**Common refinements**:
- Change technology choices (different framework, database, etc.)
- Adjust scope (reduce MVP size, defer features)
- Clarify requirements (add acceptance criteria)
- Update architecture (different component boundaries)

---

## Integration with dev-loop Workflow

This command is the **entry point** for project genesis. The full workflow is:

```
User idea
    ↓
/do:init-project (THIS COMMAND)
    ↓
project-architect → PROJECT_SPEC.md + ARCHITECTURE.md + scaffolding
    ↓
[User reviews spec]
    ↓
/do:plan
    ↓
project-evaluator → EVALUATION-*.md (gap analysis using PROJECT_SPEC.md)
    ↓
status-planner → PLAN-*.md (prioritized backlog)
    ↓
/do:tdd OR /do:it
    ↓
[Implementation agents execute work]
```

**Key integration points**:

1. **PROJECT_SPEC.md is authoritative**: All downstream agents (project-evaluator, status-planner, functional-tester, implementers) use this as ground truth.

2. **Scenario context flows**: Scenario classification informs how project-evaluator analyzes the project (new vs. migration vs. greenfield addition).

3. **Phased roadmap guides planning**: status-planner uses roadmap phases from PROJECT_SPEC.md to prioritize work.

4. **ADRs inform implementation**: Implementation agents reference ADRs to understand why decisions were made and maintain consistency.

5. **Future Considerations guide evolution**: When triggers are met, project-evaluator can flag that it's time to revisit deferred decisions.

---

## Summary

This command orchestrates project initialization through four steps:

1. **Understand Context**: Classify scenario (new project, architectural change, greenfield addition, migration, feature design)

2. **Initialize**: Invoke project-architect agent to conduct adaptive interview, make technology recommendations, and generate comprehensive PROJECT_SPEC.md

3. **Validate**: Verify generated artifacts are correct and complete. For new projects, verify scaffolding builds and tests run.

4. **Handoff**: Display summary of what was created, highlight key decisions, and recommend next command with scenario-specific guidance.

Your project foundation is now established. Review the spec, discuss any changes, then proceed to `/do:plan` to start implementation.
