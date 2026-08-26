import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearMeasurementAttempt,
  getMeasurementAttempt,
  setMeasurementAttempt,
  type MeasurementAttempt,
} from './measurementAttempt';

const STORAGE_KEY = 'chq-measure-attempt-v1';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

const MAP_META = {
  centerLat: 27.336230049999998,
  centerLng: -82.539976,
  zoom: 20,
  sw: { lat: 27.3360897, lng: -82.5400199 },
  ne: { lat: 27.3363704, lng: -82.5399321 },
  imgW: 1280,
  imgH: 800,
};
const SEED_CORNERS = [
  { lat: 27.1, lng: -82.1 },
  { lat: 27.10005, lng: -82.1 },
  { lat: 27.1001, lng: -82.1 },
  { lat: 27.1001, lng: -82.0999 },
  { lat: 27.10005, lng: -82.0999 },
  { lat: 27.1, lng: -82.0999 },
];

describe('measurementAttempt: found outcome (unchanged)', () => {
  it('round-trips a found attempt with imageUrl/mapMeta', () => {
    const attempt: MeasurementAttempt = {
      address: '123 Palm Ave, Tampa, FL 33602',
      outcome: 'found',
      sqft: 2308.32,
      imageUrl: 'https://x/a.png',
      mapMeta: MAP_META,
    };
    setMeasurementAttempt(attempt);
    expect(getMeasurementAttempt()).toEqual(attempt);
  });
});

// Feedback round 7 (Task C item 2): the new 'trace' outcome for a
// no-solar-data response that still came with imagery.
describe('measurementAttempt: trace outcome (feedback round 7)', () => {
  it('round-trips a trace attempt with imageUrl/mapMeta/seedCorners', () => {
    const attempt: MeasurementAttempt = {
      address: '123 Palm Ave, Tampa, FL 33602',
      outcome: 'trace',
      imageUrl: 'https://x/seed.png',
      mapMeta: MAP_META,
      seedCorners: SEED_CORNERS,
    };
    setMeasurementAttempt(attempt);
    expect(getMeasurementAttempt()).toEqual(attempt);
  });

  it('rejects (returns null) a trace attempt missing seedCorners -- never crashes on a malformed cache entry', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ address: '123 Palm Ave, Tampa, FL 33602', outcome: 'trace', imageUrl: 'https://x/seed.png', mapMeta: MAP_META })
    );
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('rejects a trace attempt with a malformed mapMeta', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        address: '123 Palm Ave, Tampa, FL 33602',
        outcome: 'trace',
        imageUrl: 'https://x/seed.png',
        mapMeta: { notAMapMeta: true },
        seedCorners: SEED_CORNERS,
      })
    );
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('rejects a trace attempt with a non-array seedCorners', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        address: '123 Palm Ave, Tampa, FL 33602',
        outcome: 'trace',
        imageUrl: 'https://x/seed.png',
        mapMeta: MAP_META,
        seedCorners: 'nope',
      })
    );
    expect(getMeasurementAttempt()).toBeNull();
  });
});

describe('measurementAttempt: outside-florida / fallback (unchanged)', () => {
  it('round-trips outside-florida', () => {
    setMeasurementAttempt({ address: '1 Peachtree St, Atlanta, GA', outcome: 'outside-florida' });
    expect(getMeasurementAttempt()).toEqual({ address: '1 Peachtree St, Atlanta, GA', outcome: 'outside-florida' });
  });

  it('round-trips fallback', () => {
    setMeasurementAttempt({ address: '1 Main St', outcome: 'fallback' });
    expect(getMeasurementAttempt()).toEqual({ address: '1 Main St', outcome: 'fallback' });
  });
});

describe('measurementAttempt: clear / malformed storage', () => {
  it('returns null when nothing is stored', () => {
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('clearMeasurementAttempt removes the stored entry', () => {
    setMeasurementAttempt({ address: '1 Main St', outcome: 'fallback' });
    clearMeasurementAttempt();
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('returns null (never throws) on malformed JSON in storage', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json');
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('returns null for an unrecognized outcome value', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ address: '1 Main St', outcome: 'something-else' }));
    expect(getMeasurementAttempt()).toBeNull();
  });
});
