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
  return `maps/v4/${createHash('sha256').update(normalized).digest('hex')}.png`;
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

function eventForBody(body: Record<string, unknown>, ip = '203.0.113.5'): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

const BBOX_FIXTURE = {
  sw: { latitude: 27.949, longitude: -82.461 },
  ne: { latitude: 27.951, longitude: -82.459 },
};

function flFixture(groundAreaMeters2: number, boundingBox: unknown = BBOX_FIXTURE) {
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
      json: async () => ({
        ...(boundingBox ? { boundingBox } : {}),
        solarPotential: { wholeRoofStats: { groundAreaMeters2 } },
      }),
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
  it('400s when both address and placeId are missing', async () => {
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

describe('measure handler placeId path', () => {
  it('golden: geocodes by place_id (exact match) instead of address when placeId is present', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    const fetchMock = flFixture(150);
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(eventForBody({ placeId: 'ChIJ_fake_place_id' }));
    const parsed = JSON.parse(res.body as string);

    expect(parsed.found).toBe(true);
    const geocodeUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(geocodeUrl.searchParams.get('place_id')).toBe('ChIJ_fake_place_id');
    expect(geocodeUrl.searchParams.has('address')).toBe(false);
  });

  it('applies the same FL filter and rate limit as the address path', async () => {
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
    const res = await handler(eventForBody({ placeId: 'ChIJ_ga_place' }));
    expect(JSON.parse(res.body as string)).toEqual({ found: false, reason: 'outside-florida' });
  });
});

describe('measure handler mapMeta', () => {
  const ADDRESS = '123 Main St, Tampa, FL';

  it('golden: found:true includes mapMeta consistent with the bounding box (single source of truth with the image)', async () => {
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
        json: async () => ({ boundingBox: BBOX_FIXTURE, solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } } }),
      })
      .mockResolvedValueOnce(pngResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(eventFor(ADDRESS));
    const parsed = JSON.parse(res.body as string);

    expect(parsed.found).toBe(true);
    expect(parsed.mapMeta).toEqual({
      centerLat: 27.950000000000003,
      centerLng: -82.46000000000001,
      zoom: 18,
      sw: { lat: BBOX_FIXTURE.sw.latitude, lng: BBOX_FIXTURE.sw.longitude },
      ne: { lat: BBOX_FIXTURE.ne.latitude, lng: BBOX_FIXTURE.ne.longitude },
      imgW: 1280,
      imgH: 800,
    });
    // Consistency check against the actual Static Maps URL built for the
    // same request (fetch call index 2, after geocode + solar).
    const mapUrl = new URL(fetchMock.mock.calls[2]![0] as string);
    expect(String(parsed.mapMeta.zoom)).toBe(mapUrl.searchParams.get('zoom'));
    expect(`${parsed.mapMeta.centerLat},${parsed.mapMeta.centerLng}`).toBe(mapUrl.searchParams.get('center'));
  });

  it('omits mapMeta when Solar has ground area but no boundingBox (no rectangle to adjust)', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    vi.stubGlobal('fetch', flFixture(150, null));

    const res = await handler(eventFor(ADDRESS));
    const parsed = JSON.parse(res.body as string);

    expect(parsed.found).toBe(true);
    expect(parsed).not.toHaveProperty('mapMeta');
  });

  it('never leaks the Google API key via mapMeta or anywhere else in the response', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'super-secret-google-key' } });
    vi.stubGlobal('fetch', flFixture(150));

    const res = await handler(eventFor(ADDRESS));

    expect(res.body as string).not.toContain('super-secret-google-key');
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

  it('on a cache miss, fetches the Static Maps PNG and stores it under maps/v4/<sha256>.png', async () => {
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

  it('golden: the stored aerial has NO path overlay baked in (feedback round 6), but keeps the same center/zoom framing as before', async () => {
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
        json: async () => ({
          boundingBox: BBOX_FIXTURE,
          solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } },
        }),
      })
      .mockResolvedValueOnce(pngResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(eventFor(ADDRESS));
    const parsed = JSON.parse(res.body as string);
    expect(parsed.found).toBe(true);
    expect(parsed.imageUrl).toBeTruthy();

    const mapUrl = new URL(fetchMock.mock.calls[2]![0] as string);
    // The root-cause fix: no path= overlay drawn into the fetched pixels at
    // all, regardless of the bounding box -- the outline is now drawn
    // client-side from mapMeta instead, so an adjustment can actually
    // change what's rendered.
    expect(mapUrl.searchParams.has('path')).toBe(false);
    // Framing itself is unchanged: still centered on the bbox centroid at
    // a computed tight-fit zoom (BBOX_FIXTURE's ~222.6m larger span clamps
    // to zoom 18; see google.test.ts's computeOverlayZoom tests for the
    // arithmetic).
    expect(mapUrl.searchParams.get('center')).toBe('27.950000000000003,-82.46000000000001');
    expect(mapUrl.searchParams.get('zoom')).toBe('18');
    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls[0]?.args[0].input.Key).toBe(expectedMapKey(ADDRESS));
  });

  it('falls back to a plain center/zoom Static Maps URL (no path) when Solar omits the bounding box', async () => {
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

    const mapUrl = new URL(fetchMock.mock.calls[2]![0] as string);
    expect(mapUrl.searchParams.has('path')).toBe(false);
    expect(mapUrl.searchParams.get('center')).toBe('27.95,-82.46');
    expect(mapUrl.searchParams.get('zoom')).toBe('20');
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
