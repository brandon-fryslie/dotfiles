---
name: "do-audit-master"
description: "Comprehensive audit across multiple dimensions - code quality, planning alignment, security, competitive analysis, and test coverage. Use when auditing any aspect of a project. Supports quick, medium, and thorough intensity levels."
---

# Audit Master

Comprehensive examination across multiple dimensions. Each dimension can be invoked independently or combined.

---

## Table of Contents

- [Dimension Selection](#dimension-selection)
- [Available Dimensions](#available-dimensions)
- [Intensity Levels](#intensity-levels)
- [Dimension 1: Code Quality](#dimension-1-code-quality)
- [Dimension 2: Planning Alignment](#dimension-2-planning-alignment)
- [Dimension 3: Security](#dimension-3-security)
- [Dimension 4: Competitive](#dimension-4-competitive)
- [Dimension 5: Test Coverage](#dimension-5-test-coverage)
- [Combined Audit Output](#combined-audit-output)
- [Complete Reference Index](#complete-reference-index)
- [Related Skills](#related-skills)

---

## Dimension Selection

**If user specifies dimensions explicitly** (e.g., "audit security", "audit plans", "audit tests"), run those dimensions only.

**If user says "audit" without specifying dimensions**, use AskUserQuestion to prompt:

```
Which audit dimensions would you like to run?

Options (multiSelect):
1. Code Quality - Architecture, design, efficiency, correctness (Recommended)
2. Planning Alignment - Strategy→Architecture→Plans→Implementation
3. Security - Dependencies, secrets, auth, OWASP Top 10
4. Competitive - Compare against alternatives in the market
5. Test Coverage - Test quality, gaps, coverage analysis
```

**If user says "audit everything" or "comprehensive audit"**, run ALL dimensions.

---

## Available Dimensions

| Dimension | Trigger Words | What It Assesses |
|-----------|---------------|------------------|
| Code Quality | "code", "quality", "architecture", "design", "efficiency" | Architecture, design, efficiency, correctness, domain-specific |
| Planning | "plans", "planning", "alignment", "strategy" | Strategy coherence, alignment across planning layers |
| Security | "security", "vulnerabilities", "CVE", "secrets" | CVEs, secrets, auth, OWASP Top 10 |
| Competitive | "competitive", "competitors", "market", "alternatives" | Feature parity, gaps, differentiation vs alternatives |
| Test Coverage | "tests", "testing", "coverage", "test quality" | Test quality, coverage gaps, testing strategy |

---

## Intensity Levels

All dimensions support three intensity levels:

| Level | Trigger Words | Typical Time | Depth |
|-------|---------------|--------------|-------|
| **Quick** | "quick", "glance", "overview", "fast" | 5-15 min | Spot-check, flag obvious issues |
| **Medium** | (default), "check", "review" | 20-45 min | Systematic verification |
| **Thorough** | "thorough", "comprehensive", "deep", "forensic" | 1-2 hours | Leave no stone unturned |

---

## Dimension 1: Code Quality

Comprehensive technical audit for architecture, design, efficiency, and correctness.

### When to Use Code Quality

- General health check
- Before major work
- Assessing technical debt
- After significant changes

### Code Quality Sub-Dimensions

| Sub-Dimension | Reference File | Focus |
|---------------|----------------|-------|
| Architecture | [references/code-quality/architecture.md](references/code-quality/architecture.md) | Structure, alignment, violations |
| Design Quality | [references/code-quality/design-quality.md](references/code-quality/design-quality.md) | Patterns, smells, intentionality |
| Efficiency | [references/code-quality/efficiency.md](references/code-quality/efficiency.md) | Dead code, redundancy, performance |
| Domains | [references/code-quality/domains.md](references/code-quality/domains.md) | Domain-specific anti-patterns |

### Code Quality Process

See [references/code-quality/](references/code-quality/) for detailed checklists covering:
1. Scope identification (whole project or specific area)
2. Sub-dimension selection (based on project type)
3. Systematic execution of applicable checklists
4. Evidence-based findings documentation

### Code Quality Output

```
Code Quality Audit:
  Architecture: [rating] | Design: [rating] | Efficiency: [rating]
  Findings: P0: n | P1: n | P2: n | P3: n
```

---

## Dimension 2: Planning Alignment

Hierarchical alignment audit across the planning stack:

```
Strategy/Vision → Architecture → Plans → Implementation
```

Each layer should logically derive from the one above. This dimension audits for alignment gaps, staleness, completeness, and coherence at each level.

### When to Use Planning Alignment

- Plans feel disconnected from reality
- Before major planning sessions
- After strategy changes to check downstream impact
- Feeling "lost" about project direction

### The Planning Stack

#### Layer 1: Strategy/Vision
**Files**: `PROJECT_SPEC.md`, `VISION.md`, `STRATEGY.md`, `PROJECT.md`

What this layer defines:
- What are we building and why?
- Who is it for?
- What problems does it solve?
- What is success?

#### Layer 2: Architecture
**Files**: `ARCHITECTURE.md`, system diagrams, ADRs (Architecture Decision Records)

What this layer defines:
- How will we structure the solution?
- What are the major components?
- How do they interact?
- What technologies/patterns?

#### Layer 3: Plans
**Files**: `PLAN-*.md`, `BACKLOG-*.md`, `SPRINT-*.md`, `ROADMAP.md`

What this layer defines:
- What work needs to be done?
- In what order?
- What are the dependencies?

#### Layer 4: Implementation
**Files**: Actual code, `EVALUATION-*.md`, `TODO-*.md`

What this layer defines:
- What has actually been built?
- Does it match the plans?

### Planning Horizon Guidelines

| Distance | Detail Level | What Should Exist |
|----------|--------------|-------------------|
| Current sprint | Ready to pull | Full task breakdown, acceptance criteria |
| Sprint +1, +2 | Concrete | Stories identified, rough effort known |
| Sprint +3+ | Directional | Epics/themes, not detailed stories |
| Exception | Known critical work | Can be detailed regardless of distance |

**Anti-pattern**: Detailed task breakdowns for work 3+ sprints out (waste, will change)

**Anti-pattern**: No visibility beyond current sprint (no strategic alignment)

### Planning Process

See [references/planning/](references/planning/) for detailed checklists at each intensity level:
- **Quick**: [quick-audit.md](references/planning/quick-audit.md) - Document location, spot-check alignment, flag obvious issues
- **Medium**: [medium-audit.md](references/planning/medium-audit.md) - Layer completeness, vertical traceability, horizontal consistency, staleness
- **Thorough**: [thorough-audit.md](references/planning/thorough-audit.md) - Strategy coherence, architecture sufficiency, plan coverage/realism, implementation alignment

### Planning Output

```
Planning Audit:
  Strategy:     [rating] [issues]
  Architecture: [rating] [issues]
  Plans:        [rating] [issues]
  Alignment:    [rating] [issues]

Critical Gaps: [n]
Stale Documents: [n]
```

### Planning Ratings

| Rating | Meaning |
|--------|---------|
| ✅ Healthy | Layer complete, aligned, current |
| ⚠️ Attention | Minor gaps or staleness |
| ❌ Critical | Major gaps, misalignment, or severely stale |
| ❓ Missing | Layer doesn't exist |

---

## Dimension 3: Security

Systematic security assessment of the codebase and dependencies.

### When to Use Security

- Before deployment to production
- After adding auth/payment/sensitive data handling
- Periodic security review
- After dependency updates

### Security Scope

| In Scope | Out of Scope |
|----------|--------------|
| Dependency CVEs | Penetration testing |
| Code-level vulnerabilities | Infrastructure security |
| Auth/authz patterns | Network security |
| Data exposure risks | Physical security |
| OWASP Top 10 | Compliance audits (HIPAA, SOC2) |
| Secret management | Social engineering |

### Security Process

See [references/security/](references/security/) for detailed checklists covering:
- Dependency audit (npm audit, pip-audit, govulncheck, cargo audit)
- Secret detection (gitleaks, trufflehog)
- Authentication review ([auth-checklist.md](references/security/auth-checklist.md))
- Authorization review
- Data exposure review
- OWASP Top 10 review ([owasp-checklist.md](references/security/owasp-checklist.md))
- Input validation review

### Security Intensity Levels

| Level | Scope | Time |
|-------|-------|------|
| Quick | Dependency scan + secret scan | 5-10 min |
| Medium | + Auth review + OWASP quick check | 20-30 min |
| Thorough | Full OWASP + manual code review | 1-2 hours |

### Security Output

```
Security Audit:
  Risk Level: [Critical/High/Medium/Low]
  CVEs: n critical, n high | Secrets: [status]
  OWASP: [summary]
```

### Security Severity Definitions

| Severity | Criteria |
|----------|----------|
| Critical | Active exploit available, data breach possible, no auth required |
| High | Exploitable with some effort, significant data/functionality at risk |
| Medium | Requires specific conditions, limited impact |
| Low | Theoretical, defense in depth, best practice |

---

## Dimension 4: Competitive

Systematic comparison of this project against competitors and alternatives in the market.

### When to Use Competitive

- Before major feature planning (what should we build?)
- When positioning the product
- To identify gaps and opportunities
- To validate differentiation claims

### What Competitive Audit Does

1. **Identify competitors** - Direct competitors, alternatives, adjacent solutions
2. **Analyze their approach** - Features, architecture, UX, pricing
3. **Compare systematically** - Feature-by-feature, capability-by-capability
4. **Find gaps** - What do they have that we don't?
5. **Find opportunities** - What could we do better? What's missing in market?
6. **Assess differentiation** - Is our differentiation real and valuable?

### Competitive Process

See [references/competitive/research-template.md](references/competitive/research-template.md) for the complete 6-step process:
1. Understand our project
2. Identify competitors (direct, indirect, adjacent, emerging)
3. Research each competitor (features, approach, users, strengths, weaknesses)
4. Feature comparison matrix
5. Gap analysis
6. Opportunity analysis

Use `do:researcher` with WebSearch for external research.

### Competitive Intensity Levels

| Level | Competitors Analyzed | Depth |
|-------|---------------------|-------|
| Quick | 2-3 direct | Feature list only |
| Medium | 4-6 mixed | Features + approach |
| Thorough | 8+ comprehensive | Full analysis + user research |

### Competitive Output

```
Competitive Audit:
  Position: [assessment]
  Gaps: n | Opportunities: n
  Differentiators: n validated
```

---

## Dimension 5: Test Coverage

Forensic analysis of test coverage quality. Not just "do you have tests" but "are you testing the right things at the right level?"

### When to Use Test Coverage

- Reviewing test quality
- Identifying testing gaps
- Auditing test strategy
- Before planning test improvements

### Testing Philosophy

#### The Testing Pyramid

```
         ╱╲
        ╱E2E╲          Few, slow, high-confidence
       ╱──────╲
      ╱ Integ  ╲       Medium count, medium speed
     ╱──────────╲
    ╱    Unit    ╲     Many, fast, focused
   ╱──────────────╲
```

**Comprehensive Testing Level Definitions**: [references/testing/concepts/testing-levels.md](references/testing/concepts/testing-levels.md)

| Level | Tests | Speed | Scope | Confidence |
|-------|-------|-------|-------|------------|
| Unit | Many | Fast | Single function/class | Logic correctness |
| Integration | Medium | Medium | Component boundaries | Pieces work together |
| E2E | Few | Slow | Full user journey | System actually works |

#### Testing at the Right Level

**Wrong level** → wasted effort, false confidence, or fragile tests

| Symptom | Problem | Fix |
|---------|---------|-----|
| 500 unit tests, login broken | Missing e2e | Add e2e for critical paths |
| All e2e, CI takes 2 hours | Over-reliance on slow tests | Push more to unit/integration |
| Tests break on every refactor | Testing implementation, not behavior | Test contracts, not internals |
| High coverage, bugs slip through | Testing wrong things | Focus on user-facing behavior |

#### Common AI/LLM Testing Mistakes

When AI generates tests, it often makes systematic errors. **Read**: [references/testing/concepts/llm-testing-mistakes.md](references/testing/concepts/llm-testing-mistakes.md)

| Mistake | What It Looks Like | Why It's Harmful |
|---------|-------------------|------------------|
| Tautological tests | `expect(mock).toHaveBeenCalled()` after `mock()` | Tests nothing real |
| Over-mocking | Every dependency mocked | Tests mocks, not code |
| Happy path only | No error/edge cases | Misses real failures |
| Testing implementation | Breaks on refactor | Fragile, not behavioral |

### Test Coverage Process

See [references/testing/](references/testing/) for comprehensive coverage audit process covering:

**Phase 1: Complexity Source Detection**
- Architecture detection ([microservices.md](references/testing/detection/microservices.md))
- Data interaction detection ([data-interactions.md](references/testing/detection/data-interactions.md))
- External API detection ([external-apis.md](references/testing/detection/external-apis.md))
- Interactive/user input detection ([interactive-testing.md](references/testing/concepts/interactive-testing.md))

**Phase 2: Project Type & Language Detection**
- Project type scenarios (15 types: CLI, web frontend/backend, mobile, etc. - see [references/testing/scenarios/](references/testing/scenarios/))
- Language-specific testing (6 languages: Python, TypeScript, Go, Rust, Java, Ruby - see [references/testing/languages/](references/testing/languages/))

**Phase 3-6: Inventory, Coverage Mapping, Quality Assessment, Gap Analysis**
- Test inventory and categorization
- Coverage matrix creation
- Red flag detection
- Test quality checklist
- Prioritized gap analysis (P0/P1/P2)

### Test Coverage Intensity Levels

| Level | Scope | Depth |
|-------|-------|-------|
| Quick | Architecture + high-level gaps | 10-15 min |
| Medium | + Quality assessment + coverage matrix | 30-45 min |
| Thorough | + Test-by-test review + risk analysis | 60-90 min |

### Test Coverage Output

```
Test Coverage Audit:
  Overall Health: [Healthy | Needs Work | Critical Gaps]
  Coverage Distribution: Unit n% | Integration n% | E2E n%
  Critical Gaps: [n] | Quality Issues: [n]
```

---

## Combined Audit Output

When multiple dimensions run:

```
═══════════════════════════════════════
Audit Complete - [dimensions run]

Code Quality:
  Architecture: [rating] | Design: [rating] | Efficiency: [rating]
  Findings: P0: n | P1: n | P2: n | P3: n

Planning:
  Strategy: [rating] | Alignment: [rating]
  Gaps: n | Stale docs: n

Security:
  Risk Level: [Critical/High/Medium/Low]
  CVEs: n critical, n high | Secrets: [status]

Competitive:
  Position: [assessment]
  Gaps: n | Opportunities: n

Test Coverage:
  Health: [rating] | Gaps: n critical, n significant
  Distribution: Unit n% | Integration n% | E2E n%

Reports:
  - EVALUATION-<timestamp>.md
  - PLANNING-AUDIT-<timestamp>.md (if planning dimension)
  - SECURITY-AUDIT-<timestamp>.md (if security dimension)
  - COMPETITIVE-AUDIT-<timestamp>.md (if competitive dimension)
  - TEST-COVERAGE-AUDIT-<timestamp>.md (if test dimension)
═══════════════════════════════════════
```

---

## Priority Levels

| Priority | Meaning | Action |
|----------|---------|--------|
| P0 | Critical - blocks functionality or causes harm | Fix immediately |
| P1 | High - significant quality/maintenance issue | Fix soon |
| P2 | Medium - noticeable but not urgent | Plan to address |
| P3 | Low - polish, nice-to-have | Backlog |

---

## Capture Audit Findings

After generating the audit report, capture high-priority findings as deferred work to ensure they're tracked:

**For P0 and P1 findings**, capture each as a work item:

```
Skill("do:deferred-work-capture") with:
  title: "[Dimension] <finding summary>"
  description: |
    Audit finding from [dimension] audit.

    Finding: <full description>
    Location: <file/area affected>
    Impact: <what's at risk>
    Recommendation: <suggested fix>
  type: bug  # for security, or task for quality/planning
  priority: 0  # for P0, or 1 for P1
  source_context: "audit-master <dimension> audit"
```

**For P2 findings** (batch capture):

```
Skill("do:deferred-work-capture") with:
  title: "Tech debt batch: <dimension> audit findings"
  description: |
    Medium-priority findings from [dimension] audit.

    Findings:
    - <finding 1>
    - <finding 2>
    - <finding 3>

    See: <audit-report-file.md>
  type: chore
  priority: 2
  source_context: "audit-master <dimension> audit batch"
```

**Why capture audit findings?**
- Ensures critical findings aren't just reported and forgotten
- Creates actionable work items from audit results
- Enables tracking and follow-up across sessions

---

## Complete Reference Index

### Code Quality References
| File | Purpose |
|------|---------|
| [references/code-quality/architecture.md](references/code-quality/architecture.md) | Architecture audit checklists |
| [references/code-quality/design-quality.md](references/code-quality/design-quality.md) | Design pattern analysis |
| [references/code-quality/efficiency.md](references/code-quality/efficiency.md) | Efficiency and dead code detection |
| [references/code-quality/domains.md](references/code-quality/domains.md) | Domain-specific anti-patterns |

### Planning References
| File | Purpose |
|------|---------|
| [references/planning/quick-audit.md](references/planning/quick-audit.md) | Quick planning audit checklist |
| [references/planning/medium-audit.md](references/planning/medium-audit.md) | Medium planning audit checklist |
| [references/planning/thorough-audit.md](references/planning/thorough-audit.md) | Thorough planning audit checklist |

### Security References
| File | Purpose |
|------|---------|
| [references/security/auth-checklist.md](references/security/auth-checklist.md) | Authentication audit checklist |
| [references/security/owasp-checklist.md](references/security/owasp-checklist.md) | OWASP Top 10 checklist |

### Competitive References
| File | Purpose |
|------|---------|
| [references/competitive/research-template.md](references/competitive/research-template.md) | Competitor research template |

### Testing References

#### Concepts
| File | Purpose |
|------|---------|
| [references/testing/concepts/testing-levels.md](references/testing/concepts/testing-levels.md) | Testing level definitions |
| [references/testing/concepts/llm-testing-mistakes.md](references/testing/concepts/llm-testing-mistakes.md) | Common AI testing errors |
| [references/testing/concepts/interactive-testing.md](references/testing/concepts/interactive-testing.md) | Interactive system testing |
| [references/testing/concepts/unknown-ui-testing.md](references/testing/concepts/unknown-ui-testing.md) | Unknown UI testing |

#### Detection
| File | Purpose |
|------|---------|
| [references/testing/detection/microservices.md](references/testing/detection/microservices.md) | Microservices detection |
| [references/testing/detection/data-interactions.md](references/testing/detection/data-interactions.md) | Data interaction detection |
| [references/testing/detection/external-apis.md](references/testing/detection/external-apis.md) | External API detection |

#### Languages
| File | Purpose |
|------|---------|
| [references/testing/languages/python.md](references/testing/languages/python.md) | Python testing |
| [references/testing/languages/typescript.md](references/testing/languages/typescript.md) | TypeScript testing |
| [references/testing/languages/go.md](references/testing/languages/go.md) | Go testing |
| [references/testing/languages/rust.md](references/testing/languages/rust.md) | Rust testing |
| [references/testing/languages/java.md](references/testing/languages/java.md) | Java testing |
| [references/testing/languages/ruby.md](references/testing/languages/ruby.md) | Ruby testing |

#### Scenarios
| File | Purpose |
|------|---------|
| [references/testing/scenarios/cli.md](references/testing/scenarios/cli.md) | CLI testing |
| [references/testing/scenarios/web-frontend.md](references/testing/scenarios/web-frontend.md) | Web frontend testing |
| [references/testing/scenarios/web-backend.md](references/testing/scenarios/web-backend.md) | Web backend testing |
| [references/testing/scenarios/fullstack.md](references/testing/scenarios/fullstack.md) | Full stack testing |
| [references/testing/scenarios/library.md](references/testing/scenarios/library.md) | Library testing |
| [references/testing/scenarios/mobile.md](references/testing/scenarios/mobile.md) | Mobile testing |
| [references/testing/scenarios/infrastructure.md](references/testing/scenarios/infrastructure.md) | Infrastructure testing |
| [references/testing/scenarios/ai-agents.md](references/testing/scenarios/ai-agents.md) | AI/Agent testing |
| [references/testing/scenarios/data-pipelines.md](references/testing/scenarios/data-pipelines.md) | Data pipeline testing |
| [references/testing/scenarios/realtime-systems.md](references/testing/scenarios/realtime-systems.md) | Real-time testing |
| [references/testing/scenarios/embedded-iot.md](references/testing/scenarios/embedded-iot.md) | Embedded/IoT testing |
| [references/testing/scenarios/desktop-apps.md](references/testing/scenarios/desktop-apps.md) | Desktop app testing |
| [references/testing/scenarios/browser-extensions.md](references/testing/scenarios/browser-extensions.md) | Browser extension testing |
| [references/testing/scenarios/game-development.md](references/testing/scenarios/game-development.md) | Game testing |
| [references/testing/scenarios/blockchain.md](references/testing/scenarios/blockchain.md) | Blockchain testing |

---

## Related Skills

| Skill | Purpose |
|-------|---------|
| `testing-master` | Test setup, recommendations, and implementation planning |
| `do:status-check` | Quick project status diagnostic |
| `do:feature-proposal` | Design new features based on gaps found |
| `do:market-research` | Broader market analysis beyond competitors |
