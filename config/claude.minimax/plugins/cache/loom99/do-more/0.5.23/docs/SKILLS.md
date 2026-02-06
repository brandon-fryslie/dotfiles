# Skills Reference

Skills are reusable workflow definitions that orchestrate agents and define processes. Do More Now includes seventeen skills organized into categories.

## Skill Overview

### Implementation Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `do:tdd-workflow` | Test-driven development | `/do:it tdd` |
| `do:iterative-workflow` | Incremental implementation | `/do:it iterate`, default |
| `do:fix` | Bug fix workflow | `/do:it fix` |
| `do:refactor` | Safe code restructuring | `/do:it refactor` |
| `do:debug` | Root cause investigation | `/do:it debug` |
| `do:review` | Code review | `/do:it review` |
| `do:add-tests` | Add test coverage | `/do:it test` |
| `do:setup-testing` | Configure test framework | `/do:it setup testing` |

### Planning Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `do:init-project` | New project initialization | `/do:plan init` |
| `do:status-check` | Quick status diagnostic | `/do:plan status` |
| `do:feature-proposal` | Feature design proposals | `/do:plan feature` |

### Audit Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `do:audit-master` | Multi-dimension audit routing | `/do:audit` |
| `do:deep-audit` | Code quality analysis | Code quality dimension |
| `do:planning-audit` | Planning alignment analysis | Planning dimension |
| `do:security-audit` | Security analysis | Security dimension |
| `do:competitive-audit` | Market comparison | Competitive dimension |

### Research Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `do:market-research` | External/market research | `/do:external-research market` |

### System Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `do:evaluation-profiles` | Context-aware validation | Used by project-evaluator |
| `do:gating-controller` | Decision approval routing | Used by commands |
| `do:route-subcommands` | Subcommand parsing | Used by commands |
| `do:advanced-skill-builder` | Skill creation helper | Creating new skills |

---

## Implementation Skills

### do:tdd-workflow

**Purpose**: Test-driven development - tests first, then implement.

**Process**:
```
┌─────────────────────────────────────────┐
│ TestLoop (max 3 iterations)             │
│   1. Design tests (functional-tester)   │
│   2. Evaluate tests (project-evaluator) │
│   Loop until tests are sufficient       │
├─────────────────────────────────────────┤
│ ImplementLoop                           │
│   1. Implement (test-driven-impl)       │
│   2. Evaluate (work-evaluator)          │
│   Loop until complete                   │
└─────────────────────────────────────────┘
```

**When to Use**:
- APIs and backend services
- Libraries and frameworks
- Clear, well-defined requirements
- Anything that should work the same way every time

**Output**:
```
═══════════════════════════════════════
TDD Implementation Complete
  Tests: [count] | All passing
  Files: [count] | Commits: [count]
Next: /do:plan to update status
═══════════════════════════════════════
```

---

### do:iterative-workflow

**Purpose**: Build incrementally with runtime validation.

**Process**:
```
┌─────────────────────────────────────────┐
│ Loop                                    │
│   1. Implement (iterative-implementer)  │
│   2. Evaluate (work-evaluator)          │
│                                         │
│   Verdict:                              │
│   - COMPLETE → Exit                     │
│   - INCOMPLETE → Continue               │
│   - PAUSE → Research, then continue     │
│   - BLOCKED → Surface to user           │
└─────────────────────────────────────────┘
```

**When to Use**:
- UI and frontend work
- Exploratory features
- Visual or interactive functionality
- When you need to see it to know if it's right

**Output**:
```
═══════════════════════════════════════
Iterative Implementation Complete
  Iterations: [count]
  Files: [count] | Commits: [count]
Next: /do:plan to update status
═══════════════════════════════════════
```

---

### do:fix

**Purpose**: Bug fix workflow with investigation and verification.

**Process**:
1. Investigate root cause (researcher)
2. Implement fix (iterative-implementer)
3. Verify fix works (work-evaluator)
4. Ensure no regressions

**When to Use**: When something is broken and needs fixing.

---

### do:refactor

**Purpose**: Safe code restructuring without behavior change.

**Process**:
1. Understand current behavior
2. Plan restructuring
3. Implement incrementally
4. Verify behavior unchanged

**Principles**:
- No behavior changes
- Incremental steps
- Frequent verification
- Clean commits

---

### do:debug

**Purpose**: Systematic root cause investigation.

**Process**:
1. Reproduce the issue
2. Gather evidence (logs, errors)
3. Form hypotheses
4. Test hypotheses
5. Identify root cause

**Output**: Clear explanation of root cause and recommended fix.

---

### do:review

**Purpose**: Code review and quality assessment.

**Process**:
1. Understand context (what changed, why)
2. Review for correctness
3. Review for quality
4. Review for security
5. Provide feedback

---

### do:add-tests

**Purpose**: Add test coverage to existing untested code.

**Process**:
1. Identify untested functionality
2. Design tests for real behavior
3. Implement tests
4. Verify coverage improvement

---

### do:setup-testing

**Purpose**: Configure test framework for a project.

**Supported Frameworks**:
- pytest (Python)
- jest (JavaScript)
- vitest (JavaScript)
- go test (Go)
- rust test (Rust)

**Process**:
1. Detect project type
2. Recommend appropriate framework
3. Configure with best practices
4. Create example test

---

## Planning Skills

### do:init-project

**Purpose**: Initialize a new project with proper structure.

**Process**:
1. Gather requirements (project type, goals)
2. Make architecture decisions
3. Create project structure
4. Configure foundational files
5. Document decisions

**Output**: Project skeleton ready for development.

---

### do:status-check

**Purpose**: Quick diagnostic of project state.

**Process**:
1. Read recent STATUS files
2. Check for blockers
3. Summarize current state
4. Identify next priorities

**Output**: Brief status summary with recommendations.

---

### do:feature-proposal

**Purpose**: Design features with user value focus.

**Process**:
1. Understand user need
2. Explore solution space
3. Define feature scope
4. Document proposal

**Output**: `FEATURE-*.md` with problem statement, user stories, and technical considerations.

---

## Audit Skills

### do:audit-master

**Purpose**: Route to appropriate audit dimensions.

**Dimensions**:
| Dimension | What It Assesses |
|-----------|------------------|
| Code Quality | Architecture, design, efficiency, correctness |
| Planning | Strategy coherence, alignment across layers |
| Security | CVEs, secrets, auth, OWASP Top 10 |
| Competitive | Feature parity, gaps, differentiation |

**Process**:
1. Detect requested dimensions (or ask user)
2. Route to appropriate audit skill(s)
3. Aggregate results

**Trigger Detection**:
- "audit" → Code Quality (default)
- "audit security" → Security
- "audit plans" → Planning
- "audit competitive" → Competitive
- "audit everything" → All dimensions

---

### do:deep-audit

**Purpose**: Comprehensive code quality analysis.

**Covers**:
- Architecture assessment (fractal analysis)
- Design quality assessment
- Efficiency analysis
- Feature cohesion
- Domain-specific analysis

**Output**: Detailed findings with priorities (P0-P3).

---

### do:planning-audit

**Purpose**: Assess alignment across planning layers.

**Checks**:
- Strategy coherence
- Strategy → Architecture alignment
- Architecture → Plans alignment
- Plans → Implementation alignment
- Planning horizon appropriateness

**Intensity Levels**:
| Level | Trigger | Scope |
|-------|---------|-------|
| Quick | "quick" | Basic coherence |
| Medium | default | Full alignment |
| Thorough | "thorough" | Deep forensic |

---

### do:security-audit

**Purpose**: Security-focused analysis.

**Checks**:
- Dependency vulnerabilities (CVEs)
- Hardcoded secrets
- Authentication patterns
- Authorization controls
- OWASP Top 10

**Intensity Levels**:
| Level | Scope |
|-------|-------|
| Quick | Dependency scan + secret scan |
| Medium | + Auth review + OWASP quick |
| Thorough | Full OWASP + manual review |

---

### do:competitive-audit

**Purpose**: Compare against market alternatives.

**Checks**:
- Competitor identification
- Feature comparison matrix
- Gap analysis
- Opportunity identification
- Differentiation assessment

**Requires**: External research (web search)

---

## Research Skills

### do:market-research

**Purpose**: External/market research for competitive landscape.

**Process**:
1. Identify competitors
2. Gather feature information
3. Analyze demand signals
4. Document findings

**Output**: Market research report with comparisons.

---

## System Skills

### do:evaluation-profiles

**Purpose**: Context-aware validation criteria for evaluator agents.

**Profiles**:
| Profile | Use For |
|---------|---------|
| `cli-tool` | CLI tools, scripts |
| `web-app` | Web apps, frontend |
| `agent-prompt` | Agents, skills, prompts |
| `library` | Libraries, SDKs |
| `api-service` | APIs, backend services |
| `config-infra` | Config, infrastructure |

**Prevents**: Wasted effort on irrelevant validations (e.g., pagination checks on CLIs).

---

### do:gating-controller

**Purpose**: Process pending decisions from agents.

**Gate Types**:
| Gate | When | Purpose |
|------|------|---------|
| decision-gate | During work | Review architecture/technology choices |
| security-gate | During work | Review security-sensitive changes |
| checkpoint-gate | End of command | Verify completed work |

**Modes**:
| Mode | Behavior |
|------|----------|
| BLOCKING | Always ask |
| NONBLOCKING | Auto-approve |
| CUSTOM | Evaluate against rule |

See [GATING.md](./GATING.md) for full documentation.

---

### do:route-subcommands

**Purpose**: Parse and execute inline `/do:` subcommands.

**Process**:
1. Detect `/do:` patterns in arguments
2. Extract pre-commands and post-commands
3. Return main_instructions
4. After main workflow, execute post-commands

**Example**:
```
Input: /do:plan feature auth /do:it tdd
Output:
  pre_commands: []
  main_instructions: "feature auth"
  post_commands: ["/do:it tdd"]
```

---

### do:advanced-skill-builder

**Purpose**: Create production-quality Claude skills.

**Process**:
1. Gather content (URLs, docs, domain knowledge)
2. Analyze patterns
3. Apply progressive disclosure
4. Output skill directory structure

**Output**: Complete skill with SKILL.md and references/

---

## Skill Interaction Patterns

### Skill → Agent

Skills invoke agents through the Task tool:
```
Skill defines workflow → Task tool spawns agent → Agent executes → Returns to skill
```

### Skill → Skill

Skills can invoke other skills for composition:
```
do:audit-master → do:deep-audit
                → do:security-audit
                → do:planning-audit
```

### Command → Skill → Agent

Full flow:
```
/do:it fix auth bug
    ↓
it.md detects "fix" intent
    ↓
Invokes do:fix skill
    ↓
Skill spawns researcher (investigate)
    ↓
Skill spawns iterative-implementer (fix)
    ↓
Skill spawns work-evaluator (verify)
```

---

## Related Documentation

- [Commands Reference](./COMMANDS.md) - Commands that invoke skills
- [Agents Reference](./AGENTS.md) - Agents that skills orchestrate
- [Workflows Guide](./WORKFLOWS.md) - Common workflow patterns
- [Gating Configuration](./GATING.md) - Decision checkpoint system
