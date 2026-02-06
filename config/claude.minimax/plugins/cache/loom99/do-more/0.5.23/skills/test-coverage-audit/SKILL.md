---
name: "do-test-coverage-audit"
description: "Forensic test coverage audit - exhaustive detection of complexity sources and assessment of whether tests exist at the right level. Use when reviewing test quality, identifying testing gaps, or auditing test strategy. Produces detailed accounting for test-recommendations skill."
---

# Test Coverage Audit

Forensic analysis of test coverage quality. Not just "do you have tests" but "are you testing the right things at the right level?"

This skill produces an exhaustive audit report. For recommendations based on this report, use the `test-recommendations` skill. For implementation planning, use `test-implementation-plan`.

## Philosophy

### The Testing Pyramid

```
         ╱╲
        ╱E2E╲          Few, slow, high-confidence
       ╱──────╲
      ╱ Integ  ╲       Medium count, medium speed
     ╱──────────╲
    ╱    Unit    ╲     Many, fast, focused
   ╱──────────────╲
```

**Comprehensive Testing Level Definitions**: [concepts/testing-levels.md](../audit-master/references/testing/concepts/testing-levels.md)

| Level | Tests | Speed | Scope | Confidence |
|-------|-------|-------|-------|------------|
| Unit | Many | Fast | Single function/class | Logic correctness |
| Integration | Medium | Medium | Component boundaries | Pieces work together |
| E2E | Few | Slow | Full user journey | System actually works |

### Testing at the Right Level

**Wrong level** → wasted effort, false confidence, or fragile tests

| Symptom | Problem | Fix |
|---------|---------|-----|
| 500 unit tests, login broken | Missing e2e | Add e2e for critical paths |
| All e2e, CI takes 2 hours | Over-reliance on slow tests | Push more to unit/integration |
| Tests break on every refactor | Testing implementation, not behavior | Test contracts, not internals |
| High coverage, bugs slip through | Testing wrong things | Focus on user-facing behavior |

### Common AI/LLM Testing Mistakes

When AI generates tests, it often makes systematic errors. **Read**: [concepts/llm-testing-mistakes.md](../audit-master/references/testing/concepts/llm-testing-mistakes.md)

| Mistake | What It Looks Like | Why It's Harmful |
|---------|-------------------|------------------|
| Tautological tests | `expect(mock).toHaveBeenCalled()` after `mock()` | Tests nothing real |
| Over-mocking | Every dependency mocked | Tests mocks, not code |
| Happy path only | No error/edge cases | Misses real failures |
| Testing implementation | Breaks on refactor | Fragile, not behavioral |

---

## Audit Process

### Phase 1: Complexity Source Detection

**Goal**: Create an exhaustive inventory of everything that needs testing.

#### 1.1 Architecture Detection

**Is this a microservices/distributed system?**

Read: [detection/microservices.md](../audit-master/references/testing/detection/microservices.md)

| Signal | Detection Method |
|--------|------------------|
| Docker Compose | `ls docker-compose*.yml` |
| Kubernetes | `find . -name "*.yaml" \| xargs grep "kind: Deployment"` |
| Service URLs in env | `grep -E ".*_URL=.*_HOST=" .env*` |
| Multiple repos/services | Directory structure analysis |

**Output**:
```markdown
### Architecture Classification
- Type: [Monolith | Modular Monolith | Microservices | Serverless]
- Services detected: [list with protocols]
- Inter-service communication: [HTTP | gRPC | Message Queue | None]
- Contract testing present: [Yes/No]
```

#### 1.2 Data Interaction Detection

**What data does this system touch?**

Read: [detection/data-interactions.md](../audit-master/references/testing/detection/data-interactions.md)

| Category | Detection |
|----------|-----------|
| Databases | Grep for ORM imports, connection strings |
| Caches | Grep for Redis/Memcached clients |
| File system | Grep for fs/pathlib operations |
| User config | Look for config loading patterns |
| Secrets | Check for secret manager integrations |

**Output**:
```markdown
### Data Interactions
| Category | Technology | Locations | Tested? |
|----------|------------|-----------|---------|
| Database | PostgreSQL/SQLAlchemy | models/*.py | ✅/❌ |
| Cache | Redis | services/cache.py | ✅/❌ |
| Files | S3/boto3 | storage/*.py | ✅/❌ |
| Config | pydantic/settings | config.py | ✅/❌ |
| Secrets | AWS SecretsManager | auth/*.py | ✅/❌ |
```

#### 1.3 External API Detection

**What external services does this call?**

Read: [detection/external-apis.md](../audit-master/references/testing/detection/external-apis.md)

| Category | Detection |
|----------|-----------|
| HTTP clients | Grep for requests/axios/fetch |
| Payment SDKs | Grep for stripe/paypal |
| Auth providers | Grep for oauth/auth0/cognito |
| Cloud services | Grep for boto3/gcloud/azure |
| Webhooks | Grep for webhook endpoints |

**Output**:
```markdown
### External API Integrations
| Service | SDK/Client | Criticality | Error Handling? | Tested? |
|---------|------------|-------------|-----------------|---------|
| Stripe | stripe-python | Critical | ⚠️ Partial | ❌ |
| SendGrid | sendgrid | High | ❌ None | ❌ |
| Auth0 | auth0-python | Critical | ✅ Yes | ✅ |
```

#### 1.4 Interactive/User Input Detection

**Does this require user interaction for testing?**

Read: [concepts/interactive-testing.md](../audit-master/references/testing/concepts/interactive-testing.md)

| Pattern | Testing Approach |
|---------|-----------------|
| CLI prompts | PTY/pexpect testing |
| Shell completions | Completion script testing |
| TUI (full-screen) | Virtual terminal (pyte) |
| Desktop GUI | Platform-specific (Playwright/XCTest) |
| Device-specific | Hardware test farms or mocks |

**Output**:
```markdown
### Interactive Components
| Component | Type | Can Test in CI? | Current Approach |
|-----------|------|-----------------|------------------|
| Setup wizard | CLI prompts | ✅ (pexpect) | ❌ Untested |
| Tab completion | Shell integration | ✅ (script) | ❌ Untested |
| Dashboard | Full-screen TUI | ⚠️ (with pyte) | ❌ Untested |
```

### Phase 2: Detect Project Type & Language

#### 2.1 Project Type Detection

**Identify the scenario to set testing expectations**:

| Signal | Project Type | Scenario Reference |
|--------|--------------|-------------------|
| `bin/`, CLI entry point, argparse | CLI Tool | [scenarios/cli.md](../audit-master/references/testing/scenarios/cli.md) |
| React/Vue/Angular, pages/, components/ | Web Frontend | [scenarios/web-frontend.md](../audit-master/references/testing/scenarios/web-frontend.md) |
| Express/FastAPI/Rails, routes/ | Web Backend/API | [scenarios/web-backend.md](../audit-master/references/testing/scenarios/web-backend.md) |
| Both frontend + backend | Full Stack | [scenarios/fullstack.md](../audit-master/references/testing/scenarios/fullstack.md) |
| npm package, library exports | Library/SDK | [scenarios/library.md](../audit-master/references/testing/scenarios/library.md) |
| iOS/Android, mobile frameworks | Mobile App | [scenarios/mobile.md](../audit-master/references/testing/scenarios/mobile.md) |
| Dockerfile, k8s manifests, terraform | Infrastructure | [scenarios/infrastructure.md](../audit-master/references/testing/scenarios/infrastructure.md) |
| agents/, prompts/, LLM calls | AI/Agent System | [scenarios/ai-agents.md](../audit-master/references/testing/scenarios/ai-agents.md) |
| Airflow DAGs, Spark jobs, ETL | Data Pipeline | [scenarios/data-pipelines.md](../audit-master/references/testing/scenarios/data-pipelines.md) |
| Kafka, WebSockets, real-time streams | Real-time System | [scenarios/realtime-systems.md](../audit-master/references/testing/scenarios/realtime-systems.md) |
| Firmware, HAL, microcontrollers | Embedded/IoT | [scenarios/embedded-iot.md](../audit-master/references/testing/scenarios/embedded-iot.md) |
| Electron, Qt, WPF, native GUI | Desktop App | [scenarios/desktop-apps.md](../audit-master/references/testing/scenarios/desktop-apps.md) |
| manifest.json, Chrome/Firefox extension | Browser Extension | [scenarios/browser-extensions.md](../audit-master/references/testing/scenarios/browser-extensions.md) |
| Unity, Unreal, game engine | Game Development | [scenarios/game-development.md](../audit-master/references/testing/scenarios/game-development.md) |
| Solidity, smart contracts, Web3 | Blockchain/Web3 | [scenarios/blockchain.md](../audit-master/references/testing/scenarios/blockchain.md) |

**Read the appropriate scenario file** for testing expectations specific to that project type.

#### 2.2 Language/Framework Detection

| Language | Reference |
|----------|-----------|
| Python | [languages/python.md](../audit-master/references/testing/languages/python.md) |
| TypeScript/JavaScript | [languages/typescript.md](../audit-master/references/testing/languages/typescript.md) |
| Go | [languages/go.md](../audit-master/references/testing/languages/go.md) |
| Rust | [languages/rust.md](../audit-master/references/testing/languages/rust.md) |
| Java/Kotlin | [languages/java.md](../audit-master/references/testing/languages/java.md) |
| Ruby | [languages/ruby.md](../audit-master/references/testing/languages/ruby.md) |

### Phases 2-5: Forensic Analysis

For the detailed forensic analysis (test inventory, coverage mapping, quality assessment, gap analysis), spawn the `test-auditor` agent:

Use the Task tool to spawn `do:test-auditor` agent:

```
Execute forensic test coverage analysis.

Project: [current working directory]
Framework: [detected framework from Phase 1]
Intensity: [quick|medium|thorough]

Run phases 2-5:
- Phase 3: Test Inventory
- Phase 4: Coverage Mapping
- Phase 5: Quality Assessment
- Phase 6: Gap Analysis

Output: TEST-AUDIT-<timestamp>.md in .agent_planning/
```

The agent will complete the audit report with all remaining phases.

---

## Output Format

The audit produces a comprehensive report:

```markdown
# Test Coverage Audit Report
**Project**: [name]
**Date**: [date]
**Auditor**: Claude

## Executive Summary
**Overall Health**: [Healthy | Needs Work | Critical Gaps]
**Architecture**: [type]
**Coverage Distribution**: Unit n% | Integration n% | E2E n%
**Critical Issues**: [count]

---

## 1. Architecture Analysis
[From Phase 1.1]

## 2. Complexity Source Inventory
### 2.1 Data Interactions
[From Phase 1.2]

### 2.2 External APIs
[From Phase 1.3]

### 2.3 Interactive Components
[From Phase 1.4]

---

## 3. Test Inventory
[From Phase 3]

---

## 4. Coverage Matrix
[From Phase 4]

---

## 5. Quality Assessment
### 5.1 Red Flags Detected
[From Phase 5.1]

### 5.2 Quality Checklist Results
[From Phase 5.2]

---

## 6. Gap Analysis

### P0 - Critical (Must Fix)
[From Phase 6]

### P1 - Significant (Should Fix)
[From Phase 6]

### P2 - Minor (Nice to Have)
[From Phase 6]

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Current Mitigation |
|------|--------|------------|-------------------|
| Payment failures undetected | High | Medium | ❌ None |
| Auth bypass possible | Critical | Low | ⚠️ Partial |

---

## 8. Appendix

### A. Files Analyzed
[List of all files examined]

### B. Test File Inventory
[Complete list of test files]

### C. Detection Commands Used
[Commands run during audit]
```

---

## Intensity Levels

| Level | Scope | Depth |
|-------|-------|-------|
| Quick | Architecture + high-level gaps | 10-15 min |
| Medium | + Quality assessment + coverage matrix | 30-45 min |
| Thorough | + Test-by-test review + risk analysis | 60-90 min |

---

## Reference Documents

### Concepts
| Topic | Reference |
|-------|-----------|
| Testing levels defined | [concepts/testing-levels.md](../audit-master/references/testing/concepts/testing-levels.md) |
| AI/LLM testing mistakes | [concepts/llm-testing-mistakes.md](../audit-master/references/testing/concepts/llm-testing-mistakes.md) |
| Interactive system testing | [concepts/interactive-testing.md](../audit-master/references/testing/concepts/interactive-testing.md) |
| Unknown UI testing | [concepts/unknown-ui-testing.md](../audit-master/references/testing/concepts/unknown-ui-testing.md) |

### Detection
| Area | Reference |
|------|-----------|
| Microservices detection | [detection/microservices.md](../audit-master/references/testing/detection/microservices.md) |
| Data interaction detection | [detection/data-interactions.md](../audit-master/references/testing/detection/data-interactions.md) |
| External API detection | [detection/external-apis.md](../audit-master/references/testing/detection/external-apis.md) |

### Scenarios (15)
| Category | Reference |
|----------|-----------|
| CLI Tools | [scenarios/cli.md](../audit-master/references/testing/scenarios/cli.md) |
| Web Frontend | [scenarios/web-frontend.md](../audit-master/references/testing/scenarios/web-frontend.md) |
| Web Backend/API | [scenarios/web-backend.md](../audit-master/references/testing/scenarios/web-backend.md) |
| Full Stack | [scenarios/fullstack.md](../audit-master/references/testing/scenarios/fullstack.md) |
| Library/SDK | [scenarios/library.md](../audit-master/references/testing/scenarios/library.md) |
| Mobile App | [scenarios/mobile.md](../audit-master/references/testing/scenarios/mobile.md) |
| Infrastructure | [scenarios/infrastructure.md](../audit-master/references/testing/scenarios/infrastructure.md) |
| AI/Agent System | [scenarios/ai-agents.md](../audit-master/references/testing/scenarios/ai-agents.md) |
| Data Pipeline/ETL | [scenarios/data-pipelines.md](../audit-master/references/testing/scenarios/data-pipelines.md) |
| Real-time System | [scenarios/realtime-systems.md](../audit-master/references/testing/scenarios/realtime-systems.md) |
| Embedded/IoT | [scenarios/embedded-iot.md](../audit-master/references/testing/scenarios/embedded-iot.md) |
| Desktop App | [scenarios/desktop-apps.md](../audit-master/references/testing/scenarios/desktop-apps.md) |
| Browser Extension | [scenarios/browser-extensions.md](../audit-master/references/testing/scenarios/browser-extensions.md) |
| Game Development | [scenarios/game-development.md](../audit-master/references/testing/scenarios/game-development.md) |
| Blockchain/Web3 | [scenarios/blockchain.md](../audit-master/references/testing/scenarios/blockchain.md) |

### Languages (6)
| Language | Reference |
|----------|-----------|
| Python | [languages/python.md](../audit-master/references/testing/languages/python.md) |
| TypeScript/JS | [languages/typescript.md](../audit-master/references/testing/languages/typescript.md) |
| Go | [languages/go.md](../audit-master/references/testing/languages/go.md) |
| Rust | [languages/rust.md](../audit-master/references/testing/languages/rust.md) |
| Java/Kotlin | [languages/java.md](../audit-master/references/testing/languages/java.md) |
| Ruby | [languages/ruby.md](../audit-master/references/testing/languages/ruby.md) |

---

## Integration

This skill is invoked as a dimension of `/do:plan audit`:
- Trigger: "audit tests", "test coverage audit", "testing audit"
- Can run alongside other audit dimensions

## Related Skills

| Skill | Purpose |
|-------|---------|
| `test-recommendations` | Generate strategic test plan from audit |
| `test-implementation-plan` | Create execution plan with testability refactoring |
| `do:add-tests` | Write specific tests |
| `do:setup-testing` | Set up test framework |
| `do:tdd-workflow` | Test-first development |
