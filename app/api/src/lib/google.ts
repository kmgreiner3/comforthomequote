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

export async function geocodeAddress(address: string, apiKey: string): Promise<GeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
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
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${apiKey}`;
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

// Static Maps overlay styling for the measured-building polygon: fubo blue,
// translucent fill.
const OVERLAY_PATH_STYLE = 'color:0x2563C9FF|weight:3|fillcolor:0x2563C933';

// Rectangle corners in overlay-drawing order (sw -> nw -> ne -> se -> back
// to sw, closing the polygon), each as a Static Maps "lat,lng" point.
function boundingBoxPathPoints(box: BoundingBox): string[] {
  const { sw, ne } = box;
  return [
    `${sw.latitude},${sw.longitude}`,
    `${ne.latitude},${sw.longitude}`,
    `${ne.latitude},${ne.longitude}`,
    `${sw.latitude},${ne.longitude}`,
    `${sw.latitude},${sw.longitude}`,
  ];
}

// Static Maps auto-fit (no explicit center/zoom) framed the whole city grid
// around a small building, not the building itself -- so instead we always
// send an explicit center (the bounding box's centroid) and a computed
// zoom tight enough to actually show the roof.

const METERS_PER_DEGREE_LAT = 111320;
// Web Mercator meters-per-pixel at zoom 0, equator (256px tiles).
const EARTH_MERIDIAN_CONSTANT = 156543.03392;
// Static Maps image width in logical px (pre `scale=2` doubling) the
// computed zoom must fit the padded bounding box span into.
const MAP_WIDTH_PX = 640;
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

// Builds the Static Maps request URL. With a bounding box, centers on the
// box's centroid at a computed tight-fit zoom and draws the measured
// building as a polygon overlay. Without one, falls back to a plain
// center/zoom satellite view with no overlay.
function staticMapUrl(lat: number, lng: number, apiKey: string, boundingBox: BoundingBox | null | undefined): string {
  const base = 'https://maps.googleapis.com/maps/api/staticmap';
  const common = 'size=640x400&scale=2&maptype=satellite';
  if (boundingBox) {
    const center = boundingBoxCenter(boundingBox);
    const zoom = computeOverlayZoom(boundingBox);
    const path = `${OVERLAY_PATH_STYLE}|${boundingBoxPathPoints(boundingBox).join('|')}`;
    return `${base}?center=${center.latitude},${center.longitude}&zoom=${zoom}&path=${encodeURIComponent(path)}&${common}&key=${apiKey}`;
  }
  return `${base}?center=${lat},${lng}&zoom=20&${common}&key=${apiKey}`;
}

// Fetches a satellite Static Maps PNG for the given point, optionally
// overlaid with the measured building's bounding box. Best-effort: any
// non-OK response or network failure returns null rather than throwing, so
// callers can treat property imagery as optional and never fail measurement
// on its account.
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
