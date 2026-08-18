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

export interface BuildState {
  address: string | null;
  outlineSqft: number | null;
  sq: number | null; // sqFromOutline(outlineSqft), set together
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
    (set) => ({
      ...initialState,

      setAddress: (a) => set({ address: a }),
      setOutline: (sqft) => set({ outlineSqft: sqft, sq: sqFromOutline(sqft) }),
      // Changing shingle resets color: the two products have different color lists.
      setShingle: (k) => set({ shingle: k, color: null }),
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
