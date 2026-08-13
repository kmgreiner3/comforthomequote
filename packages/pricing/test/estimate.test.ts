import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../src/estimate';
import { baseRoof, baseSel } from './fixtures';

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

describe('computeEstimate HVHZ + county + options', () => {
  it('applies HVHZ adder to materials and labor only (Miami-Dade golden case)', () => {
    const e = computeEstimate({ ...baseRoof, county: 'Miami-Dade', hvhz: true }, baseSel);
    expect(item(e, 'materials')).toBe(4688);
    expect(item(e, 'labor')).toBe(5860);
    expect(item(e, 'permit')).toBe(600);
    expect(item(e, 'disposal')).toBe(1645); // unchanged by HVHZ
    expect(e.subtotal).toBe(12793);
  });
  it('falls back to default permit for unknown counties', () => {
    const e = computeEstimate({ ...baseRoof, county: 'Okeechobee' }, baseSel);
    expect(item(e, 'permit')).toBe(400);
  });
  it('prices every option with margin applied', () => {
    const e = computeEstimate(baseRoof, {
      ...baseSel, underlaymentUpgrade: true, ridgeVent: true,
      skylights: 2, gutterLf: 120, solarReady: true,
    });
    expect(item(e, 'underlayment')).toBe(1346); // 23×45=1035 → ×1.3 = 1345.5 → 1346
    expect(item(e, 'ridgeVent')).toBe(845);     // 650 → 845
    expect(item(e, 'skylights')).toBe(1950);    // 1500 → 1950
    expect(item(e, 'gutters')).toBe(1872);      // 1440 → 1872
    expect(item(e, 'solarReady')).toBe(650);    // 500 → 650
  });
  it('is deterministic', () => {
    const a = computeEstimate(baseRoof, baseSel);
    const b = computeEstimate(baseRoof, baseSel);
    expect(a).toEqual(b);
  });
});
