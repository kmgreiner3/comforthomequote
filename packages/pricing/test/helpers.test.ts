import { describe, it, expect } from 'vitest';
import {
  roundUpDollars, peelStickUpgrade, guarantee, estimatedMonthly,
  cashPrice, sqFromOutline, deckingAdjustment,
} from '../src/price';
import { SHINGLES } from '../src/products';

describe('roundUpDollars (client rule 7)', () => {
  it.each([
    [13061.01, 13062], [13061.99, 13062], [13061.0, 13061], [0.01, 1],
  ])('%f → %d', (x, expected) => expect(roundUpDollars(x)).toBe(expected));
});

describe('peel & stick upgrade', () => {
  it('matches the client worked example: 27.43 SQ → $1,372', () => {
    expect(peelStickUpgrade(27.43)).toBe(1372);
  });
  it('24 SQ → $1,200', () => expect(peelStickUpgrade(24)).toBe(1200));
});

describe('guarantee matrix (client rule 10)', () => {
  it.each([
    ['iko-cambridge', 'synthetic', 'BETTER', 5],
    ['iko-cambridge', 'peel-stick', 'BETTER+', 10],
    ['tamko-titan-xt', 'synthetic', 'BEST', 10],
    ['tamko-titan-xt', 'peel-stick', 'BEST+', 15],
  ] as const)('%s + %s = %s / %d years', (s, u, level, years) => {
    expect(guarantee(s, u)).toEqual({ level, years });
  });
});

describe('financing heuristic ($10 per $1,000) and cash', () => {
  it('client example: $17,000 → $170/month', () => expect(estimatedMonthly(17000)).toBe(170));
  it('rounds partial thousands up: $13,497 → $135/month', () => expect(estimatedMonthly(13497)).toBe(135));
  it('cash is 5% off, rounded up: $12,000 → $11,400', () => expect(cashPrice(12000)).toBe(11400));
});

describe('measurement + decking', () => {
  it('client rule: 2,000 sq ft outline → 24 SQ', () => expect(sqFromOutline(2000)).toBe(24));
  it('does not round: 1,910 sq ft → 22.92 SQ', () => expect(sqFromOutline(1910)).toBeCloseTo(22.92, 10));
  it('client example: 9 sheets → $312', () => expect(deckingAdjustment(9)).toBe(312));
  it('5 or fewer sheets → $0', () => expect(deckingAdjustment(5)).toBe(0));
});

describe('product data', () => {
  it('carries the exact client color lists', () => {
    expect(SHINGLES['iko-cambridge'].colors).toHaveLength(10);
    expect(SHINGLES['tamko-titan-xt'].colors).toHaveLength(14);
    expect(SHINGLES['iko-cambridge'].colors).toContain('Dove White');
    expect(SHINGLES['tamko-titan-xt'].colors).toContain('Olde English Pewter');
  });
});
