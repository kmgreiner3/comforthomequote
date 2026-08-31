import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { clientIp } from '../src/lib/http';

function evt(xff?: string, sourceIp?: string): APIGatewayProxyEventV2 {
  return {
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
    requestContext: sourceIp ? { http: { sourceIp } } : undefined,
  } as unknown as APIGatewayProxyEventV2;
}

describe('clientIp', () => {
  it('takes the second-from-last hop: CloudFront appended the real client, API GW appended CloudFront', () => {
    expect(clientIp(evt('198.51.100.7, 203.0.113.5, 64.252.72.10'))).toBe('203.0.113.5');
  });

  it('ignores a spoofed client-supplied prefix entirely', () => {
    expect(clientIp(evt('1.1.1.1, 2.2.2.2, 203.0.113.5, 64.252.72.10'))).toBe('203.0.113.5');
  });

  it('falls back to the single entry when only one hop is present', () => {
    expect(clientIp(evt('203.0.113.5'))).toBe('203.0.113.5');
  });

  it('falls back to sourceIp with no header at all', () => {
    expect(clientIp(evt(undefined, '203.0.113.9'))).toBe('203.0.113.9');
  });
});
