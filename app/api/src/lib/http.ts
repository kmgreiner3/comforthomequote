import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

// Minimal JSON response builder for API Gateway HTTP API (payload v2).
export function json(statusCode: number, data: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  };
}

// First hop of x-forwarded-for is the original client (CloudFront/API GW
// append hops as the request travels, they do not rewrite earlier ones).
// Falls back to the source IP API GW records directly.
export function clientIp(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  const forwarded = headers['x-forwarded-for'] ?? headers['X-Forwarded-For'];
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
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
