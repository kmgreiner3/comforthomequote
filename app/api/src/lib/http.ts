import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

// Minimal JSON response builder for API Gateway HTTP API (payload v2).
export function json(statusCode: number, data: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  };
}

// Hardened (visualizer-live): the FIRST x-forwarded-for hop is client
// supplied and trivially spoofable, so rate-limit keys must never trust it.
// With the execute-api endpoint disabled, every request rides
// client -> CloudFront -> API Gateway, and the only hop we can trust is the
// one CloudFront itself appended: the SECOND-FROM-LAST entry (the last one
// is CloudFront's own address, appended by API Gateway). A single-entry
// header (no CloudFront in front, e.g. tests) falls back to that entry,
// then to the source IP API Gateway records directly.
export function clientIp(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  const forwarded = headers['x-forwarded-for'] ?? headers['X-Forwarded-For'];
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length >= 2) return hops[hops.length - 2] as string;
    if (hops.length === 1) return hops[0] as string;
  }
  return event.requestContext?.http?.sourceIp ?? 'unknown';
}

// Parses the (possibly base64-encoded) JSON body API GW hands the handler.
// Returns null on missing or malformed bodies so callers can 400 uniformly.
export function parseBody<T>(event: APIGatewayProxyEventV2): T | null {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
