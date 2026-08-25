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

interface GoogleSolarResponse {
  solarPotential?: {
    wholeRoofStats?: {
      groundAreaMeters2?: number;
    };
  };
}

// Returns the ground-projected roof outline in sq ft (never the pitched 3D
// area), or null when Solar has no data for the location.
export async function getGroundAreaSqft(lat: number, lng: number, apiKey: string): Promise<number | null> {
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as GoogleSolarResponse;
  const groundAreaMeters2 = data.solarPotential?.wholeRoofStats?.groundAreaMeters2;
  if (typeof groundAreaMeters2 !== 'number') return null;
  return metersToSqft(groundAreaMeters2);
}

// Fetches a satellite Static Maps PNG for the given point. Best-effort: any
// non-OK response or network failure returns null rather than throwing, so
// callers can treat property imagery as optional and never fail measurement
// on its account.
export async function getStaticMapPng(lat: number, lng: number, apiKey: string): Promise<Buffer | null> {
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=640x400&scale=2&maptype=satellite&key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}
