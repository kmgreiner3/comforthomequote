// Web Mercator projection + planar area math for the adjustable roof-outline
// editor (feedback round 5, Task B item 4). Mirrors the exact constants and
// formulas app/api/src/lib/google.ts uses to build the static map image and
// its mapMeta, so a bounding-box corner projects to the same pixel position
// on screen as the rectangle Google's Static Maps API actually drew, and a
// dragged pixel position converts back to the same real-world meters that
// image pixel represents.
import type { LatLngCorner, MapMeta } from './mapMeta';

// Web Mercator meters-per-pixel at zoom 0, equator (256px tiles) -- the same
// constant app/api's computeOverlayZoom/buildMapMeta use.
const EARTH_MERIDIAN_CONSTANT = 156543.03392;
const TILE_SIZE_PX = 256;
// mapMeta's imgW/imgH are scale-2 (Static Maps `scale=2`) pixel dimensions;
// the plain Web Mercator formulas below are in the underlying (scale-1)
// 256px-tile pixel space, so every world-pixel value needs this factor
// applied when relating it to an actual image pixel.
const STATIC_MAP_SCALE = 2;

// Global Constraint (shared with app/api): sqft = meters2 x 10.7639104167.
export const SQM_TO_SQFT = 10.7639104167;

export interface ImagePoint {
  x: number;
  y: number;
}

// Meters represented by one IMAGE pixel (scale-2) at the given latitude and
// zoom: mppImage = (156543.03392 * cos(centerLat) / 2^zoom) / 2.
export function metersPerImagePixel(centerLatDeg: number, zoom: number): number {
  const latRad = (centerLatDeg * Math.PI) / 180;
  return (EARTH_MERIDIAN_CONSTANT * Math.cos(latRad)) / 2 ** zoom / STATIC_MAP_SCALE;
}

// Standard Web Mercator world-pixel X for a longitude, at a given zoom, in
// the plain (scale-1) 256px-tile pixel space.
function worldPixelX(lngDeg: number, zoom: number): number {
  return ((lngDeg + 180) / 360) * TILE_SIZE_PX * 2 ** zoom;
}

// Standard Web Mercator world-pixel Y for a latitude (same formula Google
// Maps/Static Maps itself uses), in the plain (scale-1) 256px-tile pixel
// space. Clamped so a latitude near +/-90 can't blow up the log term.
function worldPixelY(latDeg: number, zoom: number): number {
  const sinLat = Math.min(Math.max(Math.sin((latDeg * Math.PI) / 180), -0.9999), 0.9999);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return y * TILE_SIZE_PX * 2 ** zoom;
}

// Projects a lat/lng to a pixel position on the rendered scale-2 static map
// image described by `meta`: the image is centered on (meta.centerLat,
// meta.centerLng), so a point's image pixel is the image center offset by
// that point's world-pixel delta from the center, scaled by STATIC_MAP_SCALE
// to move from world-pixel space into actual (scale-2) image-pixel space.
export function latLngToImagePx(lat: number, lng: number, meta: MapMeta): ImagePoint {
  const dxWorld = worldPixelX(lng, meta.zoom) - worldPixelX(meta.centerLng, meta.zoom);
  const dyWorld = worldPixelY(lat, meta.zoom) - worldPixelY(meta.centerLat, meta.zoom);
  return {
    x: meta.imgW / 2 + dxWorld * STATIC_MAP_SCALE,
    y: meta.imgH / 2 + dyWorld * STATIC_MAP_SCALE,
  };
}

// Inverse direction: an image pixel position -> meters offset from the
// image's center point, via the simpler per-pixel meters approximation
// (adequate at building scale, and the one the brief specifies directly).
// Sign convention: dxMeters increases eastward, dyMeters increases
// southward (screen-down, unflipped) -- irrelevant for shoelace area, which
// only depends on consistent magnitude, not a north-positive convention.
export function imagePxToMetersFromCenter(px: ImagePoint, meta: MapMeta): { dxMeters: number; dyMeters: number } {
  const mpp = metersPerImagePixel(meta.centerLat, meta.zoom);
  return {
    dxMeters: (px.x - meta.imgW / 2) * mpp,
    dyMeters: (px.y - meta.imgH / 2) * mpp,
  };
}

// Inverse of worldPixelX: the plain (scale-1) world-pixel X -> longitude.
function lngFromWorldPixelX(worldX: number, zoom: number): number {
  return (worldX / (TILE_SIZE_PX * 2 ** zoom)) * 360 - 180;
}

// Inverse of worldPixelY (standard Web Mercator inverse): the plain
// (scale-1) world-pixel Y -> latitude, via lat = atan(sinh(pi*(1-2*yNorm))).
function latFromWorldPixelY(worldY: number, zoom: number): number {
  const yNorm = worldY / (TILE_SIZE_PX * 2 ** zoom);
  const n = Math.PI * (1 - 2 * yNorm);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

// Exact inverse of latLngToImagePx: an image pixel position on the rendered
// scale-2 static map image described by `meta` -> the lat/lng it
// represents. Needed so a dragged corner (naturally tracked in image-pixel
// space while the pointer moves) can be persisted as the lat/lng the store
// keeps as its outline-corners source of truth (feedback round 6).
export function imagePxToLatLng(px: ImagePoint, meta: MapMeta): { lat: number; lng: number } {
  const centerWorldX = worldPixelX(meta.centerLng, meta.zoom);
  const centerWorldY = worldPixelY(meta.centerLat, meta.zoom);
  const dxWorld = (px.x - meta.imgW / 2) / STATIC_MAP_SCALE;
  const dyWorld = (px.y - meta.imgH / 2) / STATIC_MAP_SCALE;
  return {
    lat: latFromWorldPixelY(centerWorldY + dyWorld, meta.zoom),
    lng: lngFromWorldPixelX(centerWorldX + dxWorld, meta.zoom),
  };
}

// Shoelace formula for the (unsigned) area of a simple polygon given as
// meter offsets from a common origin. Works for any winding order (abs()'d
// at the end) and any polygon length >= 3.
export function shoelaceAreaM2(points: Array<{ dxMeters: number; dyMeters: number }>): number {
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    sum += a.dxMeters * b.dyMeters - b.dxMeters * a.dyMeters;
  }
  return Math.abs(sum) / 2;
}

export function areaM2ToSqft(areaM2: number): number {
  return areaM2 * SQM_TO_SQFT;
}

// Convenience wrapper for a set of lat/lng corners (e.g. the no-solar-data
// response's seedCorners, or the store's outlineCorners) against a given
// mapMeta: projects to image pixels, then to meter-offsets, then shoelace.
// Used by the trace-mode entry (feedback round 7) to seed the editor's
// "already known" readout with the seed rectangle's own area, so there's no
// jump the instant tracing starts (same reasoning as RoofOutlineEditor's own
// `initialSqft` prop).
export function areaSqftFromLatLngCorners(corners: LatLngCorner[], meta: MapMeta): number {
  const metersPoints = corners.map(({ lat, lng }) => imagePxToMetersFromCenter(latLngToImagePx(lat, lng, meta), meta));
  return areaM2ToSqft(shoelaceAreaM2(metersPoints));
}

// --- Self-intersection guard (feedback round 7, Task C item 4) ----------
// Moving from 4 to 6 draggable points makes it possible to drag a midpoint
// far enough to cross one of the polygon's own other edges (a "bowtie"),
// which is not a coherent roof footprint. Detected via the standard
// orientation + on-segment segment-intersection test, checked over every
// pair of NON-ADJACENT edges (adjacent edges always share exactly one
// endpoint by construction -- that's normal, not a crossing).

// Orientation of the turn p -> q -> r: 0 collinear, positive/negative for
// the two winding directions. Magnitudes below the epsilon are treated as
// collinear to avoid floating-point noise flipping the sign spuriously.
function orientation(p: ImagePoint, q: ImagePoint, r: ImagePoint): -1 | 0 | 1 {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-7) return 0;
  return val > 0 ? 1 : -1;
}

// Whether collinear point b lies within the bounding box of segment a-c
// (only ever called once orientation has already confirmed collinearity).
function onSegment(a: ImagePoint, b: ImagePoint, c: ImagePoint): boolean {
  const EPS = 1e-7;
  return (
    Math.min(a.x, c.x) - EPS <= b.x &&
    b.x <= Math.max(a.x, c.x) + EPS &&
    Math.min(a.y, c.y) - EPS <= b.y &&
    b.y <= Math.max(a.y, c.y) + EPS
  );
}

function segmentsIntersect(p1: ImagePoint, q1: ImagePoint, p2: ImagePoint, q2: ImagePoint): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;

  // Collinear edge-cases: an endpoint sitting exactly on the other segment.
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

// True when the closed polygon (edges points[i] -> points[i+1], wrapping
// back to points[0]) has any two non-adjacent edges crossing. Always false
// for fewer than 4 points (a triangle can never self-intersect).
export function polygonSelfIntersects(points: ImagePoint[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const p1 = points[i]!;
    const q1 = points[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1) continue; // shares vertex q1 === p2
      if (i === 0 && j === n - 1) continue; // wrap-around adjacency
      const p2 = points[j]!;
      const q2 = points[(j + 1) % n]!;
      if (segmentsIntersect(p1, q1, p2, q2)) return true;
    }
  }
  return false;
}
