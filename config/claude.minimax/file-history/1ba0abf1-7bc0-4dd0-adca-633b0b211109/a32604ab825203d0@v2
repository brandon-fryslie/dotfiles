# Definition of Done: authority-consolidation
Generated: 2026-01-28-192541
Status: READY (contract decided: requireManyInstance/maybeManyInstance)
Plan: SPRINT-2026-01-28-192541-authority-consolidation-PLAN.md

## Acceptance Criteria

### C-5: Remove instanceId from FieldExpr, Add Two Helpers

#### Helper Implementation
- [ ] `requireManyInstance(t: CanonicalType, context?: string): InstanceRef` exists in canonical-types.ts
- [ ] `requireManyInstance` throws if cardinality is var/zero/one (with cardinality in error message)
- [ ] `requireManyInstance` exported from canonical-types.ts
- [ ] `maybeManyInstance(t: CanonicalType): InstanceRef | null` exists in canonical-types.ts
- [ ] `maybeManyInstance` returns null if cardinality is var/zero/one
- [ ] `maybeManyInstance` exported from canonical-types.ts
- [ ] NO `getManyInstance` helper exists (ambiguous name deleted)
- [ ] Both helpers have complete docstrings documenting their contracts

#### Call Sites (estimate 30+)
- [ ] All call sites use either `requireManyInstance()` (backend) or `maybeManyInstance()` (UI/probing)
- [ ] No call sites use `maybeManyInstance(...)!` (ban the assertion pattern)
- [ ] No construction sites pass instanceId to Map/Zip/ZipSig (TypeScript enforces)

#### Type Definitions
- [ ] FieldExprMap (types.ts:265) has NO instanceId field
- [ ] FieldExprZip (types.ts:273) has NO instanceId field
- [ ] FieldExprZipSig (types.ts:282) has NO instanceId field
- [ ] FieldExprIntrinsic (types.ts:237) KEEPS instanceId (required for intrinsic lookup)

#### Call Sites (estimate 30+)
- [ ] All call sites updated to use getManyInstance(expr.type)
- [ ] All call sites handle null return value according to contract
- [ ] No construction sites pass instanceId to Map/Zip/ZipSig (TypeScript enforces)

#### Test Coverage
- [ ] Test: getManyInstance returns InstanceRef when cardinality=many(instance)
- [ ] Test: getManyInstance returns null when cardinality=one
- [ ] Test: getManyInstance returns null when cardinality=zero
- [ ] Test: getManyInstance returns null when cardinality is var
- [ ] Test: FieldExprMap without instanceId can derive instance from type
- [ ] All existing tests pass
- [ ] TypeScript compilation succeeds

#### Contract Decision (EXIT CRITERIA for MEDIUM → HIGH)
- [x] Decision made: Two helpers - requireManyInstance (throws) + maybeManyInstance (null)
- [x] Decision documented: Names encode contracts; no ambiguous getManyInstance
- [x] Enforcement strategy: Ban `maybeManyInstance(...)!` pattern

---

### C-4: Axis Enforcement Pass (Pure Checker)

#### Pass Implementation
- [ ] src/compiler/passes-v2/axis-enforcement.ts exists
- [ ] validateAxes(patch: TypedPatch): Diagnostic[] function exists
- [ ] Pass is PURE (no mutations, no inference, no adapter insertion)
- [ ] Pass runs after normalization + type inference + type assignment (integration point identified)

#### Diagnostic Type
- [ ] AxisInvalidDiagnostic type defined (kind, location, reason, expressionKind, violation)
- [ ] Diagnostic integrates with existing diagnostic infrastructure
- [ ] Diagnostics are human-readable (include what was wrong and what was expected)

#### Validation Rules Implemented
- [ ] EventExpr rule: temporality MUST be discrete
- [ ] EventExpr rule: payload MUST be bool
- [ ] EventExpr rule: unit MUST be none
- [ ] SigExpr rule: temporality MUST be continuous (discrete forbidden)
- [ ] FieldExpr rule: cardinality MUST NOT be zero

#### Helper Functions
- [ ] isEventTypeValid(type: CanonicalType): boolean exists
- [ ] findAllEventExpr(patch: TypedPatch): EventExpr[] exists (or uses existing traversal)
- [ ] findAllSigExpr(patch: TypedPatch): SigExpr[] exists
- [ ] findAllFieldExpr(patch: TypedPatch): FieldExpr[] exists

#### Test Coverage (50+ cases)
**Positive tests (should pass validation):**
- [ ] Valid EventExpr (payload=bool, unit=none, temporality=discrete)
- [ ] Valid SigExpr (temporality=continuous)
- [ ] Valid FieldExpr (cardinality=one or many)

**Negative tests (should fail validation):**
- [ ] EventExpr with temporality=continuous → AxisInvalid
- [ ] EventExpr with payload=float → AxisInvalid
- [ ] EventExpr with payload=vec2 → AxisInvalid
- [ ] EventExpr with unit=meters → AxisInvalid
- [ ] SigExpr with temporality=discrete → AxisInvalid
- [ ] FieldExpr with cardinality=zero → AxisInvalid

**Edge cases:**
- [ ] EventExpr with cardinality=one (valid)
- [ ] EventExpr with cardinality=many(instance) (valid for per-instance events)
- [ ] Type variables (cardinality.kind='var') — how to handle?

- [ ] All 50+ tests pass
- [ ] TypeScript compilation succeeds

---

## Integration Verification
- [ ] Full test suite passes (`npm test`)
- [ ] TypeScript compilation clean (`npm run typecheck`)
- [ ] Axis enforcement pass integrated into compilation pipeline
- [ ] AxisInvalid diagnostics surface correctly in UI/logs

---

## Unblocking Confirmation
- [ ] C-8 (ConstValue) can use axis enforcement to validate payload match
- [ ] U-1 (ValueExpr IR) is GATED — implementation verified to wait for C-4
- [ ] Single authority principle enforced (no dual authority violations remain)

---

## Documentation
- [ ] getManyInstance docstring explains return value and caller contract
- [ ] axis-enforcement.ts has module-level docstring explaining scope
- [ ] Scope constraints documented: "pure checker, no inference, no coercions"
- [ ] Git commit messages explain rationale for changes
