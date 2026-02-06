# Handoff: Expanding audit-master Dimensions

## Context

We just consolidated multiple audit skills into a unified `audit-master` skill with 5 dimensions:
1. **Code Quality** - Architecture, design, efficiency, correctness
2. **Planning** - Strategy → Architecture → Plans → Implementation alignment
3. **Security** - CVEs, secrets, auth, OWASP Top 10
4. **Competitive** - Market comparison, feature parity, gaps
5. **Test Coverage** - Test quality, coverage gaps, testing strategy

Located at: `skills/audit-master/SKILL.md`

The `/do:audit` command routes to this skill.

## Task: Add More Audit Dimensions

We're exploring additional audit dimensions to add. Here are the candidates:

### High Priority (Recommended)

#### Complexity Audit
- Cyclomatic complexity per function/module
- Cognitive complexity (how hard to understand)
- Dependency depth/coupling analysis
- "Hot spots" - high complexity + high change frequency
- God classes/functions detection
- Nesting depth analysis

#### Risk Assessment Audit
- Bus factor (code owned by single person)
- Change velocity vs test coverage correlation
- "Risky" areas: high complexity + low tests + frequent changes
- Dependency health (abandoned packages, CVEs, license issues)
- Blast radius analysis (what breaks if X fails?)
- Single points of failure

#### Observability Audit
- Logging coverage (are errors logged? structured?)
- Metrics/telemetry presence
- Tracing instrumentation
- Health check endpoints
- Error handling patterns (swallowed errors?)
- Alerting gaps

### Medium Priority

#### Performance Audit
- N+1 query detection
- Unbounded loops/recursion
- Missing pagination
- Memory leak patterns (event listeners, closures)
- Inefficient algorithms (O(n²) when O(n) possible)
- Missing caching opportunities
- Bundle size analysis (for frontend)
- Database index usage

#### API/Contract Audit
- Breaking change detection
- Deprecation compliance
- Versioning consistency
- Documentation coverage (OpenAPI, JSDoc)
- Error response consistency
- Rate limiting presence

#### Maintainability Audit
- Code duplication (DRY violations)
- Naming consistency
- File/folder organization
- Comment quality (outdated? redundant?)
- Magic numbers/strings
- Configuration sprawl

### Lower Priority / Specialized

#### Accessibility Audit (UI projects only)
- WCAG compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast
- ARIA usage

#### Cost Audit (cloud projects only)
- Unused resources
- Oversized instances
- Missing autoscaling
- Inefficient storage patterns
- API call optimization opportunities

## Implementation Notes

When adding new dimensions:

1. Add dimension to the orchestrator section in `SKILL.md` (Available Dimensions table, trigger words)
2. Add full dimension section with:
   - When to Use
   - Process steps
   - Output format
   - Reference documents table
3. Create reference files in `references/<dimension-name>/`
4. Update the Combined Audit Output section
5. Update the Complete Reference Index
6. Update the dimension selection prompt (multiSelect options)

Each dimension should support quick/medium/thorough intensity levels.

## Questions to Resolve

1. Which dimensions to add first? (Recommend: Complexity + Risk Assessment as they combine well)
2. Should some dimensions be project-type specific? (e.g., Accessibility only for UI, Cost only for cloud)
3. Any dimensions that should be combined? (e.g., Complexity + Maintainability overlap)
