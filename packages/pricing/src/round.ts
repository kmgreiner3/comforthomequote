// Client rule 7: final prices ALWAYS round up to the nearest whole dollar.
// The epsilon keeps exact-dollar floats (e.g. 13061.000000000002) from bumping up.
export function roundUpDollars(x: number): number {
  return Math.ceil(x - 1e-6);
}
