# Sprint: const-value - ConstValue Discriminated Union (REVISED)
Generated: 2026-01-29
Confidence: HIGH: 1, MEDIUM: 0, LOW: 0
Status: READY FOR IMPLEMENTATION (REVISION REQUIRED)
Source: EVALUATION-2026-01-28-191553.md
Dependencies: Sprint 3 (authority-consolidation) - requires C-4 (axis enforcement)

## Critical Issues Found During Implementation

### Issue 1: Type System Mismatch with Spec
**Problem**: Our codebase uses `AxisTag<T>` with `default`/`instantiated` discriminators, but the spec (00-exhaustive-type-system.md:65-73) defines `Axis<T, V>` with `var`/`inst` discriminators and `CardinalityAxis`, `TemporalityAxis`, etc.

**Spec (authoritative)**:
```typescript
export type Axis<T, V> =
  | { readonly kind: 'var'; readonly var: V }
  | { readonly kind: 'inst'; readonly value: T };

export type CardinalityAxis = Axis<CardinalityValue, CardinalityVarId>;
export type TemporalityAxis = Axis<TemporalityValue, TemporalityVarId>;
export type BindingAxis = Axis<BindingValue, BindingVarId>;
export type PerspectiveAxis = Axis<PerspectiveValue, PerspectiveVarId>;
export type BranchAxis = Axis<BranchValue, BranchVarId>;
```

**Current Code**:
```typescript
export type AxisTag<T> =
  | { readonly kind: 'default' }
  | { readonly kind: 'instantiated'; readonly value: T };
```

**Resolution**: Either add spec-compatible types OR document that our implementation uses a different pattern. For now, use the types that exist in the codebase but ensure correctness.

### Issue 2: C-4 (Axis Enforcement) Does NOT Exist
**Problem**: The DoD claims C-4 is complete, but `src/compiler/passes-v2/axis-enforcement.ts` does NOT exist. The spec (405-472) defines a required `validateAxes()` function in `src/compiler/frontend/axis-validate.ts`.

**Resolution**: C-4 is NOT complete. We must create axis enforcement before C-8 can complete.

## Revised Work Items

### P0 (Critical): Create Axis Enforcement Pass (C-4)

**Status**: NOT STARTED (previously marked as complete)

**Spec Reference**: 00-exhaustive-type-system.md:405-472

**Description**:
Create the canonical frontend validation gate that enforces all axis invariants before IR enters the backend. This is the "belt buckle" mentioned in the spec.

**Acceptance Criteria**:
- [ ] `src/compiler/passes-v2/axis-enforcement.ts` exists
- [ ] `validateAxes(patch: TypedPatch): AxisInvalidDiagnostic[]` function exists
- [ ] Validates const payload/value shape alignment (Invariant I5)
- [ ] Validates family invariants (signal/field/event derived from CanonicalType)
- [ ] Validates no duplicate type authority (no stray instanceId on expressions)
- [ ] Tests verify positive and negative cases

**Implementation**:
```typescript
// src/compiler/passes-v2/axis-enforcement.ts
export interface AxisInvalidDiagnostic {
  kind: 'AxisInvalid';
  location: SourceLocation;
  reason: string;
  expressionKind: string;
  violation: string;
}

export function validateAxes(patch: TypedPatch): AxisInvalidDiagnostic[] {
  const diagnostics: AxisInvalidDiagnostic[] = [];

  // Check const expressions for payload/value alignment (I5)
  for (const sig of patch.signals) {
    if (sig.kind === 'const') {
      if (!constValueMatchesPayload(sig.type.payload, sig.value)) {
        diagnostics.push({
          kind: 'AxisInvalid',
          location: getExprLocation(sig),
          reason: 'Const value kind must match payload kind (Invariant I5)',
          expressionKind: 'SigExprConst',
          violation: `value.kind=${sig.value.kind}, payload.kind=${sig.type.payload.kind}`
        });
      }
    }
  }

  // Check field expressions
  for (const field of patch.fields) {
    if (field.kind === 'const') {
      if (!constValueMatchesPayload(field.type.payload, field.value)) {
        diagnostics.push({
          kind: 'AxisInvalid',
          location: getExprLocation(field),
          reason: 'Const value kind must match payload kind (Invariant I5)',
          expressionKind: 'FieldExprConst',
          violation: `value.kind=${field.value.kind}, payload.kind=${field.type.payload.kind}`
        });
      }
    }
  }

  return diagnostics;
}
```

### P0 (Critical): C-8 - ConstValue Discriminated Union (REQUIRES C-4)

**Status**: PARTIALLY COMPLETE - type and interfaces defined, construction sites updated

**Dependencies**: Requires C-4 (axis enforcement)

**Description**:
Replace `value: number | string | boolean` with strongly-typed ConstValue discriminated union in SigExprConst and FieldExprConst. This enforces Invariant I5: "Const literal shape matches payload."

**Current State**:
- ✅ ConstValue type defined (7 variants with readonly tuples)
- ✅ constValueMatchesPayload() validator exists
- ✅ SigExprConst/FieldExprConst interfaces updated
- ✅ All ~40+ construction sites updated to use ConstValue
- ✅ TypeScript compilation succeeds
- ⏳ Axis enforcement validation (blocked on C-4)
- ⏳ Tests for constValueMatchesPayload
- ⏳ Axis enforcement ConstValue tests
- ⏳ Full test suite pass

**Remaining Work**:
1. Create axis-enforcement.ts (C-4)
2. Add constValueMatchesPayload tests to `src/core/__tests__/canonical-types.test.ts`
3. Add axis enforcement ConstValue tests to axis-enforcement test file
4. Run full test suite

**Test Cases for constValueMatchesPayload**:
```typescript
describe('constValueMatchesPayload', () => {
  test('float value matches float payload', () => {
    const payload: PayloadType = { kind: 'float' };
    const value: ConstValue = { kind: 'float', value: 42.0 };
    expect(constValueMatchesPayload(payload, value)).toBe(true);
  });

  test('float value does not match vec2 payload', () => {
    const payload: PayloadType = { kind: 'vec2' };
    const value: ConstValue = { kind: 'float', value: 42.0 };
    expect(constValueMatchesPayload(payload, value)).toBe(false);
  });

  // Add tests for all 7 ConstValue variants
});
```

**Test Cases for Axis Enforcement**:
```typescript
describe('Axis Enforcement: ConstValue Payload Matching', () => {
  test('Float const with float payload passes', () => {
    const expr: SigExprConst = {
      kind: 'const',
      type: canonicalType(FLOAT),
      value: { kind: 'float', value: 42.0 }
    };
    const patch: TypedPatch = { events: [], signals: [expr], fields: [] };
    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(0);
  });

  test('Float const with vec2 payload fails', () => {
    const expr: SigExprConst = {
      kind: 'const',
      type: canonicalType(VEC2),
      value: { kind: 'float', value: 42.0 }  // MISMATCH
    };
    const patch: TypedPatch = { events: [], signals: [expr], fields: [] };
    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].kind).toBe('AxisInvalid');
  });
});
```

---

## Dependencies
- **REQUIRES**: C-4 (axis enforcement pass) must be created first
- **COMPLETES**: CanonicalType migration (all 8 work items from gap analysis)

## Risks
- **Moderate**: C-4 (axis enforcement) is entirely new code
- **Mitigation**: Follow the spec exactly for implementation

## Success Criteria
- ✅ ConstValue discriminated union defined (7 variants)
- ✅ constValueMatchesPayload validator exists
- ✅ SigExprConst/FieldExprConst use ConstValue
- ✅ All construction sites updated
- ✅ Axis enforcement validates ConstValue.kind matches payload.kind
- ✅ Tests verify payload matching (positive + negative cases)
- ✅ All tests pass
- ✅ Zero TypeScript compilation errors
- ✅ Runtime type safety: impossible to construct mismatched const values

## Revised Definition of Done

After this sprint, all 8 work items from gap analysis are complete:
- ✅ C-1: EventExpr typed (Sprint 2)
- ✅ C-2: core/ids.ts authority (Sprint 1)
- ✅ C-3: reduce_field renamed (Sprint 1)
- ⏳ C-4: Axis enforcement exists and passing (Sprint 3) ← NOW DOING
- ✅ C-5: instanceId removed, getManyInstance added (Sprint 3)
- ✅ C-6: string leakage fixed (Sprint 2)
- ✅ C-7: FieldExprArray deleted (Sprint 1)
- ⏳ C-8: ConstValue discriminated union (Sprint 4) ← DEPENDS ON C-4

**Next Phase**: U-1 (ValueExpr IR) can safely start — axis enforcement ensures valid IR.
