// Web Mercator projection + planar area math for the adjustable roof-outline
// editor (feedback round 5, Task B item 4). Mirrors the exact constants and
// formulas app/api/src/lib/google.ts uses to build the static map image and
// its mapMeta, so a bounding-box corner projects to the same pixel position
// on screen as the rectangle Google's Static Maps API actually drew, and a
// dragged pixel position converts back to the same real-world meters that
// image pixel represents.
import type { MapMeta } from './mapMeta';

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
