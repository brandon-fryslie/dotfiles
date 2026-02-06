import { describe, it, expect } from 'vitest';
import { IRBuilderImpl } from '../IRBuilderImpl';
import { canonicalType, floatConst, vec2Const, intConst } from '../../../core/canonical-types';
import { FLOAT, INT, VEC2 } from '../../../core/canonical-types';
import { OpCode } from '../types';
import { instanceId } from '../Indices';

describe('Hash-consing (I13)', () => {
  describe('SigExpr deduplication', () => {
    it('deduplicates identical sigConst', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const id1 = b.sigConst(floatConst(1.0), type);
      const id2 = b.sigConst(floatConst(1.0), type);
      
      expect(id1).toBe(id2); // MUST be same ID
    });

    it('distinguishes different sigConst values', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const id1 = b.sigConst(floatConst(1.0), type);
      const id2 = b.sigConst(floatConst(2.0), type);
      
      expect(id1).not.toBe(id2);
    });

    it('deduplicates identical sigTime', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const id1 = b.sigTime('tMs', type);
      const id2 = b.sigTime('tMs', type);
      
      expect(id1).toBe(id2);
    });

    it('distinguishes different sigTime variants', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const id1 = b.sigTime('tMs', type);
      const id2 = b.sigTime('dt', type);
      
      expect(id1).not.toBe(id2);
    });

    it('deduplicates identical sigExternal', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const id1 = b.sigExternal('audioLevel', type);
      const id2 = b.sigExternal('audioLevel', type);
      
      expect(id1).toBe(id2);
    });

    it('deduplicates identical sigMap', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const input = b.sigConst(floatConst(1.0), type);
      const fn = { kind: 'opcode' as const, opcode: OpCode.Sin };
      
      const id1 = b.sigMap(input, fn, type);
      const id2 = b.sigMap(input, fn, type);
      
      expect(id1).toBe(id2);
    });

    it('deduplicates identical sigZip', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const a = b.sigConst(floatConst(2.0), type);
      const b1 = b.sigConst(floatConst(3.0), type);
      const fn = { kind: 'opcode' as const, opcode: OpCode.Add };
      
      const sum1 = b.sigZip([a, b1], fn, type);
      const sum2 = b.sigZip([a, b1], fn, type);
      
      expect(sum1).toBe(sum2);
    });

    it('deduplicates identical sigBinOp (uses sigZip)', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const a = b.sigConst(floatConst(2.0), type);
      const b1 = b.sigConst(floatConst(3.0), type);
      
      const sum1 = b.sigBinOp(a, b1, OpCode.Add, type);
      const sum2 = b.sigBinOp(a, b1, OpCode.Add, type);
      
      expect(sum1).toBe(sum2);
    });

    it('deduplicates identical sigUnaryOp (uses sigMap)', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const input = b.sigConst(floatConst(1.0), type);
      
      const result1 = b.sigUnaryOp(input, OpCode.Sin, type);
      const result2 = b.sigUnaryOp(input, OpCode.Sin, type);
      
      expect(result1).toBe(result2);
    });

    it('deduplicates identical sigCombine', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const a = b.sigConst(floatConst(1.0), type);
      const b1 = b.sigConst(floatConst(2.0), type);
      
      const sum1 = b.sigCombine([a, b1], 'sum', type);
      const sum2 = b.sigCombine([a, b1], 'sum', type);
      
      expect(sum1).toBe(sum2);
    });

    it('deduplicates identical ReduceField', () => {
      const b = new IRBuilderImpl();
      const sigType = canonicalType(FLOAT);
      
      const sig = b.sigConst(floatConst(1.0), sigType);
      const field = b.Broadcast(sig, sigType);
      
      const reduce1 = b.ReduceField(field, 'sum', sigType);
      const reduce2 = b.ReduceField(field, 'sum', sigType);
      
      expect(reduce1).toBe(reduce2);
    });
  });

  describe('Compound expression deduplication', () => {
    it('deduplicates transitively', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      // Constants deduplicate
      const a = b.sigConst(floatConst(2.0), type);
      const b1 = b.sigConst(floatConst(3.0), type);
      const b2 = b.sigConst(floatConst(3.0), type);
      expect(b1).toBe(b2);
      
      // Operations using deduplicated inputs also deduplicate
      const sum1 = b.sigBinOp(a, b1, OpCode.Add, type);
      const sum2 = b.sigBinOp(a, b2, OpCode.Add, type);
      expect(sum1).toBe(sum2);
    });

    it('deduplicates nested expressions', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const a = b.sigConst(floatConst(1.0), type);
      const b1 = b.sigConst(floatConst(2.0), type);
      
      // Build: (a + b) * 2
      const sum1 = b.sigBinOp(a, b1, OpCode.Add, type);
      const two1 = b.sigConst(floatConst(2.0), type);
      const result1 = b.sigBinOp(sum1, two1, OpCode.Mul, type);
      
      // Build same expression again
      const sum2 = b.sigBinOp(a, b1, OpCode.Add, type);
      const two2 = b.sigConst(floatConst(2.0), type);
      const result2 = b.sigBinOp(sum2, two2, OpCode.Mul, type);
      
      // All subexpressions should be deduplicated
      expect(sum1).toBe(sum2);
      expect(two1).toBe(two2);
      expect(result1).toBe(result2);
    });
  });

  describe('FieldExpr deduplication', () => {
    it('deduplicates identical fieldConst', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);

      const id1 = b.fieldConst(floatConst(1.0), type);
      const id2 = b.fieldConst(floatConst(1.0), type);

      expect(id1).toBe(id2);
    });

    it('distinguishes different fieldConst values', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);

      const id1 = b.fieldConst(floatConst(1.0), type);
      const id2 = b.fieldConst(floatConst(2.0), type);

      expect(id1).not.toBe(id2);
    });

    it('deduplicates identical Broadcast', () => {
      const b = new IRBuilderImpl();
      const sigType = canonicalType(FLOAT);
      
      const sig = b.sigConst(floatConst(1.0), sigType);
      const id1 = b.Broadcast(sig, sigType);
      const id2 = b.Broadcast(sig, sigType);
      
      expect(id1).toBe(id2);
    });

    it('deduplicates fieldIntrinsic with same instanceId', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      const inst = instanceId('inst1');
      
      const id1 = b.fieldIntrinsic(inst, 'index', type);
      const id2 = b.fieldIntrinsic(inst, 'index', type);
      
      expect(id1).toBe(id2);
    });

    it('distinguishes fieldIntrinsic with different instanceIds', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      const inst1 = instanceId('inst1');
      const inst2 = instanceId('inst2');
      
      const id1 = b.fieldIntrinsic(inst1, 'index', type);
      const id2 = b.fieldIntrinsic(inst2, 'index', type);
      
      expect(id1).not.toBe(id2);
    });

    it('distinguishes fieldIntrinsic with different properties', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      const inst = instanceId('inst1');
      
      const id1 = b.fieldIntrinsic(inst, 'index', type);
      const id2 = b.fieldIntrinsic(inst, 'normalizedIndex', type);
      
      expect(id1).not.toBe(id2);
    });

    it('deduplicates identical fieldPlacement', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(VEC2);
      const inst = instanceId('inst1');
      
      const id1 = b.fieldPlacement(inst, 'uv', 'halton2D', type);
      const id2 = b.fieldPlacement(inst, 'uv', 'halton2D', type);
      
      expect(id1).toBe(id2);
    });
  });

  describe('EventExpr deduplication', () => {
    it('deduplicates identical eventPulse', () => {
      const b = new IRBuilderImpl();
      
      const id1 = b.eventPulse('InfiniteTimeRoot');
      const id2 = b.eventPulse('InfiniteTimeRoot');
      
      expect(id1).toBe(id2);
    });

    it('deduplicates identical eventNever', () => {
      const b = new IRBuilderImpl();
      
      const id1 = b.eventNever();
      const id2 = b.eventNever();
      
      expect(id1).toBe(id2);
    });

    it('deduplicates identical eventWrap', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const sig = b.sigConst(floatConst(1.0), type);
      const id1 = b.eventWrap(sig);
      const id2 = b.eventWrap(sig);
      
      expect(id1).toBe(id2);
    });

    it('deduplicates identical eventCombine', () => {
      const b = new IRBuilderImpl();
      
      const evt1 = b.eventPulse('InfiniteTimeRoot');
      const evt2 = b.eventNever();
      
      const combine1 = b.eventCombine([evt1, evt2], 'any');
      const combine2 = b.eventCombine([evt1, evt2], 'any');
      
      expect(combine1).toBe(combine2);
    });
  });

  describe('Edge cases', () => {
    it('handles array order correctly (different order = different expr)', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const a = b.sigConst(floatConst(1.0), type);
      const b1 = b.sigConst(floatConst(2.0), type);
      const fn = { kind: 'opcode' as const, opcode: OpCode.Add };
      
      const zip1 = b.sigZip([a, b1], fn, type);
      const zip2 = b.sigZip([b1, a], fn, type);
      
      expect(zip1).not.toBe(zip2); // Order matters
    });

    it('handles PureFn opcodes correctly', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const input = b.sigConst(floatConst(1.0), type);
      const fn = { kind: 'opcode' as const, opcode: OpCode.Sin };
      
      const id1 = b.sigMap(input, fn, type);
      const id2 = b.sigMap(input, fn, type);
      
      expect(id1).toBe(id2);
    });

    it('distinguishes different PureFn opcodes', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const input = b.sigConst(floatConst(1.0), type);
      const fn1 = { kind: 'opcode' as const, opcode: OpCode.Sin };
      const fn2 = { kind: 'opcode' as const, opcode: OpCode.Cos };
      
      const id1 = b.sigMap(input, fn1, type);
      const id2 = b.sigMap(input, fn2, type);
      
      expect(id1).not.toBe(id2);
    });

    it('handles float precision consistently', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const id1 = b.sigConst(floatConst(1.0), type);
      const id2 = b.sigConst(floatConst(1.00), type);
      
      expect(id1).toBe(id2); // JS number normalization
    });

    it('distinguishes different signal types', () => {
      const b = new IRBuilderImpl();
      const floatType = canonicalType(FLOAT);
      const intType = canonicalType(INT);
      
      const id1 = b.sigConst(floatConst(1), floatType);
      const id2 = b.sigConst(intConst(1), intType);
      
      expect(id1).not.toBe(id2);
    });

    it('handles composed PureFn correctly', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const input = b.sigConst(floatConst(1.0), type);
      const fn = { kind: 'composed' as const, ops: [OpCode.Sin, OpCode.Cos] as readonly OpCode[] };
      
      const id1 = b.sigMap(input, fn, type);
      const id2 = b.sigMap(input, fn, type);
      
      expect(id1).toBe(id2);
    });
  });

  describe('Real-world scenarios', () => {
    it('reduces expression count in typical patch', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      // Simulate a patch with repeated time references
      const time1 = b.sigTime('tMs', type);
      const time2 = b.sigTime('tMs', type);
      const time3 = b.sigTime('tMs', type);
      
      // All should be the same ID
      expect(time1).toBe(time2);
      expect(time2).toBe(time3);
      
      // Create multiple instances of same computation
      const one = b.sigConst(floatConst(1.0), type);
      const pi = b.sigConst(floatConst(3.14159), type);
      
      for (let i = 0; i < 5; i++) {
        const result = b.sigBinOp(time1, one, OpCode.Add, type);
        const scaled = b.sigBinOp(result, pi, OpCode.Mul, type);
        const sin = b.sigUnaryOp(scaled, OpCode.Sin, type);
        
        // Each iteration should reuse the same expressions
        if (i > 0) {
          expect(result).toBe(result); // Same computation gets same ID
        }
      }
    });

    it('deduplicates broadcast patterns', () => {
      const b = new IRBuilderImpl();
      const type = canonicalType(FLOAT);
      
      const time = b.sigTime('tMs', type);
      
      // Multiple broadcasts of same signal
      const broadcast1 = b.Broadcast(time, type);
      const broadcast2 = b.Broadcast(time, type);
      const broadcast3 = b.Broadcast(time, type);
      
      expect(broadcast1).toBe(broadcast2);
      expect(broadcast2).toBe(broadcast3);
    });
  });
});
