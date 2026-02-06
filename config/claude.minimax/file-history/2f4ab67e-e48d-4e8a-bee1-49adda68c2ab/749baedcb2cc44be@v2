import { describe, it, expect } from 'vitest';
import { getScalarSlots, getFieldSlots, type ScheduleIR } from '../schedule-program';
import type { ScalarSlotDecl, FieldSlotDecl } from '../../ir/types';
import { instanceId } from '../../ir/Indices';

describe('State Slot Accessors', () => {
  // Helper to create minimal test schedule
  function createTestSchedule(stateMappings: Array<ScalarSlotDecl | FieldSlotDecl>): ScheduleIR {
    return {
      timeModel: { kind: 'finite', durationMs: 1000 },
      instances: new Map(),
      steps: [],
      stateSlotCount: stateMappings.reduce((sum, m) => 
        sum + (m.kind === 'scalar' ? m.stride : m.laneCount * m.stride), 0
      ),
      stateSlots: [],
      stateMappings,
      eventSlotCount: 0,
      eventExprCount: 0
    };
  }

  describe('getScalarSlots', () => {
    it('should return only scalar state mappings', () => {
      const schedule = createTestSchedule([
        { kind: 'scalar', stateId: 's1' as any, slotIndex: 0, stride: 1, initial: [0] },
        { kind: 'field', stateId: 'f1' as any, instanceId: instanceId('inst1'), slotStart: 1, laneCount: 4, stride: 1, initial: [0] },
        { kind: 'scalar', stateId: 's2' as any, slotIndex: 5, stride: 2, initial: [0, 0] }
      ]);

      const result = getScalarSlots(schedule);

      expect(result).toHaveLength(2);
      expect(result[0].kind).toBe('scalar');
      expect(result[0].stateId).toBe('s1');
      expect(result[1].kind).toBe('scalar');
      expect(result[1].stateId).toBe('s2');
    });

    it('should return empty array when no scalar slots exist', () => {
      const schedule = createTestSchedule([
        { kind: 'field', stateId: 'f1' as any, instanceId: instanceId('inst1'), slotStart: 0, laneCount: 4, stride: 1, initial: [0] }
      ]);

      const result = getScalarSlots(schedule);

      expect(result).toHaveLength(0);
    });

    it('should narrow TypeScript type correctly', () => {
      const schedule = createTestSchedule([
        { kind: 'scalar', stateId: 's1' as any, slotIndex: 0, stride: 1, initial: [0] }
      ]);

      const result = getScalarSlots(schedule);

      // TypeScript type test - should compile without type assertion
      const slotIndex: number = result[0].slotIndex;
      expect(slotIndex).toBe(0);

      // Should NOT have field-specific properties
      // @ts-expect-error - slotStart doesn't exist on ScalarSlotDecl
      const slotStart = result[0].slotStart;
      expect(slotStart).toBeUndefined();
    });
  });

  describe('getFieldSlots', () => {
    it('should return only field state mappings', () => {
      const schedule = createTestSchedule([
        { kind: 'scalar', stateId: 's1' as any, slotIndex: 0, stride: 1, initial: [0] },
        { kind: 'field', stateId: 'f1' as any, instanceId: instanceId('inst1'), slotStart: 1, laneCount: 4, stride: 1, initial: [0] },
        { kind: 'field', stateId: 'f2' as any, instanceId: instanceId('inst2'), slotStart: 5, laneCount: 8, stride: 2, initial: [0, 0] }
      ]);

      const result = getFieldSlots(schedule);

      expect(result).toHaveLength(2);
      expect(result[0].kind).toBe('field');
      expect(result[0].stateId).toBe('f1');
      expect(result[0].laneCount).toBe(4);
      expect(result[1].kind).toBe('field');
      expect(result[1].stateId).toBe('f2');
      expect(result[1].laneCount).toBe(8);
    });

    it('should return empty array when no field slots exist', () => {
      const schedule = createTestSchedule([
        { kind: 'scalar', stateId: 's1' as any, slotIndex: 0, stride: 1, initial: [0] }
      ]);

      const result = getFieldSlots(schedule);

      expect(result).toHaveLength(0);
    });

    it('should narrow TypeScript type correctly', () => {
      const schedule = createTestSchedule([
        { kind: 'field', stateId: 'f1' as any, instanceId: instanceId('inst1'), slotStart: 0, laneCount: 4, stride: 1, initial: [0] }
      ]);

      const result = getFieldSlots(schedule);

      // TypeScript type test - should compile without type assertion
      const laneCount: number = result[0].laneCount;
      expect(laneCount).toBe(4);

      // Should NOT have scalar-specific properties
      // @ts-expect-error - slotIndex doesn't exist on FieldSlotDecl
      const slotIndex = result[0].slotIndex;
      expect(slotIndex).toBeUndefined();
    });
  });

  describe('Integration', () => {
    it('should partition stateMappings array correctly', () => {
      const mappings = [
        { kind: 'scalar' as const, stateId: 's1' as any, slotIndex: 0, stride: 1, initial: [0] },
        { kind: 'field' as const, stateId: 'f1' as any, instanceId: instanceId('inst1'), slotStart: 1, laneCount: 4, stride: 1, initial: [0] },
        { kind: 'scalar' as const, stateId: 's2' as any, slotIndex: 5, stride: 2, initial: [0, 0] },
        { kind: 'field' as const, stateId: 'f2' as any, instanceId: instanceId('inst2'), slotStart: 7, laneCount: 8, stride: 1, initial: [0] }
      ];
      const schedule = createTestSchedule(mappings);

      const scalars = getScalarSlots(schedule);
      const fields = getFieldSlots(schedule);

      // Should partition correctly
      expect(scalars.length + fields.length).toBe(mappings.length);
      expect(scalars).toHaveLength(2);
      expect(fields).toHaveLength(2);

      // No overlap
      const scalarIds = new Set(scalars.map(s => s.stateId));
      const fieldIds = new Set(fields.map(f => f.stateId));
      expect([...scalarIds].some(id => fieldIds.has(id))).toBe(false);
    });
  });
});
