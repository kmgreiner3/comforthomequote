import { DEFAULT_STEP_FLAGS, type StepFlags } from './steps';

const STORAGE_KEY = 'chq-build-flow-v1';

/**
 * Tracks which of the "no distinguishing store field" steps (underlayment,
 * protection, included) the user has continued past. Deliberately separate
 * from the `useBuild` store: this is UI navigation/progress bookkeeping, not
 * roof configuration, and Task 4 must consume the build store as-is.
 *
 * Plain localStorage-backed functions rather than a React store: the hash
 * router needs the *current* value synchronously (it writes a flag, then
 * immediately navigates and re-derives what's allowed in the same tick), so
 * there's no reactive state to go stale.
 */
export function getStepFlags(): StepFlags {
  if (typeof window === 'undefined') return { ...DEFAULT_STEP_FLAGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STEP_FLAGS };
    const parsed = JSON.parse(raw) as Partial<StepFlags>;
    return { ...DEFAULT_STEP_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_STEP_FLAGS };
  }
}

export function setStepFlagDone(key: keyof StepFlags): StepFlags {
  const next = { ...getStepFlags(), [key]: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort persistence only
  }
  return next;
}

/** Start-over support: wipes the underlayment/protection/included flags. */
export function clearStepFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort only
  }
}
