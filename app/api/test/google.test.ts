import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import {
  computeOverlayZoom,
  geocodeAddress,
  getGoogleApiKey,
  getGroundAreaSqft,
  getStaticMapPng,
  metersToSqft,
  resetGoogleApiKeyCache,
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

  it('draws a polygon overlay path with the 5 bounding-box corners, centered on the box with a computed tight-fit zoom', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    vi.stubGlobal('fetch', fetchMock);

    await getStaticMapPng(27.95, -82.46, 'fake-key', BBOX_FIXTURE);

    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    const path = decodeURIComponent(requestedUrl.searchParams.get('path')!);
    expect(path).toContain('color:0x2563C9FF');
    expect(path).toContain('weight:3');
    expect(path).toContain('fillcolor:0x2563C933');
    const points = [
      '27.949,-82.461',
      '27.951,-82.461',
      '27.951,-82.459',
      '27.949,-82.459',
      '27.949,-82.461',
    ];
    expect(path.split('|').slice(-5)).toEqual(points);
    // Static Maps auto-fit (no center/zoom) framed the whole city grid
    // around the building instead of the building itself -- center on the
    // bbox centroid at a computed zoom instead. BBOX_FIXTURE's larger span
    // is its ~222.6m lat side (see the computeOverlayZoom tests below for
    // the arithmetic); that clamps to zoom 18 here.
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
