# Implementation Context: authority-consolidation

## Overview
Remove dual authority violations (FieldExpr.instanceId) and implement canonical axis enforcement gate. C-5 has MEDIUM confidence due to null-handling contract decision needed. C-4 has HIGH confidence with complete spec.

---

## C-5: Remove instanceId from FieldExpr, Add getManyInstance Helper

### CONTRACT DECISION: TWO HELPERS, NOT ONE

**Decision made (2026-01-28):** Use two helpers with explicit contracts encoded in names.

```typescript
// TOTAL / FAILING HELPER (default for compiler/backend code)
/** Returns the instance for many(instance). Throws if cardinality is not inst+many. */
export function requireManyInstance(t: CanonicalType): InstanceRef

// PARTIAL / QUERY HELPER (only for UI/probing paths)
/** Returns the instance for many(instance), else null (var/zero/one). */
export function maybeManyInstance(t: CanonicalType): InstanceRef | null
```

**Why this choice:**
- Backend/lowering: encountering non-many in field-expected paths is a bug → fail-fast
- UI: legitimately has "not fully typed yet" (vars) and "not a field" values → null OK

**Rules for callers:**
| Context | Helper | If null/error? |
|---------|--------|----------------|
| Backend/lowering | `requireManyInstance()` | Throw (axis-validation gap) |
| Frontend axis validation | `requireManyInstance()` for field-by-construction; `maybeManyInstance()` for probing | Throw / handle null |
| UI rendering | `maybeManyInstance()` | Show "unknown/not-field" |

**Docstring requirements:**

`requireManyInstance`:
```typescript
/**
 * Returns the instance for many(instance).
 * @throws If cardinality is:
 *   - var (type variable)
 *   - inst.zero
 *   - inst.one
 * Error message includes actual cardinality and optional context.
 */
```

`maybeManyInstance`:
```typescript
/**
 * Returns the instance for many(instance), else null.
 * @returns null if cardinality is:
 *   - var (type variable)
 *   - inst.zero
 *   - inst.one
 */
```

**Enforcement:** Delete `getManyInstance` entirely. Ban `maybeManyInstance(...)!` via grep gate.
```

---

### Files to Modify

1. **src/core/canonical-types.ts** (add getManyInstance)
2. **src/compiler/ir/types.ts** (remove instanceId fields)
3. **All call sites** (~30 files, TypeScript will identify)
4. **src/core/__tests__/canonical-types.test.ts** (add tests)

---

### Step 1: Add getManyInstance Helper

**File**: `src/core/canonical-types.ts`

**Location**: Insert after eventType helper (from Sprint 2)

```typescript
/**
 * Derive instance reference from cardinality axis.
 * 
 * Use this instead of storing instanceId on expression nodes.
 * This enforces Invariant I1 (Single Authority): type is the only source of truth.
 * 
 * @returns InstanceRef if cardinality=many(instance), null otherwise
 * 
 * Returns null if:
 * - cardinality is a type variable (kind='var')
 * - cardinality.value.kind is 'zero' or 'one'
 * 
 * CALLER CONTRACT: Callers MUST check for null and handle gracefully.
 * Typical pattern:
 *   const inst = getManyInstance(expr.type);
 *   if (inst === null) {
 *     // Expression is not a field, skip or use default
 *     continue;
 *   }
 *   // Use inst...
 */
export function getManyInstance(t: CanonicalType): InstanceRef | null {
  const card = t.extent.cardinality;
  if (card.kind !== 'inst') return null;  // type variable
  if (card.value.kind !== 'many') return null;  // zero or one
  return card.value.instance;
}
```

**Import additions** (if not already present):
```typescript
import type { CanonicalType, InstanceRef } from './canonical-types';
```

---

### Step 2: Remove instanceId from FieldExpr Interfaces

**File**: `src/compiler/ir/types.ts`

**Location 1: Line 265 (FieldExprMap)**
```typescript
// BEFORE
export interface FieldExprMap {
  readonly kind: 'map';
  readonly type: CanonicalType;
  readonly instanceId?: InstanceId;  // <-- DELETE this line
  readonly input: FieldExpr;
  readonly fn: MapFn;
}

// AFTER
export interface FieldExprMap {
  readonly kind: 'map';
  readonly type: CanonicalType;
  readonly input: FieldExpr;
  readonly fn: MapFn;
}
```

**Location 2: Line 273 (FieldExprZip)**
```typescript
// BEFORE
export interface FieldExprZip {
  readonly kind: 'zip';
  readonly type: CanonicalType;
  readonly instanceId?: InstanceId;  // <-- DELETE this line
  readonly inputs: readonly FieldExpr[];
  readonly fn: ZipFn;
}

// AFTER
export interface FieldExprZip {
  readonly kind: 'zip';
  readonly type: CanonicalType;
  readonly inputs: readonly FieldExpr[];
  readonly fn: ZipFn;
}
```

**Location 3: Line 282 (FieldExprZipSig)**
```typescript
// BEFORE
export interface FieldExprZipSig {
  readonly kind: 'zipSig';
  readonly type: CanonicalType;
  readonly instanceId?: InstanceId;  // <-- DELETE this line
  readonly fieldInput: FieldExpr;
  readonly sigInputs: readonly SigExpr[];
  readonly fn: ZipSigFn;
}

// AFTER
export interface FieldExprZipSig {
  readonly kind: 'zipSig';
  readonly type: CanonicalType;
  readonly fieldInput: FieldExpr;
  readonly sigInputs: readonly SigExpr[];
  readonly fn: ZipSigFn;
}
```

**DO NOT DELETE** (FieldExprIntrinsic keeps instanceId):
```typescript
// Line 237 — DO NOT CHANGE
export interface FieldExprIntrinsic {
  readonly kind: 'intrinsic';
  readonly type: CanonicalType;
  readonly instanceId: InstanceId;  // <-- KEEP (required for intrinsic lookup)
  readonly property: IntrinsicProperty;
}
```

---

### Step 3: Find and Update Call Sites

**After Step 2, TypeScript will error at all construction sites.**

**Search commands:**
```bash
# Find construction sites
grep -rn "kind: 'map'" src/ | grep Field
grep -rn "kind: 'zip'" src/ | grep Field
grep -rn "kind: 'zipSig'" src/

# Find read sites (accessing .instanceId)
grep -rn "\.instanceId" src/ | grep -E "FieldExprMap|FieldExprZip|FieldExprZipSig"
```

**Pattern for construction sites:**
```typescript
// BEFORE (will cause TypeScript error after Step 2)
const expr: FieldExprMap = {
  kind: 'map',
  type: someFieldType,
  instanceId: instanceId('inst_123'),  // <-- type error (property doesn't exist)
  input: ...,
  fn: ...
};

// AFTER (remove instanceId property)
const expr: FieldExprMap = {
  kind: 'map',
  type: someFieldType,  // instance is derivable from type
  input: ...,
  fn: ...
};
```

**Pattern for read sites:**
```typescript
// BEFORE (dual authority violation)
function processFieldExpr(expr: FieldExpr) {
  if (expr.kind === 'map') {
    const inst = expr.instanceId;  // <-- property doesn't exist after Step 2
    if (inst) {
      // use inst...
    }
  }
}

// AFTER (single authority — derive from type)
import { getManyInstance } from '../../core/canonical-types';

function processFieldExpr(expr: FieldExpr) {
  if (expr.kind === 'map') {
    const inst = getManyInstance(expr.type);  // <-- derive from type
    if (inst === null) {
      // Expression is not a field (cardinality≠many)
      console.warn('Skipping non-field expression');
      return;
    }
    // use inst...
  }
}
```

**TypeScript will identify all sites:**
```bash
npm run typecheck 2>&1 | grep -E "instanceId|FieldExprMap|FieldExprZip"
```

---

### Step 4: Add Tests

**File**: `src/core/__tests__/canonical-types.test.ts`

**Location**: Add after EventExpr tests (from Sprint 2)

```typescript
describe('getManyInstance', () => {
  test('returns InstanceRef when cardinality=many(instance)', () => {
    const inst: InstanceRef = {
      instanceId: instanceId('inst_test'),
      domainTypeId: domainTypeId('domain_test')
    };
    const type: CanonicalType = {
      payload: { kind: 'float' },
      unit: { kind: 'none' },
      extent: {
        cardinality: { kind: 'inst', value: { kind: 'many', instance: inst } },
        temporality: { kind: 'inst', value: { kind: 'continuous' } },
        binding: { kind: 'inst', value: { kind: 'unbound' } },
        perspective: { kind: 'inst', value: { kind: 'default' } },
        branch: { kind: 'inst', value: { kind: 'main' } }
      }
    };

    const result = getManyInstance(type);
    expect(result).toEqual(inst);
  });

  test('returns null when cardinality=one', () => {
    const type: CanonicalType = {
      payload: { kind: 'float' },
      unit: { kind: 'none' },
      extent: {
        cardinality: { kind: 'inst', value: { kind: 'one' } },
        temporality: { kind: 'inst', value: { kind: 'continuous' } },
        binding: { kind: 'inst', value: { kind: 'unbound' } },
        perspective: { kind: 'inst', value: { kind: 'default' } },
        branch: { kind: 'inst', value: { kind: 'main' } }
      }
    };

    const result = getManyInstance(type);
    expect(result).toBeNull();
  });

  test('returns null when cardinality=zero', () => {
    const type: CanonicalType = {
      payload: { kind: 'float' },
      unit: { kind: 'none' },
      extent: {
        cardinality: { kind: 'inst', value: { kind: 'zero' } },
        temporality: { kind: 'inst', value: { kind: 'continuous' } },
        binding: { kind: 'inst', value: { kind: 'unbound' } },
        perspective: { kind: 'inst', value: { kind: 'default' } },
        branch: { kind: 'inst', value: { kind: 'main' } }
      }
    };

    const result = getManyInstance(type);
    expect(result).toBeNull();
  });

  test('returns null when cardinality is type variable', () => {
    const type: CanonicalType = {
      payload: { kind: 'float' },
      unit: { kind: 'none' },
      extent: {
        cardinality: { kind: 'var', var: cardinalityVarId('card_var') },
        temporality: { kind: 'inst', value: { kind: 'continuous' } },
        binding: { kind: 'inst', value: { kind: 'unbound' } },
        perspective: { kind: 'inst', value: { kind: 'default' } },
        branch: { kind: 'inst', value: { kind: 'main' } }
      }
    };

    const result = getManyInstance(type);
    expect(result).toBeNull();
  });
});
```

**Import additions**:
```typescript
import { getManyInstance } from '../canonical-types';
import { instanceId, domainTypeId, cardinalityVarId } from '../ids';
```

---

## C-4: Axis Enforcement Pass (Pure Checker)

### Files to Create/Modify

1. **src/compiler/passes-v2/axis-enforcement.ts** (NEW)
2. **src/compiler/diagnostics.ts** (add AxisInvalidDiagnostic)
3. **src/compiler/passes-v2/__tests__/axis-enforcement.test.ts** (NEW, 50+ tests)
4. **src/compiler/compile.ts** (integrate pass into pipeline)

---

### Step 1: Define Diagnostic Type

**File**: `src/compiler/diagnostics.ts` (or create if doesn't exist)

**Location**: Add to existing diagnostic union

```typescript
export interface AxisInvalidDiagnostic {
  readonly kind: 'AxisInvalid';
  readonly location: SourceLocation;  // where violation occurs
  readonly reason: string;  // human-readable explanation
  readonly expressionKind: string;  // e.g., 'EventExprConst', 'SigExprMap'
  readonly violation: string;  // e.g., 'temporality=continuous (expected discrete)'
}

// Add to diagnostic union
export type Diagnostic =
  | ... existing types ...
  | AxisInvalidDiagnostic;
```

**SourceLocation type** (if not defined):
```typescript
export interface SourceLocation {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly blockId?: BlockId;
  readonly portId?: PortId;
}
```

---

### Step 2: Create Axis Enforcement Pass

**File**: `src/compiler/passes-v2/axis-enforcement.ts` (NEW FILE)

```typescript
/**
 * Axis Enforcement Pass (Pure Checker)
 * 
 * SCOPE: Validates axis-shape only. Does NOT do:
 * - Type inference
 * - Adapter insertion
 * - Scheduling/cycle legality
 * - Helpful coercions
 * - Backend-only rules
 * 
 * Runs after: normalization, type inference, type assignment
 * Before: lowering to backend
 * 
 * Invariant I3: This is the canonical enforcement gate.
 */

import type { CanonicalType } from '../../core/canonical-types';
import type { EventExpr, SigExpr, FieldExpr } from '../ir/types';
import type { AxisInvalidDiagnostic } from '../diagnostics';

export interface TypedPatch {
  // Define structure or import existing
  readonly events: readonly EventExpr[];
  readonly signals: readonly SigExpr[];
  readonly fields: readonly FieldExpr[];
  // ... other members
}

/**
 * Validate axis constraints on all expressions.
 * @returns Array of AxisInvalid diagnostics (empty if valid)
 */
export function validateAxes(patch: TypedPatch): AxisInvalidDiagnostic[] {
  const diagnostics: AxisInvalidDiagnostic[] = [];

  // Check EventExpr invariants
  for (const expr of patch.events) {
    if (!isEventTypeValid(expr.type)) {
      diagnostics.push({
        kind: 'AxisInvalid',
        location: getExprLocation(expr),
        reason: 'EventExpr must have payload=bool, unit=none, temporality=discrete',
        expressionKind: expr.kind,
        violation: describeEventViolation(expr.type)
      });
    }
  }

  // Check SigExpr temporality
  for (const expr of patch.signals) {
    if (isDiscreteTemporality(expr.type)) {
      diagnostics.push({
        kind: 'AxisInvalid',
        location: getExprLocation(expr),
        reason: 'SigExpr cannot have temporality=discrete (must be continuous)',
        expressionKind: expr.kind,
        violation: 'temporality=discrete'
      });
    }
  }

  // Check FieldExpr cardinality
  for (const expr of patch.fields) {
    if (isZeroCardinality(expr.type)) {
      diagnostics.push({
        kind: 'AxisInvalid',
        location: getExprLocation(expr),
        reason: 'FieldExpr cannot have cardinality=zero',
        expressionKind: expr.kind,
        violation: 'cardinality=zero'
      });
    }
  }

  return diagnostics;
}

/**
 * Check EventExpr HARD invariants:
 * - payload.kind === 'bool'
 * - unit.kind === 'none'
 * - extent.temporality === 'discrete'
 */
function isEventTypeValid(type: CanonicalType): boolean {
  if (type.payload.kind !== 'bool') return false;
  if (type.unit.kind !== 'none') return false;
  
  const temp = type.extent.temporality;
  if (temp.kind !== 'inst') return false;  // type variable not allowed
  if (temp.value.kind !== 'discrete') return false;
  
  return true;
}

function isDiscreteTemporality(type: CanonicalType): boolean {
  const temp = type.extent.temporality;
  if (temp.kind !== 'inst') return false;  // type variable OK
  return temp.value.kind === 'discrete';
}

function isZeroCardinality(type: CanonicalType): boolean {
  const card = type.extent.cardinality;
  if (card.kind !== 'inst') return false;  // type variable OK
  return card.value.kind === 'zero';
}

function describeEventViolation(type: CanonicalType): string {
  const parts: string[] = [];
  if (type.payload.kind !== 'bool') {
    parts.push(`payload=${type.payload.kind} (expected bool)`);
  }
  if (type.unit.kind !== 'none') {
    parts.push(`unit=${type.unit.kind} (expected none)`);
  }
  const temp = type.extent.temporality;
  if (temp.kind === 'inst' && temp.value.kind !== 'discrete') {
    parts.push(`temporality=${temp.value.kind} (expected discrete)`);
  }
  return parts.join(', ');
}

function getExprLocation(expr: any): SourceLocation {
  // Extract location metadata from expr
  // Placeholder implementation:
  return {
    blockId: expr.blockId,
    portId: expr.portId
  };
}
```

---

### Step 3: Integrate Into Compilation Pipeline

**File**: `src/compiler/compile.ts` (or equivalent orchestration file)

**Location**: After normalization/inference/assignment, before lowering

```typescript
import { validateAxes } from './passes-v2/axis-enforcement';

export function compile(inputPatch: Patch): CompileResult {
  // Existing passes
  const normalizedPatch = normalize(inputPatch);
  const inferredPatch = inferTypes(normalizedPatch);
  const typedPatch = assignTypes(inferredPatch);

  // NEW: Axis enforcement gate (Invariant I3)
  const axisDiagnostics = validateAxes(typedPatch);
  if (axisDiagnostics.length > 0) {
    return {
      success: false,
      diagnostics: axisDiagnostics
    };
  }

  // Only proceed if axis-valid
  const compiled = lowerToBackend(typedPatch);
  return {
    success: true,
    compiled
  };
}
```

---

### Step 4: Add Tests (50+ cases)

**File**: `src/compiler/passes-v2/__tests__/axis-enforcement.test.ts` (NEW)

```typescript
import { validateAxes } from '../axis-enforcement';
import { eventType } from '../../../core/canonical-types';
import type { EventExpr, SigExpr, FieldExpr, TypedPatch } from '../../ir/types';

describe('Axis Enforcement: EventExpr', () => {
  test('Valid EventExpr passes (payload=bool, unit=none, temporality=discrete)', () => {
    const cardOne = { kind: 'inst' as const, value: { kind: 'one' as const } };
    const expr: EventExprConst = {
      kind: 'const',
      type: eventType(cardOne),
      fired: true
    };
    const patch: TypedPatch = { events: [expr], signals: [], fields: [] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(0);
  });

  test('EventExpr with temporality=continuous fails', () => {
    const expr: EventExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'bool' },
        unit: { kind: 'none' },
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'one' } },
          temporality: { kind: 'inst', value: { kind: 'continuous' } },  // WRONG
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      fired: true
    };
    const patch: TypedPatch = { events: [expr], signals: [], fields: [] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].kind).toBe('AxisInvalid');
    expect(diagnostics[0].violation).toContain('temporality=continuous');
  });

  test('EventExpr with payload=float fails', () => {
    const expr: EventExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'float' },  // WRONG
        unit: { kind: 'none' },
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'one' } },
          temporality: { kind: 'inst', value: { kind: 'discrete' } },
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      fired: true
    };
    const patch: TypedPatch = { events: [expr], signals: [], fields: [] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].violation).toContain('payload=float');
  });

  test('EventExpr with unit=meters fails', () => {
    const expr: EventExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'bool' },
        unit: { kind: 'meters' },  // WRONG
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'one' } },
          temporality: { kind: 'inst', value: { kind: 'discrete' } },
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      fired: true
    };
    const patch: TypedPatch = { events: [expr], signals: [], fields: [] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].violation).toContain('unit=meters');
  });
});

describe('Axis Enforcement: SigExpr', () => {
  test('Valid SigExpr passes (temporality=continuous)', () => {
    const expr: SigExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'float' },
        unit: { kind: 'none' },
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'one' } },
          temporality: { kind: 'inst', value: { kind: 'continuous' } },
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      value: 42
    };
    const patch: TypedPatch = { events: [], signals: [expr], fields: [] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(0);
  });

  test('SigExpr with temporality=discrete fails', () => {
    const expr: SigExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'float' },
        unit: { kind: 'none' },
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'one' } },
          temporality: { kind: 'inst', value: { kind: 'discrete' } },  // WRONG
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      value: 42
    };
    const patch: TypedPatch = { events: [], signals: [expr], fields: [] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].kind).toBe('AxisInvalid');
    expect(diagnostics[0].violation).toBe('temporality=discrete');
  });
});

describe('Axis Enforcement: FieldExpr', () => {
  test('Valid FieldExpr passes (cardinality=many)', () => {
    const inst: InstanceRef = {
      instanceId: instanceId('inst_test'),
      domainTypeId: domainTypeId('domain_test')
    };
    const expr: FieldExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'float' },
        unit: { kind: 'none' },
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'many', instance: inst } },
          temporality: { kind: 'inst', value: { kind: 'continuous' } },
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      value: 42
    };
    const patch: TypedPatch = { events: [], signals: [], fields: [expr] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(0);
  });

  test('FieldExpr with cardinality=zero fails', () => {
    const expr: FieldExprConst = {
      kind: 'const',
      type: {
        payload: { kind: 'float' },
        unit: { kind: 'none' },
        extent: {
          cardinality: { kind: 'inst', value: { kind: 'zero' } },  // WRONG
          temporality: { kind: 'inst', value: { kind: 'continuous' } },
          binding: { kind: 'inst', value: { kind: 'unbound' } },
          perspective: { kind: 'inst', value: { kind: 'default' } },
          branch: { kind: 'inst', value: { kind: 'main' } }
        }
      },
      value: 42
    };
    const patch: TypedPatch = { events: [], signals: [], fields: [expr] };

    const diagnostics = validateAxes(patch);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].kind).toBe('AxisInvalid');
    expect(diagnostics[0].violation).toBe('cardinality=zero');
  });
});

// Add 40+ more test cases covering:
// - All EventExpr variants (Pulse, Wrap, Combine, Never)
// - All SigExpr variants
// - All FieldExpr variants
// - Edge cases: type variables, cardinality=one for EventExpr, etc.
```

---

## Verification

### TypeScript Compilation
```bash
npm run typecheck
```

### Unit Tests
```bash
npm test -- canonical-types.test.ts
npm test -- axis-enforcement.test.ts
```

### Full Test Suite
```bash
npm test
```

### Integration Smoke Test
Try compiling a patch with an invalid EventExpr — should produce AxisInvalid diagnostic.

---

## Adjacent Code Patterns

### Existing pass structure (for reference)
Look at other passes in `src/compiler/passes-v2/` for structure:
- Input: TypedPatch (or equivalent)
- Output: Diagnostic[] or transformed patch
- Pure functions (no mutations)

### Existing diagnostic handling
Look at how other diagnostics are created and surfaced:
- Diagnostic union type
- Location metadata
- Integration with UI/logging

Follow these patterns for axis-enforcement.ts.
