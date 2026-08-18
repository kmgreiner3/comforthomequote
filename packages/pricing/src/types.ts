export type ShingleKey = 'iko-cambridge' | 'tamko-titan-xt';
export type Underlayment = 'synthetic' | 'peel-stick';
export type ProtectionLevel = 'BETTER' | 'BETTER+' | 'BEST' | 'BEST+';

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
  workmanshipYears: Record<Underlayment, number>;
}
