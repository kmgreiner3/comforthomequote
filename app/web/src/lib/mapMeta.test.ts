import { describe, expect, it } from 'vitest';
import { isMapMeta } from './mapMeta';

const VALID = {
  centerLat: 27.336,
  centerLng: -82.54,
  zoom: 20,
  sw: { lat: 27.3, lng: -82.6 },
  ne: { lat: 27.4, lng: -82.5 },
  imgW: 1280,
  imgH: 800,
};

describe('isMapMeta', () => {
  it('accepts a well-formed mapMeta object', () => {
    expect(isMapMeta(VALID)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['missing centerLat', { ...VALID, centerLat: undefined }],
    ['missing zoom', { ...VALID, zoom: undefined }],
    ['missing imgW', { ...VALID, imgW: undefined }],
    ['non-numeric imgH', { ...VALID, imgH: '800' }],
    ['missing sw', { ...VALID, sw: undefined }],
    ['sw missing lng', { ...VALID, sw: { lat: 27.3 } }],
    ['ne not an object', { ...VALID, ne: 'nope' }],
    ['NaN centerLat', { ...VALID, centerLat: NaN }],
  ])('rejects %s', (_label, value) => {
    expect(isMapMeta(value)).toBe(false);
  });
});
