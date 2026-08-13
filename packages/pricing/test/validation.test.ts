import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../src/estimate';
import { baseRoof, baseSel } from './fixtures';

describe('computeEstimate validation', () => {
  it.each([
    [{ ...baseRoof, areaSqft: 0 }], [{ ...baseRoof, areaSqft: -50 }],
    [{ ...baseRoof, areaSqft: 30001 }], [{ ...baseRoof, pitchDeg: -1 }],
    [{ ...baseRoof, pitchDeg: 61 }],
  ])('rejects bad roof input %j', (roof) => {
    expect(() => computeEstimate(roof, baseSel)).toThrow(RangeError);
  });
  it.each([
    [{ ...baseSel, skylights: -1 }], [{ ...baseSel, skylights: 1.5 }],
    [{ ...baseSel, gutterLf: -10 }],
  ])('rejects bad selections %j', (sel) => {
    expect(() => computeEstimate(baseRoof, sel)).toThrow(RangeError);
  });
});

describe('computeEstimate JSON-boundary hardening', () => {
  it.each([
    [{ ...baseRoof, pitchDeg: Number.NaN }],
    [{ ...baseRoof, stories: 4 as never }],
    [{ ...baseRoof, complexity: 'extreme' as never }],
  ])('rejects out-of-domain roof %j', (roof) => {
    expect(() => computeEstimate(roof, baseSel)).toThrow(RangeError);
  });
  it.each([
    [{ ...baseSel, material: 'slate' as never }],
    [{ ...baseSel, gutterLf: Number.NaN }],
  ])('rejects out-of-domain selections %j', (sel) => {
    expect(() => computeEstimate(baseRoof, sel)).toThrow(RangeError);
  });
});
