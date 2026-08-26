import { describe, expect, it } from 'vitest';
import {
  areaM2ToSqft,
  imagePxToMetersFromCenter,
  latLngToImagePx,
  metersPerImagePixel,
  shoelaceAreaM2,
} from './mercator';
import type { MapMeta } from './mapMeta';

// A plausible mapMeta for a small residential lot, matching the shape
// app/api's buildMapMeta returns (1280x800 = scale-2 of the 640x400 Static
// Maps request).
const BASE_META: MapMeta = {
  centerLat: 27,
  centerLng: -82.5,
  zoom: 20,
  sw: { lat: 26.9999, lng: -82.5001 },
  ne: { lat: 27.0001, lng: -82.4999 },
  imgW: 1280,
  imgH: 800,
};

describe('shoelaceAreaM2 + areaM2ToSqft: golden', () => {
  it('a 20m x 15m rectangle at lat 27 -> 300 m2 -> 3229.17 sqft', () => {
    // Axis-aligned rectangle centered on the origin in meter-offset space:
    // 20m wide (x), 15m tall (y). Winding order doesn't matter (abs()'d).
    const corners = [
      { dxMeters: -10, dyMeters: -7.5 },
      { dxMeters: 10, dyMeters: -7.5 },
      { dxMeters: 10, dyMeters: 7.5 },
      { dxMeters: -10, dyMeters: 7.5 },
    ];
    const areaM2 = shoelaceAreaM2(corners);
    expect(areaM2).toBeCloseTo(300, 6);

    const sqft = areaM2ToSqft(areaM2);
    expect(sqft).toBeCloseTo(3229.17, 2);
  });

  it('is invariant to winding order (reversed corners give the same area)', () => {
    const cw = [
      { dxMeters: -10, dyMeters: -7.5 },
      { dxMeters: 10, dyMeters: -7.5 },
      { dxMeters: 10, dyMeters: 7.5 },
      { dxMeters: -10, dyMeters: 7.5 },
    ];
    const ccw = [...cw].reverse();
    expect(shoelaceAreaM2(cw)).toBeCloseTo(shoelaceAreaM2(ccw), 10);
  });
});

describe('metersPerImagePixel', () => {
  it('matches the brief formula directly: (156543.03392 * cos(lat) / 2^zoom) / 2', () => {
    const lat = 27;
    const zoom = 20;
    const expected = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom / 2;
    expect(metersPerImagePixel(lat, zoom)).toBeCloseTo(expected, 12);
  });

  it('is smaller at higher zoom (more pixels covering the same ground)', () => {
    expect(metersPerImagePixel(27, 20)).toBeLessThan(metersPerImagePixel(27, 19));
  });
});

describe('latLngToImagePx + imagePxToMetersFromCenter: roundtrip', () => {
  it('the map center projects to the exact center of the image', () => {
    const px = latLngToImagePx(BASE_META.centerLat, BASE_META.centerLng, BASE_META);
    expect(px.x).toBeCloseTo(BASE_META.imgW / 2, 6);
    expect(px.y).toBeCloseTo(BASE_META.imgH / 2, 6);

    const meters = imagePxToMetersFromCenter(px, BASE_META);
    expect(meters.dxMeters).toBeCloseTo(0, 6);
    expect(meters.dyMeters).toBeCloseTo(0, 6);
  });

  it('a bbox corner projected to px and back to meters matches a direct planar approximation within 1%', () => {
    const meta = BASE_META;
    const corner = { lat: meta.ne.lat, lng: meta.ne.lng }; // NE corner
    const centerLatRad = (meta.centerLat * Math.PI) / 180;

    // Direct planar (haversine-ish, adequate at this scale) approximation:
    // meters-per-degree-latitude is ~constant; meters-per-degree-longitude
    // scales by cos(latitude).
    const METERS_PER_DEGREE_LAT = 111320;
    const dLat = corner.lat - meta.centerLat;
    const dLng = corner.lng - meta.centerLng;
    const directDyMeters = dLat * METERS_PER_DEGREE_LAT; // north-positive
    const directDxMeters = dLng * METERS_PER_DEGREE_LAT * Math.cos(centerLatRad); // east-positive
    const directMagnitude = Math.sqrt(directDxMeters ** 2 + directDyMeters ** 2);

    const px = latLngToImagePx(corner.lat, corner.lng, meta);
    const { dxMeters, dyMeters } = imagePxToMetersFromCenter(px, meta);
    // imagePxToMetersFromCenter's dyMeters is south-positive (screen-down,
    // unflipped) -- flip sign before comparing to the north-positive direct
    // approximation. dxMeters is already east-positive in both.
    const projectedMagnitude = Math.sqrt(dxMeters ** 2 + (-dyMeters) ** 2);

    expect(Math.abs(projectedMagnitude - directMagnitude) / directMagnitude).toBeLessThan(0.01);
    // And the individual axes agree in sign/magnitude, not just the
    // combined magnitude.
    expect(dxMeters).toBeCloseTo(directDxMeters, 0);
    expect(-dyMeters).toBeCloseTo(directDyMeters, 0);
  });

  it('four bbox corners projected to px and converted to meters produce the expected rectangle area', () => {
    const meta: MapMeta = {
      centerLat: 27,
      centerLng: -82.5,
      zoom: 21,
      // A bounding box roughly 20m (lng span) x 15m (lat span) around the
      // center at lat 27 -- lat span 15m: 15/111320 deg; lng span 20m:
      // 20/(111320*cos(27deg)) deg.
      sw: { lat: 27 - 7.5 / 111320, lng: -82.5 - 10 / (111320 * Math.cos((27 * Math.PI) / 180)) },
      ne: { lat: 27 + 7.5 / 111320, lng: -82.5 + 10 / (111320 * Math.cos((27 * Math.PI) / 180)) },
      imgW: 1280,
      imgH: 800,
    };

    const latLngCorners = [
      { lat: meta.sw.lat, lng: meta.sw.lng },
      { lat: meta.ne.lat, lng: meta.sw.lng },
      { lat: meta.ne.lat, lng: meta.ne.lng },
      { lat: meta.sw.lat, lng: meta.ne.lng },
    ];
    const metersCorners = latLngCorners
      .map(({ lat, lng }) => latLngToImagePx(lat, lng, meta))
      .map((px) => imagePxToMetersFromCenter(px, meta));

    const areaM2 = shoelaceAreaM2(metersCorners);
    expect(areaM2).toBeCloseTo(300, 0); // ~20m x 15m = 300 m2, within rounding
  });
});
