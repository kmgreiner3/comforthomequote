import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { clientIp, json, parseBody } from '../lib/http';
import { checkAndIncrement, todayStamp } from '../lib/ratelimit';
import type { BoundingBox } from '../lib/google';
import { geocodeAddress, getGoogleApiKey, getGroundAreaSqft, getStaticMapPng } from '../lib/google';

// Module-scope client so aws-sdk-client-mock's mockClient(S3Client)
// intercepts every call regardless of which handler imports this module.
const s3 = new S3Client({});

const TABLE = process.env.TABLE ?? '';
const GOOGLE_KEY_PARAM = process.env.GOOGLE_KEY_PARAM ?? '';
const BUCKET = process.env.BUCKET ?? '';

// Global Constraints: measure capped at 20/IP/day.
const MEASURE_CAP_PER_IP_PER_DAY = 20;

// Global Constraints: reject outline results outside this open interval;
// the frontend applies sqFromOutline() (x1.2) on top of whatever we return.
const MIN_PLAUSIBLE_SQFT = 100;
const MAX_PLAUSIBLE_SQFT = 20000;

const IMAGE_GET_URL_EXPIRY_SECONDS = 60 * 60;

// Collapses whitespace/case variation so the same physical address always
// maps to the same cache key, regardless of how the caller formatted it.
function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

// v2: filenames now bake in the bounding-box overlay (see getStaticMapPng).
// Bumping the prefix means previously cached overlay-less images regenerate
// instead of being served stale; the old maps/ objects age out on their own
// via the existing lifecycle rule (its "maps/" prefix still covers
// "maps/v2/*"), and the measure Lambda's IAM policy already scopes to
// "maps/*", which also still covers "maps/v2/*".
function mapCacheKey(address: string): string {
  const hash = createHash('sha256').update(normalizeAddress(address)).digest('hex');
  return `maps/v2/${hash}.png`;
}

// Best-effort property aerial photo: fetches (or reuses a cached) Static
// Maps PNG -- overlaid with the measured building's bounding box when Solar
// provided one -- and returns a presigned GET url for it. Never throws --
// any failure here must not fail the measurement, so the caller simply gets
// no imageUrl back.
async function getPropertyImageUrl(
  address: string,
  lat: number,
  lng: number,
  apiKey: string,
  boundingBox: BoundingBox | null,
): Promise<string | undefined> {
  const key = mapCacheKey(address);
  try {
    const cacheHit = await s3
      .send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
      .then(() => true)
      .catch(() => false);

    let objectReady = cacheHit;
    if (!cacheHit) {
      const png = await getStaticMapPng(lat, lng, apiKey, boundingBox);
      if (png) {
        await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: png, ContentType: 'image/png' }));
        objectReady = true;
      }
    }

    if (!objectReady) return undefined;
    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
      expiresIn: IMAGE_GET_URL_EXPIRY_SECONDS,
    });
  } catch {
    return undefined;
  }
}

interface MeasureBody {
  address?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<MeasureBody>(event);
  const address = body?.address?.trim();
  if (!address) {
    return json(400, { error: 'address is required' });
  }

  // Resolve the Google key before touching the rate limit: calls made while
  // the key is unset/missing are free (no geocode/Solar cost), so they must
  // not burn a caller's daily quota for an {available:false} response.
  const apiKey = await getGoogleApiKey(GOOGLE_KEY_PARAM);
  if (!apiKey) {
    return json(200, { available: false });
  }

  const ip = clientIp(event);
  const withinCap = await checkAndIncrement(TABLE, `measure#ip#${ip}#${todayStamp()}`, MEASURE_CAP_PER_IP_PER_DAY);
  if (!withinCap) {
    return json(429, { error: 'rate limit exceeded' });
  }

  const geocode = await geocodeAddress(address, apiKey);
  if (!geocode.found) {
    return json(200, { found: false, reason: 'not-found' });
  }
  if (geocode.state !== 'FL') {
    return json(200, { found: false, reason: 'outside-florida' });
  }

  const solar = await getGroundAreaSqft(geocode.lat!, geocode.lng!, apiKey);
  if (solar === null) {
    return json(200, { found: false, reason: 'no-roof-data' });
  }
  const { groundAreaSqft: sqft, boundingBox } = solar;
  if (!(sqft > MIN_PLAUSIBLE_SQFT) || !(sqft < MAX_PLAUSIBLE_SQFT)) {
    return json(200, { found: false, reason: 'unlikely-roof-size' });
  }

  const imageUrl = await getPropertyImageUrl(address, geocode.lat!, geocode.lng!, apiKey, boundingBox);

  return json(200, { found: true, outlineSqft: sqft, ...(imageUrl ? { imageUrl } : {}) });
}
