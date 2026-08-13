import type { RoofInput, Selections } from '../src/types';

export const baseRoof: RoofInput = {
  areaSqft: 2000, pitchDeg: 20, stories: 1,
  complexity: 'average', county: 'Hillsborough', hvhz: false,
};
export const baseSel: Selections = {
  material: 'architectural', underlaymentUpgrade: false, ridgeVent: false,
  skylights: 0, gutterLf: 0, solarReady: false,
};
