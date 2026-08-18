import { describe, it, expect } from 'vitest';
import { priceShingle, titanUpgrade, configuredTotal } from '../src/price';

const IKO_ANCHORS: Array<[number, number]> = [
  [5, 4750], [10, 7000], [24, 12000], [35, 16800],
  [50, 22500], [65, 27750], [80, 32625], [100, 38625],
];
const TITAN_ANCHORS: Array<[number, number]> = [
  [5, 5000], [10, 7500], [24, 13200], [35, 18400],
  [50, 25000], [65, 31000], [80, 36625], [100, 43625],
];

describe('client anchor prices (golden, from docs/client/pricing-rules.md)', () => {
  it.each(IKO_ANCHORS)('IKO Cambridge %d SQ = $%d', (sq, price) => {
    expect(priceShingle(sq, 'iko-cambridge')).toBe(price);
  });
  it.each(TITAN_ANCHORS)('Titan XT %d SQ = $%d', (sq, price) => {
    expect(priceShingle(sq, 'tamko-titan-xt')).toBe(price);
  });
});

describe('progressive behavior', () => {
  it('applies the minimum for tiny roofs', () => {
    expect(priceShingle(3, 'iko-cambridge')).toBe(4750);
    expect(priceShingle(0.5, 'tamko-titan-xt')).toBe(5000);
  });
  it('prices fractional measurements exactly, rounding UP at the end', () => {
    // IKO 27.43: 4750 + 5×450 + 14×357.142857 + 3.43×436.363636 = 13496.727… → 13497
    expect(priceShingle(27.43, 'iko-cambridge')).toBe(13497);
    // Titan 27.43: 5000 + 5×500 + 14×407.142857 + 3.43×472.727273 = 14821.454… → 14822
    expect(priceShingle(27.43, 'tamko-titan-xt')).toBe(14822);
  });
  it('computes the Titan upgrade as the difference of rounded totals', () => {
    expect(titanUpgrade(24)).toBe(1200);       // 13200 - 12000 (client example)
    expect(titanUpgrade(27.43)).toBe(1325);    // 14822 - 13497
  });
  it('continues the last band rate beyond 100 SQ', () => {
    expect(priceShingle(110, 'iko-cambridge')).toBe(38625 + 10 * 300);
  });
  it('is monotonic non-decreasing across band edges', () => {
    for (const key of ['iko-cambridge', 'tamko-titan-xt'] as const) {
      let prev = 0;
      for (let sq = 1; sq <= 105; sq += 0.5) {
        const p = priceShingle(sq, key);
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });
  it('configuredTotal adds the peel & stick upgrade', () => {
    expect(configuredTotal(24, 'iko-cambridge', 'synthetic')).toBe(12000);
    expect(configuredTotal(24, 'iko-cambridge', 'peel-stick')).toBe(13200); // 12000 + 24×50
  });
  it('rejects out-of-domain sizes', () => {
    for (const bad of [0, -3, Number.NaN, 201]) {
      expect(() => priceShingle(bad, 'iko-cambridge')).toThrow(RangeError);
    }
  });
});
