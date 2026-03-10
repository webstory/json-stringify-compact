import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

function roundtrip(output: string): unknown {
  return JSON.parse(output);
}

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
