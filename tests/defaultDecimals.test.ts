import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

function roundtrip(output: string): unknown {
  return JSON.parse(output);
}

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

  it('preserves integers as integers even when defaultDecimals is set', () => {
    const result = stringifyCompact({ n: 42, f: 1.5 }, { defaultDecimals: 2 });
    expect(result).toBe('{"n":42,"f":1.50}');
  });

  it('preserves integers inside arrays even when defaultDecimals is set', () => {
    const result = stringifyCompact([1, 2.5, 3], { defaultDecimals: 2 });
    expect(result).toBe('[1,2.50,3]');
  });

  it('path rule overrides integer-preservation and applies toFixed', () => {
    const result = stringifyCompact({ n: 42 }, { defaultDecimals: 2, rules: [{ path: 'n', decimals: 3 }] });
    expect(result).toBe('{"n":42.000}');
    expect(roundtrip(result)).toEqual({ n: 42 });
  });

  it('mixed object: integers stay as-is, floats get defaultDecimals', () => {
    const data = { count: 10, ratio: 0.333, index: 5, value: 1.23456 };
    const result = stringifyCompact(data, { defaultDecimals: 2 });
    const parsed = roundtrip(result) as typeof data;
    expect(parsed.count).toBe(10);
    expect(parsed.index).toBe(5);
    expect(parsed.ratio).toBeCloseTo(0.33, 5);
    expect(parsed.value).toBeCloseTo(1.23, 5);
  });
});
