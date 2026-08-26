import { describe, expect, it } from 'vitest';
import {
  areaM2ToSqft,
  areaSqftFromLatLngCorners,
  imagePxToLatLng,
  imagePxToMetersFromCenter,
  latLngToImagePx,
  metersPerImagePixel,
  polygonSelfIntersects,
  shoelaceAreaM2,
  SQM_TO_SQFT,
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

  // Feedback round 7 (Task C item 4): the outline editor moves from 4
  // corners to 6, specifically so a homeowner can drag a midpoint inward
  // and trace an L-shaped footprint. Confirms shoelaceAreaM2 handles that
  // 6-point n-gon correctly, not just a 4-point rectangle.
  it('golden: a 6-point L-shape (full 20m x 15m rect minus an 8m x 6m notch) -> 252 m2 -> ~2712.5 sqft', () => {
    // Boundary traced clockwise starting at the sw corner of the full
    // 20m(x) x 15m(y) rectangle used by the plain-rectangle golden above;
    // the notch is cut from the NE quadrant. Hand-computed area: full rect
    // (20 x 15 = 300 m2) minus the notch (8m wide x 6m tall = 48 m2) =
    // 252 m2.
    const lShape = [
      { dxMeters: -10, dyMeters: -7.5 }, // sw
      { dxMeters: -10, dyMeters: 7.5 }, // nw
      { dxMeters: 2, dyMeters: 7.5 }, // notch outer corner (rectangle's ne would be (10, 7.5))
      { dxMeters: 2, dyMeters: 1.5 }, // notch inner corner
      { dxMeters: 10, dyMeters: 1.5 }, // notch outer corner (rectangle's e-mid would be (10, 0))
      { dxMeters: 10, dyMeters: -7.5 }, // se
    ];
    const areaM2 = shoelaceAreaM2(lShape);
    expect(areaM2).toBeCloseTo(252, 6);
    expect(areaM2ToSqft(areaM2)).toBeCloseTo(252 * SQM_TO_SQFT, 6);
    expect(areaM2ToSqft(areaM2)).toBeCloseTo(2712.51, 1);
  });
});

describe('areaSqftFromLatLngCorners', () => {
  it('matches the manual latLngToImagePx -> imagePxToMetersFromCenter -> shoelace pipeline', () => {
    const meta: MapMeta = {
      centerLat: 27,
      centerLng: -82.5,
      zoom: 21,
      sw: { lat: 27 - 7.5 / 111320, lng: -82.5 - 10 / (111320 * Math.cos((27 * Math.PI) / 180)) },
      ne: { lat: 27 + 7.5 / 111320, lng: -82.5 + 10 / (111320 * Math.cos((27 * Math.PI) / 180)) },
      imgW: 1280,
      imgH: 800,
    };
    const corners = [
      { lat: meta.sw.lat, lng: meta.sw.lng },
      { lat: meta.ne.lat, lng: meta.sw.lng },
      { lat: meta.ne.lat, lng: meta.ne.lng },
      { lat: meta.sw.lat, lng: meta.ne.lng },
    ];

    const expected = areaM2ToSqft(
      shoelaceAreaM2(corners.map(({ lat, lng }) => imagePxToMetersFromCenter(latLngToImagePx(lat, lng, meta), meta)))
    );
    expect(areaSqftFromLatLngCorners(corners, meta)).toBeCloseTo(expected, 10);
    expect(areaSqftFromLatLngCorners(corners, meta)).toBeCloseTo(300 * SQM_TO_SQFT, 0);
  });
});

// Feedback round 7 (Task C item 4): a self-intersection ("bowtie") guard,
// needed now that there are 6 draggable points instead of 4 -- a midpoint
// dragged far enough can cross one of the polygon's other edges.
describe('polygonSelfIntersects', () => {
  it('a simple (non-crossing) rectangle -- false', () => {
    const rect = [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(polygonSelfIntersects(rect)).toBe(false);
  });

  it('a classic 4-point bowtie (adjacent corners swapped) -- true', () => {
    // Connecting these in order draws an hourglass: edge (0,0)->(10,10) and
    // edge (10,0)->(0,10) cross at (5,5).
    const bowtie = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(polygonSelfIntersects(bowtie)).toBe(true);
  });

  it('a simple (non-crossing) 6-point L-shape -- false', () => {
    // Same L-shape topology as the shoelace golden above, in pixel space.
    const lShapeHex = [
      { x: 0, y: 150 }, // sw
      { x: 0, y: 0 }, // nw
      { x: 120, y: 0 }, // notch outer corner
      { x: 120, y: 60 }, // notch inner corner
      { x: 200, y: 60 }, // notch outer corner
      { x: 200, y: 150 }, // se
    ];
    expect(polygonSelfIntersects(lShapeHex)).toBe(false);
  });

  it('a 6-point hexagon with one dragged point crossing a far edge -- true', () => {
    // A rectangle-with-midpoints hexagon (sw, w-mid, nw, ne, e-mid, se)
    // with w-mid dragged far past the east edge: edge (sw -> w-mid) now
    // crosses edge (e-mid -> se).
    const dragged = [
      { x: 0, y: 10 }, // sw
      { x: 20, y: 5 }, // w-mid, dragged from (0,5) out to (20,5) -- past the east edge (x=10)
      { x: 0, y: 0 }, // nw
      { x: 10, y: 0 }, // ne
      { x: 10, y: 5 }, // e-mid
      { x: 10, y: 10 }, // se
    ];
    expect(polygonSelfIntersects(dragged)).toBe(true);
  });

  it('fewer than 4 points can never self-intersect', () => {
    expect(polygonSelfIntersects([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }])).toBe(false);
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

// imagePxToLatLng: exact inverse of latLngToImagePx (feedback round 6 --
// needed so a dragged corner, tracked in image-pixel space, can be
// persisted back as the lat/lng the store's outlineCorners keeps).
describe('imagePxToLatLng: exact inverse of latLngToImagePx', () => {
  it('the image center pixel maps back to the map center lat/lng', () => {
    const { lat, lng } = imagePxToLatLng({ x: BASE_META.imgW / 2, y: BASE_META.imgH / 2 }, BASE_META);
    expect(lat).toBeCloseTo(BASE_META.centerLat, 9);
    expect(lng).toBeCloseTo(BASE_META.centerLng, 9);
  });

  it('round-trips a bbox corner: latLngToImagePx then imagePxToLatLng returns the original lat/lng', () => {
    const corner = { lat: BASE_META.ne.lat, lng: BASE_META.ne.lng };
    const px = latLngToImagePx(corner.lat, corner.lng, BASE_META);
    const roundTripped = imagePxToLatLng(px, BASE_META);
    expect(roundTripped.lat).toBeCloseTo(corner.lat, 9);
    expect(roundTripped.lng).toBeCloseTo(corner.lng, 9);
  });

  it('round-trips an arbitrary dragged-looking pixel position (not just a bbox corner)', () => {
    const px = { x: 940.25, y: 210.75 };
    const { lat, lng } = imagePxToLatLng(px, BASE_META);
    const back = latLngToImagePx(lat, lng, BASE_META);
    expect(back.x).toBeCloseTo(px.x, 6);
    expect(back.y).toBeCloseTo(px.y, 6);
  });
});
