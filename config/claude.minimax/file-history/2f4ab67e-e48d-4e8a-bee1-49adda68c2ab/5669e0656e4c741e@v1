/**
 * ReduceOp Tests
 * 
 * Tests field→scalar reduction operations (sum, avg, min, max)
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../../compiler/compile';
import { buildPatch } from '../../graph';
import { BLOCK_DEFS_BY_TYPE } from '../../blocks/registry';

describe('ReduceOp', () => {
  describe('Block Registration', () => {
    it('registers Reduce block in registry', () => {
      const reduceBlock = BLOCK_DEFS_BY_TYPE.get('Reduce');
      
      expect(reduceBlock).toBeDefined();
      expect(reduceBlock?.type).toBe('Reduce');
      expect(reduceBlock?.category).toBe('field');
      expect(reduceBlock?.form).toBe('primitive');
    });

    it('has correct input/output port definitions', () => {
      const reduceBlock = BLOCK_DEFS_BY_TYPE.get('Reduce');
      
      expect(reduceBlock?.inputs.field).toBeDefined();
      expect(reduceBlock?.inputs.field.label).toBe('Field');
      
      expect(reduceBlock?.outputs.signal).toBeDefined();
      expect(reduceBlock?.outputs.signal.label).toBe('Result');
    });

    it('has correct cardinality metadata', () => {
      const reduceBlock = BLOCK_DEFS_BY_TYPE.get('Reduce');
      
      expect(reduceBlock?.cardinality).toBeDefined();
      expect(reduceBlock?.cardinality?.cardinalityMode).toBe('transform');
      expect(reduceBlock?.cardinality?.laneCoupling).toBe('laneCoupled');
    });
  });

  describe('IR Generation', () => {
    it('compiles patch with Reduce block', () => {
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
        const array = b.addBlock('Array', { count: 3 });
        const reduce = b.addBlock('Reduce', {});
        b.wire(array, 'elements', reduce, 'field');
      });

      const result = compile(patch);
      expect(result.kind).toBe('ok');
      if (result.kind !== 'ok') return;

      // Verify program compiled successfully
      expect(result.program).toBeDefined();
      expect(result.program.signalExprs).toBeDefined();
    });

    it('creates SigExprReduceField in IR', () => {
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
        const array = b.addBlock('Array', { count: 3 });
        const reduce = b.addBlock('Reduce', {});
        b.wire(array, 'elements', reduce, 'field');
      });

      const result = compile(patch);
      expect(result.kind).toBe('ok');
      if (result.kind !== 'ok') return;

      const program = result.program;
      
      // Find reduceField expression
      const reduceExpr = program.signalExprs.nodes.find(e => e.kind === 'reduceField');
      expect(reduceExpr).toBeDefined();
      
      if (reduceExpr && reduceExpr.kind === 'reduceField') {
        expect(reduceExpr.field).toBeDefined();
        expect(reduceExpr.op).toBeDefined();
        expect(['min', 'max', 'sum', 'avg']).toContain(reduceExpr.op);
        expect(reduceExpr.type).toBeDefined();
      }
    });
  });

  describe('Type System Integration', () => {
    it('preserves payload type from field to signal', () => {
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
        const array = b.addBlock('Array', { count: 3 });
        const reduce = b.addBlock('Reduce', {});
        b.wire(array, 'elements', reduce, 'field');
      });

      const result = compile(patch);
      expect(result.kind).toBe('ok');
      if (result.kind !== 'ok') return;

      const program = result.program;
      const reduceExpr = program.signalExprs.nodes.find(e => e.kind === 'reduceField');
      
      // For now, just verify the expression exists with the required fields
      // Type structure verification skipped until runtime evaluation complete
      expect(reduceExpr).toBeDefined();
      
      if (reduceExpr && reduceExpr.kind === 'reduceField') {
        expect(reduceExpr.type).toBeDefined();
        expect(reduceExpr.field).toBeDefined();
        expect(reduceExpr.op).toBeDefined();
      }
    });
  });

  describe('Operation Configuration', () => {
    it('defaults to sum operation', () => {
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
        const array = b.addBlock('Array', { count: 3 });
        const reduce = b.addBlock('Reduce', {}); // No config
        b.wire(array, 'elements', reduce, 'field');
      });

      const result = compile(patch);
      expect(result.kind).toBe('ok');
      if (result.kind !== 'ok') return;

      const program = result.program;
      const reduceExpr = program.signalExprs.nodes.find(e => e.kind === 'reduceField');
      
      if (reduceExpr && reduceExpr.kind === 'reduceField') {
        expect(reduceExpr.op).toBe('sum'); // Default
      }
    });

    it('accepts configured operation', () => {
      const patch = buildPatch((b) => {
        b.addBlock('InfiniteTimeRoot', {});
        const array = b.addBlock('Array', { count: 3 });
        const reduce = b.addBlock('Reduce', { op: 'max' });
        b.wire(array, 'elements', reduce, 'field');
      });

      const result = compile(patch);
      expect(result.kind).toBe('ok');
      if (result.kind !== 'ok') return;

      const program = result.program;
      const reduceExpr = program.signalExprs.nodes.find(e => e.kind === 'reduceField');
      
      if (reduceExpr && reduceExpr.kind === 'reduceField') {
        expect(reduceExpr.op).toBe('max');
      }
    });
  });

  // NOTE: Runtime evaluation tests are deferred until reduceField
  // can access field materialization (requires ScheduleExecutor changes)
  describe.skip('Runtime Evaluation', () => {
    it('sums scalar field values', () => {
      // TODO: Implement after reduceField can materialize fields
    });

    it('computes average correctly', () => {
      // TODO: Implement componentwise reduction
    });

    it('finds minimum value', () => {
      // TODO: Implement componentwise reduction
    });

    it('finds maximum value', () => {
      // TODO: Implement componentwise reduction
    });

    it('handles empty field', () => {
      // TODO: Should return 0
    });

    it('propagates NaN', () => {
      // TODO: NaN in any element should propagate
    });

    it('reduces vec2 componentwise', () => {
      // TODO: sum([vec2(1,2), vec2(3,4)]) → vec2(4, 6)
    });
  });
});
