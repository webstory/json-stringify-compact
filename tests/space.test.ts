import { describe, it, expect } from 'vitest';
import { stringifyCompact } from '../index.ts';

function roundtrip(output: string): unknown {
  return JSON.parse(output);
}

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
