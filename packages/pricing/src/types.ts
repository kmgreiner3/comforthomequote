export type ShingleKey = 'iko-cambridge' | 'tamko-titan-xt';
export type ProtectionLevel = 'BETTER' | 'BEST';

export interface Band {
  upToSq: number;    // band covers (previous upToSq, upToSq]
  ratePerSq: number; // marginal rate for that portion only
}

export interface ShingleProduct {
  key: ShingleKey;
  name: string;
  tier: 'BETTER' | 'BEST';
  tagline: string;
  highlights: string[];
  minimumSq: number;     // roofs at or below this size pay minimumPrice
  minimumPrice: number;
  bands: Band[];         // ascending upToSq, starting above minimumSq
  colors: string[];
  // Feedback round 8: peel & stick is standard for every quote now, so the
  // workmanship guarantee no longer varies by underlayment; a single value.
  workmanshipYears: number;
}
