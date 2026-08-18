import type { ProtectionLevel, ShingleKey, Underlayment } from './types';
import { SHINGLES } from './products';
import { roundUpDollars } from './round';

export { roundUpDollars };

export function priceShingle(sq: number, key: ShingleKey): number {
  if (!(sq > 0) || sq > 200) throw new RangeError('sq must be in (0, 200]');
  const p = SHINGLES[key];
  if (sq <= p.minimumSq) return p.minimumPrice;
  let total = p.minimumPrice;
  let prev = p.minimumSq;
  for (const band of p.bands) {
    const portion = Math.min(sq, band.upToSq) - prev;
    if (portion > 0) total += portion * band.ratePerSq;
    prev = band.upToSq;
  }
  const lastBand = p.bands[p.bands.length - 1]!;
  if (sq > prev) total += (sq - prev) * lastBand.ratePerSq;
  return roundUpDollars(total);
}

export function titanUpgrade(sq: number): number {
  return priceShingle(sq, 'tamko-titan-xt') - priceShingle(sq, 'iko-cambridge');
}

export function peelStickUpgrade(sq: number): number {
  if (!(sq > 0) || sq > 200) throw new RangeError('sq must be in (0, 200]');
  return roundUpDollars(sq * 50);
}

export function configuredTotal(sq: number, key: ShingleKey, underlayment: Underlayment): number {
  return priceShingle(sq, key) + (underlayment === 'peel-stick' ? peelStickUpgrade(sq) : 0);
}

export function guarantee(key: ShingleKey, underlayment: Underlayment): { level: ProtectionLevel; years: number } {
  const years = SHINGLES[key].workmanshipYears[underlayment];
  const base = SHINGLES[key].tier;
  const level = (underlayment === 'peel-stick' ? `${base}+` : base) as ProtectionLevel;
  return { level, years };
}

// Client rule of thumb: $10/month for every $1,000 of project cost.
export function estimatedMonthly(total: number): number {
  if (!(total > 0)) throw new RangeError('total must be > 0');
  return Math.ceil(total / 100);
}

export function cashPrice(total: number): number {
  if (!(total > 0)) throw new RangeError('total must be > 0');
  return roundUpDollars(total * 0.95);
}

// Client measuring rule: raw outline × 1.2 (10% waste + 10% pitch), NO rounding.
export function sqFromOutline(outlineSqft: number): number {
  if (!(outlineSqft > 0) || outlineSqft > 20000) throw new RangeError('outlineSqft must be in (0, 20000]');
  return (outlineSqft * 1.2) / 100;
}

export function deckingAdjustment(sheets: number): number {
  if (sheets < 0 || !Number.isInteger(sheets)) throw new RangeError('sheets must be a non-negative integer');
  return Math.max(sheets - 5, 0) * 78;
}
