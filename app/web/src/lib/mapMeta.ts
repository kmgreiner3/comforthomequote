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

// One corner of the roof-outline quad (feedback round 6). The store keeps
// exactly 4 of these, ordered sw -> nw -> ne -> se, as the single source of
// truth the confirm card's read-only overlay and the adjust-outline
// editor's draggable one both render from.
export interface LatLngCorner {
  lat: number;
  lng: number;
}

function isLatLng(x: unknown): x is { lat: number; lng: number } {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return typeof p.lat === 'number' && Number.isFinite(p.lat) && typeof p.lng === 'number' && Number.isFinite(p.lng);
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
