import type { BuildState } from '../../state/build';

// Feedback round 8: the 9-step flow (address, home, shingle, color,
// underlayment, protection, included, finishing, review) collapses to 5.
// Address is absorbed into Home; color and finishing (drip edge) merge into
// Appearance; underlayment and protection are gone outright now that peel &
// stick is standard for everyone and the guarantee no longer needs its own
// explainer screen.
export const STEP_IDS = ['home', 'shingle', 'appearance', 'included', 'review'] as const;

export type StepId = (typeof STEP_IDS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  home: 'Home',
  shingle: 'Shingle',
  appearance: 'Appearance',
  included: 'Included',
  review: 'Review',
};

export function stepIndex(id: StepId): number {
  return STEP_IDS.indexOf(id);
}

// Old bookmarks/shared links pointing at a now-gone step must still land
// somewhere sane instead of falling through to nothing.
const HASH_ALIASES: Record<string, StepId> = {
  address: 'home',
  color: 'appearance',
  finishing: 'appearance',
  underlayment: 'included',
  protection: 'included',
};

export function stepIdFromHash(hash: string): StepId | null {
  const clean = hash.replace(/^#/, '');
  if ((STEP_IDS as readonly string[]).includes(clean)) return clean as StepId;
  return HASH_ALIASES[clean] ?? null;
}

/**
 * Steps with no distinguishing store field of their own are tracked by
 * `StepFlags`, set when the user continues past that step. Included is the
 * only one left in the 5-step flow: its tiles are purely informational, so
 * there's no store field that "continued past Included" would set.
 */
export interface StepFlags {
  included: boolean;
}

export const DEFAULT_STEP_FLAGS: StepFlags = {
  included: false,
};

/** Furthest step index the user has actually earned, given store + flags. */
export function maxAllowedIndex(s: BuildState, flags: StepFlags): number {
  if (!s.address || !s.address.trim() || s.sq == null || s.solarPanels == null) {
    return stepIndex('home');
  }
  if (s.shingle == null) return stepIndex('shingle');
  if (s.color == null || s.dripEdge == null) return stepIndex('appearance');
  if (!flags.included) return stepIndex('included');
  return stepIndex('review');
}
