import { describe, it, expect } from 'vitest';
import {
  roundUpDollars, guarantee, solarCost, estimatedMonthly,
  cashPrice, sqFromOutline, deckingAdjustment,
} from '../src/price';
import { SHINGLES } from '../src/products';

describe('roundUpDollars (client rule 7)', () => {
  it.each([
    [13061.01, 13062], [13061.99, 13062], [13061.0, 13061], [0.01, 1],
  ])('%f → %d', (x, expected) => expect(roundUpDollars(x)).toBe(expected));
});

describe('solar add on (feedback round 8, $200 per panel)', () => {
  it('client example: 12 panels is $2,400', () => expect(solarCost(12)).toBe(2400));
  it('accepts the boundary values 0 and 60 panels', () => {
    expect(solarCost(0)).toBe(0);
    expect(solarCost(60)).toBe(12000); // 60 x 200
  });
  it.each([-1, 61, 2.5])('rejects a panel count outside the valid integer range: %s', (bad) => {
    expect(() => solarCost(bad)).toThrow(RangeError);
  });
});

describe('guarantee matrix (feedback round 8: keyed on shingle only)', () => {
  it.each([
    ['iko-cambridge', 'BETTER', 5],
    ['tamko-titan-xt', 'BEST', 10],
  ] as const)('%s = %s / %d years', (key, level, years) => {
    expect(guarantee(key)).toEqual({ level, years });
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
