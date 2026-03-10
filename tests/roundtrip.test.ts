import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively compare `parsed` against `original`, allowing numeric values to
 * differ by at most half a unit at the given decimal precision (i.e., the
 * rounding error introduced by toFixed(decimals)).
 *
 * For paths where no precision rounding is applied the tolerance is 0 and
 * values must be bit-exact after the roundtrip.
 */
function approxDeepEqual(
  parsed: unknown,
  original: unknown,
  tolerance: number,
): boolean {
  if (typeof original === 'number') {
    if (!isFinite(original)) {
      // Infinity / NaN are serialised as null by JSON spec
      return parsed === null;
    }
    if (Number.isInteger(original)) {
      // Integers should survive the roundtrip exactly
      return parsed === original;
    }
    return (
      typeof parsed === 'number' && Math.abs(parsed - original) <= tolerance
    );
  }

  if (Array.isArray(original)) {
    if (!Array.isArray(parsed) || parsed.length !== original.length) return false;
    return original.every((v, i) => approxDeepEqual(parsed[i], v, tolerance));
  }

  if (original !== null && typeof original === 'object') {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      return false;
    const orig = original as Record<string, unknown>;
    const pars = parsed as Record<string, unknown>;
    return Object.keys(orig).every((k) => approxDeepEqual(pars[k], orig[k], tolerance));
  }

  // primitives: string, boolean, null
  return parsed === original;
}

/** Tolerance for N decimal places: half the last unit of precision. */
function tol(decimals: number): number {
  return 0.5 * Math.pow(10, -decimals);
}

// ---------------------------------------------------------------------------
// Roundtrip tests — no precision loss (defaultDecimals not set)
// ---------------------------------------------------------------------------

describe('roundtrip — no precision loss', () => {
  it('scalar number', () => {
    const v = 3.141592653589793;
    const parsed = JSON.parse(stringifyCompact(v));
    expect(parsed).toBe(v);
  });

  it('flat object with numbers', () => {
    const data = { a: 1.5, b: -0.25, c: 100 };
    const parsed = JSON.parse(stringifyCompact(data));
    expect(parsed).toEqual(data);
  });

  it('nested object', () => {
    const data = { outer: { inner: { value: 1.23456789 } } };
    const parsed = JSON.parse(stringifyCompact(data));
    expect(parsed).toEqual(data);
  });

  it('array of numbers', () => {
    const data = [1.1, 2.2, 3.3, 4.4];
    const parsed = JSON.parse(stringifyCompact(data));
    expect(parsed).toEqual(data);
  });

  it('mixed types survive roundtrip exactly', () => {
    const data = { n: 42, f: 1.5, s: 'hello', b: true, nil: null, arr: [1, 'x'] };
    const parsed = JSON.parse(stringifyCompact(data));
    expect(parsed).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// Roundtrip tests — defaultDecimals applied
// ---------------------------------------------------------------------------

describe('roundtrip — defaultDecimals', () => {
  it('parsed value is within tolerance of original (2 decimals)', () => {
    const data = { x: 1.23456, y: 9.87654 };
    const parsed = JSON.parse(stringifyCompact(data, { defaultDecimals: 2 }));
    expect(approxDeepEqual(parsed, data, tol(2))).toBe(true);
  });

  it('parsed value is within tolerance of original (4 decimals)', () => {
    const data = { pi: 3.14159265, e: 2.71828182 };
    const parsed = JSON.parse(stringifyCompact(data, { defaultDecimals: 4 }));
    expect(approxDeepEqual(parsed, data, tol(4))).toBe(true);
  });

  it('array elements are within tolerance (1 decimal)', () => {
    const data = [0.111, 0.555, 0.999];
    const parsed = JSON.parse(stringifyCompact(data, { defaultDecimals: 1 }));
    expect(approxDeepEqual(parsed, data, tol(1))).toBe(true);
  });

  it('integers survive exactly even when defaultDecimals is set', () => {
    const data = { count: 7, ratio: 0.123456 };
    const parsed = JSON.parse(
      stringifyCompact(data, { defaultDecimals: 3 }),
    ) as typeof data;
    expect(parsed.count).toBe(7);
    expect(Math.abs(parsed.ratio - data.ratio)).toBeLessThanOrEqual(tol(3));
  });

  it('deeply nested structure is within tolerance', () => {
    const data = {
      sensor: {
        temperature: 36.6789,
        humidity: 0.7654,
        readings: [1.11111, 2.22222, 3.33333],
      },
    };
    const parsed = JSON.parse(stringifyCompact(data, { defaultDecimals: 2 }));
    expect(approxDeepEqual(parsed, data, tol(2))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Roundtrip tests — path rules applied
// ---------------------------------------------------------------------------

describe('roundtrip — path rules', () => {
  it('single-segment wildcard: parsed values within tolerance', () => {
    const data = { a: 1.23456, b: 9.87654, c: 0.11111 };
    const parsed = JSON.parse(
      stringifyCompact(data, { rules: [{ path: '*', decimals: 2 }] }),
    );
    expect(approxDeepEqual(parsed, data, tol(2))).toBe(true);
  });

  it('named array [*]: each element within tolerance', () => {
    const data = { readings: [1.23456, 2.34567, 3.45678] };
    const parsed = JSON.parse(
      stringifyCompact(data, { rules: [{ path: 'readings[*]', decimals: 1 }] }),
    );
    expect(approxDeepEqual(parsed, data, tol(1))).toBe(true);
  });

  it('deep wildcard **: all numbers within tolerance', () => {
    const data = { a: 1.9999, b: { c: 2.9999, d: { e: 3.9999 } } };
    const parsed = JSON.parse(
      stringifyCompact(data, { rules: [{ path: '**', decimals: 1 }] }),
    );
    expect(approxDeepEqual(parsed, data, tol(1))).toBe(true);
  });

  it('per-path rules: each field within its own tolerance', () => {
    const data = { coarse: 1.23456, fine: 1.23456 };
    const result = stringifyCompact(data, {
      rules: [
        { path: 'coarse', decimals: 1 },
        { path: 'fine', decimals: 4 },
      ],
    });
    const parsed = JSON.parse(result) as typeof data;
    expect(Math.abs(parsed.coarse - data.coarse)).toBeLessThanOrEqual(tol(1));
    expect(Math.abs(parsed.fine - data.fine)).toBeLessThanOrEqual(tol(4));
  });

  it('unaffected keys survive exactly', () => {
    const data = { metrics: { cpu: 0.98765, mem: 0.51234 }, version: 1.23456 };
    const result = stringifyCompact(data, {
      rules: [{ path: 'metrics.*', decimals: 2 }],
    });
    const parsed = JSON.parse(result) as typeof data;
    // metrics fields: within 2-decimal tolerance
    expect(Math.abs(parsed.metrics.cpu - data.metrics.cpu)).toBeLessThanOrEqual(tol(2));
    expect(Math.abs(parsed.metrics.mem - data.metrics.mem)).toBeLessThanOrEqual(tol(2));
    // version: no rule applied — must be bit-exact
    expect(parsed.version).toBe(data.version);
  });
});

// ---------------------------------------------------------------------------
// Roundtrip tests — special values
// ---------------------------------------------------------------------------

describe('roundtrip — special values', () => {
  it('Infinity serialises to null and parses back as null', () => {
    const parsed = JSON.parse(stringifyCompact(Infinity));
    expect(parsed).toBeNull();
  });

  it('NaN serialises to null and parses back as null', () => {
    const parsed = JSON.parse(stringifyCompact(NaN));
    expect(parsed).toBeNull();
  });

  it('null survives roundtrip', () => {
    expect(JSON.parse(stringifyCompact(null))).toBeNull();
  });

  it('boolean values survive roundtrip', () => {
    expect(JSON.parse(stringifyCompact(true))).toBe(true);
    expect(JSON.parse(stringifyCompact(false))).toBe(false);
  });

  it('string values survive roundtrip unchanged', () => {
    const s = 'hello "world"\n\ttab';
    expect(JSON.parse(stringifyCompact(s))).toBe(s);
  });
});
