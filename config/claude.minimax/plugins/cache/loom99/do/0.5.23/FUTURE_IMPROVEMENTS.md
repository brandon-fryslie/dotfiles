# Dev-Loop Plugin: Future Improvements

**Last Updated**: 2025-11-13
**Status**: 90% ready for ARD-to-working-software automation

---

## Completed

### ✅ P0-1: Agent Mismatch Fix (Completed 2025-11-13)
- **Fixed**: test-and-implement.md now uses work-evaluator in ImplementLoop (line 49)
- **Impact**: HIGH - Aligns with implement-and-iterate, appropriate evaluator for iteration validation
- **Commit**: ad32b74

---

## Priority Improvements

### 🔶 P1: Autonomous Completion

**Problem**: Agent stops prematurely, requires manual "/test-and-implement plan-first" to continue

**Solution**: PLAN-driven continuation logic
- After work item completes → auto-move to next work item in PLAN
- Only stop for: ALL items complete, genuine ambiguity, external blocker
- Never stop for: iteration count, subjective uncertainty, partial completion

**Implementation**:
- Update command prompts: Add "Continue until ALL PLAN items complete"
- Update evaluator agents: Add continuation decision logic
- Add stall detection: Same error 3+ times = genuine problem (not iteration limit)

**Effort**: 2-3 hours
**Impact**: HIGH - Eliminates manual re-prompting

---

### 🔶 P1: Decision Point Detection

**Problem**: System doesn't detect genuine ambiguity, may choose wrong approach

**Solution**: Add ambiguity detector to agents
- Detect: Unclear requirements, multiple valid approaches, missing specs
- Output: USER_INPUT_NEEDED status with specific questions and options
- Continue working on clear requirements

**Where to add**:
- status-planner: Detect contradictory STATUS/SPEC, vague acceptance criteria
- functional-tester: Detect missing test framework, unclear success criteria
- Implementers: Detect multiple valid approaches, missing technical specs

**Effort**: 3-4 hours
**Impact**: HIGH - Prevents wrong implementations

---

### 🔶 P1: Loop Exit Clarity

**Problem**: "No outstanding issues for which solution is well defined" is ambiguous

**Solution**: Clear exit conditions
```
Exit when:
- All PLAN work item acceptance criteria met AND no more items
- Genuine ambiguity detected (requirements unclear)
- External blocker (missing access/permissions)

Continue when:
- Current item incomplete but path clear
- More items remain in PLAN
- Progress being made
```

**Effort**: 30 min
**Impact**: MEDIUM - Reduces premature stopping

---

## Medium Priority

### 🟨 P2: MCP Tool Usage Skills

**Problem**: Agents must rediscover how to use chrome-devtools and peekaboo MCP tools each time

**Solution**: Create Claude Code Skills for MCP tool patterns
- `skills/chrome-devtools-screenshots.md` - Navigate, capture screenshots, extract console logs
- `skills/peekaboo-capture.md` - Capture macOS desktop screenshots for evidence
- Model-invoked when agents need visual evidence

**Effort**: 2-3 hours
**Impact**: MEDIUM - Reduces friction, agents discover MCP capabilities automatically

---

## Future Enhancements

### 🔵 P3: Bug Fix Workflow
- Lighter than full TDD: Write failing test → Fix → Verify
- **Effort**: 2-3 hours

### 🔵 P3: Refactoring Workflow
- Baseline current behavior → Refactor → Verify tests still pass
- **Effort**: 2-3 hours

---

## Design Principles (Preserve These)

**Context Separation**: Implementer and evaluator run in separate contexts for "fresh eyes" evaluation. Never share implementation context with evaluators.

**Zero Optimism**: Evaluators assess only observable behavior and evidence, not intentions.

**PLAN-Driven**: Work continues through entire PLAN unless genuine ambiguity or blocker encountered.

---

## Implementation Priority

**Week 1**: P1 items (6-8 hours) → 95% ARD-to-working-software capability
**Week 2**: P2 items (2-3 hours) → MCP tool discoverability
**Week 3+**: P3 items (4-6 hours) → Additional workflows

---

## Validation Metrics

- Autonomous completion rate: Target 95%+ (completes PLAN without re-prompting)
- Genuine ambiguity detection: Target 100% (stops only for real issues)
- Premature stops: Target 0
- User intervention rate: Target < 3 per workflow
