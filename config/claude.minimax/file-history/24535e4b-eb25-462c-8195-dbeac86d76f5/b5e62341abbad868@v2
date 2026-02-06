/**
 * RenderAssembler Per-Instance Shapes Tests
 *
 * Tests for per-instance shape support (Field<shape>) in v2 render assembly.
 * Covers topology grouping, buffer slicing, and multi-op emission.
 */
import { describe, it, expect } from 'vitest';
import {
  assembleDrawPathInstancesOp,
  assembleRenderFrame,
  type AssemblerContext,
} from '../RenderAssembler';
import type { StepRender, InstanceDecl, SigExpr } from '../../compiler/ir/types';
import { instanceId, domainTypeId } from '../../compiler/ir/Indices';
import type { CanonicalType } from '../../core/canonical-types';
import { FLOAT, INT, BOOL, VEC2, VEC3, COLOR, SHAPE, CAMERA_PROJECTION, canonicalType } from '../../core/canonical-types';
import type { RuntimeState } from '../RuntimeState';
import { createRuntimeState, SHAPE2D_WORDS, writeShape2D } from '../RuntimeState';
import type { ValueSlot, SigExprId } from '../../types';
import { registerDynamicTopology } from '../../shapes/registry';
import type { RenderSpace2D } from '../../shapes/types';
import { PathVerb } from '../../shapes/types';
import { DEFAULT_CAMERA } from '../CameraResolver';
import { getTestArena } from './test-arena-helper';

// Helper to create a valid palette Float32Array
function createPalette(r = 1, g = 1, b = 1, a = 1): Float32Array {
  return new Float32Array([r, g, b, a]);
}

// Helper to create a scalar signal type
const SCALAR_TYPE: CanonicalType = canonicalType(FLOAT);

// Create a minimal runtime state for testing
function createMockState(): RuntimeState {
  const state = createRuntimeState(100);
  state.time = {
    tAbsMs: 0,
    tMs: 0,
    dt: 0,
    phaseA: 0,
    phaseB: 0,
    pulse: 0,
    palette: createPalette(),
    energy: 0.5,
  };
  return state;
}

// Create a minimal instance declaration
function createMockInstance(count: number): InstanceDecl {
  return {
    count,
    identityMode: 'none',
  } as InstanceDecl;
}

// Register test path topologies (without id — assigned by registry)
const CIRCLE_ID = registerDynamicTopology({
  params: [
    { name: 'radius', type: 'float', default: 0.02 },
    { name: 'closed', type: 'float', default: 1 },
  ],
  render: (ctx: CanvasRenderingContext2D, p: Record<string, number>, space: RenderSpace2D) => {
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
  },
  verbs: [PathVerb.MOVE, PathVerb.LINE, PathVerb.LINE, PathVerb.LINE, PathVerb.CLOSE],
  pointsPerVerb: [1, 1, 1, 1, 0],
  totalControlPoints: 4,
  closed: true,
}, 'test-circle');

const SQUARE_ID = registerDynamicTopology({
  params: [
    { name: 'size', type: 'float', default: 0.04 },
    { name: 'closed', type: 'float', default: 1 },
  ],
  render: (ctx: CanvasRenderingContext2D, p: Record<string, number>, space: RenderSpace2D) => {
    const s = p.size / 2;
    ctx.beginPath();
    ctx.moveTo(-s, -s);
    ctx.lineTo(s, -s);
    ctx.lineTo(s, s);
    ctx.lineTo(-s, s);
    ctx.closePath();
    ctx.fill();
  },
  verbs: [PathVerb.MOVE, PathVerb.LINE, PathVerb.LINE, PathVerb.LINE, PathVerb.CLOSE],
  pointsPerVerb: [1, 1, 1, 1, 0],
  totalControlPoints: 4,
  closed: true,
}, 'test-square');

const TRIANGLE_ID = registerDynamicTopology({
  params: [
    { name: 'size', type: 'float', default: 0.03 },
    { name: 'closed', type: 'float', default: 1 },
  ],
  render: (ctx: CanvasRenderingContext2D, p: Record<string, number>, space: RenderSpace2D) => {
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0.87, 0.5);
    ctx.lineTo(-0.87, 0.5);
    ctx.closePath();
    ctx.fill();
  },
  verbs: [PathVerb.MOVE, PathVerb.LINE, PathVerb.LINE, PathVerb.CLOSE],
  pointsPerVerb: [1, 1, 1, 0],
  totalControlPoints: 3,
  closed: true,
}, 'test-triangle');

describe('RenderAssembler - Per-Instance Shapes', () => {
  describe('Shape Buffer Validation', () => {
    it('throws when shape buffer has wrong length', () => {
      const state = createMockState();
      // Position buffer must be stride-3 (vec3 world-space positions)
      const positionBuffer = new Float32Array(30); // 10 instances * 3 components
      const colorBuffer = new Uint8ClampedArray(40); // 10 instances
      const shapeBuffer = new Uint32Array(40); // Only 5 instances worth! (40 / 8 = 5)

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot }, // Per-instance shapes
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(10)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      expect(() => assembleDrawPathInstancesOp(step, context)).toThrow(
        /Shape buffer length mismatch/
      );
    });
  });

  describe('Topology Grouping', () => {
    it('groups instances with same topology together', () => {
      const state = createMockState();

      // 5 instances: 3 circles, 2 circles (all same topology)
      const instanceCount = 5;
      // Position buffer must be stride-3 (vec3 world-space positions)
      const positionBuffer = new Float32Array(instanceCount * 3);
      const colorBuffer = new Uint8ClampedArray(instanceCount * 4);
      const shapeBuffer = new Uint32Array(instanceCount * SHAPE2D_WORDS);
      const controlPointsBuffer = new Float32Array([
        0, 1, 1, 0, 0, -1, -1, 0, // 4 points for circle
      ]);

      // Fill buffers with test data
      for (let i = 0; i < instanceCount; i++) {
        positionBuffer[i * 3] = 0.1 + i * 0.1;
        positionBuffer[i * 3 + 1] = 0.5;
        positionBuffer[i * 3 + 2] = 0.0; // z component
        colorBuffer[i * 4] = 255;
        colorBuffer[i * 4 + 1] = 0;
        colorBuffer[i * 4 + 2] = 0;
        colorBuffer[i * 4 + 3] = 255;

        // All instances use circle topology with same control points
        writeShape2D(shapeBuffer, i, {
          topologyId: CIRCLE_ID,
          pointsFieldSlot: 4, // All use slot 4
          pointsCount: 4,
          styleRef: 0,
          flags: 1, // closed
        });
      }

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);
      state.values.objects.set(4 as ValueSlot, controlPointsBuffer);

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot },
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(instanceCount)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      const result = assembleDrawPathInstancesOp(step, context);

      // All instances have same topology → 1 group → 1 op
      expect(result).toHaveLength(1);
      expect(result[0].instances.count).toBe(5);
      expect(result[0].geometry.topologyId).toBe(CIRCLE_ID);
    });

    it('groups instances by topology and produces multiple ops', () => {
      const state = createMockState();

      // 10 instances: 5 circles, 3 squares, 2 triangles
      const instanceCount = 10;
      // Position buffer must be stride-3 (vec3 world-space positions)
      const positionBuffer = new Float32Array(instanceCount * 3);
      const colorBuffer = new Uint8ClampedArray(instanceCount * 4);
      const shapeBuffer = new Uint32Array(instanceCount * SHAPE2D_WORDS);

      // Control points for each topology
      const circlePoints = new Float32Array([0, 1, 1, 0, 0, -1, -1, 0]); // 4 points
      const squarePoints = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]); // 4 points
      const trianglePoints = new Float32Array([0, -1, 0.87, 0.5, -0.87, 0.5]); // 3 points

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);
      state.values.objects.set(4 as ValueSlot, circlePoints);
      state.values.objects.set(5 as ValueSlot, squarePoints);
      state.values.objects.set(6 as ValueSlot, trianglePoints);

      // Fill buffers: 5 circles, 3 squares, 2 triangles
      const topologies = [
        CIRCLE_ID, CIRCLE_ID, CIRCLE_ID, CIRCLE_ID, CIRCLE_ID, // 5 circles (slot 4)
        SQUARE_ID, SQUARE_ID, SQUARE_ID,                       // 3 squares (slot 5)
        TRIANGLE_ID, TRIANGLE_ID,                              // 2 triangles (slot 6)
      ];
      const slots = [4, 4, 4, 4, 4, 5, 5, 5, 6, 6];
      const pointCounts = [4, 4, 4, 4, 4, 4, 4, 4, 3, 3];

      for (let i = 0; i < instanceCount; i++) {
        positionBuffer[i * 3] = 0.1 + i * 0.05;
        positionBuffer[i * 3 + 1] = 0.5;
        positionBuffer[i * 3 + 2] = 0.0; // z component
        colorBuffer[i * 4] = i < 5 ? 255 : (i < 8 ? 0 : 128);
        colorBuffer[i * 4 + 1] = i < 5 ? 0 : (i < 8 ? 255 : 0);
        colorBuffer[i * 4 + 2] = i < 5 ? 0 : (i < 8 ? 0 : 255);
        colorBuffer[i * 4 + 3] = 255;

        writeShape2D(shapeBuffer, i, {
          topologyId: topologies[i],
          pointsFieldSlot: slots[i],
          pointsCount: pointCounts[i],
          styleRef: 0,
          flags: 1,
        });
      }

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 2.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot },
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(instanceCount)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      const result = assembleDrawPathInstancesOp(step, context);

      // 3 different topologies → 3 groups → 3 ops
      expect(result).toHaveLength(3);

      // Ops are ordered by first occurrence in buffer (circle, square, triangle)
      const circleOp = result.find(op => op.geometry.topologyId === CIRCLE_ID);
      const squareOp = result.find(op => op.geometry.topologyId === SQUARE_ID);
      const triangleOp = result.find(op => op.geometry.topologyId === TRIANGLE_ID);

      expect(circleOp).toBeDefined();
      expect(squareOp).toBeDefined();
      expect(triangleOp).toBeDefined();

      expect(circleOp!.instances.count).toBe(5);
      expect(squareOp!.instances.count).toBe(3);
      expect(triangleOp!.instances.count).toBe(2);
    });

    it('handles interleaved topologies correctly', () => {
      const state = createMockState();

      // 6 instances interleaved: circle, square, circle, square, circle, square
      const instanceCount = 6;
      // Position buffer must be stride-3 (vec3 world-space positions)
      const positionBuffer = new Float32Array(instanceCount * 3);
      const colorBuffer = new Uint8ClampedArray(instanceCount * 4);
      const shapeBuffer = new Uint32Array(instanceCount * SHAPE2D_WORDS);

      const circlePoints = new Float32Array([0, 1, 1, 0, 0, -1, -1, 0]);
      const squarePoints = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);
      state.values.objects.set(4 as ValueSlot, circlePoints);
      state.values.objects.set(5 as ValueSlot, squarePoints);

      // Interleave: C S C S C S
      const topologies = [CIRCLE_ID, SQUARE_ID, CIRCLE_ID, SQUARE_ID, CIRCLE_ID, SQUARE_ID];
      const slots = [4, 5, 4, 5, 4, 5];

      for (let i = 0; i < instanceCount; i++) {
        positionBuffer[i * 3] = i * 0.1;
        positionBuffer[i * 3 + 1] = 0.5;
        positionBuffer[i * 3 + 2] = 0.0; // z component
        colorBuffer[i * 4] = 255;
        colorBuffer[i * 4 + 1] = 0;
        colorBuffer[i * 4 + 2] = 0;
        colorBuffer[i * 4 + 3] = 255;

        writeShape2D(shapeBuffer, i, {
          topologyId: topologies[i],
          pointsFieldSlot: slots[i],
          pointsCount: 4,
          styleRef: 0,
          flags: 1,
        });
      }

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot },
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(instanceCount)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      const result = assembleDrawPathInstancesOp(step, context);

      // 2 topologies → 2 ops (circles grouped together, squares grouped together)
      expect(result).toHaveLength(2);

      const circleOp = result.find(op => op.geometry.topologyId === CIRCLE_ID);
      const squareOp = result.find(op => op.geometry.topologyId === SQUARE_ID);

      expect(circleOp!.instances.count).toBe(3);
      expect(squareOp!.instances.count).toBe(3);
    });
  });

  describe('Buffer Slicing', () => {
    it('slices position and color buffers correctly', () => {
      const state = createMockState();

      // 4 instances: 2 circles at indices 0,3; 2 squares at indices 1,2
      const instanceCount = 4;
      const positionBuffer = new Float32Array([
        0.1, 0.1, 0, // instance 0 (circle) - vec3
        0.2, 0.2, 0, // instance 1 (square) - vec3
        0.3, 0.3, 0, // instance 2 (square) - vec3
        0.4, 0.4, 0, // instance 3 (circle) - vec3
      ]);
      const colorBuffer = new Uint8ClampedArray([
        255, 0, 0, 255,   // instance 0 (red, circle)
        0, 255, 0, 255,   // instance 1 (green, square)
        0, 0, 255, 255,   // instance 2 (blue, square)
        255, 255, 0, 255, // instance 3 (yellow, circle)
      ]);
      const shapeBuffer = new Uint32Array(instanceCount * SHAPE2D_WORDS);

      const circlePoints = new Float32Array([0, 1, 1, 0, 0, -1, -1, 0]);
      const squarePoints = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);
      state.values.objects.set(4 as ValueSlot, circlePoints);
      state.values.objects.set(5 as ValueSlot, squarePoints);

      // Setup: circle, square, square, circle
      writeShape2D(shapeBuffer, 0, { topologyId: CIRCLE_ID, pointsFieldSlot: 4, pointsCount: 4, styleRef: 0, flags: 1 });
      writeShape2D(shapeBuffer, 1, { topologyId: SQUARE_ID, pointsFieldSlot: 5, pointsCount: 4, styleRef: 0, flags: 1 });
      writeShape2D(shapeBuffer, 2, { topologyId: SQUARE_ID, pointsFieldSlot: 5, pointsCount: 4, styleRef: 0, flags: 1 });
      writeShape2D(shapeBuffer, 3, { topologyId: CIRCLE_ID, pointsFieldSlot: 4, pointsCount: 4, styleRef: 0, flags: 1 });

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot },
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(instanceCount)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      const result = assembleDrawPathInstancesOp(step, context);

      expect(result).toHaveLength(2);

      const circleOp = result.find(op => op.geometry.topologyId === CIRCLE_ID)!;
      const squareOp = result.find(op => op.geometry.topologyId === SQUARE_ID)!;

      // Circle op should have instances 0 and 3 (stride-2 after projection)
      expect(circleOp.instances.count).toBe(2);
      expect(circleOp.instances.position).toEqual(new Float32Array([
        0.1, 0.1, // instance 0 (vec2)
        0.4, 0.4, // instance 3 (vec2)
      ]));
      expect(circleOp.style.fillColor).toEqual(new Uint8ClampedArray([
        255, 0, 0, 255,   // red
        255, 255, 0, 255, // yellow
      ]));

      // Square op should have instances 1 and 2 (stride-2 after projection)
      expect(squareOp.instances.count).toBe(2);
      expect(squareOp.instances.position).toEqual(new Float32Array([
        0.2, 0.2, // instance 1 (vec2)
        0.3, 0.3, // instance 2 (vec2)
      ]));
      expect(squareOp.style.fillColor).toEqual(new Uint8ClampedArray([
        0, 255, 0, 255, // green
        0, 0, 255, 255, // blue
      ]));
    });
  });

  describe('Error Handling', () => {
    it('throws when topology not found', () => {
      const state = createMockState();

      const instanceCount = 2;
      // Position buffer must be stride-3 (vec3 world-space positions)
      const positionBuffer = new Float32Array(instanceCount * 3);
      const colorBuffer = new Uint8ClampedArray(instanceCount * 4);
      const shapeBuffer = new Uint32Array(instanceCount * SHAPE2D_WORDS);
      const controlPointsBuffer = new Float32Array(8);

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);
      state.values.objects.set(4 as ValueSlot, controlPointsBuffer);

      // Use non-existent topology ID
      for (let i = 0; i < instanceCount; i++) {
        writeShape2D(shapeBuffer, i, {
          topologyId: 999, // Non-existent topology
          pointsFieldSlot: 4,
          pointsCount: 4,
          styleRef: 0,
          flags: 1,
        });
      }

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot },
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(instanceCount)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      expect(() => assembleDrawPathInstancesOp(step, context)).toThrow(
        /Unknown topology ID: 999/
      );
    });

    it('throws when control points buffer not found', () => {
      const state = createMockState();

      const instanceCount = 2;
      // Position buffer must be stride-3 (vec3 world-space positions)
      const positionBuffer = new Float32Array(instanceCount * 3);
      const colorBuffer = new Uint8ClampedArray(instanceCount * 4);
      const shapeBuffer = new Uint32Array(instanceCount * SHAPE2D_WORDS);

      state.values.objects.set(1 as ValueSlot, positionBuffer);
      state.values.objects.set(2 as ValueSlot, colorBuffer);
      state.values.objects.set(3 as ValueSlot, shapeBuffer);
      // No control points buffer at slot 4!

      for (let i = 0; i < instanceCount; i++) {
        writeShape2D(shapeBuffer, i, {
          topologyId: CIRCLE_ID,
          pointsFieldSlot: 4, // References missing slot
          pointsCount: 4,
          styleRef: 0,
          flags: 1,
        });
      }

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const step: StepRender = {
        kind: 'render',
        instanceId: instanceId('test-instance'),
        positionSlot: 1 as ValueSlot,
        colorSlot: 2 as ValueSlot,
        scale: { k: 'sig', id: 0 as SigExprId },
        shape: { k: 'slot', slot: 3 as ValueSlot },
      };

      const context: AssemblerContext = {
        signals,
        instances: new Map([['test-instance', createMockInstance(instanceCount)]]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      expect(() => assembleDrawPathInstancesOp(step, context)).toThrow(
        /Control points buffer not found/
      );
    });
  });

  describe('Integration with assembleRenderFrame', () => {
    it('flattens multiple ops from per-instance shapes', () => {
      const state = createMockState();

      // Step 1: 3 circles (stride-3 positions)
      const pos1 = new Float32Array(9); // 3 * 3 components
      const color1 = new Uint8ClampedArray(12);
      const shape1 = new Uint32Array(3 * SHAPE2D_WORDS);
      const circlePoints = new Float32Array([0, 1, 1, 0, 0, -1, -1, 0]);

      for (let i = 0; i < 3; i++) {
        writeShape2D(shape1, i, { topologyId: CIRCLE_ID, pointsFieldSlot: 10, pointsCount: 4, styleRef: 0, flags: 1 });
        pos1[i * 3] = i * 0.1;
        pos1[i * 3 + 1] = 0.5;
        pos1[i * 3 + 2] = 0.0;
      }

      // Step 2: mixed 2 circles + 2 squares (stride-3 positions)
      const pos2 = new Float32Array(12); // 4 * 3 components
      const color2 = new Uint8ClampedArray(16);
      const shape2 = new Uint32Array(4 * SHAPE2D_WORDS);
      const squarePoints = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);

      writeShape2D(shape2, 0, { topologyId: CIRCLE_ID, pointsFieldSlot: 10, pointsCount: 4, styleRef: 0, flags: 1 });
      writeShape2D(shape2, 1, { topologyId: CIRCLE_ID, pointsFieldSlot: 10, pointsCount: 4, styleRef: 0, flags: 1 });
      writeShape2D(shape2, 2, { topologyId: SQUARE_ID, pointsFieldSlot: 11, pointsCount: 4, styleRef: 0, flags: 1 });
      writeShape2D(shape2, 3, { topologyId: SQUARE_ID, pointsFieldSlot: 11, pointsCount: 4, styleRef: 0, flags: 1 });

      for (let i = 0; i < 4; i++) {
        pos2[i * 3] = i * 0.1;
        pos2[i * 3 + 1] = 0.3;
        pos2[i * 3 + 2] = 0.0;
      }

      state.values.objects.set(1 as ValueSlot, pos1);
      state.values.objects.set(2 as ValueSlot, color1);
      state.values.objects.set(3 as ValueSlot, shape1);
      state.values.objects.set(4 as ValueSlot, pos2);
      state.values.objects.set(5 as ValueSlot, color2);
      state.values.objects.set(6 as ValueSlot, shape2);
      state.values.objects.set(10 as ValueSlot, circlePoints);
      state.values.objects.set(11 as ValueSlot, squarePoints);

      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 1.0 }, type: SCALAR_TYPE },
      ];

      const steps: StepRender[] = [
        {
          kind: 'render',
          instanceId: instanceId('instance-a'),
          positionSlot: 1 as ValueSlot,
          colorSlot: 2 as ValueSlot,
          scale: { k: 'sig', id: 0 as SigExprId },
          shape: { k: 'slot', slot: 3 as ValueSlot },
        },
        {
          kind: 'render',
          instanceId: instanceId('instance-b'),
          positionSlot: 4 as ValueSlot,
          colorSlot: 5 as ValueSlot,
          scale: { k: 'sig', id: 0 as SigExprId },
          shape: { k: 'slot', slot: 6 as ValueSlot },
        },
      ];

      const context: AssemblerContext = {
        signals,
        instances: new Map([
          ['instance-a', createMockInstance(3)],
          ['instance-b', createMockInstance(4)],
        ]),
        state,
    resolvedCamera: DEFAULT_CAMERA,
        arena: getTestArena(),
      };

      const result = assembleRenderFrame(steps, context);

      // Step 1: 1 op (all circles)
      // Step 2: 2 ops (circles + squares)
      // Total: 3 ops
      expect(result.version).toBe(2);
      expect(result.ops).toHaveLength(3);

      const circleOps = result.ops.filter(op => op.geometry.topologyId === CIRCLE_ID);
      const squareOps = result.ops.filter(op => op.geometry.topologyId === SQUARE_ID);

      expect(circleOps).toHaveLength(2); // One from step 1, one from step 2
      expect(squareOps).toHaveLength(1); // One from step 2

      // Verify instance counts
      expect(circleOps[0].instances.count).toBe(3); // Step 1
      expect(circleOps[1].instances.count).toBe(2); // Step 2
      expect(squareOps[0].instances.count).toBe(2); // Step 2
    });
  });
});
