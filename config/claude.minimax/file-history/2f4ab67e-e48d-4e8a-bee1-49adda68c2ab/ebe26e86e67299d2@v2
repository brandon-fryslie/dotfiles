/**
 * State Migration Tests
 *
 * Tests for migrating stateful primitive state across hot-swap.
 */

import { describe, it, expect } from 'vitest';
import { migrateState, createInitialState } from '../StateMigration';
import type { StateMapping, StableStateId } from '../../compiler/ir/types';
import { stableStateId } from '../../compiler/ir/types';
import { instanceId } from '../../compiler/ir/Indices';
import type { MappingState } from '../ContinuityState';

describe('StateMigration', () => {
  describe('createInitialState', () => {
    it('initializes scalar state with defaults', () => {
      const mappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'delay'),
          slotIndex: 0,
          stride: 1,
          initial: [42],
        },
      ];

      const state = createInitialState(1, mappings);
      expect(state[0]).toBe(42);
    });

    it('initializes field state with defaults for all lanes', () => {
      const mappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b2', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 3,
          stride: 1,
          initial: [10],
        },
      ];

      const state = createInitialState(3, mappings);
      expect(state[0]).toBe(10);
      expect(state[1]).toBe(10);
      expect(state[2]).toBe(10);
    });

    it('initializes multi-stride field state correctly', () => {
      const mappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b3', 'filter'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 2,
          stride: 2,
          initial: [1, 2], // y, dy
        },
      ];

      const state = createInitialState(4, mappings);
      // Lane 0: y=1, dy=2
      expect(state[0]).toBe(1);
      expect(state[1]).toBe(2);
      // Lane 1: y=1, dy=2
      expect(state[2]).toBe(1);
      expect(state[3]).toBe(2);
    });
  });

  describe('migrateState - scalar', () => {
    it('migrates scalar state when StateId matches', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'delay'),
          slotIndex: 0,
          stride: 1,
          initial: [0],
        },
      ];
      const newMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'delay'),
          slotIndex: 0, // Same slot
          stride: 1,
          initial: [0],
        },
      ];

      const oldState = new Float64Array([99]);
      const newState = new Float64Array(1);

      const result = migrateState(
        oldState,
        newState,
        oldMappings,
        newMappings,
        () => null
      );

      expect(result.migrated).toBe(true);
      expect(result.scalarsMigrated).toBe(1);
      expect(newState[0]).toBe(99);
    });

    it('migrates scalar state when slot index changes', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'delay'),
          slotIndex: 0,
          stride: 1,
          initial: [0],
        },
      ];
      const newMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'delay'),
          slotIndex: 5, // Slot moved!
          stride: 1,
          initial: [0],
        },
      ];

      const oldState = new Float64Array([77]);
      const newState = new Float64Array(10);

      migrateState(oldState, newState, oldMappings, newMappings, () => null);

      expect(newState[5]).toBe(77); // Value migrated to new slot
    });

    it('initializes new scalar state with defaults', () => {
      const oldMappings: StateMapping[] = [];
      const newMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b2', 'delay'),
          slotIndex: 0,
          stride: 1,
          initial: [42],
        },
      ];

      const oldState = new Float64Array(0);
      const newState = new Float64Array(1);

      const result = migrateState(
        oldState,
        newState,
        oldMappings,
        newMappings,
        () => null
      );

      expect(result.initialized).toBe(1);
      expect(newState[0]).toBe(42);
    });

    it('tracks discarded state', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'delay'),
          slotIndex: 0,
          stride: 1,
          initial: [0],
        },
      ];
      const newMappings: StateMapping[] = [];

      const oldState = new Float64Array([99]);
      const newState = new Float64Array(0);

      const result = migrateState(
        oldState,
        newState,
        oldMappings,
        newMappings,
        () => null
      );

      expect(result.discarded).toBe(1);
    });
  });

  describe('migrateState - field', () => {
    it('migrates field state with identity mapping', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 3,
          stride: 1,
          initial: [0],
        },
      ];
      const newMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 3,
          stride: 1,
          initial: [0],
        },
      ];

      const oldState = new Float64Array([10, 20, 30]);
      const newState = new Float64Array(3);

      const identityMapping: MappingState = { newToOld: new Int32Array([0, 1, 2]) };

      migrateState(oldState, newState, oldMappings, newMappings, () => identityMapping);

      expect(newState[0]).toBe(10);
      expect(newState[1]).toBe(20);
      expect(newState[2]).toBe(30);
    });

    it('uses lane mapping for field state when lanes reorder', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 3,
          stride: 1,
          initial: [0],
        },
      ];
      const newMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 3,
          stride: 1,
          initial: [0],
        },
      ];

      const oldState = new Float64Array([10, 20, 30]);
      const newState = new Float64Array(3);

      // New lane 0 was old lane 2, lane 1 was 0, lane 2 was 1
      const reorderMapping: MappingState = {
        newToOld: new Int32Array([2, 0, 1]),
      };

      migrateState(oldState, newState, oldMappings, newMappings, () => reorderMapping);

      expect(newState[0]).toBe(30); // Was lane 2
      expect(newState[1]).toBe(10); // Was lane 0
      expect(newState[2]).toBe(20); // Was lane 1
    });

    it('initializes new lanes when count increases', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 2,
          stride: 1,
          initial: [99],
        },
      ];
      const newMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'slew'),
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 4,
          stride: 1,
          initial: [99],
        },
      ];

      const oldState = new Float64Array([10, 20]);
      const newState = new Float64Array(4);

      // First 2 lanes map directly, lanes 2-3 are new (-1)
      const mapping: MappingState = {
        newToOld: new Int32Array([0, 1, -1, -1]),
      };

      const result = migrateState(
        oldState,
        newState,
        oldMappings,
        newMappings,
        () => mapping
      );

      expect(newState[0]).toBe(10);
      expect(newState[1]).toBe(20);
      expect(newState[2]).toBe(99); // Initialized
      expect(newState[3]).toBe(99); // Initialized
      expect(result.details[0].lanesMigrated).toBe(2);
      expect(result.details[0].lanesInitialized).toBe(2);
    });

    it('handles cardinality change (scalar to field) as reinitialization', () => {
      const oldMappings: StateMapping[] = [
        {
          kind: 'scalar',
          stateId: stableStateId('b1', 'state'),
          slotIndex: 0,
          stride: 1,
          initial: [0],
        },
      ];
      const newMappings: StateMapping[] = [
        {
          kind: 'field',
          stateId: stableStateId('b1', 'state'), // Same ID, different cardinality
          instanceId: instanceId('inst_0'),
          slotStart: 0,
          laneCount: 3,
          stride: 1,
          initial: [42],
        },
      ];

      const oldState = new Float64Array([99]);
      const newState = new Float64Array(3);

      const result = migrateState(
        oldState,
        newState,
        oldMappings,
        newMappings,
        () => null
      );

      // Can't migrate scalar->field, so reinitialize
      expect(result.initialized).toBe(1);
      expect(newState[0]).toBe(42);
      expect(newState[1]).toBe(42);
      expect(newState[2]).toBe(42);
    });
  });
});
