import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

function roundtrip(output: string): unknown {
  return JSON.parse(output);
}

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
