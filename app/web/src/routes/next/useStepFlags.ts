import { DEFAULT_NEXT_STEP_FLAGS, type NextStepFlags } from './steps';

const STORAGE_KEY = 'chq-next-flow-v1';

/**
 * Mirrors app/web/src/routes/build/useStepFlags.ts: plain localStorage-backed
 * functions (not a React store) so the hash router can read the *current*
 * value synchronously right after writing it, in the same tick.
 */
export function getNextStepFlags(): NextStepFlags {
  if (typeof window === 'undefined') return { ...DEFAULT_NEXT_STEP_FLAGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NEXT_STEP_FLAGS };
    const parsed = JSON.parse(raw) as Partial<NextStepFlags>;
    return { ...DEFAULT_NEXT_STEP_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_NEXT_STEP_FLAGS };
  }
}

export function setNextStepFlagDone(key: keyof NextStepFlags): NextStepFlags {
  const next = { ...getNextStepFlags(), [key]: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort persistence only
  }
  return next;
}

/** Start-over support: wipes the partnerSeen flag (and any future /next flags). */
export function clearNextStepFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort only
  }
}
