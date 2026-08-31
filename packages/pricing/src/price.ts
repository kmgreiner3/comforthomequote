import type { ProtectionLevel, ShingleKey } from './types';
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

// Feedback round 8: peel & stick is now the standard underlayment on every
// quote (synthetic is discontinued), so its per-SQ cost is baked directly
// into configuredTotal below rather than exposed as a separate opt-in
// upgrade. The rate stays internal, not part of the public API.
const PEEL_STICK_PER_SQ = 50;

function peelStickCost(sq: number): number {
  if (!(sq > 0) || sq > 200) throw new RangeError('sq must be in (0, 200]');
  return roundUpDollars(sq * PEEL_STICK_PER_SQ);
}

// Feedback round 8: solar panel removal (before the project) and reinstall
// (after) by a licensed solar contractor, at a flat $200 per panel. The
// homeowner-entered panel count is an integer from 0 (no panels) to 60.
export function solarCost(panels: number): number {
  if (!Number.isInteger(panels) || panels < 0 || panels > 60) {
    throw new RangeError('panels must be an integer in [0, 60]');
  }
  return panels * 200;
}

export function configuredTotal(sq: number, key: ShingleKey, solarPanels = 0): number {
  return priceShingle(sq, key) + peelStickCost(sq) + solarCost(solarPanels);
}

// Feedback round 8: guarantee is keyed on the shingle alone. Peel & stick no
// longer changes the workmanship years since it is standard for everyone.
export function guarantee(key: ShingleKey): { level: ProtectionLevel; years: number } {
  const p = SHINGLES[key];
  return { level: p.tier, years: p.workmanshipYears };
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
