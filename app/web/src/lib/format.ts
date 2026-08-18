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
