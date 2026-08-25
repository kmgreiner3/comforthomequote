import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { clientIp, json, parseBody } from '../lib/http';
import { checkAndIncrement, todayStamp } from '../lib/ratelimit';
import { geocodeAddress, getGoogleApiKey, getGroundAreaSqft } from '../lib/google';

const TABLE = process.env.TABLE ?? '';
const GOOGLE_KEY_PARAM = process.env.GOOGLE_KEY_PARAM ?? '';

// Global Constraints: measure capped at 20/IP/day.
const MEASURE_CAP_PER_IP_PER_DAY = 20;

// Global Constraints: reject outline results outside this open interval;
// the frontend applies sqFromOutline() (x1.2) on top of whatever we return.
const MIN_PLAUSIBLE_SQFT = 100;
const MAX_PLAUSIBLE_SQFT = 20000;

interface MeasureBody {
  address?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<MeasureBody>(event);
  const address = body?.address?.trim();
  if (!address) {
    return json(400, { error: 'address is required' });
  }

  const ip = clientIp(event);
  const withinCap = await checkAndIncrement(TABLE, `measure#ip#${ip}#${todayStamp()}`, MEASURE_CAP_PER_IP_PER_DAY);
  if (!withinCap) {
    return json(429, { error: 'rate limit exceeded' });
  }

  const apiKey = await getGoogleApiKey(GOOGLE_KEY_PARAM);
  if (!apiKey) {
    return json(200, { available: false });
  }

  const geocode = await geocodeAddress(address, apiKey);
  if (!geocode.found) {
    return json(200, { found: false, reason: 'not-found' });
  }
  if (geocode.state !== 'FL') {
    return json(200, { found: false, reason: 'outside-florida' });
  }

  const sqft = await getGroundAreaSqft(geocode.lat!, geocode.lng!, apiKey);
  if (sqft === null) {
    return json(200, { found: false, reason: 'no-roof-data' });
  }
  if (!(sqft > MIN_PLAUSIBLE_SQFT) || !(sqft < MAX_PLAUSIBLE_SQFT)) {
    return json(200, { found: false, reason: 'unlikely-roof-size' });
  }

  return json(200, { found: true, outlineSqft: sqft });
}
