import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { resetGoogleApiKeyCache } from '../src/lib/google';

process.env.TABLE = 'chq-api-test';
process.env.GOOGLE_KEY_PARAM = '/chq/google-api-key-test';
process.env.BUCKET = 'chq-visualizer-test';
// See vizUpload.test.ts: presigning signs locally, needs real-shaped but
// fake static credentials so it resolves offline and instantly.
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';

const { handler } = await import('../src/handlers/measure');

const ddbMock = mockClient(DynamoDBClient);
const ssmMock = mockClient(SSMClient);
const s3Mock = mockClient(S3Client);

function expectedMapKey(address: string): string {
  const normalized = address.trim().toLowerCase().replace(/\s+/g, ' ');
  return `maps/${createHash('sha256').update(normalized).digest('hex')}.png`;
}

function pngResponse() {
  return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
}

function eventFor(address: string | undefined, ip = '203.0.113.5'): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: address === undefined ? null : JSON.stringify({ address }),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

function flFixture(groundAreaMeters2: number) {
  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            address_components: [{ short_name: 'FL', types: ['administrative_area_level_1'] }],
            geometry: { location: { lat: 27.95, lng: -82.46 } },
          },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ solarPotential: { wholeRoofStats: { groundAreaMeters2 } } }),
    });
}

beforeEach(() => {
  ddbMock.reset();
  ssmMock.reset();
  s3Mock.reset();
  resetGoogleApiKeyCache();
  vi.unstubAllGlobals();
  ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '1' } } });
  // Default: no cached map image (tests that care about a hit override this).
  s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
  s3Mock.on(PutObjectCommand).resolves({});
});

describe('measure handler', () => {
  it('400s when address is missing', async () => {
    const res = await handler(eventFor(undefined));
    expect(res.statusCode).toBe(400);
  });

  it('golden: unset key returns available:false with zero rate-limit increments', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'unset' } });
    const res = await handler(eventFor('123 Main St, Tampa, FL'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ available: false });
    // A no-key response costs nothing (no geocode/Solar call either), so it
    // must not burn the caller's daily quota.
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it('also returns available:false with zero rate-limit increments when the parameter is missing entirely', async () => {
    ssmMock.on(GetParameterCommand).rejects(new ParameterNotFound({ message: 'not found', $metadata: {} }));
    const res = await handler(eventFor('123 Main St, Tampa, FL'));
    expect(JSON.parse(res.body as string)).toEqual({ available: false });
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it('golden: FL filter rejects a GA geocode fixture with reason outside-florida', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              address_components: [{ short_name: 'GA', types: ['administrative_area_level_1'] }],
              geometry: { location: { lat: 33.75, lng: -84.39 } },
            },
          ],
        }),
      }),
    );
    const res = await handler(eventFor('123 Peachtree St, Atlanta, GA'));
    expect(JSON.parse(res.body as string)).toEqual({ found: false, reason: 'outside-florida' });
  });

  it('returns found:true with an unrounded outlineSqft for an in-range FL result', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    vi.stubGlobal('fetch', flFixture(150));
    const res = await handler(eventFor('123 Main St, Tampa, FL'));
    const parsed = JSON.parse(res.body as string);
    expect(parsed.found).toBe(true);
    expect(parsed.outlineSqft).toBeCloseTo(150 * 10.7639104167, 5);
  });

  it('rejects an implausibly large roof outside the clamp range', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    vi.stubGlobal('fetch', flFixture(5000));
    const res = await handler(eventFor('999 Huge Roof Ave, Tampa, FL'));
    expect(JSON.parse(res.body as string)).toEqual({ found: false, reason: 'unlikely-roof-size' });
  });

  it('429s once the per-IP daily cap is exceeded', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '21' } } });
    const res = await handler(eventFor('123 Main St, Tampa, FL'));
    expect(res.statusCode).toBe(429);
  });
});

describe('measure handler property image', () => {
  const ADDRESS = '123 Main St, Tampa, FL';

  it('golden: a cached map image skips the Static Maps fetch and returns imageUrl', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    s3Mock.on(HeadObjectCommand).resolves({});
    const fetchMock = flFixture(150);
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(eventFor(ADDRESS));
    const parsed = JSON.parse(res.body as string);

    expect(parsed.found).toBe(true);
    expect(parsed.imageUrl).toBeTruthy();
    // Only the geocode + Solar calls happened; no third (Static Maps) fetch.
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it('on a cache miss, fetches the Static Maps PNG and stores it under maps/<sha256>.png', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              address_components: [{ short_name: 'FL', types: ['administrative_area_level_1'] }],
              geometry: { location: { lat: 27.95, lng: -82.46 } },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } } }),
      })
      .mockResolvedValueOnce(pngResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(eventFor(ADDRESS));
    const parsed = JSON.parse(res.body as string);

    expect(parsed.found).toBe(true);
    expect(parsed.imageUrl).toBeTruthy();
    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0]?.args[0].input.Key).toBe(expectedMapKey(ADDRESS));
    expect(putCalls[0]?.args[0].input.ContentType).toBe('image/png');
  });

  it('a Static Maps failure still returns found:true without imageUrl, and never stores anything', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              address_components: [{ short_name: 'FL', types: ['administrative_area_level_1'] }],
              geometry: { location: { lat: 27.95, lng: -82.46 } },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } } }),
      })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(eventFor(ADDRESS));
    const parsed = JSON.parse(res.body as string);

    expect(parsed.found).toBe(true);
    expect(parsed.outlineSqft).toBeGreaterThan(0);
    expect(parsed).not.toHaveProperty('imageUrl');
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
    expect(res.body as string).not.toContain('real-key');
  });

  it('never leaks the Google API key into the response body on a successful image fetch', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'super-secret-google-key' } });
    s3Mock.on(HeadObjectCommand).resolves({});
    vi.stubGlobal('fetch', flFixture(150));

    const res = await handler(eventFor(ADDRESS));

    expect(res.body as string).not.toContain('super-secret-google-key');
  });
});
