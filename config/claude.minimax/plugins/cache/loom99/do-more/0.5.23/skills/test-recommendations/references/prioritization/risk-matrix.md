# Risk-Based Test Prioritization Matrix

How to prioritize which tests to write based on risk assessment.

## The Risk Matrix

```
              IMPACT
        Low    Medium   High
      ┌──────┬───────┬───────┐
High  │  P2  │  P1   │  P0   │
      ├──────┼───────┼───────┤
Med   │  P3  │  P2   │  P1   │  LIKELIHOOD
      ├──────┼───────┼───────┤
Low   │  P3  │  P3   │  P2   │
      └──────┴───────┴───────┘
```

## Impact Assessment

### High Impact

| Category | Examples |
|----------|----------|
| Data loss/corruption | Delete user data, corrupt database |
| Security breach | Auth bypass, data exposure |
| Financial loss | Wrong charge, failed payment |
| Compliance violation | GDPR breach, audit failure |
| Total system failure | App crashes, service down |

### Medium Impact

| Category | Examples |
|----------|----------|
| UX degradation | Slow responses, confusing errors |
| Partial feature failure | Some users affected |
| Data inconsistency | Stale cache, delayed sync |
| Operational burden | Manual intervention needed |

### Low Impact

| Category | Examples |
|----------|----------|
| Minor annoyance | Cosmetic issues, typos |
| Edge case failures | Rare scenarios |
| Recoverable errors | User can retry |
| Internal tooling issues | Dev-only impact |

## Likelihood Assessment

### High Likelihood

| Indicator | Why |
|-----------|-----|
| Common code path | Hit by most users |
| No existing tests | No safety net |
| Recent bugs here | Pattern of issues |
| Complex logic | More ways to fail |
| External dependencies | Can't control |

### Medium Likelihood

| Indicator | Why |
|-----------|-----|
| Secondary features | Some users hit |
| Some test coverage | Partial safety net |
| Moderate complexity | Some risk |
| Stable dependencies | Usually works |

### Low Likelihood

| Indicator | Why |
|-----------|-----|
| Edge cases | Rare paths |
| Well-tested code | Good coverage |
| Simple logic | Few failure modes |
| No external deps | Full control |

## Priority Definitions

### P0: Critical

**Must fix immediately**

- High impact + High/Medium likelihood
- Examples:
  - Payment processing errors
  - Authentication bypass
  - Data corruption bugs
  - Security vulnerabilities

**Test requirement**: E2E + Integration + Unit coverage

### P1: High

**Fix in current sprint**

- Medium impact + High likelihood
- High impact + Low likelihood
- Examples:
  - API error handling gaps
  - Important user journey issues
  - Performance bottlenecks
  - Error message clarity

**Test requirement**: Integration + Unit coverage

### P2: Medium

**Plan for upcoming work**

- Medium impact + Medium likelihood
- Low impact + High likelihood
- Examples:
  - Secondary feature issues
  - Edge case handling
  - Minor UX problems
  - Configuration validation

**Test requirement**: Unit coverage minimum

### P3: Low

**Nice to have**

- Low impact scenarios
- Very unlikely issues
- Examples:
  - Cosmetic issues
  - Rare edge cases
  - Redundant validation
  - Internal tooling

**Test requirement**: Optional

## Scoring Template

For each gap identified in audit:

```markdown
### Gap: [Name]

**Impact Assessment**:
- [ ] Data loss/corruption risk? → High
- [ ] Security implications? → High
- [ ] Financial impact? → High
- [ ] UX degradation? → Medium
- [ ] Minor annoyance? → Low

**Impact Score**: [High/Medium/Low]

**Likelihood Assessment**:
- [ ] Common code path? → +1
- [ ] No existing tests? → +1
- [ ] Recent bugs? → +1
- [ ] Complex logic? → +1
- [ ] External deps? → +1

**Likelihood Score**: [High (3+) / Medium (1-2) / Low (0)]

**Priority**: [Use matrix]

**Rationale**: [Why this priority makes sense]
```

## Adjustment Factors

### Upgrade Priority When

| Factor | Adjustment |
|--------|------------|
| Customer-facing | +1 priority level |
| Revenue-impacting | +1 priority level |
| Compliance-related | +1 priority level |
| Recent production incident | +1 priority level |
| Executive visibility | +1 priority level |

### Downgrade Priority When

| Factor | Adjustment |
|--------|------------|
| Feature flagged off | -1 priority level |
| Deprecated code | -1 priority level |
| Internal-only | -1 priority level |
| Scheduled for removal | -1 priority level |

## Example Prioritization

```markdown
## Gap Analysis with Priorities

| Gap | Impact | Likelihood | Base Priority | Adjustments | Final |
|-----|--------|------------|---------------|-------------|-------|
| No payment error tests | High (financial) | High (common path) | P0 | Customer-facing | P0 |
| No cache invalidation | Medium (stale data) | Medium (some users) | P2 | Revenue-impacting | P1 |
| No config validation | Low (startup crash) | Low (caught early) | P3 | - | P3 |
| No auth flow e2e | High (security) | High (no tests) | P0 | Compliance | P0 |
```

## Prioritization Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Everything is P0 | Nothing prioritized | Apply matrix strictly |
| LIFO prioritization | Recent = important | Use risk matrix |
| Developer preference | Biased toward fun work | Stick to impact/likelihood |
| Ignoring likelihood | All high impact is P0 | Consider how often it happens |
| Feature-only focus | Infra untested | Include operational risks |
