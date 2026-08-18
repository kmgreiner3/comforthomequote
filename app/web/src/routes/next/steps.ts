import type { BuildState } from '../../state/build';

export const NEXT_STEP_IDS = ['partner', 'info', 'schedule', 'confirm'] as const;

export type NextStepId = (typeof NEXT_STEP_IDS)[number];

export const NEXT_STEP_LABELS: Record<NextStepId, string> = {
  partner: 'Partner',
  info: 'Your info',
  schedule: 'Schedule',
  confirm: 'Confirmation',
};

export function nextStepIndex(id: NextStepId): number {
  return NEXT_STEP_IDS.indexOf(id);
}

export function nextStepIdFromHash(hash: string): NextStepId | null {
  const clean = hash.replace(/^#/, '');
  return (NEXT_STEP_IDS as readonly string[]).includes(clean) ? (clean as NextStepId) : null;
}

/**
 * Partner has no distinguishing store field of its own (unlike info/schedule,
 * which are satisfied once contact/visit are set), so -- exactly like
 * Build's underlayment/protection/included steps -- it is tracked with a
 * localStorage flag set once the user continues past it.
 */
export interface NextStepFlags {
  partnerSeen: boolean;
}

export const DEFAULT_NEXT_STEP_FLAGS: NextStepFlags = { partnerSeen: false };

/** Furthest step index the user has actually earned, given store + flags. */
export function maxAllowedNextIndex(s: Pick<BuildState, 'contact' | 'visit'>, flags: NextStepFlags): number {
  if (!flags.partnerSeen) return nextStepIndex('partner');
  if (s.contact == null) return nextStepIndex('info');
  if (s.visit == null) return nextStepIndex('schedule');
  return nextStepIndex('confirm');
}
