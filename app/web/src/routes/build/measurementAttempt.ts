/**
 * Tracks the outcome of the at-most-once-per-address satellite measurement
 * attempt for StepHome. Deliberately separate from the `useBuild` store
 * (same reasoning as useStepFlags.ts): this is transient UI bookkeeping --
 * "did we already try to measure this address" -- not roof configuration,
 * and Task 3 only adds `outlineSource` / `setOutlineFromSatellite` to the
 * store itself.
 *
 * sessionStorage (not localStorage): this only needs to survive step
 * re-entry within the current tab/session so StepHome doesn't burn another
 * /api/measure call (and another day's rate-limit unit) every time the
 * homeowner steps back and forth without changing the address. It's fine,
 * even desirable, for a brand new session to get one fresh attempt.
 */

import { isLatLngCornerArray, isMapMeta, type LatLngCorner, type MapMeta } from '../../lib/mapMeta';

const STORAGE_KEY = 'chq-measure-attempt-v1';

export type MeasurementAttempt =
  | { address: string; outcome: 'found'; sqft: number; imageUrl?: string; mapMeta?: MapMeta }
  // Geocode succeeded, in Florida, but Solar had no building data -- there's
  // still an aerial + a plausible starting rectangle to trace from (feedback
  // round 7, Task C item 2), so this gets its own cached outcome rather than
  // falling into 'fallback' (which means "go straight to the manual form").
  | { address: string; outcome: 'trace'; imageUrl: string; mapMeta: MapMeta; seedCorners: LatLngCorner[] }
  | { address: string; outcome: 'outside-florida' }
  | { address: string; outcome: 'fallback' };

export function getMeasurementAttempt(): MeasurementAttempt | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MeasurementAttempt> | null;
    if (!parsed || typeof parsed.address !== 'string') return null;
    if (parsed.outcome === 'found' && typeof (parsed as { sqft?: unknown }).sqft === 'number') {
      const imageUrl = (parsed as { imageUrl?: unknown }).imageUrl;
      const mapMeta = (parsed as { mapMeta?: unknown }).mapMeta;
      return {
        address: parsed.address,
        outcome: 'found',
        sqft: (parsed as { sqft: number }).sqft,
        ...(typeof imageUrl === 'string' ? { imageUrl } : {}),
        ...(isMapMeta(mapMeta) ? { mapMeta } : {}),
      };
    }
    if (parsed.outcome === 'trace') {
      const imageUrl = (parsed as { imageUrl?: unknown }).imageUrl;
      const mapMeta = (parsed as { mapMeta?: unknown }).mapMeta;
      const seedCorners = (parsed as { seedCorners?: unknown }).seedCorners;
      if (typeof imageUrl !== 'string' || !isMapMeta(mapMeta) || !isLatLngCornerArray(seedCorners)) return null;
      return { address: parsed.address, outcome: 'trace', imageUrl, mapMeta, seedCorners };
    }
    if (parsed.outcome === 'outside-florida') {
      return { address: parsed.address, outcome: 'outside-florida' };
    }
    if (parsed.outcome === 'fallback') {
      return { address: parsed.address, outcome: 'fallback' };
    }
    return null;
  } catch {
    return null;
  }
}

export function setMeasurementAttempt(attempt: MeasurementAttempt): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // best-effort persistence only
  }
}

/** Start-over support: wipes the at-most-once-per-address measurement cache. */
export function clearMeasurementAttempt(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort only
  }
}
