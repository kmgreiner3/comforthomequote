import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { clientIp, json, parseBody } from '../lib/http';
import { checkAndIncrement, todayStamp } from '../lib/ratelimit';
import { getGoogleApiKey, suggestAddresses } from '../lib/google';

const TABLE = process.env.TABLE ?? '';
const GOOGLE_KEY_PARAM = process.env.GOOGLE_KEY_PARAM ?? '';

// Global Constraints: address-suggest capped at 100/IP/day (same limiter
// mechanism as measure, just a separate pk prefix/cap).
const SUGGEST_CAP_PER_IP_PER_DAY = 100;

interface AddressSuggestBody {
  input?: string;
  sessionToken?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<AddressSuggestBody>(event);
  const input = body?.input?.trim();
  if (!input) {
    return json(400, { error: 'input is required' });
  }

  // Resolve the Google key before touching the rate limit: calls made
  // while the key is unset/missing (or Places API (New) isn't enabled on
  // it yet) are free, so they must not burn a caller's daily quota for an
  // {available:false} response.
  const apiKey = await getGoogleApiKey(GOOGLE_KEY_PARAM);
  if (!apiKey) {
    return json(200, { available: false });
  }

  const ip = clientIp(event);
  const withinCap = await checkAndIncrement(TABLE, `suggest#ip#${ip}#${todayStamp()}`, SUGGEST_CAP_PER_IP_PER_DAY);
  if (!withinCap) {
    return json(429, { error: 'rate limit exceeded' });
  }

  const suggestions = await suggestAddresses(input, body?.sessionToken, apiKey);
  // Any non-200 from Places (including 403 "API not enabled"), a network
  // failure, or a timeout comes back as null -- degrade to available:false
  // so the client falls back to a plain input rather than erroring.
  if (suggestions === null) {
    return json(200, { available: false });
  }

  return json(200, { suggestions });
}
