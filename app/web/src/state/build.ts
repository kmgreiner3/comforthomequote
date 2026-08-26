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
import type { LatLngCorner, MapMeta } from '../lib/mapMeta';

function midpoint(a: LatLngCorner, b: LatLngCorner): LatLngCorner {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

// Six points in the order the outline editor consumes (feedback round 7,
// Task C item 4): sw -> w-mid -> nw -> ne -> e-mid -> se -- the 4 rectangle
// corners (in the same order app/api's old boundingBoxPathPoints used,
// sw -> nw -> ne -> se) plus the midpoints of the two longer west/east
// edges, derived from a mapMeta's bounding box. This is the initial,
// unadjusted hexagon before any homeowner drag.
function cornersFromMapMeta(m: MapMeta): LatLngCorner[] {
  const sw = { lat: m.sw.lat, lng: m.sw.lng };
  const nw = { lat: m.ne.lat, lng: m.sw.lng };
  const ne = { lat: m.ne.lat, lng: m.ne.lng };
  const se = { lat: m.sw.lat, lng: m.ne.lng };
  return [sw, midpoint(sw, nw), nw, ne, midpoint(ne, se), se];
}

// Upgrades a pre-round-7 persisted 4-point outlineCorners (sw, nw, ne, se)
// to the current 6-point shape by inserting the two edge midpoints, so old
// localStorage state rehydrates safely instead of crashing anything that
// now expects 6 points. Anything that isn't exactly 4 (already 6, empty,
// null, or some unexpected shape) is left untouched -- there's nothing
// meaningful to upgrade, and every consumer already renders generically
// over whatever length `outlineCorners` actually has.
function upgradeOutlineCornersTo6(corners: unknown): unknown {
  if (!Array.isArray(corners) || corners.length !== 4) return corners;
  const [sw, nw, ne, se] = corners as LatLngCorner[];
  if (!sw || !nw || !ne || !se) return corners;
  return [sw, midpoint(sw, nw), nw, ne, midpoint(ne, se), se];
}

// Field-by-field (not JSON.stringify) so key order never matters.
function mapMetaEquals(a: MapMeta, b: MapMeta): boolean {
  return (
    a.centerLat === b.centerLat &&
    a.centerLng === b.centerLng &&
    a.zoom === b.zoom &&
    a.imgW === b.imgW &&
    a.imgH === b.imgH &&
    a.sw.lat === b.sw.lat &&
    a.sw.lng === b.sw.lng &&
    a.ne.lat === b.ne.lat &&
    a.ne.lng === b.ne.lng
  );
}

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
  // The mapMeta the last successful /api/measure with a bounding box
  // returned (Task A), and the 6 roof-outline points (sw, w-mid, nw, ne,
  // e-mid, se -- feedback round 7) it and any subsequent homeowner
  // adjustment resolve to. Together these are
  // the single source of truth the confirm card's read-only overlay and the
  // adjust-outline editor's draggable one both render from (feedback round
  // 6) -- so the two can never show a different rectangle, and reopening
  // the editor after an adjustment starts from the adjusted shape, not the
  // original satellite bounding box. Persisted (like propertyImageUrl) so a
  // revisit -- even one that re-fetches after the session cache is gone --
  // still renders the adjusted shape rather than resetting to the bbox.
  mapMeta: MapMeta | null;
  outlineCorners: LatLngCorner[] | null;
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
  // different placeId (the round-5 wrong-building recovery flow: a
  // free-typed or ambiguous address measured the wrong building, so the
  // homeowner re-picks the exact one from autocomplete) records just that
  // placeId, clears the measurement-attempt cache (so /api/measure retries
  // via the new exact-match geocode), and clears mapMeta/outlineCorners too
  // -- otherwise the OLD building's bbox/corners would stay stashed and get
  // drawn over the NEW building's photo once the re-measurement lands.
  // outlineSqft/sq/outlineSource/propertyImageUrl are deliberately left
  // alone here (unlike the different-address branch below): they get
  // overwritten in due course when the re-measurement resolves. Setting a
  // DIFFERENT address clears outline/sq/outlineSource/propertyImageUrl (the prior
  // measurement no longer applies to a different property) and the
  // measurement-attempt cache, but deliberately leaves shingle/color/
  // underlayment/dripEdge/accepted/contact/visit untouched so switching
  // addresses mid-flow (the address chip's "Change") keeps the rest of the
  // configuration intact for a fast side-by-side price check.
  setAddress(a: string, placeId?: string | null): void;
  // Adopts the geocode's canonical formatted address (which always includes
  // the postal code, unlike a Google suggestion description -- feedback
  // round 7, Task C item 1) as the store's `address` once a measurement
  // succeeds, WITHOUT touching placeId/outline/mapMeta/propertyImageUrl/the
  // measurement-attempt cache -- unlike setAddress's "different address"
  // branch, this is the SAME physical address, just its canonical text
  // replacing whatever the homeowner typed or picked. A no-op if the text
  // is empty or already matches.
  adoptCanonicalAddress(formattedAddress: string): void;
  setOutline(sqft: number): void;
  setOutlineFromSatellite(sqft: number): void;
  // Homeowner-adjusted outline from the drag-to-fit roof editor (Task B
  // item 4). Same sqFromOutline derivation as the other two outline
  // setters, distinct provenance tag ('adjusted') so a later back-
  // navigation's satellite-number leak guard also applies to this value
  // (it's still an image-derived measurement, just user-refined -- not a
  // hand-typed footprint).
  setOutlineAdjusted(sqft: number, corners: LatLngCorner[]): void;
  // Called once per successful measurement (see StepHome) with the mapMeta
  // the response returned, or null when there's no bounding box to draw.
  // Re-syncing the SAME mapMeta (a re-render, or Cancel returning to the
  // confirm phase) leaves outlineCorners alone. A DIFFERENT mapMeta (a
  // genuine re-measurement -- e.g. the same-address-new-placeId recovery
  // flow above) re-initializes outlineCorners from the NEW box's sw/ne,
  // UNLESS outlineSource === 'adjusted': a homeowner's hand-adjusted
  // corners are absolute lat/lng, not tied to any particular mapMeta
  // frame, so they're kept rather than reset even across a re-measurement.
  // A null mapMeta clears both fields together.
  setMeasuredMapMeta(mapMeta: MapMeta | null): void;
  // The no-solar-data trace flow's entry point (feedback round 7, Task C
  // item 2): sets mapMeta AND outlineCorners directly from the response's
  // own seedCorners, rather than re-deriving corners from the mapMeta's
  // bbox the way setMeasuredMapMeta does -- there is no real Solar bounding
  // box here, just the server's plausible starting rectangle, so the
  // client trusts it verbatim instead of reconstructing it.
  setSeedOutline(mapMeta: MapMeta, corners: LatLngCorner[]): void;
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
  | 'mapMeta'
  | 'outlineCorners'
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
  mapMeta: null,
  outlineCorners: null,
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
          set({ placeId, mapMeta: null, outlineCorners: null });
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
          mapMeta: null,
          outlineCorners: null,
        });
      },
      adoptCanonicalAddress: (formattedAddress) => {
        if (!formattedAddress || get().address === formattedAddress) return;
        set({ address: formattedAddress });
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
      // and confirmed it via "Use this outline". Same sqft/sq derivation,
      // distinct provenance tag -- plus the adjusted corners themselves,
      // so the confirm card renders the SAME quad the homeowner just set,
      // not the original satellite bounding box.
      setOutlineAdjusted: (sqft, corners) =>
        set({ outlineSqft: sqft, sq: sqFromOutline(sqft), outlineSource: 'adjusted', outlineCorners: corners }),
      setMeasuredMapMeta: (mapMeta) => {
        if (!mapMeta) {
          set({ mapMeta: null, outlineCorners: null });
          return;
        }
        const state = get();
        const isSameFrame = state.mapMeta != null && mapMetaEquals(state.mapMeta, mapMeta);
        // Keep the existing corners across a re-sync of the SAME frame
        // (idempotent), or when the homeowner has hand-adjusted them
        // (frame-independent lat/lng, kept even across a genuine
        // re-measurement). Otherwise -- a DIFFERENT frame, not yet
        // adjusted -- re-initialize from the new box's bbox rather than
        // keeping a stale rectangle registered to the old photo.
        const keepExistingCorners = state.outlineCorners != null && (isSameFrame || state.outlineSource === 'adjusted');
        set({
          mapMeta,
          outlineCorners: keepExistingCorners ? state.outlineCorners : cornersFromMapMeta(mapMeta),
        });
      },
      setSeedOutline: (mapMeta, corners) => set({ mapMeta, outlineCorners: corners }),
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
      // A field added later (outlineSource, placeId, ...) simply isn't a
      // key in older persisted JSON -- zustand's default merge,
      // `{ ...currentState, ...persistedState }`, leaves the freshly-
      // initialized default (null) in place for those, no migration step
      // needed. version/migrate exist only for feedback round 7's
      // outlineCorners shape change (4 points -> 6): that one DOES need an
      // actual transform, not just "leave the default alone", since a
      // pre-round-7 array is present but the WRONG shape.
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 1 && state && typeof state === 'object' && 'outlineCorners' in state) {
          state.outlineCorners = upgradeOutlineCornersTo6(state.outlineCorners);
        }
        return state;
      },
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
