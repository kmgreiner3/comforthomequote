import type { ShingleKey, ShingleProduct } from './types';

export const SHINGLES: Record<ShingleKey, ShingleProduct> = {
  'iko-cambridge': {
    key: 'iko-cambridge',
    name: 'IKO Cambridge',
    tier: 'BETTER',
    tagline: 'Dependable Performance. Excellent Value.',
    highlights: [
      'Class 3 impact resistance classification',
      '110 MPH Limited Wind Warranty',
      'Up to 130 MPH Limited High-Wind Warranty when installed according to applicable IKO requirements*',
      'Class A fire resistance',
      'Limited Lifetime manufacturer warranty*',
      '10-year Iron Clad Protection period*',
    ],
    minimumSq: 5,
    minimumPrice: 4750,
    bands: [
      { upToSq: 10, ratePerSq: 450 },
      { upToSq: 24, ratePerSq: 357.142857 },
      { upToSq: 35, ratePerSq: 436.363636 },
      { upToSq: 50, ratePerSq: 380 },
      { upToSq: 65, ratePerSq: 350 },
      { upToSq: 80, ratePerSq: 325 },
      { upToSq: 100, ratePerSq: 300 },
    ],
    colors: [
      'Dual Black', 'Dual Grey', 'Dual Brown', 'Weatherwood', 'Charcoal Grey',
      'Beachwood', 'Harvard Slate', 'Earthtone Cedar', 'Driftwood', 'Dove White',
    ],
    workmanshipYears: { synthetic: 5, 'peel-stick': 10 },
  },
  'tamko-titan-xt': {
    key: 'tamko-titan-xt',
    name: 'TAMKO Titan XT',
    tier: 'BEST',
    tagline: 'Enhanced Protection. Premium Performance.',
    highlights: [
      'UL 2218 Class 3 impact resistance',
      '110 MPH standard Limited Wind Warranty',
      'Up to 160 MPH Limited Wind Warranty when installed according to applicable TAMKO high-wind requirements*',
      'Limited Lifetime manufacturer warranty*',
      '10-year Full Start non-prorated warranty period*',
    ],
    minimumSq: 5,
    minimumPrice: 5000,
    bands: [
      { upToSq: 10, ratePerSq: 500 },
      { upToSq: 24, ratePerSq: 407.142857 },
      { upToSq: 35, ratePerSq: 472.727273 },
      { upToSq: 50, ratePerSq: 440 },
      { upToSq: 65, ratePerSq: 400 },
      { upToSq: 80, ratePerSq: 375 },
      { upToSq: 100, ratePerSq: 350 },
    ],
    colors: [
      'Black Walnut', 'Natural Timber', 'Thunderstorm Grey', 'Desert Sand',
      'Glacier White', 'Olde English Pewter', 'Oxford Grey', 'Rustic Black',
      'Rustic Cedar', 'Rustic Hickory', 'Rustic Slate', 'Shadow Grey',
      'Virginia Slate', 'Weathered Wood',
    ],
    workmanshipYears: { synthetic: 10, 'peel-stick': 15 },
  },
};

// Education pages only — NOT configurator-priced (tier cliffs; see docs/client/pricing-rules.md).
export const METAL = {
  name: 'Tri State 26-Gauge Standing Seam',
  tiers: [
    { maxSq: 5, ratePerSq: 1300 },
    { maxSq: 15, ratePerSq: 1200 },
    { maxSq: 25, ratePerSq: 900 },
    { maxSq: 35, ratePerSq: 850 },
    { maxSq: Infinity, ratePerSq: 800 },
  ],
  gauge24UpchargePerSq: 50,
  guaranteeYears: 50,
  manufacturerWarrantyYears: 40,
} as const;

export const TILE = {
  name: 'Eagle Tile',
  ratePerSq: 1300,
  guaranteeYears: 20,
  manufacturerWarranty: 'Lifetime transferable Limited Warranty',
} as const;
