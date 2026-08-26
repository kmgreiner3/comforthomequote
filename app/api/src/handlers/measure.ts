import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { clientIp, json, parseBody } from '../lib/http';
import { checkAndIncrement, todayStamp } from '../lib/ratelimit';
import type { BoundingBox } from '../lib/google';
import {
  buildMapMeta,
  buildSeedCorners,
  buildSeedMapMeta,
  geocodeAddress,
  geocodeByPlaceId,
  getGoogleApiKey,
  getGroundAreaSqft,
  getStaticMapPng,
} from '../lib/google';

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

// Cache identity for the property aerial image. A placeId is an opaque,
// case-sensitive exact-match token (must NOT be case-folded the way a
// free-typed address is); prefixed so it can never collide with a
// normalized address string that happens to look the same.
function imageCacheIdentity(address: string | undefined, placeId: string | undefined): string {
  return placeId ? `placeid:${placeId}` : normalizeAddress(address!);
}

// v5: the no-solar-data path (feedback round 7) now fetches/caches an
// aerial for an identity that previously never got one at all (a Solar miss
// used to dead-end before ever calling getPropertyImageUrl), AND that path
// shares this same cache identity (address/placeId) with the found:true
// path -- so without a version bump, an address whose Solar coverage
// changes between calls could serve a stale image framed for the WRONG
// scenario (e.g. a tightly-framed bounding-box image reused for the
// zoom-20 seed-outline framing, or vice versa). Bumping the prefix forces a
// fresh fetch under the current framing decision for every identity. (v4:
// dropped the path= polygon overlay entirely -- the roof outline is drawn
// client-side as an SVG overlay from mapMeta's corners instead, because a
// server-baked pixel outline can never reflect a client-side adjustment.
// v3: computed-zoom tight framing; v2's auto-fit framed the whole city grid
// around a small building instead of the roof itself.) The old maps/*
// objects age out on their own via the existing lifecycle rule (its
// "maps/" prefix still covers "maps/v5/*"), and the measure Lambda's IAM
// policy already scopes to "maps/*", which also still covers "maps/v5/*".
function mapCacheKey(identity: string): string {
  const hash = createHash('sha256').update(identity).digest('hex');
  return `maps/v5/${hash}.png`;
}

// Best-effort property aerial photo: fetches (or reuses a cached) a CLEAN
// Static Maps PNG -- framed on the measured building's bounding box when
// Solar provided one, but with no outline baked into the pixels -- and
// returns a presigned GET url for it. Never throws -- any failure here must
// not fail the measurement, so the caller simply gets no imageUrl back.
async function getPropertyImageUrl(
  identity: string,
  lat: number,
  lng: number,
  apiKey: string,
  boundingBox: BoundingBox | null,
): Promise<string | undefined> {
  const key = mapCacheKey(identity);
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
  placeId?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<MeasureBody>(event);
  const placeId = body?.placeId?.trim();
  const address = body?.address?.trim();
  if (!placeId && !address) {
    return json(400, { error: 'address or placeId is required' });
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

  // placeId (picked from an address-suggest suggestion) resolves via an
  // exact-match geocode -- no ambiguity, unlike the free-typed address
  // path, which is unchanged.
  const geocode = placeId ? await geocodeByPlaceId(placeId, apiKey) : await geocodeAddress(address!, apiKey);
  if (!geocode.found) {
    return json(200, { found: false, reason: 'not-found' });
  }
  if (geocode.state !== 'FL') {
    return json(200, { found: false, reason: 'outside-florida' });
  }

  const solar = await getGroundAreaSqft(geocode.lat!, geocode.lng!, apiKey);
  if (solar === null) {
    // No Solar building data at all -- but the geocode succeeded and it's
    // in Florida, so there's still a point to show an aerial for and a
    // plausible starting rectangle to trace from (feedback round 7): this
    // is what lets the frontend offer roof tracing instead of demanding a
    // manual square-footage number.
    const identity = imageCacheIdentity(address, placeId);
    const imageUrl = await getPropertyImageUrl(identity, geocode.lat!, geocode.lng!, apiKey, null);
    return json(200, {
      found: false,
      reason: 'no-solar-data',
      formattedAddress: geocode.formattedAddress,
      ...(imageUrl ? { imageUrl } : {}),
      mapMeta: buildSeedMapMeta(geocode.lat!, geocode.lng!),
      seedCorners: buildSeedCorners(geocode.lat!, geocode.lng!),
    });
  }
  const { groundAreaSqft: sqft, boundingBox } = solar;
  if (!(sqft > MIN_PLAUSIBLE_SQFT) || !(sqft < MAX_PLAUSIBLE_SQFT)) {
    return json(200, { found: false, reason: 'unlikely-roof-size' });
  }

  const identity = imageCacheIdentity(address, placeId);
  const imageUrl = await getPropertyImageUrl(identity, geocode.lat!, geocode.lng!, apiKey, boundingBox);
  // mapMeta only makes sense alongside an actual outline to adjust -- when
  // Solar has ground area but no boundingBox (see getGroundAreaSqft), there
  // is no rectangle drawn on the image either, so both are omitted together.
  const mapMeta = boundingBox ? buildMapMeta(boundingBox) : undefined;

  return json(200, {
    found: true,
    outlineSqft: sqft,
    formattedAddress: geocode.formattedAddress,
    ...(imageUrl ? { imageUrl } : {}),
    ...(mapMeta ? { mapMeta } : {}),
  });
}
