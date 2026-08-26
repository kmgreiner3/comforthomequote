// Client-side mirror of app/api's MapMeta shape (measure.ts's found-response
// `mapMeta` field, built by app/api/src/lib/google.ts's buildMapMeta). Kept
// as a plain local type rather than a cross-workspace import: app/web has no
// dependency on app/api, and this shape is small/stable enough to duplicate
// rather than wire up a shared package for.
export interface MapMeta {
  centerLat: number;
  centerLng: number;
  zoom: number;
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
  imgW: number;
  imgH: number;
}

// One point of the roof-outline polygon (feedback round 6; expanded from 4
// to 6 in feedback round 7 -- Task C item 4). The store keeps exactly 6 of
// these, ordered sw -> w-mid -> nw -> ne -> e-mid -> se (the 4 rectangle
// corners plus the midpoints of the two longer, west/east edges), as the
// single source of truth the confirm card's read-only overlay and the
// adjust-outline/trace editor's draggable one both render from. The two
// midpoints are what let a homeowner drag a point inward to trace an
// L-shaped footprint out of a plain rectangle. A pre-round-7 persisted
// store may still have only 4 of these -- see state/build.ts's rehydrate
// migration, which inserts the two midpoints so old state upgrades safely.
export interface LatLngCorner {
  lat: number;
  lng: number;
}

function isLatLng(x: unknown): x is { lat: number; lng: number } {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return typeof p.lat === 'number' && Number.isFinite(p.lat) && typeof p.lng === 'number' && Number.isFinite(p.lng);
}

/** Runtime shape guard for a single LatLngCorner-shaped value. */
export function isLatLngCorner(x: unknown): x is LatLngCorner {
  return isLatLng(x);
}

// Runtime shape guard for an array of LatLngCorner-shaped values, e.g. the
// `seedCorners` field on an untrusted /api/measure no-solar-data response.
// Deliberately lenient about length (>= 3, a valid polygon) rather than
// requiring exactly 6 -- the caller decides what to do with an unexpected
// length; this just guards against non-corner garbage.
export function isLatLngCornerArray(x: unknown): x is LatLngCorner[] {
  return Array.isArray(x) && x.length >= 3 && x.every(isLatLngCorner);
}

// Runtime shape guard for a `mapMeta` value parsed out of an untrusted
// /api/measure JSON response (same defensive-parsing posture as StepHome's
// own isFoundResponse()) or restored from the measurement-attempt
// sessionStorage cache.
export function isMapMeta(x: unknown): x is MapMeta {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  if (typeof m.centerLat !== 'number' || !Number.isFinite(m.centerLat)) return false;
  if (typeof m.centerLng !== 'number' || !Number.isFinite(m.centerLng)) return false;
  if (typeof m.zoom !== 'number' || !Number.isFinite(m.zoom)) return false;
  if (typeof m.imgW !== 'number' || !Number.isFinite(m.imgW)) return false;
  if (typeof m.imgH !== 'number' || !Number.isFinite(m.imgH)) return false;
  if (!isLatLng(m.sw) || !isLatLng(m.ne)) return false;
  return true;
}
