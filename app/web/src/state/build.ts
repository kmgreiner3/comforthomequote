import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProtectionLevel, ShingleKey, Underlayment } from '@chq/pricing';
import {
  cashPrice,
  configuredTotal,
  estimatedMonthly,
  guarantee,
  peelStickUpgrade,
  sqFromOutline,
  titanUpgrade,
} from '@chq/pricing';
import { clearStepFlags } from '../routes/build/useStepFlags';
import { clearMeasurementAttempt } from '../routes/build/measurementAttempt';
import { clearNextStepFlags } from '../routes/next/useStepFlags';

export type DripEdge = 'White' | 'Black' | 'Brown';

export interface Contact {
  name: string;
  phone: string;
  email: string;
  billing: string;
  method: string;
}

export interface Visit {
  date: string;
  window: 'Morning' | 'Afternoon' | 'No Preference';
}

export type OutlineSource = 'satellite' | 'manual' | 'adjusted' | null;

export interface BuildState {
  address: string | null;
  // Google Places placeId for `address`, when it was picked from the
  // address-suggest dropdown rather than free-typed. Sent alongside address
  // on /api/measure (exact-match geocode, no ambiguity); null for a
  // free-typed address, and always cleared whenever address changes to a
  // different value that wasn't itself accompanied by a placeId.
  placeId: string | null;
  outlineSqft: number | null;
  sq: number | null; // sqFromOutline(outlineSqft), set together
  // How outlineSqft/sq were populated. Never rendered to the homeowner --
  // internal bookkeeping only (satellite-path numbers must never reach the
  // UI). Manual entry always overrides a prior satellite value.
  outlineSource: OutlineSource;
  // Presigned S3 URL for the property's aerial photo (Task A's /api/measure
  // imageUrl), shown on the satellite confirmation card only. Presigned URLs
  // expire (1h) -- kept in the persisted store for simplicity, but a stale/
  // expired URL just fails to load; the <img>'s onError handler hides it
  // rather than the store having to know anything about expiry.
  propertyImageUrl: string | null;
  shingle: ShingleKey | null;
  color: string | null;
  underlayment: Underlayment; // default 'synthetic'
  dripEdge: DripEdge | null;
  accepted: boolean; // set by "I'm Ready to Move Forward"
  contact: Contact | null;
  visit: Visit | null;

  // actions
  // `placeId`: pass the picked suggestion's placeId when `a` came from the
  // address-suggest dropdown, omit/null for a free-typed address. Setting
  // the SAME address (string equality against the current value) with an
  // unchanged (or omitted) placeId is a no-op -- nothing is cleared,
  // nothing is rewritten. Setting the SAME address but a NEWLY PICKED,
  // different placeId records just that placeId and clears the
  // measurement-attempt cache (so /api/measure retries via the new exact-
  // match geocode), without touching anything else. Setting a DIFFERENT
  // address clears outline/sq/outlineSource/propertyImageUrl (the prior
  // measurement no longer applies to a different property) and the
  // measurement-attempt cache, but deliberately leaves shingle/color/
  // underlayment/dripEdge/accepted/contact/visit untouched so switching
  // addresses mid-flow (the address chip's "Change") keeps the rest of the
  // configuration intact for a fast side-by-side price check.
  setAddress(a: string, placeId?: string | null): void;
  setOutline(sqft: number): void;
  setOutlineFromSatellite(sqft: number): void;
  // Homeowner-adjusted outline from the drag-to-fit roof editor (Task B
  // item 4). Same sqFromOutline derivation as the other two outline
  // setters, distinct provenance tag ('adjusted') so a later back-
  // navigation's satellite-number leak guard also applies to this value
  // (it's still an image-derived measurement, just user-refined -- not a
  // hand-typed footprint).
  setOutlineAdjusted(sqft: number): void;
  setPropertyImageUrl(url: string | null): void;
  setShingle(k: ShingleKey): void;
  setColor(c: string): void;
  setUnderlayment(u: Underlayment): void;
  setDripEdge(c: DripEdge): void;
  accept(): void;
  setContact(c: Contact): void;
  setVisit(v: Visit): void;
  reset(): void;
  // Start-over: resets this store to pristine defaults AND wipes the three
  // sibling storages that track UI-only progress outside the persisted
  // store (build step-flags localStorage, measurement-attempt sessionStorage,
  // /next step-flags localStorage), so a "start over" click can never leave
  // stale progress behind in any of them -- including the /next flow's own
  // partnerSeen flag, which would otherwise silently skip a second quote
  // straight past the partner (license/insurance) step.
  resetQuote(): void;
}

type PersistedFields = Pick<
  BuildState,
  | 'address'
  | 'placeId'
  | 'outlineSqft'
  | 'sq'
  | 'outlineSource'
  | 'propertyImageUrl'
  | 'shingle'
  | 'color'
  | 'underlayment'
  | 'dripEdge'
  | 'accepted'
  | 'contact'
  | 'visit'
>;

const initialState: PersistedFields = {
  address: null,
  placeId: null,
  outlineSqft: null,
  sq: null,
  outlineSource: null,
  propertyImageUrl: null,
  shingle: null,
  color: null,
  underlayment: 'synthetic',
  dripEdge: null,
  accepted: false,
  contact: null,
  visit: null,
};

export const useBuild = create<BuildState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAddress: (a, placeId) => {
        if (get().address === a) {
          // Same address text. `placeId === undefined` means the caller
          // has no opinion about it (e.g. a plain free-typed resubmit) --
          // leave whatever's already stored alone, a true no-op. But a
          // NEWLY PICKED placeId (explicitly passed, and different from
          // what's stored) must not be silently dropped just because the
          // address text happens to already match -- record it and clear
          // the measurement-attempt cache so /api/measure retries via the
          // new exact-match geocode. Nothing else about the configuration
          // changes: it's still the same physical address.
          if (placeId === undefined || placeId === get().placeId) return;
          clearMeasurementAttempt();
          set({ placeId });
          return;
        }
        clearMeasurementAttempt();
        set({
          address: a,
          placeId: placeId ?? null,
          outlineSqft: null,
          sq: null,
          outlineSource: null,
          propertyImageUrl: null,
        });
      },
      // Manual entry (StepHome's own footprint field). Always wins over a
      // prior satellite value -- entering/continuing here is the homeowner
      // overriding whatever satellite measurement (if any) came before.
      setOutline: (sqft) => set({ outlineSqft: sqft, sq: sqFromOutline(sqft), outlineSource: 'manual' }),
      // Satellite measurement, confirmed by the homeowner on the "Looks
      // right, continue" card. Same derivation (sqFromOutline), distinct
      // provenance tag only.
      setOutlineFromSatellite: (sqft) =>
        set({ outlineSqft: sqft, sq: sqFromOutline(sqft), outlineSource: 'satellite' }),
      // Homeowner dragged the roof-outline editor's corners to a better fit
      // and confirmed it via "Use this outline". Same derivation, distinct
      // provenance tag.
      setOutlineAdjusted: (sqft) =>
        set({ outlineSqft: sqft, sq: sqFromOutline(sqft), outlineSource: 'adjusted' }),
      setPropertyImageUrl: (url) => set({ propertyImageUrl: url }),
      // Changing shingle resets color: the two products have different color
      // lists. Re-selecting the *same* shingle is a no-op -- it must not
      // wipe a color the user already chose.
      setShingle: (k) => {
        if (get().shingle === k) return;
        set({ shingle: k, color: null });
      },
      setColor: (c) => set({ color: c }),
      setUnderlayment: (u) => set({ underlayment: u }),
      setDripEdge: (c) => set({ dripEdge: c }),
      accept: () => set({ accepted: true }),
      setContact: (c) => set({ contact: c }),
      setVisit: (v) => set({ visit: v }),
      reset: () => set({ ...initialState }),
      resetQuote: () => {
        clearStepFlags();
        clearMeasurementAttempt();
        clearNextStepFlags();
        set({ ...initialState });
      },
    }),
    {
      name: 'chq-build-v1',
      storage: createJSONStorage(() => localStorage),
      // No explicit version/migrate: zustand's default merge is
      // `{ ...currentState, ...persistedState }`. A field added later
      // (outlineSource) simply isn't a key in older persisted JSON, so the
      // spread leaves the freshly-initialized default (null) in place --
      // old persisted state rehydrates safely without a migration step.
    }
  )
);

// --- Derived selectors --------------------------------------------------
// All pricing math lives in @chq/pricing; these are thin, unit-tested
// wrappers so components never compute money themselves.

export function selectTotal(s: BuildState): number | null {
  if (s.sq == null || s.shingle == null) return null;
  return configuredTotal(s.sq, s.shingle, s.underlayment);
}

export function selectMonthly(s: BuildState): number | null {
  const total = selectTotal(s);
  return total == null ? null : estimatedMonthly(total);
}

export function selectUpgradeDelta(s: BuildState): number | null {
  return s.sq == null ? null : titanUpgrade(s.sq);
}

export function selectPeelStickDelta(s: BuildState): number | null {
  return s.sq == null ? null : peelStickUpgrade(s.sq);
}

export function selectGuarantee(s: BuildState): { level: ProtectionLevel; years: number } | null {
  if (s.shingle == null) return null;
  return guarantee(s.shingle, s.underlayment);
}

export function selectCash(s: BuildState): number | null {
  const total = selectTotal(s);
  return total == null ? null : cashPrice(total);
}
