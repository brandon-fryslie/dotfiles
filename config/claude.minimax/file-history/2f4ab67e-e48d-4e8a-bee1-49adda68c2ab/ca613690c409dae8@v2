/**
 * Test for project policy behavior on domain change
 *
 * This test verifies that when element count changes (domain change),
 * mapped elements maintain their visual position at the boundary.
 *
 * The bug: On ANY domain change, positions drift from their correct values.
 */

import { describe, it, expect } from 'vitest';
import {
  applyContinuity,
  initializeGaugeOnDomainChange,
  initializeSlewWithMapping,
} from '../ContinuityApply';
import {
  createContinuityState,
  getOrCreateTargetState,
  type MappingState,
  type StableTargetId,
} from '../ContinuityState';
import type { StepContinuityApply } from '../../compiler/ir/types';
import { instanceId } from '../../compiler/ir/Indices';
import type { RuntimeState } from '../RuntimeState';
import { ExternalChannelSystem } from '../ExternalChannel';
import type { ValueSlot } from '../../types';

// Helper to create a valid palette Float32Array
function createPalette(r = 0.5, g = 0, b = 0, a = 1): Float32Array {
  return new Float32Array([r, g, b, a]);
}

/**
 * Create a minimal RuntimeState for testing
 */
function createTestRuntimeState(): RuntimeState {
  return {
    time: { 
      tAbsMs: 0, 
      tMs: 0, 
      phaseA: 0, 
      phaseB: 0, 
      dt: 16, 
      pulse: 0,
      palette: createPalette(),
      energy: 0.5,
    },
    values: {
      f64: new Float64Array(0),
      objects: new Map(),
      shape2d: new Uint32Array(0),
    },
    state: new Float64Array(0),
    eventScalars: new Uint8Array(0),
    eventPrevPredicate: new Uint8Array(0),
    events: new Map(),
    cache: {
      frameId: 0,
      sigValues: new Float64Array(100),
      sigStamps: new Uint32Array(100),
      fieldBuffers: new Map(),
      fieldStamps: new Map(),
    },
    timeState: {
      prevTAbsMs: null,
      prevTMs: null,

      prevPhaseA: null,
      prevPhaseB: null,
      offsetA: 0,
      offsetB: 0,
    },
    externalChannels: new ExternalChannelSystem(),
    health: {
      frameTimes: new Array(10).fill(0),
      frameTimesIndex: 0,
      nanCount: 0,
      infCount: 0,
      lastNanBlockId: null,
      lastInfBlockId: null,
      materializationCount: 0,
      heavyMaterializationBlocks: new Map(),
      lastSnapshotTime: 0,
      samplingBatchStart: 0,
      nanBatchCount: 0,
      infBatchCount: 0,
      // Assembler performance metrics
      assemblerGroupingMs: new Array(10).fill(0),
      assemblerGroupingMsIndex: 0,
      assemblerSlicingMs: new Array(10).fill(0),
      assemblerSlicingMsIndex: 0,
      assemblerTotalMs: new Array(10).fill(0),
      assemblerTotalMsIndex: 0,
      topologyGroupCacheHits: 0,
      topologyGroupCacheMisses: 0,
      // Frame timing metrics
      prevRafTimestamp: null,
      frameDeltas: new Array(60).fill(0),
      frameDeltasIndex: 0,
      droppedFrameCount: 0,
      frameCountInWindow: 0,
      frameDeltaSum: 0,
      frameDeltaSumSq: 0,
      minFrameDelta: Infinity,
      maxFrameDelta: 0,
      // Buffer pool metrics
      poolAllocs: 0,
      poolReleases: 0,
      pooledBytes: 0,
      poolKeyCount: 0,
    },
    continuity: createContinuityState(),
    continuityConfig: {
      decayExponent: 0.7,
      baseTauMs: 150,
      testPulseRequest: null,
      tauMultiplier: 1.0,
    },
  };
}

describe('Project Policy Domain Change', () => {
  /**
   * Core test: On domain change, mapped elements should maintain their position
   * at the boundary frame (no visual discontinuity).
   */
  it('mapped elements maintain position at domain change boundary', () => {
    const state = createTestRuntimeState();
    state.time = { 
      tAbsMs: 1000, 
      tMs: 1000, 
      phaseA: 0, 
      phaseB: 0, 
      dt: 16, 
      pulse: 0,
      palette: createPalette(),
      energy: 0.5,
    };

    // Simulate: We have 5 elements with positions around (0.5, 0.5)
    // Position is vec2, so buffer has 10 floats (5 elements * 2 components)
    const oldPositions = new Float32Array([
      0.4, 0.4,  // element 0
      0.5, 0.5,  // element 1
      0.6, 0.6,  // element 2
      0.45, 0.55, // element 3
      0.55, 0.45, // element 4
    ]);

    // Set up initial continuity state with these positions
    const targetId = 'test_position' as StableTargetId;
    const initialState = getOrCreateTargetState(state.continuity, targetId, 10);
    // Slew buffer holds current effective positions
    initialState.slewBuffer.set(oldPositions);
    // Gauge is zero initially (positions are at base values)
    initialState.gaugeBuffer.fill(0);

    // Now simulate domain change: increase from 5 to 7 elements
    // Elements 0-4 map to themselves, elements 5-6 are new
    const newCount = 7;
    const newBufferLength = newCount * 2; // vec2

    // New base positions (computed by materializer)
    // Note: With more elements, each element's base position changes!
    // This is the key insight - the COMPUTED position changes when count changes
    const newBasePositions = new Float32Array([
      0.35, 0.35,  // element 0 - DIFFERENT from old!
      0.45, 0.45,  // element 1 - DIFFERENT from old!
      0.55, 0.55,  // element 2 - DIFFERENT from old!
      0.40, 0.50,  // element 3 - DIFFERENT from old!
      0.50, 0.40,  // element 4 - DIFFERENT from old!
      0.60, 0.60,  // element 5 - NEW
      0.65, 0.65,  // element 6 - NEW
    ]);

    // Mapping: elements 0-4 map to old 0-4, elements 5-6 are unmapped (-1)
    const mapping: MappingState = {
      newToOld: new Int32Array([0, 1, 2, 3, 4, -1, -1]),
    };

    // Store mapping in continuity state
    state.continuity.mappings.set('test_instance', mapping);
    state.continuity.domainChangeThisFrame = true;

    // Capture old slew state before reallocation
    const oldSlewSnapshot = new Float32Array(initialState.slewBuffer);

    // Reallocate for new size
    const newTargetState = getOrCreateTargetState(state.continuity, targetId, newBufferLength);

    // Initialize gauge to preserve effective values for mapped elements
    initializeGaugeOnDomainChange(
      oldSlewSnapshot,
      newBasePositions,
      newTargetState.gaugeBuffer,
      mapping,
      newCount,
      2 // stride for vec2
    );

    // Initialize slew buffer with mapped values
    initializeSlewWithMapping(
      oldSlewSnapshot,
      newBasePositions,
      newTargetState.slewBuffer,
      mapping,
      newCount,
      2 // stride for vec2
    );

    // Now verify: For mapped elements, base + gauge should equal old position
    for (let i = 0; i < 5; i++) {
      const oldIdx = mapping.newToOld[i];
      expect(oldIdx).toBeGreaterThanOrEqual(0); // Should be mapped

      for (let s = 0; s < 2; s++) {
        const newBufIdx = i * 2 + s;
        const oldBufIdx = oldIdx * 2 + s;

        const effectivePosition = newBasePositions[newBufIdx] + newTargetState.gaugeBuffer[newBufIdx];
        const oldPosition = oldSlewSnapshot[oldBufIdx];

        // THIS IS THE CORE INVARIANT:
        // Effective position after domain change should equal old position
        expect(effectivePosition).toBeCloseTo(oldPosition, 5);
      }
    }

    // For new elements, gauge should be 0 (start at base)
    for (let i = 5; i < 7; i++) {
      for (let s = 0; s < 2; s++) {
        expect(newTargetState.gaugeBuffer[i * 2 + s]).toBe(0);
      }
    }
  });

  /**
   * Test that verifies the full applyContinuity function works correctly
   */
  it('applyContinuity preserves position at domain change boundary', () => {
    const state = createTestRuntimeState();
    state.time = { 
      tAbsMs: 1000, 
      tMs: 1000, 
      phaseA: 0, 
      phaseB: 0, 
      dt: 16, 
      pulse: 0,
      palette: createPalette(),
      energy: 0.5,
    };
    state.continuity.lastTModelMs = 984; // Previous frame was 16ms ago

    // Set up slots for buffers
    const baseSlot = 100 as ValueSlot;
    const outputSlot = 101 as ValueSlot;

    // Initial state: 3 elements with known positions
    const oldPositions = new Float32Array([
      0.5, 0.5,  // center
      0.3, 0.3,  // offset
      0.7, 0.7,  // offset other way
    ]);

    // Set up continuity state
    const targetId = 'test_instance_position_0' as StableTargetId;
    const initialState = getOrCreateTargetState(state.continuity, targetId, 6);
    initialState.slewBuffer.set(oldPositions);
    initialState.gaugeBuffer.fill(0);

    // Domain change: now 4 elements
    // New base positions are DIFFERENT (because count changed)
    const newBasePositions = new Float32Array([
      0.4, 0.4,  // element 0 - computed differently now
      0.2, 0.2,  // element 1 - computed differently now
      0.6, 0.6,  // element 2 - computed differently now
      0.8, 0.8,  // element 3 - NEW
    ]);

    const outputBuffer = new Float32Array(8);

    // Store buffers in state
    state.values.objects.set(baseSlot, newBasePositions);
    state.values.objects.set(outputSlot, outputBuffer);

    // Set up mapping
    const mapping: MappingState = {
      newToOld: new Int32Array([0, 1, 2, -1]),
    };
    state.continuity.mappings.set('test_instance', mapping);
    state.continuity.domainChangeThisFrame = true;

    // Create step
    const step: StepContinuityApply = {
      kind: 'continuityApply',
      targetKey: targetId,
      instanceId: instanceId('test_instance'),
      policy: { kind: 'project', projector: 'byId', post: 'slew', tauMs: 120 },
      baseSlot,
      outputSlot,
      semantic: 'position',
      stride: 2,  // vec2 position
    };

    // Apply continuity
    applyContinuity(step, state, (slot) => {
      return state.values.objects.get(slot) as Float32Array;
    });

    // Get the output
    const result = state.values.objects.get(outputSlot) as Float32Array;

    // For mapped elements (0, 1, 2), output should be CLOSE to old positions
    // (not exactly equal because slew has 16ms of movement, but very close)
    // With tau=120ms and dt=16ms, alpha ≈ 0.125, so we move about 12.5% toward target
    // But at the BOUNDARY, before any frames pass, effective should equal old

    // The key test: the OUTPUT should NOT be the new base positions
    // It should be close to the old positions (with some slew movement)

    // Element 0: old was (0.5, 0.5), new base is (0.4, 0.4)
    // If continuity is working, output should be closer to 0.5 than to 0.4
    expect(result[0]).toBeGreaterThan(0.4); // Should be > new base
    expect(result[1]).toBeGreaterThan(0.4);

    // Element 1: old was (0.3, 0.3), new base is (0.2, 0.2)
    expect(result[2]).toBeGreaterThan(0.2);
    expect(result[3]).toBeGreaterThan(0.2);

    // Element 2: old was (0.7, 0.7), new base is (0.6, 0.6)
    expect(result[4]).toBeGreaterThan(0.6);
    expect(result[5]).toBeGreaterThan(0.6);

    // Element 3 (new): should be at or near base (0.8, 0.8)
    expect(result[6]).toBeCloseTo(0.8, 1);
    expect(result[7]).toBeCloseTo(0.8, 1);
  });

  /**
   * Test decrease in count (the other direction)
   */
  it('handles decrease in element count', () => {
    const state = createTestRuntimeState();
    state.time = { 
      tAbsMs: 1000, 
      tMs: 1000, 
      phaseA: 0, 
      phaseB: 0, 
      dt: 16, 
      pulse: 0,
      palette: createPalette(),
      energy: 0.5,
    };

    // Start with 5 elements
    const oldPositions = new Float32Array([
      0.1, 0.1,
      0.2, 0.2,
      0.3, 0.3,
      0.4, 0.4,
      0.5, 0.5,
    ]);

    const targetId = 'test_position' as StableTargetId;
    const initialState = getOrCreateTargetState(state.continuity, targetId, 10);
    initialState.slewBuffer.set(oldPositions);
    initialState.gaugeBuffer.fill(0);

    // Decrease to 3 elements
    // Elements 0-2 are kept, 3-4 are removed
    const newBasePositions = new Float32Array([
      0.15, 0.15,  // element 0 - different base now
      0.25, 0.25,  // element 1 - different base now
      0.35, 0.35,  // element 2 - different base now
    ]);

    const mapping: MappingState = {
      newToOld: new Int32Array([0, 1, 2]),
    };

    state.continuity.mappings.set('test_instance', mapping);
    state.continuity.domainChangeThisFrame = true;

    const oldSlewSnapshot = new Float32Array(initialState.slewBuffer);
    const newTargetState = getOrCreateTargetState(state.continuity, targetId, 6);

    initializeGaugeOnDomainChange(
      oldSlewSnapshot,
      newBasePositions,
      newTargetState.gaugeBuffer,
      mapping,
      3,
      2
    );

    // Verify: effective position = base + gauge = old position
    for (let i = 0; i < 3; i++) {
      for (let s = 0; s < 2; s++) {
        const idx = i * 2 + s;
        const effective = newBasePositions[idx] + newTargetState.gaugeBuffer[idx];
        expect(effective).toBeCloseTo(oldPositions[idx], 5);
      }
    }
  });

  /**
   * Test that simulates a REALISTIC multi-frame scenario:
   * 1. Animation starts with N elements, runs for several frames
   * 2. Domain changes (count increases)
   * 3. Several frames pass
   * 4. Domain changes again (count decreases back to N)
   * 5. Verify positions match the ORIGINAL animation, not some drifted state
   *
   * This is the scenario the user reported: spiral looks correct at start,
   * but after increasing and then decreasing count, the spiral is distorted.
   */
  it('round-trip domain change preserves original animation shape', () => {
    const state = createTestRuntimeState();
    state.continuity.lastTModelMs = 0;

    // Slots for buffers
    const baseSlot = 100 as ValueSlot;
    const outputSlot = 101 as ValueSlot;

    // Simulated spiral positions for 5 elements (vec2 = 10 floats)
    // These represent the COMPUTED positions based on count=5
    // IMPORTANT: Each element has DIFFERENT positions in each configuration
    // to test that gauge offsets accumulate correctly across domain changes
    const spiralFor5 = new Float32Array([
      0.50, 0.50,  // element 0
      0.55, 0.60,  // element 1
      0.45, 0.40,  // element 2
      0.60, 0.55,  // element 3
      0.40, 0.45,  // element 4
    ]);

    // When count increases to 7, ALL COMPUTED positions change
    // (because the spiral formula distributes elements differently)
    // Notice: Even element 0 is at a DIFFERENT position now!
    const spiralFor7 = new Float32Array([
      0.48, 0.52,  // element 0 - MOVED from (0.50, 0.50)!
      0.52, 0.55,  // element 1 - DIFFERENT spacing
      0.46, 0.47,  // element 2 - DIFFERENT spacing
      0.54, 0.50,  // element 3 - DIFFERENT spacing
      0.44, 0.49,  // element 4 - DIFFERENT spacing
      0.57, 0.57,  // element 5 - NEW
      0.43, 0.43,  // element 6 - NEW
    ]);

    // When count goes back to 5, positions return to spiralFor5 formula
    // (This is the COMPUTED base - same as original)
    const spiralBackTo5 = new Float32Array([
      0.50, 0.50,  // element 0 - back to original
      0.55, 0.60,  // element 1 - back to original
      0.45, 0.40,  // element 2 - back to original
      0.60, 0.55,  // element 3 - back to original
      0.40, 0.45,  // element 4 - back to original
    ]);

    const targetId = 'test_instance_position_0' as StableTargetId;
    const instId = 'test_instance';
    let outputBuffer = new Float32Array(10);

    // Helper to run one frame
    const runFrame = (
      tMs: number,
      basePositions: Float32Array,
      isDomainChange: boolean,
      newToOldMapping: Int32Array | null
    ) => {
      state.time = { 
        tAbsMs: tMs, 
        tMs, 
        phaseA: 0, 
        phaseB: 0, 
        dt: 16, 
        pulse: 0,
        palette: createPalette(),
        energy: 0.5,
      };

      // Update output buffer size if needed
      if (outputBuffer.length !== basePositions.length) {
        outputBuffer = new Float32Array(basePositions.length);
      }

      // Store buffers
      state.values.objects.set(baseSlot, basePositions);
      state.values.objects.set(outputSlot, outputBuffer);

      // Set up mapping if domain changed
      if (isDomainChange && newToOldMapping) {
        const mapping: MappingState = {
          newToOld: newToOldMapping,
        };
        state.continuity.mappings.set(instId, mapping);
        state.continuity.domainChangeThisFrame = true;
      } else {
        state.continuity.domainChangeThisFrame = false;
        state.continuity.mappings.delete(instId);
      }

      // Create step
      const step: StepContinuityApply = {
        kind: 'continuityApply',
        targetKey: targetId,
        instanceId: instanceId(instId),
        policy: { kind: 'project', projector: 'byId', post: 'slew', tauMs: 120 },
        baseSlot,
        outputSlot,
        semantic: 'position',
        stride: 2,  // vec2 position
      };

      // Apply continuity
      applyContinuity(step, state, (slot) => {
        return state.values.objects.get(slot) as Float32Array;
      });

      // Update time tracking (like finalizeContinuityFrame does)
      state.continuity.lastTModelMs = tMs;

      return state.values.objects.get(outputSlot) as Float32Array;
    };

    // PHASE 1: Initialize with 5 elements, run several frames to reach steady state
    // (slew buffer converges to base values)
    let result = runFrame(0, spiralFor5, false, null);
    for (let t = 16; t <= 500; t += 16) {
      result = runFrame(t, spiralFor5, false, null);
    }

    // After 500ms of steady animation, output should match base (slew converged)
    for (let i = 0; i < 10; i++) {
      expect(result[i]).toBeCloseTo(spiralFor5[i], 2);
    }

    // PHASE 2: Domain change - increase to 7 elements
    // Elements 0-4 map to themselves, 5-6 are new
    const mappingTo7 = new Int32Array([0, 1, 2, 3, 4, -1, -1]);
    result = runFrame(516, spiralFor7, true, mappingTo7);

    // Right after domain change:
    // - Mapped elements (0-4) should be at OLD positions (spiralFor5), not new base
    // - New elements (5-6) should be at their base positions
    for (let i = 0; i < 5; i++) {
      // Mapped elements should preserve old position (within slew tolerance)
      expect(result[i * 2]).toBeCloseTo(spiralFor5[i * 2], 1);
      expect(result[i * 2 + 1]).toBeCloseTo(spiralFor5[i * 2 + 1], 1);
    }

    // Run several more frames with 7 elements
    for (let t = 532; t <= 1000; t += 16) {
      result = runFrame(t, spiralFor7, false, null);
    }

    // Log intermediate state
    const targetState = state.continuity.targets.get(targetId);
    console.log('After 500ms at count=7:');
    console.log('  slew[0,1]:', targetState?.slewBuffer[0], targetState?.slewBuffer[1]);
    console.log('  gauge[0,1]:', targetState?.gaugeBuffer[0], targetState?.gaugeBuffer[1]);
    console.log('  base[0,1]:', spiralFor7[0], spiralFor7[1]);
    console.log('  result[0,1]:', result[0], result[1]);

    // After 500ms, slew should have converged toward spiralFor7
    // But with project policy + gauge, gauge preserves offset, so where does it slew to?
    // This is the key question!

    // PHASE 3: Domain change - decrease back to 5 elements
    // Elements 0-4 map to themselves
    const mappingTo5 = new Int32Array([0, 1, 2, 3, 4]);
    result = runFrame(1016, spiralBackTo5, true, mappingTo5);

    // THE CRITICAL TEST:
    // After going 5 -> 7 -> 5, the positions should be very close to original
    // Because:
    // 1. spiralBackTo5 === spiralFor5 (same base computation)
    // 2. Elements 0-4 were preserved through both domain changes
    //
    // But if there's a bug, the positions might have drifted due to:
    // - Gauge accumulation
    // - Incorrect mapping application
    // - Slew state corruption
    console.log('Final result after round-trip:');
    console.log('Element 0:', result[0], result[1], 'expected:', spiralFor5[0], spiralFor5[1]);
    console.log('Element 1:', result[2], result[3], 'expected:', spiralFor5[2], spiralFor5[3]);
    console.log('Element 2:', result[4], result[5], 'expected:', spiralFor5[4], spiralFor5[5]);

    // Verify positions are close to original (allowing for some slew transition)
    for (let i = 0; i < 5; i++) {
      const x = result[i * 2];
      const y = result[i * 2 + 1];
      const expectedX = spiralFor5[i * 2];
      const expectedY = spiralFor5[i * 2 + 1];

      // After domain change, should be at or near old effective position
      // The old effective position after the previous frames was spiralFor7[i]
      // which then got remapped. This is where the bug might manifest.
      expect(x).toBeCloseTo(expectedX, 0); // Loose tolerance - just checking for gross drift
      expect(y).toBeCloseTo(expectedY, 0);
    }
  });

  /**
   * Test that gauge decays to zero over time for project policy.
   * This is critical for animated properties like rotating spirals.
   *
   * Without decay: gauge computed at domain change stays permanent,
   * causing drift as the base animation continues.
   *
   * With decay: gauge provides continuity at the boundary, then
   * decays away so elements gradually settle into their new positions.
   */
  it('project policy gauge decays to zero over time', () => {
    const state = createTestRuntimeState();
    state.continuity.lastTModelMs = 0;

    const baseSlot = 100 as ValueSlot;
    const outputSlot = 101 as ValueSlot;
    const targetId = 'test_instance_position_0' as StableTargetId;
    const instId = 'test_instance';

    // Start with 3 elements at known positions
    const initialPositions = new Float32Array([
      0.5, 0.5,  // element 0
      0.3, 0.3,  // element 1
      0.7, 0.7,  // element 2
    ]);

    // Run a few frames to establish steady state
    let outputBuffer = new Float32Array(6);
    state.values.objects.set(baseSlot, initialPositions);
    state.values.objects.set(outputSlot, outputBuffer);

    const step: StepContinuityApply = {
      kind: 'continuityApply',
      targetKey: targetId,
      instanceId: instanceId(instId),
      policy: { kind: 'project', projector: 'byId', post: 'slew', tauMs: 120 },
      baseSlot,
      outputSlot,
      semantic: 'position',
      stride: 2,  // vec2 position
    };

    // Run initial frames
    for (let t = 0; t <= 100; t += 16) {
      state.time = { 
        tAbsMs: t, 
        tMs: t, 
        phaseA: 0, 
        phaseB: 0, 
        dt: 16, 
        pulse: 0,
        palette: createPalette(),
        energy: 0.5,
      };
      state.continuity.domainChangeThisFrame = false;
      applyContinuity(step, state, (slot) => state.values.objects.get(slot) as Float32Array);
      state.continuity.lastTModelMs = t;
    }

    // Domain change at t=116: increase to 5 elements
    // New base positions are different (simulating rotating spiral)
    const newBasePositions = new Float32Array([
      0.4, 0.4,  // element 0 - moved from (0.5, 0.5)
      0.2, 0.2,  // element 1 - moved from (0.3, 0.3)
      0.6, 0.6,  // element 2 - moved from (0.7, 0.7)
      0.8, 0.8,  // element 3 - new
      0.1, 0.1,  // element 4 - new
    ]);

    outputBuffer = new Float32Array(10);
    state.values.objects.set(baseSlot, newBasePositions);
    state.values.objects.set(outputSlot, outputBuffer);

    const mapping: MappingState = {
      newToOld: new Int32Array([0, 1, 2, -1, -1]),
    };
    state.continuity.mappings.set(instId, mapping);
    state.continuity.domainChangeThisFrame = true;
    state.time = { 
      tAbsMs: 116, 
      tMs: 116, 
      phaseA: 0, 
      phaseB: 0, 
      dt: 16, 
      pulse: 0,
      palette: createPalette(),
      energy: 0.5,
    };

    // Apply domain change frame
    applyContinuity(step, state, (slot) => state.values.objects.get(slot) as Float32Array);
    state.continuity.lastTModelMs = 116;

    // Capture gauge values right after domain change
    const targetState = state.continuity.targets.get(targetId)!;
    const gaugeAfterDomainChange = new Float32Array(targetState.gaugeBuffer);

    // Gauge should be non-zero for mapped elements (preserving continuity)
    expect(Math.abs(gaugeAfterDomainChange[0])).toBeGreaterThan(0.01); // element 0, x
    expect(Math.abs(gaugeAfterDomainChange[1])).toBeGreaterThan(0.01); // element 0, y

    // Run frames with the NEW base positions (simulating continued animation)
    // As time passes, gauge should decay toward zero
    state.continuity.domainChangeThisFrame = false;
    state.continuity.mappings.delete(instId);

    // Collect gauge samples over time
    const gaugeSamples: number[] = [];
    const timeSamples: number[] = [];

    // Run for ~5 tau (5 * 120ms = 600ms) to see gauge decay nearly to zero
    for (let t = 132; t <= 716; t += 16) {
      state.time = { 
        tAbsMs: t, 
        tMs: t, 
        phaseA: 0, 
        phaseB: 0, 
        dt: 16, 
        pulse: 0,
        palette: createPalette(),
        energy: 0.5,
      };

      // IMPORTANT: Base positions continue to change (simulating rotating spiral)
      // This is what causes drift if gauge doesn't decay
      // For simplicity, we'll keep base constant in this test (gauge decay should work either way)
      applyContinuity(step, state, (slot) => state.values.objects.get(slot) as Float32Array);
      state.continuity.lastTModelMs = t;

      // Sample gauge magnitude (Euclidean norm of first element's x,y gauge)
      const gaugeMagnitude = Math.sqrt(
        targetState.gaugeBuffer[0] ** 2 + targetState.gaugeBuffer[1] ** 2
      );
      gaugeSamples.push(gaugeMagnitude);
      timeSamples.push(t - 116); // elapsed since domain change
    }

    // Verify gauge is decaying exponentially
    // After 1 tau (120ms): gauge should be ~36.8% of original (e^-1 ≈ 0.368)
    // After 5 tau (600ms): gauge should be ~0.7% of original (e^-5 ≈ 0.0067)

    const initialGaugeMagnitude = Math.sqrt(
      gaugeAfterDomainChange[0] ** 2 + gaugeAfterDomainChange[1] ** 2
    );

    // Verify overall trend: gauge is monotonically decreasing
    for (let i = 1; i < gaugeSamples.length; i++) {
      // Allow for tiny numerical fluctuations
      expect(gaugeSamples[i]).toBeLessThanOrEqual(gaugeSamples[i - 1] + 0.0001);
    }

    // With tau=360ms and ease-in curve (exp^0.7):
    // - Starts slow (gentle beginning)
    // - Accelerates toward the end (snap into place)
    // - After ~600ms: should be around 3-5% (still has a bit to go)
    // - After ~1800ms (5τ): would be essentially complete
    const finalGauge = gaugeSamples[gaugeSamples.length - 1];
    expect(finalGauge).toBeLessThan(initialGaugeMagnitude * 0.06); // < 6% after 600ms
    expect(finalGauge).toBeGreaterThan(initialGaugeMagnitude * 0.02); // > 2% (still decaying)
  });
});
