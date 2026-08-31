import type { ShingleKey } from '@chq/pricing';

// Feedback round 8: manufacturer warranty line shown on the Shingle step's
// cards and the Review step's guarantee summary -- kept in one place so the
// two can't drift.
export const MANUFACTURER_WARRANTY_LINE: Record<ShingleKey, string> = {
  'iko-cambridge': 'IKO Limited Lifetime manufacturer warranty*',
  'tamko-titan-xt': 'TAMKO Limited Lifetime manufacturer warranty*',
};
