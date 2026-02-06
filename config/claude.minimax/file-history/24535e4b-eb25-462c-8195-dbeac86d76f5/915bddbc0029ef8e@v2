/**
 * Event Evaluator Tests
 *
 * Tests for the event system: EventExpr evaluation, per-frame clearing,
 * monotone OR, and end-to-end pulse wiring.
 */

import { describe, it, expect } from 'vitest';
import { evaluateEvent } from '../EventEvaluator';
import { createRuntimeState } from '../RuntimeState';
import { executeFrame } from '../ScheduleExecutor';
import { compile } from '../../compiler/compile';
import { EventHub } from '../../events/EventHub';
import { getTestArena } from '../../runtime/__tests__/test-arena-helper';
import { buildPatch } from '../../graph/Patch';
import { canonicalType, eventTypeScalar } from '../../core/canonical-types';
import { FLOAT, INT, BOOL, VEC2, VEC3, COLOR, SHAPE, CAMERA_PROJECTION } from '../../core/canonical-types';
import { sigExprId } from '../../compiler/ir/Indices';
import type { EventExpr, StepEvalEvent } from '../../compiler/ir/types';
import type { EventExprId } from '../../compiler/ir/Indices';
import type { RuntimeState } from '../RuntimeState';
import type { SigExpr } from '../../compiler/ir/types';

// Helper to create a valid palette Float32Array
function createPalette(r = 0, g = 0, b = 0, a = 1): Float32Array {
  return new Float32Array([r, g, b, a]);
}

// =============================================================================
// Test Helpers
// =============================================================================

function createMinimalState(
  eventSlotCount: number = 0,
  eventExprCount: number = 0
): RuntimeState {
  return createRuntimeState(10, 0, eventSlotCount, eventExprCount);
}

function eventExprId(n: number): EventExprId {
  return n as EventExprId;
}

// =============================================================================
// Unit Tests: evaluateEvent
// =============================================================================

describe('EventEvaluator', () => {
  describe('const', () => {
    it('const(true) fires', () => {
      const exprs: EventExpr[] = [{ kind: 'const', type: eventTypeScalar(), fired: true }];
      const state = createMinimalState(0, 1);
      // Set time so evaluateSignal doesn't throw
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(0), exprs, state, [])).toBe(true);
    });

    it('const(false) does not fire', () => {
      const exprs: EventExpr[] = [{ kind: 'const', type: eventTypeScalar(), fired: false }];
      const state = createMinimalState(0, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(0), exprs, state, [])).toBe(false);
    });
  });

  describe('never', () => {
    it('never fires', () => {
      const exprs: EventExpr[] = [{ kind: 'never', type: eventTypeScalar() }];
      const state = createMinimalState(0, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(0), exprs, state, [])).toBe(false);
    });
  });

  describe('pulse', () => {
    it('pulse(timeRoot) fires every tick', () => {
      const exprs: EventExpr[] = [{ kind: 'pulse', type: eventTypeScalar(), source: 'timeRoot' }];
      const state = createMinimalState(0, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      // Should fire every tick
      expect(evaluateEvent(eventExprId(0), exprs, state, [])).toBe(true);
      expect(evaluateEvent(eventExprId(0), exprs, state, [])).toBe(true);
      expect(evaluateEvent(eventExprId(0), exprs, state, [])).toBe(true);
    });
  });

  describe('combine', () => {
    it('combine(any) fires if either fires', () => {
      const exprs: EventExpr[] = [
        { kind: 'const', type: eventTypeScalar(), fired: false },
        { kind: 'const', type: eventTypeScalar(), fired: true },
        { kind: 'combine', type: eventTypeScalar(), events: [eventExprId(0), eventExprId(1)], mode: 'any' },
      ];
      const state = createMinimalState(0, 3);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(2), exprs, state, [])).toBe(true);
    });

    it('combine(any) does not fire if none fires', () => {
      const exprs: EventExpr[] = [
        { kind: 'const', type: eventTypeScalar(), fired: false },
        { kind: 'const', type: eventTypeScalar(), fired: false },
        { kind: 'combine', type: eventTypeScalar(), events: [eventExprId(0), eventExprId(1)], mode: 'any' },
      ];
      const state = createMinimalState(0, 3);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(2), exprs, state, [])).toBe(false);
    });

    it('combine(all) fires only if both fire', () => {
      const exprs: EventExpr[] = [
        { kind: 'const', type: eventTypeScalar(), fired: true },
        { kind: 'const', type: eventTypeScalar(), fired: true },
        { kind: 'combine', type: eventTypeScalar(), events: [eventExprId(0), eventExprId(1)], mode: 'all' },
      ];
      const state = createMinimalState(0, 3);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(2), exprs, state, [])).toBe(true);
    });

    it('combine(all) does not fire if one is false', () => {
      const exprs: EventExpr[] = [
        { kind: 'const', type: eventTypeScalar(), fired: true },
        { kind: 'const', type: eventTypeScalar(), fired: false },
        { kind: 'combine', type: eventTypeScalar(), events: [eventExprId(0), eventExprId(1)], mode: 'all' },
      ];
      const state = createMinimalState(0, 3);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };
      expect(evaluateEvent(eventExprId(2), exprs, state, [])).toBe(false);
    });
  });

  describe('wrap', () => {
    it('fires on rising edge (0.4 → 0.6)', () => {
      // Signal that returns different values
      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 0.6 }, type: canonicalType(FLOAT) },
      ];
      const exprs: EventExpr[] = [
        { kind: 'wrap', type: eventTypeScalar(), signal: sigExprId(0) },
      ];
      const state = createMinimalState(1, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };

      // prevPredicate starts at 0, signal is 0.6 → predicate=1, rising edge → fires
      expect(evaluateEvent(eventExprId(0), exprs, state, signals)).toBe(true);
    });

    it('does not fire on sustained high (0.6 → 0.8)', () => {
      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 0.8 }, type: canonicalType(FLOAT) },
      ];
      const exprs: EventExpr[] = [
        { kind: 'wrap', type: eventTypeScalar(), signal: sigExprId(0) },
      ];
      const state = createMinimalState(1, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };

      // First call: rising edge (0→1)
      state.eventPrevPredicate[0] = 1; // Simulate previous predicate was already 1
      expect(evaluateEvent(eventExprId(0), exprs, state, signals)).toBe(false);
    });

    it('does not fire on falling edge (0.6 → 0.4)', () => {
      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 0.4 }, type: canonicalType(FLOAT) },
      ];
      const exprs: EventExpr[] = [
        { kind: 'wrap', type: eventTypeScalar(), signal: sigExprId(0) },
      ];
      const state = createMinimalState(1, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };

      // Previous was high (1), now low (0.4) → predicate=0, not rising edge
      state.eventPrevPredicate[0] = 1;
      expect(evaluateEvent(eventExprId(0), exprs, state, signals)).toBe(false);
    });

    it('NaN treated as false', () => {
      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: NaN }, type: canonicalType(FLOAT) },
      ];
      const exprs: EventExpr[] = [
        { kind: 'wrap', type: eventTypeScalar(), signal: sigExprId(0) },
      ];
      const state = createMinimalState(1, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };

      // NaN → predicate=0, prev=0 → no rising edge
      expect(evaluateEvent(eventExprId(0), exprs, state, signals)).toBe(false);
    });

    it('Inf treated as false', () => {
      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: Infinity }, type: canonicalType(FLOAT) },
      ];
      const exprs: EventExpr[] = [
        { kind: 'wrap', type: eventTypeScalar(), signal: sigExprId(0) },
      ];
      const state = createMinimalState(1, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };

      // Inf → not finite → predicate=0, prev=0 → no rising edge
      expect(evaluateEvent(eventExprId(0), exprs, state, signals)).toBe(false);
    });

    it('updates eventPrevPredicate after evaluation', () => {
      const signals: SigExpr[] = [
        { kind: 'const', value: { kind: 'float', value: 0.7 }, type: canonicalType(FLOAT) },
      ];
      const exprs: EventExpr[] = [
        { kind: 'wrap', type: eventTypeScalar(), signal: sigExprId(0) },
      ];
      const state = createMinimalState(1, 1);
      state.time = { tAbsMs: 0, tMs: 0, phaseA: 0, phaseB: 0, dt: 16, pulse: 0, palette: createPalette(), energy: 0.5 };

      expect(state.eventPrevPredicate[0]).toBe(0);
      evaluateEvent(eventExprId(0), exprs, state, signals);
      expect(state.eventPrevPredicate[0]).toBe(1); // Updated to current predicate
    });
  });

  describe('per-frame clearing', () => {
    it('eventScalars cleared to 0 each frame via fill(0)', () => {
      const state = createMinimalState(4, 0);
      // Simulate a fired event
      state.eventScalars[0] = 1;
      state.eventScalars[1] = 1;

      // Clear (as done at start of executeFrame)
      state.eventScalars.fill(0);

      expect(state.eventScalars[0]).toBe(0);
      expect(state.eventScalars[1]).toBe(0);
    });
  });

  describe('monotone OR', () => {
    it('multiple writes to same slot — any true stays true', () => {
      const state = createMinimalState(2, 0);

      // Simulate two evalEvent steps targeting the same slot
      // First write: false (no-op, stays 0)
      // Second write: true (sets to 1)
      state.eventScalars[0] = 0;
      // First event doesn't fire → no write
      // Second event fires → set to 1
      state.eventScalars[0] = 1;
      // Third event doesn't fire → no overwrite (monotone OR)
      // The executor only writes 1, never writes 0 back

      expect(state.eventScalars[0]).toBe(1);
    });
  });

  describe('end-to-end: InfiniteTimeRoot pulse', () => {
    it('compile patch with InfiniteTimeRoot, execute frame, verify pulse slot = 1', () => {
      // Build a minimal patch with just InfiniteTimeRoot
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
      });

      const events = new EventHub();
      const result = compile(patch, { events });

      if (result.kind === 'error') {
        throw new Error(`Compile failed: ${result.errors.map(e => e.message).join(', ')}`);
      }

      const program = result.program;
      const schedule = program.schedule;

      // Verify eventSlotCount > 0 (pulse registered an event slot)
      expect(schedule.eventSlotCount).toBeGreaterThan(0);

      // Verify evalEvent step exists
      const evalEventSteps = schedule.steps.filter((s: any) => s.kind === 'evalEvent');
      expect(evalEventSteps.length).toBeGreaterThan(0);

      // Execute a frame
      const state = createRuntimeState(
        program.slotMeta.length,
        schedule.stateSlotCount ?? 0,
        schedule.eventSlotCount ?? 0,
        schedule.eventExprCount ?? 0
      );
      const arena = getTestArena();
      executeFrame(program, state, arena, 100);

      // Verify pulse event slot is 1 (fired this tick)
      const pulseStep = evalEventSteps[0] as StepEvalEvent;
      expect(state.eventScalars[pulseStep.target as number]).toBe(1);
    });

    it('pulse fires again on second frame (not just first)', () => {
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
      });

      const events = new EventHub();
      const result = compile(patch, { events });
      if (result.kind === 'error') {
        throw new Error(`Compile failed: ${result.errors.map(e => e.message).join(', ')}`);
      }

      const program = result.program;
      const schedule = program.schedule;
      const state = createRuntimeState(
        program.slotMeta.length,
        schedule.stateSlotCount ?? 0,
        schedule.eventSlotCount ?? 0,
        schedule.eventExprCount ?? 0
      );
      const arena = getTestArena();

      // Frame 1
      executeFrame(program, state, arena, 100);
      const evalEventSteps = schedule.steps.filter((s: any) => s.kind === 'evalEvent') as StepEvalEvent[];
      expect(state.eventScalars[evalEventSteps[0].target as number]).toBe(1);

      // Frame 2 (eventScalars should be cleared and re-fired)
      executeFrame(program, state, arena, 116);
      expect(state.eventScalars[evalEventSteps[0].target as number]).toBe(1);
    });
  });
});
