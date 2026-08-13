export type Material = 'threeTab' | 'architectural' | 'metal' | 'tile';
export type PitchClass = 'walkable' | 'steep' | 'verySteep';
export type Complexity = 'simple' | 'average' | 'cutUp';

export interface RoofInput {
  areaSqft: number;      // total roof surface area, sq ft
  pitchDeg: number;      // dominant pitch, degrees
  stories: 1 | 2 | 3;
  complexity: Complexity;
  county: string;        // e.g. "Hillsborough"; unknown counties use config default
  hvhz: boolean;         // Miami-Dade / Broward high-velocity hurricane zone
}

export interface Selections {
  material: Material;
  underlaymentUpgrade: boolean;
  ridgeVent: boolean;
  skylights: number;     // count, ≥ 0
  gutterLf: number;      // linear feet, ≥ 0
  solarReady: boolean;
}

export interface LineItem {
  key: string;           // stable id: materials|labor|underlayment|ridgeVent|skylights|gutters|solarReady|permit|disposal
  label: string;         // display text
  amount: number;        // whole USD
}

export interface Estimate {
  configVersion: string;
  squares: number;       // roofing squares incl. waste, 1 decimal
  lineItems: LineItem[];
  subtotal: number;      // whole USD, sum of line items
  low: number;           // subtotal - band, rounded to $100
  high: number;          // subtotal + band, rounded to $100
}

export interface PricingConfig {
  version: string;
  wastePct: Record<Complexity, number>;          // integer %
  materialPerSquare: Record<Material, number>;   // material-only $/square
  laborPerSquare: Record<PitchClass, number>;    // $/square
  storiesFactorPct: Record<'1' | '2' | '3', number>; // integer %, 100 = ×1.0
  pitchBreaksDeg: { steepFrom: number; verySteepFrom: number };
  permitByCounty: Record<string, number> & { default: number }; // must include "default"
  hvhzPct: number;                               // integer %
  disposalPerSquare: number;
  underlaymentUpgradePerSquare: number;
  ridgeVentFlat: number;
  perSkylight: number;
  gutterPerLf: number;
  solarReadyFlat: number;
  marginPct: number;                             // integer %
  bandPct: number;                               // integer %, estimate range ±
}
