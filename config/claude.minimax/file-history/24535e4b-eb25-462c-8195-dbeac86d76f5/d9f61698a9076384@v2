/**
 * Instance Unification Tests
 *
 * Verifies that instance tracking works correctly during field expression
 * composition and at render sinks.
 *
 * Key insight: Intrinsics ARE bound to an instance. The `FieldExprIntrinsic`
 * has `instanceId: InstanceId` because intrinsics provide per-element
 * properties FOR that specific instance. Therefore `inferFieldInstance()`
 * returns the instanceId for intrinsics, NOT undefined.
 *
 * Instance binding:
 * - intrinsic, array, stateRead → return their instanceId (bound to instance)
 * - map, zipSig → propagate from input
 * - zip → unify from inputs (must all be same instance)
 * - const, broadcast → undefined (truly instance-agnostic)
 */

import { describe, it, expect } from 'vitest';
import { IRBuilderImpl } from '../ir/IRBuilderImpl';
import { OpCode } from '../ir/types';
import { signalTypeField, signalTypeSignal, floatConst, intConst, vec2Const } from '../../core/canonical-types';
import { FLOAT, INT, BOOL, VEC2, VEC3, COLOR, SHAPE, CAMERA_PROJECTION } from '../../core/canonical-types';
import { DOMAIN_CIRCLE } from '../../core/domain-registry';

describe('Instance Unification', () => {
  describe('intrinsic field instance inference', () => {
    it('returns instanceId for index intrinsic', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const field = b.fieldIntrinsic(instance, 'index', type);

      // Intrinsics ARE bound to their instance
      expect(b.inferFieldInstance(field)).toBe(instance);
    });

    it('returns instanceId for normalizedIndex intrinsic', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const field = b.fieldIntrinsic(instance, 'normalizedIndex', type);

      expect(b.inferFieldInstance(field)).toBe(instance);
    });

    it('returns instanceId for randomId intrinsic', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const field = b.fieldIntrinsic(instance, 'randomId', type);

      expect(b.inferFieldInstance(field)).toBe(instance);
    });
  });

  describe('instance-agnostic field operations', () => {
    it('returns undefined for broadcast fields', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const sig = b.sigConst(floatConst(1.0), signalTypeSignal(FLOAT));
      const broadcast = b.Broadcast(sig, type);

      // Broadcasts are instance-agnostic
      expect(b.inferFieldInstance(broadcast)).toBeUndefined();
    });

    it('returns undefined for const fields', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const constField = b.fieldConst(floatConst(42), type);

      // Consts are instance-agnostic
      expect(b.inferFieldInstance(constField)).toBeUndefined();
    });
  });

  describe('layout field instance inference', () => {
    it('returns instanceId for kernel-based layout fields', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const floatType = signalTypeField(FLOAT, instance);
      const vec2Type = signalTypeField(VEC2, instance);
      
      // Create normalizedIndex field
      const normalizedIndex = b.fieldIntrinsic(instance, 'normalizedIndex', floatType);
      
      // Create signals for grid dimensions
      const colsSig = b.sigConst(intConst(5), signalTypeSignal(INT));
      const rowsSig = b.sigConst(intConst(2), signalTypeSignal(INT));
      
      // Apply gridLayout kernel
      const layoutField = b.fieldZipSig(
        normalizedIndex,
        [colsSig, rowsSig],
        { kind: 'kernel', name: 'gridLayout' },
        vec2Type
      );

      expect(b.inferFieldInstance(layoutField)).toBe(instance);
    });
  });

  describe('field composition with intrinsics', () => {
    it('propagates instanceId through map on intrinsic', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const intrinsic = b.fieldIntrinsic(instance, 'index', type);
      const mapped = b.fieldMap(intrinsic, { kind: 'opcode', opcode: OpCode.Sin }, type);

      // Instance propagates from input
      expect(b.inferFieldInstance(mapped)).toBe(instance);
    });

    it('propagates instanceId through zipSig on intrinsic', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const fieldType = signalTypeField(FLOAT, instance);
      const sigType = signalTypeSignal(FLOAT);
      const intrinsic = b.fieldIntrinsic(instance, 'index', fieldType);
      const signal = b.sigConst(floatConst(2.0), sigType);
      const zipped = b.fieldZipSig(intrinsic, [signal], { kind: 'opcode', opcode: OpCode.Mul }, fieldType);

      expect(b.inferFieldInstance(zipped)).toBe(instance);
    });

    it('unifies instance for zip of intrinsics from same instance', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const field1 = b.fieldIntrinsic(instance, 'index', type);
      const field2 = b.fieldIntrinsic(instance, 'normalizedIndex', type);

      const zipped = b.fieldZip([field1, field2], { kind: 'opcode', opcode: OpCode.Add }, type);
      expect(b.inferFieldInstance(zipped)).toBe(instance);
    });

    it('throws error for zip of intrinsics from different instances', () => {
      const b = new IRBuilderImpl();
      const instance1 = b.createInstance(DOMAIN_CIRCLE, 10);
      const instance2 = b.createInstance(DOMAIN_CIRCLE, 20);
      const type1 = signalTypeField(FLOAT, instance1);
      const type2 = signalTypeField(FLOAT, instance2);
      const field1 = b.fieldIntrinsic(instance1, 'index', type1);
      const field2 = b.fieldIntrinsic(instance2, 'index', type2);

      // Zipping fields from different instances should throw
      expect(() => {
        b.fieldZip([field1, field2], { kind: 'opcode', opcode: OpCode.Add }, type1);
      }).toThrow(/Instance mismatch/);
    });

    it('propagates instance through zip of intrinsic and broadcast', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const intrinsic = b.fieldIntrinsic(instance, 'index', type);
      const sig = b.sigConst(floatConst(1.0), signalTypeSignal(FLOAT));
      const broadcast = b.Broadcast(sig, type);

      // Broadcast is instance-agnostic, so zip takes instance from intrinsic
      const zipped = b.fieldZip([intrinsic, broadcast], { kind: 'opcode', opcode: OpCode.Add }, type);
      expect(b.inferFieldInstance(zipped)).toBe(instance);
    });

    it('propagates instance through map after zip of intrinsics', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const field1 = b.fieldIntrinsic(instance, 'index', type);
      const field2 = b.fieldIntrinsic(instance, 'normalizedIndex', type);
      const zipped = b.fieldZip([field1, field2], { kind: 'opcode', opcode: OpCode.Add }, type);
      const mapped = b.fieldMap(zipped, { kind: 'opcode', opcode: OpCode.Sin }, type);

      expect(b.inferFieldInstance(mapped)).toBe(instance);
    });
  });

  describe('multiple broadcasts', () => {
    it('returns undefined for zip of multiple broadcasts (all instance-agnostic)', () => {
      const b = new IRBuilderImpl();
      const instance = b.createInstance(DOMAIN_CIRCLE, 10);
      const type = signalTypeField(FLOAT, instance);
      const sig1 = b.sigConst(floatConst(1.0), signalTypeSignal(FLOAT));
      const sig2 = b.sigConst(floatConst(2.0), signalTypeSignal(FLOAT));
      const broadcast1 = b.Broadcast(sig1, type);
      const broadcast2 = b.Broadcast(sig2, type);

      // Two broadcasts - no instance constraint
      const zipped = b.fieldZip([broadcast1, broadcast2], { kind: 'opcode', opcode: OpCode.Add }, type);
      expect(b.inferFieldInstance(zipped)).toBeUndefined();
    });
  });
});
