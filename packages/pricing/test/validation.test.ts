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
