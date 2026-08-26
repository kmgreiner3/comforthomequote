import { describe, expect, it } from 'vitest';
import { isLatLngCorner, isLatLngCornerArray, isMapMeta } from './mapMeta';

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

// Feedback round 7 (Task C item 4/2): defensive parsing for the no-solar-
// data response's seedCorners field, and for the trace outcome cached in
// measurementAttempt.
describe('isLatLngCorner', () => {
  it('accepts a well-formed corner', () => {
    expect(isLatLngCorner({ lat: 27.336, lng: -82.54 })).toBe(true);
  });

  it.each([
    ['null', null],
    ['missing lng', { lat: 27.336 }],
    ['non-numeric lat', { lat: '27.336', lng: -82.54 }],
    ['NaN lng', { lat: 27.336, lng: NaN }],
  ])('rejects %s', (_label, value) => {
    expect(isLatLngCorner(value)).toBe(false);
  });
});

describe('isLatLngCornerArray', () => {
  const CORNER = { lat: 27.336, lng: -82.54 };

  it('accepts a 6-point array (the current outline shape)', () => {
    expect(isLatLngCornerArray([CORNER, CORNER, CORNER, CORNER, CORNER, CORNER])).toBe(true);
  });

  it('accepts a 4-point array too (lenient on length -- the caller decides what to do with it)', () => {
    expect(isLatLngCornerArray([CORNER, CORNER, CORNER, CORNER])).toBe(true);
  });

  it.each([
    ['not an array', { lat: 27.336, lng: -82.54 }],
    ['too short (< 3 points)', [CORNER, CORNER]],
    ['contains a non-corner element', [CORNER, CORNER, CORNER, { lat: 27.336 }]],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isLatLngCornerArray(value)).toBe(false);
  });
});
