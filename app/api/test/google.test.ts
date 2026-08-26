import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import {
  buildMapMeta,
  buildSeedCorners,
  buildSeedMapMeta,
  computeOverlayZoom,
  geocodeAddress,
  geocodeByPlaceId,
  getGoogleApiKey,
  getGroundAreaSqft,
  getStaticMapPng,
  metersToSqft,
  resetGoogleApiKeyCache,
  suggestAddresses,
} from '../src/lib/google';

const ssmMock = mockClient(SSMClient);

beforeEach(() => {
  ssmMock.reset();
  resetGoogleApiKeyCache();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('metersToSqft', () => {
  it('golden: 100 m2 -> 1076.39104167 sqft', () => {
    expect(metersToSqft(100)).toBeCloseTo(1076.39104167, 5);
  });
});

describe('getGoogleApiKey', () => {
  it('returns null and reports unavailable when the SSM value is the "unset" placeholder', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'unset' } });
    const key = await getGoogleApiKey('/chq/google-api-key');
    expect(key).toBeNull();
  });

  it('returns null when the parameter does not exist yet', async () => {
    ssmMock.on(GetParameterCommand).rejects(new ParameterNotFound({ message: 'not found', $metadata: {} }));
    const key = await getGoogleApiKey('/chq/google-api-key');
    expect(key).toBeNull();
  });

  it('returns the real key when present and caches it across calls', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key-123' } });
    const first = await getGoogleApiKey('/chq/google-api-key');
    const second = await getGoogleApiKey('/chq/google-api-key');
    expect(first).toBe('real-key-123');
    expect(second).toBe('real-key-123');
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1);
  });
});

describe('geocodeAddress', () => {
  it('golden: FL filter rejects a GA geocode fixture (parses the wrong state)', async () => {
    const gaFixture = {
      results: [
        {
          address_components: [
            { short_name: 'Atlanta', types: ['locality'] },
            { short_name: 'GA', types: ['administrative_area_level_1'] },
          ],
          geometry: { location: { lat: 33.749, lng: -84.388 } },
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => gaFixture }),
    );
    const result = await geocodeAddress('123 Peachtree St, Atlanta, GA', 'fake-key');
    expect(result.found).toBe(true);
    expect(result.state).toBe('GA');
    expect(result.state).not.toBe('FL');
  });

  it('parses a Florida fixture state correctly', async () => {
    const flFixture = {
      results: [
        {
          address_components: [
            { short_name: 'Tampa', types: ['locality'] },
            { short_name: 'FL', types: ['administrative_area_level_1'] },
          ],
          geometry: { location: { lat: 27.95, lng: -82.46 } },
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => flFixture }),
    );
    const result = await geocodeAddress('123 Main St, Tampa, FL', 'fake-key');
    expect(result.found).toBe(true);
    expect(result.state).toBe('FL');
  });

  it('returns not found when Google has no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
    const result = await geocodeAddress('nonsense address', 'fake-key');
    expect(result.found).toBe(false);
  });

  it('golden: returns formatted_address verbatim as formattedAddress, ZIP included (feedback round 7)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              formatted_address: '8491 60th Street, Pinellas Park, FL 33781, USA',
              address_components: [{ short_name: 'FL', types: ['administrative_area_level_1'] }],
              geometry: { location: { lat: 27.84, lng: -82.68 } },
            },
          ],
        }),
      }),
    );
    const result = await geocodeAddress('8491 60th Street, Pinellas Park, FL', 'fake-key');
    expect(result.formattedAddress).toBe('8491 60th Street, Pinellas Park, FL 33781, USA');
  });
});

describe('geocodeByPlaceId', () => {
  it('requests an exact-match geocode by place_id (no address ambiguity)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            address_components: [{ short_name: 'FL', types: ['administrative_area_level_1'] }],
            geometry: { location: { lat: 27.95, lng: -82.46 } },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeByPlaceId('ChIJ_fake_place_id', 'fake-key');

    expect(result.found).toBe(true);
    expect(result.state).toBe('FL');
    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.get('place_id')).toBe('ChIJ_fake_place_id');
    expect(requestedUrl.searchParams.has('address')).toBe(false);
  });

  it('returns not found when Google has no results for the placeId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
    const result = await geocodeByPlaceId('ChIJ_unknown', 'fake-key');
    expect(result.found).toBe(false);
  });
});

const BBOX_FIXTURE = {
  sw: { latitude: 27.9490, longitude: -82.4610 },
  ne: { latitude: 27.9510, longitude: -82.4590 },
};

describe('getGroundAreaSqft', () => {
  it('converts groundAreaMeters2 to sqft and passes through the boundingBox', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          boundingBox: BBOX_FIXTURE,
          solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } },
        }),
      }),
    );
    const result = await getGroundAreaSqft(27.95, -82.46, 'fake-key');
    expect(result?.groundAreaSqft).toBeCloseTo(150 * 10.7639104167, 5);
    expect(result?.boundingBox).toEqual(BBOX_FIXTURE);
  });

  it('returns boundingBox: null when Solar has ground area but omits the box', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } } }),
      }),
    );
    const result = await getGroundAreaSqft(27.95, -82.46, 'fake-key');
    expect(result?.boundingBox).toBeNull();
  });

  it('returns null when Solar has no roof data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const result = await getGroundAreaSqft(27.95, -82.46, 'fake-key');
    expect(result).toBeNull();
  });

  it('requests requiredQuality=LOW so imagery of any quality is used, not HIGH-only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await getGroundAreaSqft(27.95, -82.46, 'fake-key');

    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.get('requiredQuality')).toBe('LOW');
  });

  it('golden: resolves found (non-null) for a MEDIUM-quality imagery fixture -- the round-5 fix for homes that used to fall to manual', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          boundingBox: BBOX_FIXTURE,
          imageryQuality: 'MEDIUM',
          solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } },
        }),
      }),
    );

    const result = await getGroundAreaSqft(27.95, -82.46, 'fake-key');

    expect(result).not.toBeNull();
    expect(result?.groundAreaSqft).toBeCloseTo(150 * 10.7639104167, 5);
    expect(result?.boundingBox).toEqual(BBOX_FIXTURE);
  });
});

describe('getStaticMapPng', () => {
  it('returns the PNG bytes on a successful fetch', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }),
    );
    const png = await getStaticMapPng(27.95, -82.46, 'fake-key');
    expect(png).toEqual(Buffer.from(bytes));
  });

  it('returns null (never throws) when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const png = await getStaticMapPng(27.95, -82.46, 'fake-key');
    expect(png).toBeNull();
  });

  it('returns null (never throws) when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const png = await getStaticMapPng(27.95, -82.46, 'fake-key');
    expect(png).toBeNull();
  });

  it('golden: draws NO path overlay (feedback round 6 -- outline is drawn client-side now), but keeps the same center/zoom framing as before', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    vi.stubGlobal('fetch', fetchMock);

    await getStaticMapPng(27.95, -82.46, 'fake-key', BBOX_FIXTURE);

    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.has('path')).toBe(false);
    // Framing itself must not change: still centered on the bbox centroid
    // at the same computed tight-fit zoom as before the outline was
    // removed. BBOX_FIXTURE's larger span is its ~222.6m lat side (see the
    // computeOverlayZoom tests below for the arithmetic); that clamps to
    // zoom 18 here.
    expect(requestedUrl.searchParams.get('center')).toBe('27.950000000000003,-82.46000000000001');
    expect(requestedUrl.searchParams.get('zoom')).toBe(String(computeOverlayZoom(BBOX_FIXTURE)));
    expect(requestedUrl.searchParams.get('zoom')).toBe('18');
  });

  it('falls back to a center/zoom URL with no path when the bounding box is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    vi.stubGlobal('fetch', fetchMock);

    await getStaticMapPng(27.95, -82.46, 'fake-key', null);

    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.has('path')).toBe(false);
    expect(requestedUrl.searchParams.get('center')).toBe('27.95,-82.46');
    expect(requestedUrl.searchParams.get('zoom')).toBe('20');
  });
});

describe('computeOverlayZoom', () => {
  // zoom(z) is the largest integer with metersPerPixel(z) small enough that
  // 1.5x the box's larger span fits in 640px, clamped to [17, 20]:
  //   raw = log2(156543.03392 * cos(lat) * 640 / (1.5 * spanMeters))
  //   z   = floor(raw), then clamp

  it('a 15m building at lat 27 clamps to the max zoom (20)', () => {
    // latSpan = 15m exactly (dLat = 15 / 111320 deg), lngSpan = 0, so
    // spanMeters = max(15, 0, 10) = 15.
    // raw = log2(156543.03392 * cos(27deg) * 640 / (1.5 * 15))
    //     = log2(139480.9... * 640 / 22.5) = log2(3,968,624.9... / 22.5)
    //     ~= 21.9198 -> floor 21 -> clamp(17,20) -> 20
    const dLat = 15 / 111320;
    const box = {
      sw: { latitude: 27 - dLat / 2, longitude: -82.46 },
      ne: { latitude: 27 + dLat / 2, longitude: -82.46 },
    };
    expect(computeOverlayZoom(box)).toBe(20);
  });

  it('a 120m building at lat 27 computes to zoom 18 (no clamping needed)', () => {
    // latSpan = 120m exactly (dLat = 120 / 111320 deg), lngSpan = 0, so
    // spanMeters = max(120, 0, 10) = 120.
    // raw = log2(156543.03392 * cos(27deg) * 640 / (1.5 * 120))
    //     ~= 18.9198 -> floor 18 -> clamp(17,20) -> 18
    const dLat = 120 / 111320;
    const box = {
      sw: { latitude: 27 - dLat / 2, longitude: -82.46 },
      ne: { latitude: 27 + dLat / 2, longitude: -82.46 },
    };
    expect(computeOverlayZoom(box)).toBe(18);
  });

  it('a degenerate (point-like) box floors its span at 10m rather than dividing by ~0', () => {
    const box = {
      sw: { latitude: 27, longitude: -82.46 },
      ne: { latitude: 27, longitude: -82.46 },
    };
    // spanMeters = max(0, 0, 10) = 10 -> raw ~= 22.5047 -> floor 22 -> clamp 20
    expect(computeOverlayZoom(box)).toBe(20);
  });

  it('a very large building (300m span) computes to the min zoom (17), still unclamped from above', () => {
    const dLat = 300 / 111320;
    const box = {
      sw: { latitude: 27 - dLat / 2, longitude: -82.46 },
      ne: { latitude: 27 + dLat / 2, longitude: -82.46 },
    };
    // raw ~= 17.5979 -> floor 17 -> clamp(17,20) -> 17
    expect(computeOverlayZoom(box)).toBe(17);
  });

  it('an enormous span clamps to the min zoom (17) rather than floor going below it', () => {
    const dLat = 1000 / 111320;
    const box = {
      sw: { latitude: 27 - dLat / 2, longitude: -82.46 },
      ne: { latitude: 27 + dLat / 2, longitude: -82.46 },
    };
    // raw ~= 15.8609 -> floor 15 -> clamp(17,20) -> 17
    expect(computeOverlayZoom(box)).toBe(17);
  });
});

describe('buildMapMeta', () => {
  it('matches the exact center/zoom the static map URL builder uses for the same box (single source of truth)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    vi.stubGlobal('fetch', fetchMock);

    await getStaticMapPng(27.95, -82.46, 'fake-key', BBOX_FIXTURE);
    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    const meta = buildMapMeta(BBOX_FIXTURE);

    expect(`${meta.centerLat},${meta.centerLng}`).toBe(requestedUrl.searchParams.get('center'));
    expect(String(meta.zoom)).toBe(requestedUrl.searchParams.get('zoom'));
    expect(meta.zoom).toBe(computeOverlayZoom(BBOX_FIXTURE));
  });

  it('passes through sw/ne verbatim and reports the scale-2 pixel dimensions (size=640x400, scale=2)', () => {
    const meta = buildMapMeta(BBOX_FIXTURE);
    expect(meta.sw).toEqual({ lat: BBOX_FIXTURE.sw.latitude, lng: BBOX_FIXTURE.sw.longitude });
    expect(meta.ne).toEqual({ lat: BBOX_FIXTURE.ne.latitude, lng: BBOX_FIXTURE.ne.longitude });
    expect(meta.imgW).toBe(1280);
    expect(meta.imgH).toBe(800);
  });
});

describe('buildSeedCorners', () => {
  it('golden: six points centered on (lat, lng), in sw / w-mid / nw / ne / e-mid / se order, sized ~12m x 10m (~1,300 sqft)', () => {
    const [sw, wMid, nw, ne, eMid, se] = buildSeedCorners(27, -82.46);

    // West edge (sw -> nw) and east edge (ne -> se) each share a
    // longitude; west is strictly less than east.
    expect(sw!.lng).toBeCloseTo(nw!.lng, 9);
    expect(ne!.lng).toBeCloseTo(se!.lng, 9);
    expect(sw!.lng).toBeLessThan(ne!.lng);

    // South edge (sw -> se) and north edge (nw -> ne) each share a
    // latitude; south is strictly less than north.
    expect(sw!.lat).toBeCloseTo(se!.lat, 9);
    expect(nw!.lat).toBeCloseTo(ne!.lat, 9);
    expect(sw!.lat).toBeLessThan(nw!.lat);

    // The two mid points sit at the input latitude, on their own edge's
    // longitude -- exactly the midpoint of the (longer) vertical edge
    // they belong to.
    expect(wMid).toEqual({ lat: 27, lng: sw!.lng });
    expect(eMid).toEqual({ lat: 27, lng: ne!.lng });

    // Centered on the input point.
    expect((sw!.lat + nw!.lat) / 2).toBeCloseTo(27, 9);
    expect((sw!.lng + ne!.lng) / 2).toBeCloseTo(-82.46, 9);

    // ~12m north-south (the longer span) x ~10m east-west -> ~1,300 sqft.
    const nsMeters = (nw!.lat - sw!.lat) * 111320;
    const ewMeters = (ne!.lng - sw!.lng) * 111320 * Math.cos((27 * Math.PI) / 180);
    expect(nsMeters).toBeCloseTo(12, 5);
    expect(ewMeters).toBeCloseTo(10, 5);
    expect(nsMeters * ewMeters * 10.7639104167).toBeCloseTo(1291.67, 0);
  });
});

describe('buildSeedMapMeta', () => {
  it('centers on the geocoded point at the max overlay zoom (20), matching the no-bbox Static Maps fallback', () => {
    const meta = buildSeedMapMeta(27.95, -82.46);
    expect(meta.centerLat).toBe(27.95);
    expect(meta.centerLng).toBe(-82.46);
    expect(meta.zoom).toBe(20);
    expect(meta.imgW).toBe(1280);
    expect(meta.imgH).toBe(800);
  });

  it("reports the seed rectangle's own outer corners as sw/ne (there is no real Solar bbox to frame)", () => {
    const meta = buildSeedMapMeta(27, -82.46);
    const [sw, , , ne] = buildSeedCorners(27, -82.46);
    expect(meta.sw).toEqual({ lat: sw!.lat, lng: sw!.lng });
    expect(meta.ne).toEqual({ lat: ne!.lat, lng: ne!.lng });
  });
});

describe('suggestAddresses', () => {
  function suggestionsResponse(descriptions: Array<{ text: string; placeId: string }>) {
    return {
      ok: true,
      json: async () => ({
        suggestions: descriptions.map((d) => ({
          placePrediction: { placeId: d.placeId, text: { text: d.text } },
        })),
      }),
    };
  }

  it('POSTs to Places Autocomplete (New) with the key header, sessionToken, and includedRegionCodes:["us"]', async () => {
    const fetchMock = vi.fn().mockResolvedValue(suggestionsResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await suggestAddresses('1530 Main St Sar', 'session-abc', 'fake-key');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('fake-key');
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toEqual({
      input: '1530 Main St Sar',
      sessionToken: 'session-abc',
      includedRegionCodes: ['us'],
    });
  });

  it('filters results to Florida (description contains ", FL") and maps to {description, placeId}', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        suggestionsResponse([
          { text: '1530 Main St, Sarasota, FL, USA', placeId: 'place-fl-1' },
          { text: '1530 Main St, Atlanta, GA, USA', placeId: 'place-ga-1' },
          { text: '1531 Main St, Tampa, FL, USA', placeId: 'place-fl-2' },
        ]),
      ),
    );

    const result = await suggestAddresses('1530 Main St', undefined, 'fake-key');

    expect(result).toEqual([
      { description: '1530 Main St, Sarasota, FL, USA', placeId: 'place-fl-1' },
      { description: '1531 Main St, Tampa, FL, USA', placeId: 'place-fl-2' },
    ]);
  });

  it('caps results at 5 even when Google returns more Florida matches', async () => {
    const flDescriptions = Array.from({ length: 8 }, (_, i) => ({
      text: `${100 + i} Main St, Tampa, FL, USA`,
      placeId: `place-${i}`,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(suggestionsResponse(flDescriptions)));

    const result = await suggestAddresses('Main St', undefined, 'fake-key');

    expect(result).toHaveLength(5);
  });

  it('returns null (never throws) on a non-200 response, e.g. 403 when Places API (New) is not yet enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const result = await suggestAddresses('1530 Main St', undefined, 'fake-key');
    expect(result).toBeNull();
  });

  it('returns null (never throws) when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await suggestAddresses('1530 Main St', undefined, 'fake-key');
    expect(result).toBeNull();
  });

  it('returns an empty array (not null) for a successful call with no Florida matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(suggestionsResponse([{ text: '1 Main St, Atlanta, GA, USA', placeId: 'place-ga' }])),
    );
    const result = await suggestAddresses('1 Main St', undefined, 'fake-key');
    expect(result).toEqual([]);
  });
});
