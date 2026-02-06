# Sprint: authority-consolidation - Single Authority Enforcement
Generated: 2026-01-28-192541
Confidence: HIGH: 2, MEDIUM: 0, LOW: 0
Status: READY (contract decided)
Source: EVALUATION-2026-01-28-191553.md
Dependencies: Sprint 1 (foundation) + Sprint 2 (event-typing)

## Sprint Goal
Eliminate dual authority violations by removing instanceId from FieldExpr nodes and implementing axis enforcement pass as the canonical validation gate for type invariants.

## Scope
**Deliverables:**
- REMOVE instanceId field from FieldExprMap/Zip/ZipSig (violates I1: Single Authority)
- Create getManyInstance(type) helper to derive instance from CanonicalType
- Implement axis enforcement pass (pure checker, AxisInvalid diagnostic only)

**Dependencies**: Requires Sprint 1 (C-2) + Sprint 2 (C-1) for typed EventExpr

**Confidence Split**:
- C-5 (remove instanceId, add helper): **MEDIUM** — getManyInstance null-handling contract needs decision
- C-4 (axis enforcement): **HIGH** — spec is complete, clear scope

## Work Items

### P0 (Critical): C-5 - Remove instanceId from FieldExpr, Add getManyInstance Helper

**Dependencies**: Sprint 1 C-2 (InstanceId in core/ids.ts), Sprint 2 C-1 (EventExpr.type exists)
**Spec Reference**: 15-FiveAxesTypeSystem-Conclusion.md:69 (I1: Single Authority), 00-exhaustive-type-system.md:230-235 • **Status Reference**: EVALUATION-2026-01-28-191553.md:145-164

**Confidence**: HIGH (contract decision: two helpers, requireManyInstance/maybeManyInstance)

#### Description
**REMOVE** instanceId field from FieldExprMap, FieldExprZip, FieldExprZipSig (3 interfaces). This field violates Invariant I1 (Single Authority): "No field on any node may duplicate type authority." If instanceId is present, it MUST match getManyInstance(type), so why store it twice? Implement getManyInstance(type: CanonicalType): InstanceRef | null helper so callers derive instance via: `const inst = getManyInstance(expr.type)`.

**Note**: FieldExprIntrinsic KEEPS instanceId (types.ts:237) — it's required for intrinsic property lookup and NOT derivable from type alone (intrinsic identity depends on block structure).

**Current State**:
- types.ts:265 (FieldExprMap), 273 (FieldExprZip), 282 (FieldExprZipSig): All have `instanceId?: InstanceId`
- No getManyInstance helper exists in canonical-types.ts
- 30+ call sites need updating to derive instance instead of reading field

**Spec Contract** (00-exhaustive-type-system.md:230-235):
```typescript
export function getManyInstance(t: CanonicalType): InstanceRef | null {
  const card = t.extent.cardinality;
  if (card.kind !== 'inst') return null;  // cardinality is a type variable
  if (card.value.kind !== 'many') return null;  // cardinality is 'zero' or 'one'
  return card.value.instance;  // cardinality is many(instance)
}
```

#### Acceptance Criteria (REQUIRED)
- [ ] getManyInstance(type: CanonicalType): InstanceRef | null exists in canonical-types.ts
- [ ] getManyInstance exported and unit tested
- [ ] FieldExprMap (L265) has NO instanceId field
- [ ] FieldExprZip (L273) has NO instanceId field
- [ ] FieldExprZipSig (L282) has NO instanceId field
- [ ] FieldExprIntrinsic (L237) KEEPS instanceId (not derivable from type)
- [ ] All 30+ call sites updated to use getManyInstance(expr.type)
- [ ] Tests verify: returns InstanceRef when cardinality=many, null otherwise
- [ ] Tests verify: handles cardinality var (returns null)
- [ ] All tests pass
- [ ] TypeScript compilation succeeds

#### Technical Notes

**Add two helpers to canonical-types.ts:**

**`requireManyInstance`** (total, throws):
```typescript
/**
 * Returns the instance reference for cardinality=many(instance).
 *
 * USE IN: Compiler backend, lowering, axis validation (field-expected paths).
 *
 * @throws If cardinality is not inst+many:
 *   - kind='var' (type variable not yet resolved)
 *   - value.kind='zero' (empty)
 *   - value.kind='one' (scalar, not a field)
 *
 * Error message includes actual cardinality for debugging.
 */
export function requireManyInstance(
  t: CanonicalType,
  context?: string
): InstanceRef {
  const card = t.extent.cardinality;
  if (card.kind !== 'inst') {
    throw new Error(
      `requireManyInstance: cardinality is var${context ? ` (${context})` : ''}, got: ${JSON.stringify(card)}`
    );
  }
  if (card.value.kind !== 'many') {
    throw new Error(
      `requireManyInstance: cardinality is ${card.value.kind}${context ? ` (${context})` : ''}, expected many`
    );
  }
  return card.value.instance;
}
```

**`maybeManyInstance`** (partial, returns null):
```typescript
/**
 * Returns the instance reference for cardinality=many(instance), or null.
 *
 * USE IN: UI rendering, diagnostic probes, when handling incomplete types.
 *
 * @returns InstanceRef if cardinality=many(instance), null otherwise:
 *   - kind='var' (type variable not yet resolved)
 *   - value.kind='zero' (empty)
 *   - value.kind='one' (scalar, not a field)
 */
export function maybeManyInstance(t: CanonicalType): InstanceRef | null {
  const card = t.extent.cardinality;
  if (card.kind !== 'inst') return null;
  if (card.value.kind !== 'many') return null;
  return card.value.instance;
}
```

**NOTE:** Do NOT create a `getManyInstance` helper. The ambiguity in that name is why we need two explicit variants.

**Call site pattern:**
```typescript
// BEFORE (dual authority violation)
const expr: FieldExprMap = {
  kind: 'map',
  type: someFieldType,
  instanceId: instanceId('inst_123'),  // <-- DELETE
  input: ...,
  fn: ...
};

const inst = expr.instanceId;  // OLD

// AFTER (single authority)
const expr: FieldExprMap = {
  kind: 'map',
  type: someFieldType,
  input: ...,
  fn: ...
};

const inst = getManyInstance(expr.type);  // NEW - derive from type
if (inst === null) {
  // DECISION NEEDED: What should happen here?
  // Option A: Skip this expression (cardinality=one, not a field)
  // Option B: Throw error (caller expects field)
  // Option C: Return default instance
}
```

#### Unknowns to Resolve

**CRITICAL AMBIGUITY** (must resolve before implementation):

1. **What should callers do when getManyInstance returns null?**
   - **Context**: Spec says "returns null if cardinality≠many" but doesn't specify caller contract
   - **Options**:
     - (a) Callers must check null + handle both cases (safest, most verbose)
     - (b) Callers assume non-null (crashes on cardinality=one, breaks system)
     - (c) Helper throws error if cardinality≠many (fails fast, but might reject valid expressions)
   - **Impact**: If callers crash on null, breaks cardinality=one field expressions
   - **Recommendation**: Choose (a) — callers check null, skip/log for cardinality=one

2. **Are there FieldExpr with cardinality=one?**
   - If NO: getManyInstance on FieldExpr is always non-null, simplifies logic
   - If YES: Need robust null handling at all call sites

#### Exit Criteria (to reach HIGH confidence)
- [ ] getManyInstance null-handling contract decided (choose option a/b/c above)
- [ ] Survey all call sites: confirm they can handle null (or adjust contract)
- [ ] Document caller obligations in getManyInstance docstring

---

### P1 (High): C-4 - Axis Enforcement Pass (Pure Checker)

**Dependencies**: Sprint 2 C-1 (needs EventExpr.type to validate invariants)
**Spec Reference**: 00-exhaustive-type-system.md:394-461, 15-FiveAxesTypeSystem-Conclusion.md:82-87 • **Status Reference**: EVALUATION-2026-01-28-191553.md:122-143

**Confidence**: HIGH (spec is complete, scope is constrained, no unknowns)

#### Description
Create axis enforcement pass as the **canonical validation gate** (Invariant I3). This is a **pure checker** with constrained scope: validates axis-shape only, no inference, no adapter insertion, no coercions. Runs after normalization, type inference, and type assignment. Produces single diagnostic category `AxisInvalid` with location + reason.

**What to check**:
- **SigExpr**: temporality=continuous (discrete forbidden)
- **EventExpr**: temporality=discrete, payload=bool, unit=none (HARD invariants)
- **FieldExpr**: cardinality≠zero (zero forbidden for fields)
- **State**: binding∈{strong,identity} for state reads (if applicable)

**What NOT to check** (out of scope):
- Type inference
- Adapter insertion
- Scheduling/cycle legality
- "Helpful coercions"
- Backend-only legality rules

**Current State**:
- No axis enforcement pass exists in src/compiler/passes-v2/
- No AxisInvalid diagnostic type defined
- EventExpr invariants never validated at runtime

**Spec Contract** (00-exhaustive-type-system.md:394-461):
```typescript
// src/compiler/passes-v2/axis-enforcement.ts
export function validateAxes(patch: TypedPatch): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Check EventExpr invariants
  for (const expr of findAllEventExpr(patch)) {
    if (!isEventTypeValid(expr.type)) {
      diagnostics.push({
        kind: 'AxisInvalid',
        location: expr.location,
        reason: 'EventExpr must have payload=bool, unit=none, temporality=discrete'
      });
    }
  }
  
  // Check SigExpr temporality
  for (const expr of findAllSigExpr(patch)) {
    if (expr.type.extent.temporality.kind === 'inst' &&
        expr.type.extent.temporality.value.kind === 'discrete') {
      diagnostics.push({
        kind: 'AxisInvalid',
        location: expr.location,
        reason: 'SigExpr cannot have temporality=discrete'
      });
    }
  }
  
  // Check FieldExpr cardinality
  for (const expr of findAllFieldExpr(patch)) {
    if (expr.type.extent.cardinality.kind === 'inst' &&
        expr.type.extent.cardinality.value.kind === 'zero') {
      diagnostics.push({
        kind: 'AxisInvalid',
        location: expr.location,
        reason: 'FieldExpr cannot have cardinality=zero'
      });
    }
  }
  
  return diagnostics;
}
```

#### Acceptance Criteria (REQUIRED)
- [ ] src/compiler/passes-v2/axis-enforcement.ts exists
- [ ] AxisInvalid diagnostic type defined (kind, location, reason)
- [ ] Pass validates EventExpr invariants (temporality=discrete, payload=bool, unit=none)
- [ ] Pass validates SigExpr temporality (continuous only, discrete forbidden)
- [ ] Pass validates FieldExpr cardinality (zero forbidden)
- [ ] Pass is PURE (no mutations, no inference, no coercions)
- [ ] Pass runs after normalization + type inference (integration point identified)
- [ ] 50+ test cases exist (positive + negative):
  - [ ] Valid EventExpr passes
  - [ ] EventExpr with temporality=continuous fails
  - [ ] EventExpr with payload≠bool fails
  - [ ] SigExpr with temporality=discrete fails
  - [ ] FieldExpr with cardinality=zero fails
- [ ] All tests pass
- [ ] TypeScript compilation succeeds

#### Technical Notes

**Diagnostic type** (add to diagnostics.ts or create new file):
```typescript
export interface AxisInvalidDiagnostic {
  readonly kind: 'AxisInvalid';
  readonly location: SourceLocation;  // where the violation occurs
  readonly reason: string;  // human-readable explanation
  readonly expressionKind: string;  // e.g., 'EventExprConst', 'SigExprMap'
  readonly violation: string;  // e.g., 'temporality=continuous (expected discrete)'
}
```

**Integration point** (compiler/compile.ts or equivalent):
```typescript
// After normalization, inference, type assignment:
const normalizedPatch = normalize(inputPatch);
const inferredPatch = inferTypes(normalizedPatch);
const typedPatch = assignTypes(inferredPatch);

// BEFORE lowering to backend:
const axisDiagnostics = validateAxes(typedPatch);  // <-- NEW
if (axisDiagnostics.length > 0) {
  return { success: false, diagnostics: axisDiagnostics };
}

// Only proceed if axis-valid:
const compiled = lowerToBackend(typedPatch);
```

**Helper functions** (in axis-enforcement.ts):
```typescript
function isEventTypeValid(type: CanonicalType): boolean {
  if (type.payload.kind !== 'bool') return false;
  if (type.unit.kind !== 'none') return false;
  if (type.extent.temporality.kind !== 'inst') return false;
  if (type.extent.temporality.value.kind !== 'discrete') return false;
  return true;
}

function findAllEventExpr(patch: TypedPatch): EventExpr[] {
  // Walk AST, collect all EventExpr nodes
  // (Use existing AST traversal utilities)
}
```

**GATES U-1** (ValueExpr IR):
Per spec, U-1 (ValueExpr IR lowering) **MUST NOT START** until C-4 is implemented and passing. Otherwise you'll implement ValueExpr while frontend can still emit invalid axis combinations.

---

## Dependencies
- **REQUIRES Sprint 1 C-2**: InstanceId in core/ids.ts (for C-5)
- **REQUIRES Sprint 2 C-1**: EventExpr.type exists (for C-4 validation)
- **UNBLOCKS**:
  - C-8 (ConstValue discriminated union — axis enforcement checks payload match)
  - U-1 (ValueExpr IR — GATED, cannot start until C-4 passes)

## Risks
- **C-5 Ambiguity**: getManyInstance null-handling contract needs clarification
  - **Mitigation**: Document decision in helper docstring, test both null/non-null cases
- **C-4 Integration**: Need to identify correct integration point in compilation pipeline
  - **Mitigation**: Spec says "after normalization/inference/assignment" — grep for existing pass orchestration

---

## Success Criteria
- ✅ getManyInstance helper exists and tested
- ✅ FieldExprMap/Zip/ZipSig have NO instanceId field (single authority restored)
- ✅ Axis enforcement pass exists and validates all invariants
- ✅ AxisInvalid diagnostic type defined
- ✅ 50+ axis enforcement tests pass (positive + negative)
- ✅ All tests pass
- ✅ Zero TypeScript compilation errors
- ✅ U-1 can safely start (axis violations caught before lowering)

---

## Estimated Effort
- C-5 (remove instanceId, add getManyInstance): 8 hours (includes contract clarification)
- C-4 (axis enforcement pass): 12 hours (includes 50+ test cases)
**Total: 20 hours**
