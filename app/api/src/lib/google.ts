import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';

// Module-scope client so aws-sdk-client-mock's mockClient(SSMClient)
// intercepts every call regardless of which handler imports this module.
const ssm = new SSMClient({});

// Global Constraints: sqft = meters2 x 10.7639104167.
export const SQM_TO_SQFT = 10.7639104167;

export function metersToSqft(meters2: number): number {
  return meters2 * SQM_TO_SQFT;
}

// Cached across warm invocations. `undefined` = not yet loaded this
// container, `null` = loaded and unavailable (unset placeholder or missing).
let cachedKey: string | null | undefined;

export function resetGoogleApiKeyCache(): void {
  cachedKey = undefined;
}

// Returns the real key, or null when the SSM param is the terraform
// placeholder value "unset" or does not exist yet.
export async function getGoogleApiKey(paramName: string): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: paramName, WithDecryption: true }));
    const value = result.Parameter?.Value;
    cachedKey = value && value !== 'unset' ? value : null;
  } catch (err) {
    if (err instanceof ParameterNotFound) {
      cachedKey = null;
    } else {
      throw err;
    }
  }
  return cachedKey;
}

export interface GeocodeResult {
  found: boolean;
  lat?: number;
  lng?: number;
  state?: string;
}

interface GoogleAddressComponent {
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResponse {
  results: Array<{
    address_components: GoogleAddressComponent[];
    geometry: { location: { lat: number; lng: number } };
  }>;
}

async function fetchGeocode(url: string): Promise<GeocodeResult> {
  const res = await fetch(url);
  if (!res.ok) return { found: false };
  const data = (await res.json()) as GoogleGeocodeResponse;
  const result = data.results?.[0];
  if (!result) return { found: false };
  const stateComponent = result.address_components.find((c) =>
    c.types.includes('administrative_area_level_1'),
  );
  return {
    found: true,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    state: stateComponent?.short_name,
  };
}

export async function geocodeAddress(address: string, apiKey: string): Promise<GeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  return fetchGeocode(url);
}

// Exact-match geocode by Places placeId -- used when the client picked a
// suggestion from address-suggest, so there is no ambiguity to resolve
// (unlike free-typed address strings, which Google's geocoder can match
// fuzzily to the wrong property).
export async function geocodeByPlaceId(placeId: string, apiKey: string): Promise<GeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}`;
  return fetchGeocode(url);
}

export interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

// Building-level bounding box from the Solar API. sw/ne are opposite
// corners (southwest/northeast); the other two corners of the rectangle
// are derived by combining sw's/ne's lat and lng.
export interface BoundingBox {
  sw: GoogleLatLng;
  ne: GoogleLatLng;
}

interface GoogleSolarResponse {
  boundingBox?: BoundingBox;
  solarPotential?: {
    wholeRoofStats?: {
      groundAreaMeters2?: number;
    };
  };
}

export interface SolarLookup {
  groundAreaSqft: number;
  // null when Solar returned no boundingBox for this building -- callers
  // fall back to a plain center/zoom map with no overlay.
  boundingBox: BoundingBox | null;
}

// Returns the ground-projected roof outline in sq ft (never the pitched 3D
// area) plus the building's bounding box for the overlay, or null when
// Solar has no data for the location.
export async function getGroundAreaSqft(lat: number, lng: number, apiKey: string): Promise<SolarLookup | null> {
  // requiredQuality=LOW: without it Solar defaults to HIGH-quality imagery
  // only and 404s for buildings where only MEDIUM/LOW quality imagery has
  // been processed -- the root cause of "falls to manual" misses on real
  // (existing) homes. LOW asks for the best available imagery of ANY
  // quality; higher-quality results still come back when they exist.
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as GoogleSolarResponse;
  const groundAreaMeters2 = data.solarPotential?.wholeRoofStats?.groundAreaMeters2;
  if (typeof groundAreaMeters2 !== 'number') return null;
  return {
    groundAreaSqft: metersToSqft(groundAreaMeters2),
    boundingBox: data.boundingBox ?? null,
  };
}

// Static Maps auto-fit (no explicit center/zoom) framed the whole city grid
// around a small building, not the building itself -- so instead we always
// send an explicit center (the bounding box's centroid) and a computed
// zoom tight enough to actually show the roof.

const METERS_PER_DEGREE_LAT = 111320;
// Web Mercator meters-per-pixel at zoom 0, equator (256px tiles).
const EARTH_MERIDIAN_CONSTANT = 156543.03392;
// Static Maps image size in logical px (pre `scale=2` doubling); the
// computed zoom must fit the padded bounding box span into the width.
const MAP_WIDTH_PX = 640;
const MAP_HEIGHT_PX = 400;
const STATIC_MAP_SCALE = 2;
// Padding factor so the building doesn't fill the frame edge-to-edge.
const FRAMING_PADDING = 1.5;
const MIN_OVERLAY_ZOOM = 17;
const MAX_OVERLAY_ZOOM = 20;
// Degenerate/point-like boxes still get a sane (max-zoom) framing rather
// than a division blowup.
const MIN_SPAN_METERS = 10;

function boundingBoxCenter(box: BoundingBox): GoogleLatLng {
  return {
    latitude: (box.sw.latitude + box.ne.latitude) / 2,
    longitude: (box.sw.longitude + box.ne.longitude) / 2,
  };
}

// Larger of the bounding box's two ground spans in meters, floored at
// MIN_SPAN_METERS.
function boundingBoxSpanMeters(box: BoundingBox): number {
  const centerLatRad = (boundingBoxCenter(box).latitude * Math.PI) / 180;
  const latSpan = (box.ne.latitude - box.sw.latitude) * METERS_PER_DEGREE_LAT;
  const lngSpan = (box.ne.longitude - box.sw.longitude) * METERS_PER_DEGREE_LAT * Math.cos(centerLatRad);
  return Math.max(latSpan, lngSpan, MIN_SPAN_METERS);
}

// Largest integer zoom (clamped to [17, 20]) that fits FRAMING_PADDING x
// the bounding box's larger ground span within a 640px-wide frame, using
// the standard Web Mercator meters-per-pixel relationship:
// metersPerPixel(z) = EARTH_MERIDIAN_CONSTANT * cos(lat) / 2^z.
export function computeOverlayZoom(box: BoundingBox): number {
  const centerLatRad = (boundingBoxCenter(box).latitude * Math.PI) / 180;
  const spanMeters = boundingBoxSpanMeters(box);
  const raw = Math.log2(
    (EARTH_MERIDIAN_CONSTANT * Math.cos(centerLatRad) * MAP_WIDTH_PX) / (FRAMING_PADDING * spanMeters),
  );
  const z = Math.floor(raw);
  return Math.min(MAX_OVERLAY_ZOOM, Math.max(MIN_OVERLAY_ZOOM, z));
}

// Center + zoom for framing a bounding box on the static map -- the single
// source of truth both staticMapUrl and buildMapMeta read from, so the
// image the user sees and the mapMeta the overlay editor computes pixel
// positions from can never drift apart.
interface OverlayFraming {
  center: GoogleLatLng;
  zoom: number;
}

function overlayFraming(box: BoundingBox): OverlayFraming {
  return { center: boundingBoxCenter(box), zoom: computeOverlayZoom(box) };
}

// Builds the Static Maps request URL. With a bounding box, centers on the
// box's centroid at a computed tight-fit zoom -- the same framing as
// before -- but draws NO overlay (feedback round 6): a server-drawn path=
// polygon is a baked pixel artifact that a client-side outline adjustment
// can never change, which is exactly the bug this fixes. The image is now
// always a clean aerial photo; the outline is drawn in the browser as an
// SVG overlay from mapMeta's corners instead. Without a bounding box, falls
// back to a plain center/zoom satellite view (unchanged).
function staticMapUrl(lat: number, lng: number, apiKey: string, boundingBox: BoundingBox | null | undefined): string {
  const base = 'https://maps.googleapis.com/maps/api/staticmap';
  const common = `size=${MAP_WIDTH_PX}x${MAP_HEIGHT_PX}&scale=${STATIC_MAP_SCALE}&maptype=satellite`;
  if (boundingBox) {
    const { center, zoom } = overlayFraming(boundingBox);
    return `${base}?center=${center.latitude},${center.longitude}&zoom=${zoom}&${common}&key=${apiKey}`;
  }
  return `${base}?center=${lat},${lng}&zoom=20&${common}&key=${apiKey}`;
}

export interface MapMeta {
  centerLat: number;
  centerLng: number;
  zoom: number;
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
  imgW: number;
  imgH: number;
}

// mapMeta for the client-drawn outline overlay (Task B, and its confirm-card
// read-only counterpart added in feedback round 6): the exact center, zoom
// and image pixel dimensions the static map PNG was rendered with, so the
// browser can convert the bounding box corners to pixel positions via Web
// Mercator math that matches the image on screen -- now the ONLY place the
// outline gets drawn, since the image itself is a clean aerial with nothing
// baked in. Derived from the same overlayFraming() + size constants
// staticMapUrl() uses above -- never compute these independently.
export function buildMapMeta(box: BoundingBox): MapMeta {
  const { center, zoom } = overlayFraming(box);
  return {
    centerLat: center.latitude,
    centerLng: center.longitude,
    zoom,
    sw: { lat: box.sw.latitude, lng: box.sw.longitude },
    ne: { lat: box.ne.latitude, lng: box.ne.longitude },
    imgW: MAP_WIDTH_PX * STATIC_MAP_SCALE,
    imgH: MAP_HEIGHT_PX * STATIC_MAP_SCALE,
  };
}

// Fetches a clean satellite Static Maps PNG for the given point -- framed
// tightly on the measured building's bounding box when one is given, but
// with no overlay drawn into the pixels (feedback round 6: the outline is
// drawn client-side from mapMeta instead, so it can actually be adjusted).
// Best-effort: any non-OK response or network failure returns null rather
// than throwing, so callers can treat property imagery as optional and
// never fail measurement on its account.
export async function getStaticMapPng(
  lat: number,
  lng: number,
  apiKey: string,
  boundingBox?: BoundingBox | null,
): Promise<Buffer | null> {
  const url = staticMapUrl(lat, lng, apiKey, boundingBox);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

// --- Places Autocomplete (New), server-side proxy for /api/address-suggest ---

export interface AddressSuggestion {
  description: string;
  placeId: string;
}

// Global Constraints: results filtered to Florida; description contains
// ", FL" for any real Florida street address Google returns.
const FLORIDA_DESCRIPTION_MARKER = ', FL';
const MAX_ADDRESS_SUGGESTIONS = 5;
const AUTOCOMPLETE_TIMEOUT_MS = 3000;

interface PlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
    };
  }>;
}

// Proxies Places Autocomplete (New) so the Google key never reaches the
// client. Returns null on ANY non-200 (including 403 when Places API (New)
// is not yet enabled on the key), network failure, or a fetch that doesn't
// resolve within AUTOCOMPLETE_TIMEOUT_MS -- callers turn that into
// {available:false} rather than throwing. A successful call with no
// Florida-matching predictions returns an empty array, not null.
export async function suggestAddresses(
  input: string,
  sessionToken: string | undefined,
  apiKey: string,
): Promise<AddressSuggestion[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTOCOMPLETE_TIMEOUT_MS);
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({ input, sessionToken, includedRegionCodes: ['us'] }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PlacesAutocompleteResponse;
    const suggestions: AddressSuggestion[] = [];
    for (const item of data.suggestions ?? []) {
      const description = item.placePrediction?.text?.text;
      const placeId = item.placePrediction?.placeId;
      if (!description || !placeId) continue;
      if (!description.includes(FLORIDA_DESCRIPTION_MARKER)) continue;
      suggestions.push({ description, placeId });
      if (suggestions.length >= MAX_ADDRESS_SUGGESTIONS) break;
    }
    return suggestions;
  } catch {
    // Covers network failure and the AbortController timeout firing.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
