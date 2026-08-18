// Approximate swatch hexes for every shingle color, keyed by the exact color
// strings in `@chq/pricing`'s SHINGLES data. These are tasteful digital
// approximations, not manufacturer-certified colors -- the swatch grid always
// pairs them with SWATCH_NOTE.
//
// Note: this content lives in the web app deliberately. The pricing package
// stays pricing-only (products, bands, math); presentation-only data like
// hex approximations does not belong in a package that other, non-visual
// consumers may depend on.
export const SWATCH_NOTE = 'Digital approximation. Final color from manufacturer samples.';

export const SWATCHES: Record<string, string> = {
  // IKO Cambridge (10)
  'Dual Black': '#2b2b2e',
  'Dual Grey': '#6b6d70',
  'Dual Brown': '#5a4636',
  Weatherwood: '#7a6a55',
  'Charcoal Grey': '#4a4d52',
  Beachwood: '#c9b790',
  'Harvard Slate': '#43494f',
  'Earthtone Cedar': '#8a5a3c',
  Driftwood: '#a89a86',
  'Dove White': '#d8d4c8',

  // TAMKO Titan XT (14)
  'Black Walnut': '#3b2f2a',
  'Natural Timber': '#6e5842',
  'Thunderstorm Grey': '#55585c',
  'Desert Sand': '#c2a877',
  'Glacier White': '#d9dadb',
  'Olde English Pewter': '#5c5b57',
  'Oxford Grey': '#4b4e52',
  'Rustic Black': '#26262a',
  'Rustic Cedar': '#7c4a34',
  'Rustic Hickory': '#6b4a35',
  'Rustic Slate': '#4d5560',
  'Shadow Grey': '#57595c',
  'Virginia Slate': '#3f4448',
  'Weathered Wood': '#6d5f4e',
};

export function swatchHex(color: string): string {
  return SWATCHES[color] ?? '#8a8f98';
}
