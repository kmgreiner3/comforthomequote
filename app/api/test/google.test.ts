import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import {
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

describe('getGroundAreaSqft', () => {
  it('converts groundAreaMeters2 to sqft', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ solarPotential: { wholeRoofStats: { groundAreaMeters2: 150 } } }),
      }),
    );
    const sqft = await getGroundAreaSqft(27.95, -82.46, 'fake-key');
    expect(sqft).toBeCloseTo(150 * 10.7639104167, 5);
  });

  it('returns null when Solar has no roof data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const sqft = await getGroundAreaSqft(27.95, -82.46, 'fake-key');
    expect(sqft).toBeNull();
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
});
