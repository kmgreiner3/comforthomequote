export function monthlyPayment(principal: number, aprPct: number, months: number): number {
  if (principal <= 0) throw new RangeError('principal must be > 0');
  if (months <= 0 || !Number.isInteger(months)) throw new RangeError('months must be a positive integer');
  if (aprPct < 0) throw new RangeError('aprPct must be >= 0');
  const r = aprPct / 100 / 12;
  const raw = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(raw * 100) / 100;
}
