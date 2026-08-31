import { DEFAULT_STEP_FLAGS, type StepFlags } from './steps';

const STORAGE_KEY = 'chq-build-flow-v1';

// Feedback round 8: the 9-step flow's StepFlags shape (underlayment,
// protection, included) collapsed to just `included`. Stamp a version
// alongside the flags so a pre-round-8 blob (no `v`, or a mismatched one)
// is discarded outright rather than spread over today's defaults -- a
// stale/foreign shape never partially applies, and a corrupt or
// unexpected JSON value never crashes anything, it just falls back to
// DEFAULT_STEP_FLAGS.
const FLAGS_VERSION = 2;

interface StoredFlags extends StepFlags {
  v: number;
}

/**
 * Tracks which of the "no distinguishing store field" steps (just
 * `included` now) the user has continued past. Deliberately separate from
 * the `useBuild` store: this is UI navigation/progress bookkeeping, not
 * roof configuration.
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
    const parsed = JSON.parse(raw) as Partial<StoredFlags> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== FLAGS_VERSION) {
      return { ...DEFAULT_STEP_FLAGS };
    }
    return { ...DEFAULT_STEP_FLAGS, included: Boolean(parsed.included) };
  } catch {
    return { ...DEFAULT_STEP_FLAGS };
  }
}

export function setStepFlagDone(key: keyof StepFlags): StepFlags {
  const next = { ...getStepFlags(), [key]: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: FLAGS_VERSION, ...next }));
  } catch {
    // best-effort persistence only
  }
  return next;
}

/** Start-over support: wipes the included flag. */
export function clearStepFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort only
  }
}
