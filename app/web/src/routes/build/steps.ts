import type { BuildState } from '../../state/build';

export const STEP_IDS = [
  'address',
  'home',
  'shingle',
  'color',
  'underlayment',
  'protection',
  'included',
  'finishing',
  'review',
] as const;

export type StepId = (typeof STEP_IDS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  address: 'Address',
  home: 'Home',
  shingle: 'Shingle',
  color: 'Color',
  underlayment: 'Underlayment',
  protection: 'Protection',
  included: 'Included',
  finishing: 'Finishing',
  review: 'Review',
};

export function stepIndex(id: StepId): number {
  return STEP_IDS.indexOf(id);
}

export function stepIdFromHash(hash: string): StepId | null {
  const clean = hash.replace(/^#/, '');
  return (STEP_IDS as readonly string[]).includes(clean) ? (clean as StepId) : null;
}

/**
 * Steps that gate purely on a store field (address set, valid sq, shingle
 * chosen, color chosen, drip edge chosen) can be re-derived from the build
 * state alone. Underlayment, protection, and included don't leave a distinct
 * store field behind when their default/no-op path is taken (e.g. picking
 * the already-default STANDARD underlayment), so those three are tracked by
 * `StepFlags`, set when the user continues past that step.
 */
export interface StepFlags {
  underlayment: boolean;
  protection: boolean;
  included: boolean;
}

export const DEFAULT_STEP_FLAGS: StepFlags = {
  underlayment: false,
  protection: false,
  included: false,
};

/** Furthest step index the user has actually earned, given store + flags. */
export function maxAllowedIndex(s: BuildState, flags: StepFlags): number {
  if (!s.address || !s.address.trim()) return stepIndex('address');
  if (s.sq == null) return stepIndex('home');
  if (s.shingle == null) return stepIndex('shingle');
  if (s.color == null) return stepIndex('color');
  if (!flags.underlayment) return stepIndex('underlayment');
  if (!flags.protection) return stepIndex('protection');
  if (!flags.included) return stepIndex('included');
  if (s.dripEdge == null) return stepIndex('finishing');
  return stepIndex('review');
}
