// Money formatting. These are the ONLY functions allowed to render prices:
// never cents, never per-SQ rates.
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function usd(n: number): string {
  return currencyFormatter.format(n);
}

export function perMonth(n: number): string {
  return `${usd(n)}/month`;
}

// Display-only footprint rounding: AUTHORIZED display exception (Kyle,
// 2026-08-25) lets the satellite-measured footprint sq ft show on the
// StepHome confirm card. This must never be used for anything that feeds
// pricing -- the store keeps the exact outlineSqft, and @chq/pricing's
// sqFromOutline() always runs on that unrounded value, never on this.
const sqftFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function roundToNearestFifty(n: number): number {
  return Math.round(n / 50) * 50;
}

// e.g. 2308.32 -> "2,300"
export function formatFootprintSqft(n: number): string {
  return sqftFormatter.format(roundToNearestFifty(n));
}
