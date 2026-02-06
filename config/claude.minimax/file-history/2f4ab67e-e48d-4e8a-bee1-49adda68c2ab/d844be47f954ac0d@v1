/**
 * ══════════════════════════════════════════════════════════════════════
 * FIELD MATERIALIZER
 * ══════════════════════════════════════════════════════════════════════
 *
 * Converts FieldExpr IR nodes into typed array buffers.
 * Pure IR path - no legacy fallbacks.
 *
 * ──────────────────────────────────────────────────────────────────────
 * LAYER CONTRACT
 * ──────────────────────────────────────────────────────────────────────
 *
 * MATERIALIZER RESPONSIBILITIES:
 * 1. IR → buffer orchestration (materialize, fillBuffer)
 * 2. Buffer cache management (frame-stamped caching)
 * 3. Intrinsic field production (index, normalizedIndex, randomId)
 * 4. Layout field production (position, radius from layout spec)
 * 5. Dispatch to field kernel registry
 *
 * MATERIALIZER DOES NOT:
 * - Define scalar math (→ OpcodeInterpreter)
 * - Define signal kernels (→ SignalEvaluator)
 * - Define coord-space semantics (→ block-level contracts)
 * - Multiply by viewport width/height (→ backend renderers)
 *
 * ──────────────────────────────────────────────────────────────────────
 * FIELD KERNEL REGISTRY (applyFieldKernel / applyFieldKernelZipSig)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Field kernels operate on typed array buffers (vec2/color/float).
 * Most kernels are COORD-SPACE AGNOSTIC and do not assume world vs local.
 * Kernels that are explicitly world/local-space state that in their contract.
 *
 * VEC2 CONSTRUCTION:
 *   makeVec2(x, y) → vec2
 *     AGNOSTIC - combines raw values
 *
 * POLAR/CARTESIAN:
 *   fieldPolarToCartesian(cx, cy, r, angle) → vec2
 *     AGNOSTIC - pure geometric transform, angle in RADIANS
 *     Output space matches input space (local if inputs are local, etc.)
 *
 * LAYOUT:
 *   circleLayout(normalizedIndex, radius, phase) → vec2
 *     WORLD-SPACE - centered at (0.5, 0.5), expects index ∈ [0,1]
 *   circleAngle(normalizedIndex, phase) → float (radians)
 *     Expects index ∈ [0,1], outputs RADIANS
 *   polygonVertex(index, sides, radiusX, radiusY) → vec2
 *     LOCAL-SPACE - centered at (0,0), outputs control points
 *
 * EFFECTS:
 *   fieldJitterVec(pos, rand, amtX, amtY, amtZ) → vec3
 *     AGNOSTIC - offsets in same units as pos
 *   attract2d(pos, targetX, targetY, phase, strength) → vec2
 *     AGNOSTIC - pos/target must be in same space
 *   fieldPulse(id01, phase, base, amp, spread) → float
 *     Expects id01 ∈ [0,1], outputs scalar values
 *
 * FIELD MATH:
 *   fieldAdd(a, b) → float
 *     AGNOSTIC - element-wise addition
 *   fieldAngularOffset(id01, phase, spin) → float (radians)
 *     Expects id01 ∈ [0,1], outputs RADIANS
 *   fieldRadiusSqrt(id01, radius) → float
 *     AGNOSTIC - expects id01 ∈ [0,1], preserves radius units
 *   fieldGoldenAngle(id01) → float (radians)
 *     Expects id01 ∈ [0,1], outputs RADIANS
 *
 * COLOR:
 *   hsvToRgb(h, s, v) → color
 *     h wraps to [0,1], s/v clamped to [0,1]
 *   hsvToRgb(hueField, sat, val) → color (zipSig variant)
 *     hueField per-element, sat/val uniform
 *   fieldHueFromPhase(id01, phase) → float
 *     Expects id01 ∈ [0,1], outputs hue ∈ [0,1]
 *   applyOpacity(color, opacity) → color
 *     opacity clamped to [0,1]
 *
 * ──────────────────────────────────────────────────────────────────────
 * IMPORTANT: COORD-SPACE DISCIPLINE
 * ──────────────────────────────────────────────────────────────────────
 *
 * Most field kernels are COORD-SPACE AGNOSTIC - they perform pure
 * mathematical transformations without knowledge of coordinate systems.
 *
 * Key principles:
 * 1. NO viewport width/height multiplication (→ backend concern)
 * 2. Angles are ALWAYS in RADIANS (not degrees, not cycles)
 * 3. Normalized inputs (id01, normalizedIndex) expect [0,1]
 * 4. Blocks define whether vec2 fields are local-space or world-space
 * 5. Agnostic kernels preserve input space in output
 *
 * Examples:
 * - fieldPolarToCartesian: just computes cx + r*cos(a), cy + r*sin(a)
 *   - If center=(0,0) and r is local units → local output
 *   - If center=(0.5,0.5) and r is world units → world output
 * - jitter2d: adds offsets in the same units as input position
 *   - If pos is local, amounts should be local
 *   - If pos is world, amounts should be world
 * - polygonVertex: explicitly outputs LOCAL-SPACE control points
 * - circleLayout: explicitly outputs WORLD-SPACE positions
 *
 * This design keeps kernels simple, reusable, and backend-independent.
 *
 * ──────────────────────────────────────────────────────────────────────
 * ROADMAP PHASE 6 - ALIGNMENT WITH FUTURE RENDERIR
 * ──────────────────────────────────────────────────────────────────────
 *
 * The Materializer outputs are designed to align with the future
 * DrawPathInstancesOp model (see src/render/types.ts).
 *
 * CURRENT STATE:
 * - Control points (polygonVertex) → Field<vec2> in local space
 * - Position fields (circleLayout) → Field<vec2> in world space [0,1]
 * - Size/rotation/scale2 → Field<float> or uniform scalars
 *
 * FUTURE STATE (no changes needed to Materializer):
 * - RenderAssembler will consume these fields and produce DrawPathInstancesOp
 * - PathGeometry.points ← materialize(controlPointsFieldId) [local space]
 * - InstanceTransforms.position ← materialize(positionFieldId) [world space]
 * - InstanceTransforms.size ← materialize(sizeFieldId) or uniform
 * - InstanceTransforms.rotation ← materialize(rotationFieldId) [optional]
 * - InstanceTransforms.scale2 ← materialize(scale2FieldId) [optional]
 *
 * KEY INVARIANTS TO PRESERVE:
 * 1. Control point fields MUST be in LOCAL SPACE (centered at origin)
 *    - polygonVertex already does this correctly
 *    - Future geometry kernels should follow same pattern
 *
 * 2. Position fields MUST be in WORLD SPACE normalized [0,1]
 *    - circleLayout already does this correctly
 *    - Renderer will multiply by viewport dimensions
 *
 * 3. Size is ISOTROPIC SCALE in world units
 *    - scale2 is ANISOTROPIC multiplier on top of size
 *    - Effective scale: S_eff = size * (scale2 ?? vec2(1,1))
 *
 * 4. No viewport scaling in Materializer
 *    - Width/height multiplication is renderer concern
 *    - Keep all field kernels dimension-agnostic
 *
 * This architecture ensures:
 * - Geometry is reusable across layouts (local-space independence)
 * - Instance transforms are composable (position/size/rotation/scale2)
 * - Renderer is simple (apply transforms, draw local geometry)
 * - Backend-independent (same buffers work for Canvas, WebGL, SVG)
 *
 * ══════════════════════════════════════════════════════════════════════
 */

import type {
  FieldExprId,
  SigExprId,
} from '../types';
import type { CanonicalType } from '../core/canonical-types';
import type {
  FieldExpr,
  InstanceDecl,
  OpCode,
  PureFn,
  SigExpr,
  IntrinsicPropertyName,
  PlacementFieldName,
} from '../compiler/ir/types';
import type { BufferPool, BufferFormat } from './BufferPool';
import { getBufferFormat } from './BufferPool';
import type { RuntimeState } from './RuntimeState';
import { evaluateSignal } from './SignalEvaluator';
import { applyOpcode } from './OpcodeInterpreter';
import { ensurePlacementBasis } from './PlacementBasis';
import { applyFieldKernel, applyFieldKernelZipSig } from './FieldKernels';

/**
 * Materialize a field expression into a typed array
 *
 * @param fieldId - Field expression ID
 * @param instanceId - Instance to materialize over (string)
 * @param fields - Dense array of field expressions
 * @param signals - Dense array of signal expressions (for lazy evaluation)
 * @param instances - Instance declaration map
 * @param state - Runtime state (for signal values)
 * @param pool - Buffer pool for allocation
 * @returns Typed array with materialized field data
 */
export function materialize(
  fieldId: FieldExprId,
  instanceId: string,
  fields: readonly FieldExpr[],
  signals: readonly SigExpr[],
  instances: ReadonlyMap<string, InstanceDecl>,
  state: RuntimeState,
  pool: BufferPool
): ArrayBufferView {
  // Check cache - use nested Map structure (C-15 fix)
  const fieldIdNum = fieldId as number;
  const instanceIdNum = instanceId as any as number;

  const innerCache = state.cache.fieldBuffers.get(fieldIdNum);
  const cached = innerCache?.get(instanceIdNum);

  const innerStamps = state.cache.fieldStamps.get(fieldIdNum);
  const cachedStamp = innerStamps?.get(instanceIdNum);

  if (cached && cachedStamp === state.cache.frameId) {
    return cached;
  }

  // Get field expression from dense array
  const expr = fields[fieldId as number];
  if (!expr) {
    throw new Error(`Field expression ${fieldId} not found`);
  }

  // Get instance
  const instance = instances.get(instanceId);
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  // Resolve count
  if (typeof instance.count !== 'number') {
    throw new Error(`instance.count ${instanceId} is not a number: ${instance.count}`);
  }
  const count = instance.count;

  // Allocate buffer
  const format = getBufferFormat(expr.type.payload);
  const buffer = pool.alloc(format, count);

  // Fill buffer based on expression kind
  fillBuffer(expr, buffer, instance, fields, signals, instances, state, pool);

  // Cache result (with size limit to prevent unbounded growth)
  const MAX_CACHED_FIELDS = 200;
  const totalCached = Array.from(state.cache.fieldBuffers.values())
    .reduce((sum, inner) => sum + inner.size, 0);

  if (totalCached >= MAX_CACHED_FIELDS) {
    // Evict oldest entries (those with lowest stamps)
    const entries: Array<[number, number, number]> = [];
    for (const [fId, innerStamps] of state.cache.fieldStamps.entries()) {
      for (const [iId, stamp] of innerStamps.entries()) {
        entries.push([fId, iId, stamp]);
      }
    }
    entries.sort((a, b) => a[2] - b[2]);
    const toEvict = entries.slice(0, Math.floor(MAX_CACHED_FIELDS / 4));
    for (const [fId, iId] of toEvict) {
      state.cache.fieldBuffers.get(fId)?.delete(iId);
      state.cache.fieldStamps.get(fId)?.delete(iId);
    }
  }

  // Ensure inner maps exist
  if (!state.cache.fieldBuffers.has(fieldIdNum)) {
    state.cache.fieldBuffers.set(fieldIdNum, new Map());
  }
  if (!state.cache.fieldStamps.has(fieldIdNum)) {
    state.cache.fieldStamps.set(fieldIdNum, new Map());
  }

  state.cache.fieldBuffers.get(fieldIdNum)!.set(instanceIdNum, buffer);
  state.cache.fieldStamps.get(fieldIdNum)!.set(instanceIdNum, state.cache.frameId);

  return buffer;
}

/**
 * Fill a buffer based on field expression kind
 */
function fillBuffer(
  expr: FieldExpr,
  buffer: ArrayBufferView,
  instance: InstanceDecl,
  fields: readonly FieldExpr[],
  signals: readonly SigExpr[],
  instances: ReadonlyMap<string, InstanceDecl>,
  state: RuntimeState,
  pool: BufferPool
): void {
  if (typeof instance.count !== 'number') {
    throw new Error(`instance.count ${instance.id} is not a number: ${instance.count}`);
  }
  const count = instance.count;
  const N = count;

  switch (expr.kind) {
    case 'const': {
      // Fill with constant value
      const arr = buffer as Float32Array | Uint8ClampedArray;
      if (typeof expr.value !== 'number') {
        throw new Error(`instance.count ${expr.kind} ${expr.type} is not a number: ${expr.value}`);
      }
      const value = expr.value;

      if (expr.type.payload .kind === 'color') {
        // Color: broadcast to RGBA
        const rgba = buffer as Uint8ClampedArray;
        for (let i = 0; i < N; i++) {
          rgba[i * 4 + 0] = 255; // R
          rgba[i * 4 + 1] = 255; // G
          rgba[i * 4 + 2] = 255; // B
          rgba[i * 4 + 3] = 255; // A
        }
      } else if (expr.type.payload .kind === 'vec2') {
        // Vec2: broadcast to (value, value)
        const vec = buffer as Float32Array;
        for (let i = 0; i < N; i++) {
          vec[i * 2 + 0] = value;
          vec[i * 2 + 1] = value;
        }
      } else {
        // Scalar: broadcast single value
        for (let i = 0; i < N; i++) {
          arr[i] = value;
        }
      }
      break;
    }

    case 'intrinsic': {
      // Fill from intrinsic property (new system - properly typed)
      fillBufferIntrinsic(expr.intrinsic, buffer, instance);
      break;
    }

    case 'broadcast': {
      // Broadcast signal value to all elements
      const sigValue = evaluateSignal(expr.signal, signals, state);
      const arr = buffer as Float32Array;
      for (let i = 0; i < N; i++) {
        arr[i] = sigValue;
      }
      break;
    }

    case 'map': {
      // Map: get input, apply function
      const input = materialize(
        expr.input,
        instance.id,
        fields,
        signals,
        instances,
        state,
        pool
      );
      applyMap(buffer, input, expr.fn, N, expr.type);
      break;
    }

    case 'zip': {
      // Zip: get inputs, apply function
      const inputs = expr.inputs.map((id) =>
        materialize(id, instance.id, fields, signals, instances, state, pool)
      );
      applyZip(buffer, inputs, expr.fn, N, expr.type);
      break;
    }

    case 'zipSig': {
      // ZipSig: combine field with signals
      const fieldInput = materialize(
        expr.field,
        instance.id,
        fields,
        signals,
        instances,
        state,
        pool
      );
      const sigValues = expr.signals.map((id) => evaluateSignal(id, signals, state));
      applyZipSig(buffer, fieldInput, sigValues, expr.fn, N, expr.type);
      break;
    }

    case 'stateRead': {
      // Per-lane state read for stateful cardinality-generic blocks
      // Each lane reads its corresponding state slot value
      const arr = buffer as Float32Array;
      const baseSlot = expr.stateSlot as number;
      for (let i = 0; i < N; i++) {
        arr[i] = state.state[baseSlot + i] ?? 0;
      }
      break;
    }

    case 'pathDerivative': {
      // Path derivative: compute tangent or arc length from control points
      const inputBuffer = materialize(
        expr.input,
        instance.id,
        fields,
        signals,
        instances,
        state,
        pool
      );
      
      if (expr.operation === 'tangent') {
        fillBufferTangent(buffer as Float32Array, inputBuffer as Float32Array, N);
      } else if (expr.operation === 'arcLength') {
        fillBufferArcLength(buffer as Float32Array, inputBuffer as Float32Array, N);
      }
      break;
    }

    case 'placement': {
      const placementExpr = expr as import('../compiler/ir/types').FieldExprPlacement;

      // Get or create placement basis for this instance
      const basis = ensurePlacementBasis(
        state.continuity.placementBasis,
        placementExpr.instanceId,
        N,
        placementExpr.basisKind
      );

      const outArr = buffer as Float32Array;
      switch (placementExpr.field) {
        case 'uv':
          // Copy N elements (stride 2)
          outArr.set(basis.uv.subarray(0, N * 2));
          break;
        case 'rank':
          outArr.set(basis.rank.subarray(0, N));
          break;
        case 'seed':
          outArr.set(basis.seed.subarray(0, N));
          break;
        default: {
          const _: never = placementExpr.field;
          throw new Error(`Unknown placement field: ${_}`);
        }
      }
      break;
    }

    default: {
      const _exhaustive: never = expr;
      throw new Error(`Unknown field expr kind: ${(_exhaustive as FieldExpr).kind}`);
    }
  }
}

/**
 * Fill buffer from intrinsic property (new system with exhaustive checks).
 * Intrinsics are per-element properties automatically available for any instance.
 */
function fillBufferIntrinsic(
  intrinsic: IntrinsicPropertyName,
  buffer: ArrayBufferView,
  instance: InstanceDecl
): void {
  const count = typeof instance.count === 'number' ? instance.count : 0;
  const N = count;

  switch (intrinsic) {
    case 'index': {
      // Element index (0, 1, 2, ..., N-1)
      const arr = buffer as Float32Array;
      for (let i = 0; i < N; i++) {
        arr[i] = i;
      }
      break;
    }

    case 'normalizedIndex': {
      // Normalized index (0.0 to 1.0)
      // C-7 FIX: Single element should be centered at 0.5, not 0
      const arr = buffer as Float32Array;
      for (let i = 0; i < N; i++) {
        arr[i] = N > 1 ? i / (N - 1) : 0.5;
      }
      break;
    }

    case 'randomId': {
      // Deterministic per-element random (0.0 to 1.0)
      const arr = buffer as Float32Array;
      for (let i = 0; i < N; i++) {
        arr[i] = pseudoRandom(i);
      }
      break;
    }

    default: {
      // TypeScript exhaustiveness check: if all cases are handled, this never executes
      const _exhaustive: never = intrinsic;
      throw new Error(`Unknown intrinsic: ${_exhaustive}`);
    }
  }
}

/**
 * Pseudo-random generator for deterministic per-element randomness.
 * Uses sine-based hash for smooth, deterministic results.
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Apply map function to buffer
 *
 * LAYER CONTRACT: Map only supports opcodes for scalar math.
 * Kernels are not allowed in map context - use zip or zipSig for field kernels.
 */
function applyMap(
  out: ArrayBufferView,
  input: ArrayBufferView,
  fn: PureFn,
  N: number,
  type: CanonicalType
): void {
  if (type.payload.kind !== 'float') {
    throw new Error(
      `Map with opcode only supports scalar float fields, got payload=${type.payload.kind}`
    );
  }
  const outArr = out as Float32Array;
  const inArr = input as Float32Array;

  if (fn.kind === 'opcode') {
    const op = fn.opcode;
    for (let i = 0; i < N; i++) {
      outArr[i] = applyOpcode(op, [inArr[i]]);
    }
  } else if (fn.kind === 'kernel') {
    // Map is not the place for kernels - they belong in zip/zipSig
    throw new Error(
      `Map only supports opcodes, not kernels. ` +
      `Kernel '${fn.name}' should use zip or zipSig instead.`
    );
  } else {
    throw new Error(`Map function kind ${fn.kind} not implemented`);
  }
}

/**
 * Apply zip function to buffers
 */
function applyZip(
  out: ArrayBufferView,
  inputs: ArrayBufferView[],
  fn: PureFn,
  N: number,
  type: CanonicalType
): void {
  if (fn.kind === 'opcode') {
    if (type.payload.kind !== 'float') {
      throw new Error(
        `Zip with opcode only supports scalar float fields, got payload=${type.payload.kind}`
      );
    }
    const outArr = out as Float32Array;
    const inArrs = inputs.map((buf) => buf as Float32Array);
    const op = fn.opcode;
    for (let i = 0; i < N; i++) {
      const values = inArrs.map((arr) => arr[i]);
      outArr[i] = applyOpcode(op, values);
    }
  } else if (fn.kind === 'kernel') {
    // Handle kernel functions
    applyFieldKernel(out, inputs, fn.name, N, type);
  } else {
    throw new Error(`Zip function kind ${fn.kind} not implemented`);
  }
}

/**
 * Apply zipSig function
 */
function applyZipSig(
  out: ArrayBufferView,
  fieldInput: ArrayBufferView,
  sigValues: number[],
  fn: PureFn,
  N: number,
  type: CanonicalType
): void {
  const outArr = out as Float32Array;
  const inArr = fieldInput as Float32Array;

  if (fn.kind === 'opcode') {
    if (type.payload.kind !== 'float') {
      throw new Error(
        `ZipSig with opcode only supports scalar float fields, got payload=${type.payload.kind}`
      );
    }
    const op = fn.opcode;
    for (let i = 0; i < N; i++) {
      const values = [inArr[i], ...sigValues];
      outArr[i] = applyOpcode(op, values);
    }
  } else if (fn.kind === 'kernel') {
    applyFieldKernelZipSig(out, fieldInput, sigValues, fn.name, N, type);
  } else {
    throw new Error(`ZipSig function kind ${fn.kind} not implemented`);
  }
}


/**
 * Hash string to float in [0, 1]
 */
function hashToFloat01(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  const t = (h * 12.9898 + 78.233) * 43758.5453;
  return t - Math.floor(t);
}
// ==============================================================================
// Path Derivative Helpers (Task 4h6 - MVP: Polygonal paths only)
// ==============================================================================

/**
 * Fill buffer with tangent vectors using central difference.
 * 
 * MVP Scope: Polygonal paths (linear approximation).
 * For a closed path with N control points:
 *   tangent[i] = (point[i+1] - point[i-1]) / 2
 * 
 * Edge cases:
 * - Single point (N=1): tangent = (0, 0)
 * - Two points (N=2): tangent computed with wrapping
 * - Assumes closed path (wraps at boundaries)
 * 
 * @param out - Output buffer for tangent vectors (vec3, length N*3)
 * @param input - Input buffer for control points (vec2, length N*2)
 * @param N - Number of points (not components)
 */
function fillBufferTangent(
  out: Float32Array,
  input: Float32Array,
  N: number
): void {
  if (N === 0) return;

  if (N === 1) {
    // Single point: no tangent
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return;
  }

  // Central difference for each point
  // For closed path: [P0, P1, ..., PN-1] where PN wraps to P0
  for (let i = 0; i < N; i++) {
    const prevIdx = (i - 1 + N) % N;  // Wrap around for closed path
    const nextIdx = (i + 1) % N;

    const prevX = input[prevIdx * 2];
    const prevY = input[prevIdx * 2 + 1];
    const nextX = input[nextIdx * 2];
    const nextY = input[nextIdx * 2 + 1];

    // Central difference: (next - prev) / 2, z=0
    out[i * 3] = (nextX - prevX) / 2;
    out[i * 3 + 1] = (nextY - prevY) / 2;
    out[i * 3 + 2] = 0;
  }
}

/**
 * Fill buffer with cumulative arc length.
 * 
 * MVP Scope: Polygonal paths (Euclidean distance between consecutive points).
 * For N control points:
 *   arcLength[0] = 0
 *   arcLength[i] = arcLength[i-1] + ||point[i] - point[i-1]||
 * 
 * Edge cases:
 * - Single point (N=1): arcLength = [0]
 * - Returns monotonically increasing values
 * 
 * @param out - Output buffer for arc lengths (float, length N)
 * @param input - Input buffer for control points (vec2, length N*2)
 * @param N - Number of points
 */
function fillBufferArcLength(
  out: Float32Array,
  input: Float32Array,
  N: number
): void {
  if (N === 0) return;
  
  out[0] = 0;
  
  if (N === 1) return;
  
  let totalDistance = 0;
  
  // Sum segment distances from point 0 to point i
  for (let i = 1; i < N; i++) {
    const prevX = input[(i - 1) * 2];
    const prevY = input[(i - 1) * 2 + 1];
    const currX = input[i * 2];
    const currY = input[i * 2 + 1];
    
    const dx = currX - prevX;
    const dy = currY - prevY;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    totalDistance += segmentLength;
    
    out[i] = totalDistance;
  }
}

