import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the output and re-stringify with native JSON to check structural equality. */
function roundtrip(output: string): unknown {
  return JSON.parse(output);
}

// ---------------------------------------------------------------------------
// Basic serialization (no options)
// ---------------------------------------------------------------------------

describe('basic serialization', () => {
  it('serializes primitives', () => {
    expect(stringifyCompact(null)).toBe('null');
    expect(stringifyCompact(true)).toBe('true');
    expect(stringifyCompact(false)).toBe('false');
    expect(stringifyCompact('hello')).toBe('"hello"');
    expect(stringifyCompact(42)).toBe('42');
    expect(stringifyCompact(0)).toBe('0');
    expect(stringifyCompact(-7)).toBe('-7');
  });

  it('serializes empty structures', () => {
    expect(stringifyCompact([])).toBe('[]');
    expect(stringifyCompact({})).toBe('{}');
  });

  it('preserves full floating-point precision by default', () => {
    expect(stringifyCompact(1.23456789)).toBe('1.23456789');
  });

  it('serializes a flat object', () => {
    expect(roundtrip(stringifyCompact({ a: 1, b: 'x', c: true }))).toEqual({
      a: 1,
      b: 'x',
      c: true,
    });
  });

  it('serializes nested objects', () => {
    const data = { outer: { inner: { value: 1.5 } } };
    expect(roundtrip(stringifyCompact(data))).toEqual(data);
  });

  it('serializes arrays of primitives', () => {
    expect(stringifyCompact([1, 2, 3])).toBe('[1,2,3]');
  });

  it('serializes arrays of objects', () => {
    const data = [{ a: 1 }, { a: 2 }];
    expect(roundtrip(stringifyCompact(data))).toEqual(data);
  });

  it('serializes mixed nested structure', () => {
    const data = { list: [{ x: 1.1, y: 2.2 }, { x: 3.3, y: 4.4 }] };
    expect(roundtrip(stringifyCompact(data))).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// defaultDecimals
// ---------------------------------------------------------------------------

describe('defaultDecimals', () => {
  it('applies to all numbers when no rules are given', () => {
    const result = stringifyCompact({ a: 1.23456, b: 9.99999 }, { defaultDecimals: 2 });
    expect(roundtrip(result)).toEqual({ a: 1.23, b: 10 });
  });

  it('pads trailing zeros', () => {
    expect(stringifyCompact({ v: 1.5 }, { defaultDecimals: 4 })).toBe('{"v":1.5000}');
  });

  it('applies to numbers inside arrays', () => {
    const result = stringifyCompact([1.111, 2.222, 3.333], { defaultDecimals: 1 });
    expect(roundtrip(result)).toEqual([1.1, 2.2, 3.3]);
  });

  it('does not affect non-numeric values', () => {
    const result = stringifyCompact({ n: 1.5, s: 'hello', b: true, nil: null }, { defaultDecimals: 0 });
    expect(roundtrip(result)).toEqual({ n: 2, s: 'hello', b: true, nil: null });
  });
});

// ---------------------------------------------------------------------------
// Path rules — single-segment wildcard (*)
// ---------------------------------------------------------------------------

describe('rules — * (single segment)', () => {
  it('matches all direct children of an object', () => {
    const data = { a: 1.999, b: 2.999, c: 3.999 };
    const result = stringifyCompact(data, { rules: [{ path: '*', decimals: 1 }] });
    expect(roundtrip(result)).toEqual({ a: 2.0, b: 3.0, c: 4.0 });
  });

  it('matches direct children of a named key', () => {
    const data = { metrics: { cpu: 0.98765, mem: 0.51234 }, version: 1.23456 };
    const result = stringifyCompact(data, {
      rules: [{ path: 'metrics.*', decimals: 2 }],
    });
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.metrics.cpu).toBeCloseTo(0.99, 5);
    expect(parsed.metrics.mem).toBeCloseTo(0.51, 5);
    expect(parsed.version).toBe(1.23456); // unaffected
  });

  it('does not match grandchildren', () => {
    const data = { a: { b: { v: 1.23456 } } };
    const result = stringifyCompact(data, { rules: [{ path: 'a.*', decimals: 1 }] });
    // a.b is an object — not a number, so decimals not applied to it
    // a.b.v is a grandchild, should be unaffected
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.a.b.v).toBe(1.23456);
  });
});

// ---------------------------------------------------------------------------
// Path rules — array index wildcard ([*])
// ---------------------------------------------------------------------------

describe('rules — [*] (array index)', () => {
  it('matches every element in a named array', () => {
    const data = { readings: [1.23456, 2.34567, 3.45678] };
    const result = stringifyCompact(data, {
      rules: [{ path: 'readings[*]', decimals: 1 }],
    });
    expect(roundtrip(result)).toEqual({ readings: [1.2, 2.3, 3.5] });
  });

  it('matches elements in a root-level array with *', () => {
    const result = stringifyCompact([0.111, 0.222], {
      rules: [{ path: '[*]', decimals: 2 }],
    });
    expect(roundtrip(result)).toEqual([0.11, 0.22]);
  });

  it('matches numeric fields inside array objects', () => {
    const data = { items: [{ v: 1.23456 }, { v: 2.34567 }] };
    const result = stringifyCompact(data, {
      rules: [{ path: 'items[*].v', decimals: 1 }],
    });
    expect(roundtrip(result)).toEqual({ items: [{ v: 1.2 }, { v: 2.3 }] });
  });
});

// ---------------------------------------------------------------------------
// Path rules — deep wildcard (**)
// ---------------------------------------------------------------------------

describe('rules — ** (any depth)', () => {
  it('matches a key at any nesting level', () => {
    const data = {
      a: { value: 1.23456 },
      b: { c: { value: 2.34567 } },
    };
    const result = stringifyCompact(data, {
      rules: [{ path: '**.value', decimals: 2 }],
    });
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.a.value).toBeCloseTo(1.23, 5);
    expect(parsed.b.c.value).toBeCloseTo(2.35, 5);
  });

  it('matches all numbers at any depth when used alone', () => {
    const data = { a: 1.999, b: { c: 2.999 } };
    const result = stringifyCompact(data, {
      rules: [{ path: '**', decimals: 0 }],
    });
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.a).toBe(2);
    expect(parsed.b.c).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Rule precedence (later rules win)
// ---------------------------------------------------------------------------

describe('rule precedence', () => {
  it('later rule overrides earlier rule for the same path', () => {
    const data = { metrics: { cpu: 0.987654 } };
    const result = stringifyCompact(data, {
      rules: [
        { path: 'metrics.*', decimals: 4 },
        { path: 'metrics.cpu', decimals: 1 }, // more specific, wins
      ],
    });
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.metrics.cpu).toBeCloseTo(1.0, 5);
  });

  it('specific rule overrides defaultDecimals', () => {
    const data = { a: 1.23456, b: 1.23456 };
    const result = stringifyCompact(data, {
      defaultDecimals: 4,
      rules: [{ path: 'b', decimals: 1 }],
    });
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.a).toBeCloseTo(1.2346, 4);
    expect(parsed.b).toBeCloseTo(1.2, 5);
  });
});

// ---------------------------------------------------------------------------
// Pretty-printed output (space option)
// ---------------------------------------------------------------------------

describe('space option', () => {
  it('produces compact output by default (space: 0)', () => {
    const result = stringifyCompact({ a: 1, b: [2, 3] });
    expect(result).not.toContain('\n');
    expect(result).not.toContain(' ');
  });

  it('produces indented output with space: 2', () => {
    const result = stringifyCompact({ a: 1 }, { space: 2 });
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('pretty output parses to the same structure as compact', () => {
    const data = { a: 1.5, b: [2.5, 3.5], c: { d: 4.5 } };
    const compact = stringifyCompact(data, { defaultDecimals: 1 });
    const pretty = stringifyCompact(data, { defaultDecimals: 1, space: 2 });
    expect(roundtrip(compact)).toEqual(roundtrip(pretty));
  });

  it('applies decimal rules in pretty mode', () => {
    const result = stringifyCompact(
      { v: 1.23456 },
      { rules: [{ path: 'v', decimals: 2 }], space: 2 },
    );
    expect(result).toContain('1.23');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles deeply nested arrays', () => {
    const data = { matrix: [[1.111, 2.222], [3.333, 4.444]] };
    const result = stringifyCompact(data, {
      rules: [{ path: 'matrix[*][*]', decimals: 1 }],
    });
    expect(roundtrip(result)).toEqual({ matrix: [[1.1, 2.2], [3.3, 4.4]] });
  });

  it('handles integer numbers without adding unnecessary decimals', () => {
    expect(stringifyCompact(42)).toBe('42');
    expect(stringifyCompact({ n: 42 })).toBe('{"n":42}');
  });

  it('handles special float values', () => {
    // JSON.stringify returns null for Infinity and NaN
    expect(stringifyCompact(Infinity)).toBe('null');
    expect(stringifyCompact(NaN)).toBe('null');
  });

  it('handles null values inside objects and arrays', () => {
    expect(roundtrip(stringifyCompact({ a: null, b: [null, 1] }))).toEqual({
      a: null,
      b: [null, 1],
    });
  });

  it('handles string values that look like numbers', () => {
    expect(stringifyCompact({ v: '1.23' }, { defaultDecimals: 0 })).toBe('{"v":"1.23"}');
  });

  it('handles zero decimals (rounds to integer)', () => {
    const result = stringifyCompact({ v: 2.9 }, { defaultDecimals: 0 });
    expect(roundtrip(result)).toEqual({ v: 3 });
  });

  it('returns valid JSON for a complex mixed structure', () => {
    const data = {
      id: 'abc',
      score: 0.987654,
      tags: ['x', 'y'],
      meta: { created: '2026-01-01', weight: 1.23456 },
    };
    const result = stringifyCompact(data, { defaultDecimals: 2 });
    expect(() => JSON.parse(result)).not.toThrow();
    expect(roundtrip(result)).toMatchObject({ id: 'abc', tags: ['x', 'y'] });
  });
});
