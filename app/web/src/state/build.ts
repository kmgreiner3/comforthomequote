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

export type OutlineSource = 'satellite' | 'manual' | null;

export interface BuildState {
  address: string | null;
  outlineSqft: number | null;
  sq: number | null; // sqFromOutline(outlineSqft), set together
  // How outlineSqft/sq were populated. Never rendered to the homeowner --
  // internal bookkeeping only (satellite-path numbers must never reach the
  // UI). Manual entry always overrides a prior satellite value.
  outlineSource: OutlineSource;
  shingle: ShingleKey | null;
  color: string | null;
  underlayment: Underlayment; // default 'synthetic'
  dripEdge: DripEdge | null;
  accepted: boolean; // set by "I'm Ready to Move Forward"
  contact: Contact | null;
  visit: Visit | null;

  // actions
  setAddress(a: string): void;
  setOutline(sqft: number): void;
  setOutlineFromSatellite(sqft: number): void;
  setShingle(k: ShingleKey): void;
  setColor(c: string): void;
  setUnderlayment(u: Underlayment): void;
  setDripEdge(c: DripEdge): void;
  accept(): void;
  setContact(c: Contact): void;
  setVisit(v: Visit): void;
  reset(): void;
}

type PersistedFields = Pick<
  BuildState,
  | 'address'
  | 'outlineSqft'
  | 'sq'
  | 'outlineSource'
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
  outlineSqft: null,
  sq: null,
  outlineSource: null,
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

      setAddress: (a) => set({ address: a }),
      // Manual entry (StepHome's own footprint field). Always wins over a
      // prior satellite value -- entering/continuing here is the homeowner
      // overriding whatever satellite measurement (if any) came before.
      setOutline: (sqft) => set({ outlineSqft: sqft, sq: sqFromOutline(sqft), outlineSource: 'manual' }),
      // Satellite measurement, confirmed by the homeowner on the "Looks
      // right, continue" card. Same derivation (sqFromOutline), distinct
      // provenance tag only.
      setOutlineFromSatellite: (sqft) =>
        set({ outlineSqft: sqft, sq: sqFromOutline(sqft), outlineSource: 'satellite' }),
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
