/**
 * Expression DSL Integration Tests
 *
 * End-to-end tests for compileExpression() public API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileExpression } from '../index';
import { canonicalType, floatConst, intConst, boolConst, vec3Const, colorConst } from '../../core/canonical-types';
import { FLOAT, INT, BOOL, VEC3, COLOR } from '../../core/canonical-types';
import { IRBuilderImpl } from '../../compiler/ir/IRBuilderImpl';
import { extractSigExpr } from '../../__tests__/ir-test-helpers';

describe('compileExpression Integration', () => {
  let builder: IRBuilderImpl;

  beforeEach(() => {
    builder = new IRBuilderImpl();
  });

  it('compiles literal expression', () => {
    const result = compileExpression(
      '42',
      new Map(),
      builder,
      new Map()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const sigExpr = extractSigExpr(builder, result.value);
      expect(sigExpr?.kind).toBe('const');
      expect((sigExpr as any)?.value).toBe(42);
    }
  });

  it('compiles identifier expression', () => {
    // Create an input signal
    const inputSig = builder.sigConst(intConst(10), canonicalType(INT));

    // Compile expression that references it
    const result = compileExpression(
      'x',
      new Map([['x', canonicalType(INT)]]),
      builder,
      new Map([['x', inputSig]])
    );

    if (!result.ok) {
      console.error('Compilation failed:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should return the input signal ID unchanged
      expect(result.value).toBe(inputSig);
    }
  });

  it('compiles binary operation', () => {
    // Create input signals
    const aSig = builder.sigConst(intConst(5), canonicalType(INT));
    const bSig = builder.sigConst(intConst(3), canonicalType(INT));

    // Compile expression
    const result = compileExpression(
      'a + b',
      new Map([
        ['a', canonicalType(INT)],
        ['b', canonicalType(INT)],
      ]),
      builder,
      new Map([
        ['a', aSig],
        ['b', bSig],
      ])
    );

    if (!result.ok) {
      console.error('Compilation failed:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sigExpr = extractSigExpr(builder, result.value);
      expect(sigExpr?.kind).toBe('zip'); // Binary ops use zip
    }
  });

  it('compiles function call', () => {
    // Create input signal
    const xSig = builder.sigConst(floatConst(0), canonicalType(FLOAT));

    // Compile expression
    const result = compileExpression(
      'sin(x)',
      new Map([['x', canonicalType(FLOAT)]]),
      builder,
      new Map([['x', xSig]])
    );

    if (!result.ok) {
      console.error('Compilation failed:', result.error);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sigExpr = extractSigExpr(builder, result.value);
      expect(sigExpr?.kind).toBe('map'); // Functions use map
    }
  });

  it('returns error for syntax error', () => {
    const result = compileExpression(
      'x +',
      new Map([['x', canonicalType(INT)]]),
      builder,
      new Map([['x', builder.sigConst(intConst(1), canonicalType(INT))]])
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ExprSyntaxError');
    }
  });

  it('returns error for type error', () => {
    // bool + bool is not allowed - arithmetic requires numeric types
    const result = compileExpression(
      'x + y',
      new Map([
        ['x', canonicalType(BOOL)],
        ['y', canonicalType(BOOL)],
      ]),
      builder,
      new Map([
        ['x', builder.sigConst(boolConst(false), canonicalType(BOOL))],
        ['y', builder.sigConst(boolConst(false), canonicalType(BOOL))],
      ])
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ExprTypeError');
    }
  });

  it('returns error for undefined identifier', () => {
    const result = compileExpression(
      'foo',
      new Map(), // No inputs defined
      builder,
      new Map()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ExprTypeError'); // Type checker catches undefined identifiers
    }
  });

  describe('Component Access (Swizzle)', () => {
    it('compiles vec3.x to extraction kernel (single component)', () => {
      // Note: At signal level, vec3 is represented as a reference to a multi-slot value.
      // For this test, we create a placeholder signal with vec3 type.
      const vSig = builder.sigConst(vec3Const(0, 0, 0), canonicalType(VEC3)); // Placeholder

      const result = compileExpression(
        'v.x',
        new Map([['v', canonicalType(VEC3)]]),
        builder,
        new Map([['v', vSig]])
      );

      if (!result.ok) {
        console.error('Compilation failed:', result.error);
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        const sigExpr = extractSigExpr(builder, result.value);
        expect(sigExpr?.kind).toBe('map'); // Extraction uses sigMap
      }
    });

    it('compiles color.r to extraction kernel', () => {
      const cSig = builder.sigConst(colorConst(0, 0, 0, 1), canonicalType(COLOR)); // Placeholder

      const result = compileExpression(
        'c.r',
        new Map([['c', canonicalType(COLOR)]]),
        builder,
        new Map([['c', cSig]])
      );

      if (!result.ok) {
        console.error('Compilation failed:', result.error);
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        const sigExpr = extractSigExpr(builder, result.value);
        expect(sigExpr?.kind).toBe('map');
      }
    });

    it('compiles expressions with single-component extraction', () => {
      const vSig = builder.sigConst(vec3Const(0, 0, 0), canonicalType(VEC3));

      const result = compileExpression(
        'v.x + v.y',
        new Map([['v', canonicalType(VEC3)]]),
        builder,
        new Map([['v', vSig]])
      );

      if (!result.ok) {
        console.error('Compilation failed:', result.error);
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        const sigExpr = extractSigExpr(builder, result.value);
        expect(sigExpr?.kind).toBe('zip'); // Addition uses zip
      }
    });

    it('compiles function call on extracted component', () => {
      const vSig = builder.sigConst(vec3Const(0, 0, 0), canonicalType(VEC3));

      const result = compileExpression(
        'sin(v.x)',
        new Map([['v', canonicalType(VEC3)]]),
        builder,
        new Map([['v', vSig]])
      );

      if (!result.ok) {
        console.error('Compilation failed:', result.error);
      }
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should compile successfully - sin operates on the extracted float
        const sigExpr = extractSigExpr(builder, result.value);
        expect(sigExpr?.kind).toBe('map'); // sin uses map
      }
    });

    it('compiles multi-component swizzle (field-level only)', () => {
      // Multi-component swizzle (.xy, .rgb) compiles successfully but is
      // FIELD-LEVEL ONLY. Signal-level execution is not yet supported.
      // See WORK-EVALUATION-20260127-181500.md for details.
      const vSig = builder.sigConst(vec3Const(0, 0, 0), canonicalType(VEC3));

      const result = compileExpression(
        'v.xy',
        new Map([['v', canonicalType(VEC3)]]),
        builder,
        new Map([['v', vSig]])
      );

      if (!result.ok) {
        console.error('Compilation failed:', result.error);
      }
      // Should compile (type-check and IR generation work)
      expect(result.ok).toBe(true);
      // Note: Runtime execution would fail at signal level due to makeVec2Sig
      // throwing "not yet supported". This is documented as field-level only.
    });

    it('returns error for invalid component', () => {
      const vSig = builder.sigConst(vec3Const(0, 0, 0), canonicalType(VEC3));

      const result = compileExpression(
        'v.w', // vec3 has no 4th component
        new Map([['v', canonicalType(VEC3)]]),
        builder,
        new Map([['v', vSig]])
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ExprTypeError');
        expect(result.error.message).toMatch(/has no component 'w'/);
      }
    });

    it('returns error for component access on non-vector', () => {
      const fSig = builder.sigConst(floatConst(1.0), canonicalType(FLOAT));

      const result = compileExpression(
        'f.x', // float not a vector type
        new Map([['f', canonicalType(FLOAT)]]),
        builder,
        new Map([['f', fSig]])
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ExprTypeError');
        expect(result.error.message).toMatch(/not a vector type/);
      }
    });
  });
});
