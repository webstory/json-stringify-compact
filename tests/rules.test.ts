import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

function roundtrip(output: string): unknown {
  return JSON.parse(output);
}

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
