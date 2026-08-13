import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../src/estimate';
import type { RoofInput, Selections } from '../src/types';

export const baseRoof: RoofInput = {
  areaSqft: 2000, pitchDeg: 20, stories: 1,
  complexity: 'average', county: 'Hillsborough', hvhz: false,
};
export const baseSel: Selections = {
  material: 'architectural', underlaymentUpgrade: false, ridgeVent: false,
  skylights: 0, gutterLf: 0, solarReady: false,
};

const item = (e: ReturnType<typeof computeEstimate>, key: string) =>
  e.lineItems.find(li => li.key === key)?.amount;

describe('computeEstimate core', () => {
  it('matches the hand-computed golden case', () => {
    const e = computeEstimate(baseRoof, baseSel);
    expect(e.squares).toBe(23);
    expect(item(e, 'materials')).toBe(4186);
    expect(item(e, 'labor')).toBe(5233);
    expect(item(e, 'permit')).toBe(425);
    expect(item(e, 'disposal')).toBe(1645);
    expect(e.subtotal).toBe(11489);
    expect(e.low).toBe(10600);
    expect(e.high).toBe(12400);
    expect(e.configVersion).toBe('2026-08-13.1');
  });
  it('omits option line items when no options selected', () => {
    const keys = computeEstimate(baseRoof, baseSel).lineItems.map(li => li.key);
    expect(keys).toEqual(['materials', 'labor', 'permit', 'disposal']);
  });
  it('applies stories factor to labor (2-story = +10%)', () => {
    const e = computeEstimate({ ...baseRoof, stories: 2 }, baseSel);
    // 23 × 175 × 110/100 = 4427.5, then margin: ×130/100 = 5755.75 → round = 5756
    expect(item(e, 'labor')).toBe(5756);
  });
  it('uses steep labor rate from pitch degrees', () => {
    const e = computeEstimate({ ...baseRoof, pitchDeg: 30 }, baseSel);
    // 23 × 250 = 5750 → ×1.30 = 7475
    expect(item(e, 'labor')).toBe(7475);
  });
});
