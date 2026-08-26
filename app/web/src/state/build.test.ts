import { beforeEach, describe, expect, it } from 'vitest';
import {
  cashPrice,
  configuredTotal,
  estimatedMonthly,
  guarantee,
  peelStickUpgrade,
  sqFromOutline,
  titanUpgrade,
} from '@chq/pricing';
import {
  selectCash,
  selectGuarantee,
  selectMonthly,
  selectPeelStickDelta,
  selectTotal,
  selectUpgradeDelta,
  useBuild,
} from './build';
import { getStepFlags, setStepFlagDone } from '../routes/build/useStepFlags';
import { getMeasurementAttempt, setMeasurementAttempt } from '../routes/build/measurementAttempt';
import { getNextStepFlags, setNextStepFlagDone } from '../routes/next/useStepFlags';
import { maxAllowedNextIndex, nextStepIndex } from '../routes/next/steps';

const STORAGE_KEY = 'chq-build-v1';
const STEP_FLAGS_KEY = 'chq-build-flow-v1';
const MEASUREMENT_ATTEMPT_KEY = 'chq-measure-attempt-v1';
const NEXT_STEP_FLAGS_KEY = 'chq-next-flow-v1';

beforeEach(() => {
  useBuild.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('useBuild store actions', () => {
  it('setOutline sets outlineSqft and sq together (golden: outline 2000 -> sq 24)', () => {
    useBuild.getState().setOutline(2000);
    const s = useBuild.getState();
    expect(s.outlineSqft).toBe(2000);
    expect(s.sq).toBe(24);
    expect(s.sq).toBe(sqFromOutline(2000));
  });

  it('setOutline computes sq via the engine for a non-round outline', () => {
    useBuild.getState().setOutline(2286);
    const s = useBuild.getState();
    expect(s.sq).toBeCloseTo(27.432, 10);
    expect(s.sq).toBe(sqFromOutline(2286));
  });

  it('setOutline (manual entry) tags outlineSource as manual', () => {
    useBuild.getState().setOutline(2000);
    const s = useBuild.getState();
    expect(s.outlineSource).toBe('manual');
    expect(s.outlineSqft).toBe(2000);
    expect(s.sq).toBe(sqFromOutline(2000));
  });

  it('setOutlineFromSatellite sets outlineSqft/sq via the same engine and tags outlineSource as satellite', () => {
    useBuild.getState().setOutlineFromSatellite(1850.5);
    const s = useBuild.getState();
    expect(s.outlineSqft).toBe(1850.5);
    expect(s.sq).toBe(sqFromOutline(1850.5));
    expect(s.outlineSource).toBe('satellite');
  });

  it('manual entry overrides a prior satellite value', () => {
    useBuild.getState().setOutlineFromSatellite(1850.5);
    expect(useBuild.getState().outlineSource).toBe('satellite');

    useBuild.getState().setOutline(2200);

    const s = useBuild.getState();
    expect(s.outlineSource).toBe('manual');
    expect(s.outlineSqft).toBe(2200);
    expect(s.sq).toBe(sqFromOutline(2200));
  });

  it('outlineSource defaults to null before either action is called', () => {
    expect(useBuild.getState().outlineSource).toBeNull();
  });

  it('setShingle resets color because color lists differ per shingle', () => {
    useBuild.getState().setShingle('iko-cambridge');
    useBuild.getState().setColor('Dual Black');
    expect(useBuild.getState().color).toBe('Dual Black');

    useBuild.getState().setShingle('tamko-titan-xt');
    expect(useBuild.getState().shingle).toBe('tamko-titan-xt');
    expect(useBuild.getState().color).toBeNull();
  });

  it('setShingle is a no-op when re-selecting the already-chosen shingle (keeps color)', () => {
    useBuild.getState().setShingle('iko-cambridge');
    useBuild.getState().setColor('Dual Black');

    useBuild.getState().setShingle('iko-cambridge');

    expect(useBuild.getState().shingle).toBe('iko-cambridge');
    expect(useBuild.getState().color).toBe('Dual Black');
  });

  it('defaults underlayment to synthetic', () => {
    expect(useBuild.getState().underlayment).toBe('synthetic');
  });

  it('accept() sets accepted true', () => {
    expect(useBuild.getState().accepted).toBe(false);
    useBuild.getState().accept();
    expect(useBuild.getState().accepted).toBe(true);
  });

  it('setContact and setVisit store full objects', () => {
    const contact = {
      name: 'Dylan Client',
      phone: '555-0100',
      email: 'dylan@example.com',
      billing: '1 Roofline Ave',
      method: 'text',
    };
    const visit = { date: '2026-09-01', window: 'Morning' as const };

    useBuild.getState().setContact(contact);
    useBuild.getState().setVisit(visit);

    expect(useBuild.getState().contact).toEqual(contact);
    expect(useBuild.getState().visit).toEqual(visit);
  });

  it('reset() restores every field to its default', () => {
    const s0 = useBuild.getState();
    s0.setAddress('1 Main St');
    s0.setOutlineFromSatellite(2000);
    s0.setShingle('iko-cambridge');
    s0.setColor('Dual Black');
    s0.setUnderlayment('peel-stick');
    s0.setDripEdge('Black');
    s0.accept();
    s0.setContact({ name: 'a', phone: 'b', email: 'c', billing: 'd', method: 'e' });
    s0.setVisit({ date: '2026-09-01', window: 'Afternoon' });

    useBuild.getState().reset();

    const s = useBuild.getState();
    expect(s.address).toBeNull();
    expect(s.outlineSqft).toBeNull();
    expect(s.sq).toBeNull();
    expect(s.outlineSource).toBeNull();
    expect(s.shingle).toBeNull();
    expect(s.color).toBeNull();
    expect(s.underlayment).toBe('synthetic');
    expect(s.dripEdge).toBeNull();
    expect(s.accepted).toBe(false);
    expect(s.contact).toBeNull();
    expect(s.visit).toBeNull();
  });

  it('resetQuote() restores the store to pristine defaults, including propertyImageUrl', () => {
    const s0 = useBuild.getState();
    s0.setAddress('1 Main St');
    s0.setOutlineFromSatellite(2000);
    s0.setPropertyImageUrl('https://example.com/aerial.png');
    s0.setShingle('iko-cambridge');
    s0.setColor('Dual Black');
    s0.setUnderlayment('peel-stick');
    s0.setDripEdge('Black');
    s0.accept();
    s0.setContact({ name: 'a', phone: 'b', email: 'c', billing: 'd', method: 'e' });
    s0.setVisit({ date: '2026-09-01', window: 'Afternoon' });

    useBuild.getState().resetQuote();

    const s = useBuild.getState();
    expect(s.address).toBeNull();
    expect(s.outlineSqft).toBeNull();
    expect(s.sq).toBeNull();
    expect(s.outlineSource).toBeNull();
    expect(s.propertyImageUrl).toBeNull();
    expect(s.shingle).toBeNull();
    expect(s.color).toBeNull();
    expect(s.underlayment).toBe('synthetic');
    expect(s.dripEdge).toBeNull();
    expect(s.accepted).toBe(false);
    expect(s.contact).toBeNull();
    expect(s.visit).toBeNull();
  });

  it('resetQuote() also wipes the step-flags localStorage and the measurement-attempt sessionStorage', () => {
    // Populate the two sibling storages the same way the real flow would.
    setStepFlagDone('underlayment');
    setStepFlagDone('protection');
    setMeasurementAttempt({ address: '1 Main St', outcome: 'found', sqft: 1850.5 });

    expect(localStorage.getItem(STEP_FLAGS_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(MEASUREMENT_ATTEMPT_KEY)).not.toBeNull();

    useBuild.getState().resetQuote();

    expect(localStorage.getItem(STEP_FLAGS_KEY)).toBeNull();
    expect(sessionStorage.getItem(MEASUREMENT_ATTEMPT_KEY)).toBeNull();
    expect(getStepFlags()).toEqual({ underlayment: false, protection: false, included: false });
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('resetQuote() also wipes the /next flow\'s own step-flags localStorage (partnerSeen), so a second quote does not skip the partner step', () => {
    // A completed first quote leaves partnerSeen=true behind in its own
    // storage (chq-next-flow-v1) -- separate from the build store and from
    // build's own step-flags key.
    setNextStepFlagDone('partnerSeen');
    expect(localStorage.getItem(NEXT_STEP_FLAGS_KEY)).not.toBeNull();
    expect(getNextStepFlags()).toEqual({ partnerSeen: true });

    useBuild.getState().resetQuote();

    expect(localStorage.getItem(NEXT_STEP_FLAGS_KEY)).toBeNull();
    expect(getNextStepFlags()).toEqual({ partnerSeen: false });

    // Without this clear, a second quote's /next flow would compute
    // maxAllowedNextIndex as already past 'partner' the moment contact/visit
    // get set, silently skipping the license/insurance step. After
    // resetQuote(), with contact/visit also back to null, it must land back
    // on 'partner'.
    const s = useBuild.getState();
    expect(maxAllowedNextIndex(s, getNextStepFlags())).toBe(nextStepIndex('partner'));
  });

  it('resetQuote() leaves no build config behind even mid-flow (address, shingle, color, flags all set)', () => {
    const s0 = useBuild.getState();
    s0.setAddress('42 Wallaby Way');
    s0.setOutline(2000);
    s0.setShingle('tamko-titan-xt');
    s0.setColor('Rustic Black');
    setStepFlagDone('underlayment');

    useBuild.getState().resetQuote();

    expect(localStorage.getItem(STORAGE_KEY)).toContain('"address":null');
    expect(getStepFlags().underlayment).toBe(false);
  });
});

describe('useBuild store: setAddress semantics (feedback round 5)', () => {
  it('placeId defaults to null before any address is set', () => {
    expect(useBuild.getState().placeId).toBeNull();
  });

  it('setAddress with a placeId stores it alongside the address', () => {
    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');
    const s = useBuild.getState();
    expect(s.address).toBe('123 Palm Ave, Tampa, FL 33602');
    expect(s.placeId).toBe('places/abc123');
  });

  it('setAddress with no placeId (free-typed) leaves placeId null', () => {
    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602');
    expect(useBuild.getState().placeId).toBeNull();
  });

  it('setAddress with the SAME address is a no-op: nothing is cleared or rewritten', () => {
    const s0 = useBuild.getState();
    s0.setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');
    s0.setOutlineFromSatellite(2000);
    s0.setPropertyImageUrl('https://example.com/aerial.png');
    setMeasurementAttempt({ address: '123 Palm Ave, Tampa, FL 33602', outcome: 'found', sqft: 2000 });

    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602');

    const s = useBuild.getState();
    expect(s.address).toBe('123 Palm Ave, Tampa, FL 33602');
    expect(s.placeId).toBe('places/abc123'); // untouched, not cleared to null
    expect(s.outlineSqft).toBe(2000);
    expect(s.sq).not.toBeNull();
    expect(s.outlineSource).toBe('satellite');
    expect(s.propertyImageUrl).toBe('https://example.com/aerial.png');
    expect(getMeasurementAttempt()).not.toBeNull();
  });

  it('setAddress with the SAME address but a NEWLY PICKED (different) placeId records it and clears the measurement attempt, without touching outlineSqft/propertyImageUrl', () => {
    const s0 = useBuild.getState();
    s0.setAddress('123 Palm Ave, Tampa, FL 33602'); // free-typed, no placeId yet
    s0.setOutline(2000);
    s0.setPropertyImageUrl('https://example.com/aerial.png');
    setMeasurementAttempt({ address: '123 Palm Ave, Tampa, FL 33602', outcome: 'fallback' });
    expect(getMeasurementAttempt()).not.toBeNull();

    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');

    const s = useBuild.getState();
    expect(s.address).toBe('123 Palm Ave, Tampa, FL 33602');
    expect(s.placeId).toBe('places/abc123');
    // The measurement-attempt cache is cleared so /api/measure retries via
    // the new exact-match geocode...
    expect(getMeasurementAttempt()).toBeNull();
    // ...but outlineSqft/propertyImageUrl are left alone here -- they get
    // overwritten in due course when the re-measurement resolves.
    expect(s.outlineSqft).toBe(2000);
    expect(s.propertyImageUrl).toBe('https://example.com/aerial.png');
  });

  it('setAddress with the SAME address but a NEWLY PICKED placeId clears mapMeta/outlineCorners (feedback round 6: the wrong-building recovery flow)', () => {
    // Simulates the round-5 recovery flow: a free-typed address measured
    // the WRONG building (mapMeta/outlineCorners/propertyImageUrl already
    // synced into the store from that wrong measurement's confirm phase),
    // then the homeowner picks the exact building from autocomplete for
    // the SAME address text.
    const wrongBuildingMapMeta = {
      centerLat: 27.1,
      centerLng: -82.1,
      zoom: 19,
      sw: { lat: 27.0999, lng: -82.1001 },
      ne: { lat: 27.1001, lng: -82.0999 },
      imgW: 1280,
      imgH: 800,
    };
    const s0 = useBuild.getState();
    s0.setAddress('123 Palm Ave, Tampa, FL 33602');
    s0.setMeasuredMapMeta(wrongBuildingMapMeta);
    s0.setPropertyImageUrl('https://example.com/wrong-building.png');
    expect(useBuild.getState().outlineCorners).not.toBeNull();

    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602', 'places/exact-match-123');

    const s = useBuild.getState();
    expect(s.placeId).toBe('places/exact-match-123');
    // The old building's bbox/corners must NOT stay stashed -- otherwise
    // they'd get drawn over the new building's photo once the
    // re-measurement lands (the actual reported bug).
    expect(s.mapMeta).toBeNull();
    expect(s.outlineCorners).toBeNull();
  });

  it('setAddress with the SAME address and the SAME placeId (re-passed) is still a full no-op', () => {
    const s0 = useBuild.getState();
    s0.setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');
    setMeasurementAttempt({ address: '123 Palm Ave, Tampa, FL 33602', outcome: 'found', sqft: 2000 });

    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');

    expect(useBuild.getState().placeId).toBe('places/abc123');
    expect(getMeasurementAttempt()).not.toBeNull(); // not cleared -- nothing changed
  });

  it('setAddress with a DIFFERENT address clears outline/sq/outlineSource/propertyImageUrl/placeId and the measurement attempt', () => {
    const s0 = useBuild.getState();
    s0.setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');
    s0.setOutlineFromSatellite(2000);
    s0.setPropertyImageUrl('https://example.com/aerial.png');
    setMeasurementAttempt({ address: '123 Palm Ave, Tampa, FL 33602', outcome: 'found', sqft: 2000 });

    useBuild.getState().setAddress('456 Ocean Dr, Miami, FL 33139');

    const s = useBuild.getState();
    expect(s.address).toBe('456 Ocean Dr, Miami, FL 33139');
    expect(s.placeId).toBeNull();
    expect(s.outlineSqft).toBeNull();
    expect(s.sq).toBeNull();
    expect(s.outlineSource).toBeNull();
    expect(s.propertyImageUrl).toBeNull();
    expect(getMeasurementAttempt()).toBeNull();
  });

  it('a DIFFERENT address paired with a new placeId sets the new placeId (not cleared to null)', () => {
    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602', 'places/abc123');

    useBuild.getState().setAddress('456 Ocean Dr, Miami, FL 33139', 'places/xyz789');

    expect(useBuild.getState().placeId).toBe('places/xyz789');
  });

  it('setAddress with a DIFFERENT address PRESERVES shingle/color/underlayment/dripEdge (fast multi-address price checks)', () => {
    const s0 = useBuild.getState();
    s0.setAddress('123 Palm Ave, Tampa, FL 33602');
    s0.setOutline(2000);
    s0.setShingle('iko-cambridge');
    s0.setColor('Dual Black');
    s0.setUnderlayment('peel-stick');
    s0.setDripEdge('Black');

    useBuild.getState().setAddress('456 Ocean Dr, Miami, FL 33139');

    const s = useBuild.getState();
    expect(s.address).toBe('456 Ocean Dr, Miami, FL 33139');
    // Cleared: the prior outline no longer applies to a different property.
    expect(s.outlineSqft).toBeNull();
    expect(s.sq).toBeNull();
    // Preserved: config choices carry over so switching addresses to
    // compare prices is fast.
    expect(s.shingle).toBe('iko-cambridge');
    expect(s.color).toBe('Dual Black');
    expect(s.underlayment).toBe('peel-stick');
    expect(s.dripEdge).toBe('Black');
  });
});

describe('useBuild store: setOutlineAdjusted (feedback round 5)', () => {
  const CORNERS = [
    { lat: 27.336, lng: -82.54 },
    { lat: 27.337, lng: -82.54 },
    { lat: 27.337, lng: -82.539 },
    { lat: 27.336, lng: -82.539 },
  ];

  it('sets outlineSqft and sq together via the pricing engine, tagged outlineSource=adjusted', () => {
    useBuild.getState().setOutlineAdjusted(1975, CORNERS);
    const s = useBuild.getState();
    expect(s.outlineSqft).toBe(1975);
    expect(s.sq).toBe(sqFromOutline(1975));
    expect(s.outlineSource).toBe('adjusted');
  });

  it('overrides a prior satellite value the same way manual entry does', () => {
    useBuild.getState().setOutlineFromSatellite(2000);
    expect(useBuild.getState().outlineSource).toBe('satellite');

    useBuild.getState().setOutlineAdjusted(2150, CORNERS);

    const s = useBuild.getState();
    expect(s.outlineSource).toBe('adjusted');
    expect(s.outlineSqft).toBe(2150);
    expect(s.sq).toBe(sqFromOutline(2150));
  });

  it('also stores the adjusted corners themselves (feedback round 6)', () => {
    useBuild.getState().setOutlineAdjusted(1975, CORNERS);
    expect(useBuild.getState().outlineCorners).toEqual(CORNERS);
  });
});

// sw -> w-mid -> nw -> ne -> e-mid -> se (feedback round 7): the midpoint of
// two lat/lng points is just their arithmetic mean.
function midpoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

describe('useBuild store: mapMeta / outlineCorners (feedback round 6; expanded to 6 points in round 7)', () => {
  const MAP_META = {
    centerLat: 27.336230049999998,
    centerLng: -82.539976,
    zoom: 20,
    sw: { lat: 27.3360897, lng: -82.5400199 },
    ne: { lat: 27.3363704, lng: -82.5399321 },
    imgW: 1280,
    imgH: 800,
  };
  const BBOX_SW = { lat: MAP_META.sw.lat, lng: MAP_META.sw.lng };
  const BBOX_NW = { lat: MAP_META.ne.lat, lng: MAP_META.sw.lng };
  const BBOX_NE = { lat: MAP_META.ne.lat, lng: MAP_META.ne.lng };
  const BBOX_SE = { lat: MAP_META.sw.lat, lng: MAP_META.ne.lng };
  const BBOX_CORNERS = [BBOX_SW, midpoint(BBOX_SW, BBOX_NW), BBOX_NW, BBOX_NE, midpoint(BBOX_NE, BBOX_SE), BBOX_SE];
  const ADJUSTED_CORNERS = [
    { lat: MAP_META.sw.lat - 0.00001, lng: MAP_META.sw.lng - 0.00001 },
    { lat: MAP_META.centerLat, lng: MAP_META.sw.lng - 0.00001 },
    { lat: MAP_META.ne.lat + 0.00001, lng: MAP_META.sw.lng - 0.00001 },
    { lat: MAP_META.ne.lat + 0.00001, lng: MAP_META.ne.lng + 0.00001 },
    { lat: MAP_META.centerLat, lng: MAP_META.ne.lng + 0.00001 },
    { lat: MAP_META.sw.lat - 0.00001, lng: MAP_META.ne.lng + 0.00001 },
  ];

  it('mapMeta and outlineCorners default to null', () => {
    const s = useBuild.getState();
    expect(s.mapMeta).toBeNull();
    expect(s.outlineCorners).toBeNull();
  });

  it('setMeasuredMapMeta initializes outlineCorners from mapMeta.sw/ne (sw, w-mid, nw, ne, e-mid, se order) when none is set yet', () => {
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    const s = useBuild.getState();
    expect(s.mapMeta).toEqual(MAP_META);
    expect(s.outlineCorners).toEqual(BBOX_CORNERS);
  });

  it('setMeasuredMapMeta(null) clears both fields', () => {
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    expect(useBuild.getState().mapMeta).not.toBeNull();

    useBuild.getState().setMeasuredMapMeta(null);

    const s = useBuild.getState();
    expect(s.mapMeta).toBeNull();
    expect(s.outlineCorners).toBeNull();
  });

  it('re-calling setMeasuredMapMeta with the same mapMeta does NOT clobber an already-adjusted outlineCorners', () => {
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    useBuild.getState().setOutlineAdjusted(2150, ADJUSTED_CORNERS);
    expect(useBuild.getState().outlineCorners).toEqual(ADJUSTED_CORNERS);

    // Simulates StepHome's phase-sync effect re-running (e.g. re-render,
    // or Cancel returning to the confirm phase with the same mapMeta).
    useBuild.getState().setMeasuredMapMeta(MAP_META);

    const s = useBuild.getState();
    expect(s.mapMeta).toEqual(MAP_META);
    expect(s.outlineCorners).toEqual(ADJUSTED_CORNERS);
  });

  const OTHER_MAP_META = {
    centerLat: 27.1,
    centerLng: -82.1,
    zoom: 19,
    sw: { lat: 27.0999, lng: -82.1001 },
    ne: { lat: 27.1001, lng: -82.0999 },
    imgW: 1280,
    imgH: 800,
  };
  const OTHER_BBOX_SW = { lat: OTHER_MAP_META.sw.lat, lng: OTHER_MAP_META.sw.lng };
  const OTHER_BBOX_NW = { lat: OTHER_MAP_META.ne.lat, lng: OTHER_MAP_META.sw.lng };
  const OTHER_BBOX_NE = { lat: OTHER_MAP_META.ne.lat, lng: OTHER_MAP_META.ne.lng };
  const OTHER_BBOX_SE = { lat: OTHER_MAP_META.sw.lat, lng: OTHER_MAP_META.ne.lng };
  const OTHER_BBOX_CORNERS = [
    OTHER_BBOX_SW,
    midpoint(OTHER_BBOX_SW, OTHER_BBOX_NW),
    OTHER_BBOX_NW,
    OTHER_BBOX_NE,
    midpoint(OTHER_BBOX_NE, OTHER_BBOX_SE),
    OTHER_BBOX_SE,
  ];

  it('setMeasuredMapMeta re-initializes outlineCorners from the NEW bbox when the incoming mapMeta DIFFERS from the stored one and the corners were never adjusted (feedback round 6 fix)', () => {
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    expect(useBuild.getState().outlineCorners).toEqual(BBOX_CORNERS);

    // A genuinely different mapMeta -- e.g. a re-measurement for the same
    // address text via a newly picked, more specific placeId (the
    // wrong-building recovery flow). Corners were never hand-adjusted
    // (outlineSource is still null), so they must reset to the NEW box's
    // bbox, not keep the OLD building's rectangle.
    useBuild.getState().setMeasuredMapMeta(OTHER_MAP_META);

    const s = useBuild.getState();
    expect(s.mapMeta).toEqual(OTHER_MAP_META);
    expect(s.outlineCorners).toEqual(OTHER_BBOX_CORNERS);
  });

  it('setMeasuredMapMeta KEEPS the hand-adjusted corners across a DIFFERENT mapMeta when outlineSource is "adjusted" (frame-independent lat/lng)', () => {
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    useBuild.getState().setOutlineAdjusted(2150, ADJUSTED_CORNERS);
    expect(useBuild.getState().outlineSource).toBe('adjusted');

    useBuild.getState().setMeasuredMapMeta(OTHER_MAP_META);

    const s = useBuild.getState();
    expect(s.mapMeta).toEqual(OTHER_MAP_META);
    expect(s.outlineCorners).toEqual(ADJUSTED_CORNERS);
  });

  it('round-trips through persist storage (serialize then rehydrate) including an adjustment', async () => {
    useBuild.getState().setAddress('1530 Main St, Sarasota, FL');
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    useBuild.getState().setOutlineAdjusted(2150, ADJUSTED_CORNERS);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.mapMeta).toEqual(MAP_META);
    expect(parsed.state.outlineCorners).toEqual(ADJUSTED_CORNERS);

    useBuild.setState({ mapMeta: null, outlineCorners: null });
    localStorage.setItem(STORAGE_KEY, raw as string);
    await useBuild.persist.rehydrate();

    const rehydrated = useBuild.getState();
    expect(rehydrated.mapMeta).toEqual(MAP_META);
    expect(rehydrated.outlineCorners).toEqual(ADJUSTED_CORNERS);
  });

  it('setAddress with a DIFFERENT address clears mapMeta and outlineCorners too', () => {
    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL');
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    useBuild.getState().setOutlineAdjusted(2150, ADJUSTED_CORNERS);

    useBuild.getState().setAddress('456 Ocean Dr, Miami, FL');

    const s = useBuild.getState();
    expect(s.mapMeta).toBeNull();
    expect(s.outlineCorners).toBeNull();
  });

  it('setAddress with the SAME address leaves mapMeta and outlineCorners untouched', () => {
    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL');
    useBuild.getState().setMeasuredMapMeta(MAP_META);
    useBuild.getState().setOutlineAdjusted(2150, ADJUSTED_CORNERS);

    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL');

    const s = useBuild.getState();
    expect(s.mapMeta).toEqual(MAP_META);
    expect(s.outlineCorners).toEqual(ADJUSTED_CORNERS);
  });

  it('rehydrates cleanly from a pre-round-6 persisted blob that has no mapMeta/outlineCorners keys', async () => {
    const legacyBlob = JSON.stringify({
      state: {
        address: '42 Wallaby Way',
        outlineSqft: 2000,
        sq: 24,
        outlineSource: 'satellite',
        shingle: 'iko-cambridge',
        color: 'Dual Black',
        underlayment: 'synthetic',
        dripEdge: null,
        accepted: false,
        contact: null,
        visit: null,
      },
      version: 0,
    });

    useBuild.getState().reset();
    localStorage.setItem(STORAGE_KEY, legacyBlob);

    await useBuild.persist.rehydrate();

    const s = useBuild.getState();
    expect(s.address).toBe('42 Wallaby Way');
    expect(s.mapMeta).toBeNull();
    expect(s.outlineCorners).toBeNull();
  });

  // Feedback round 7 (Task C item 5): a pre-round-7 persisted store has
  // only 4 outlineCorners (sw, nw, ne, se). Rehydrating that state must
  // upgrade it to 6 points (inserting the two edge midpoints) rather than
  // leaving a 4-point array around for code that now assumes 6, or crashing
  // outright.
  it('upgrades a pre-round-7 4-point persisted outlineCorners to 6 points on rehydrate', async () => {
    const legacyFourCorners = [BBOX_SW, BBOX_NW, BBOX_NE, BBOX_SE];
    const legacyBlob = JSON.stringify({
      state: {
        address: '1530 Main St, Sarasota, FL',
        outlineSqft: 2150,
        sq: sqFromOutline(2150),
        outlineSource: 'adjusted',
        mapMeta: MAP_META,
        outlineCorners: legacyFourCorners,
        shingle: null,
        color: null,
        underlayment: 'synthetic',
        dripEdge: null,
        accepted: false,
        contact: null,
        visit: null,
      },
      version: 0,
    });

    useBuild.getState().reset();
    localStorage.setItem(STORAGE_KEY, legacyBlob);

    await useBuild.persist.rehydrate();

    const s = useBuild.getState();
    // Upgraded to exactly the 6-point shape (sw, w-mid, nw, ne, e-mid, se)
    // -- not left at 4, not dropped, not thrown.
    expect(s.outlineCorners).toHaveLength(6);
    expect(s.outlineCorners).toEqual(BBOX_CORNERS);
    // Nothing else about the migration disturbs unrelated fields.
    expect(s.address).toBe('1530 Main St, Sarasota, FL');
    expect(s.outlineSqft).toBe(2150);
  });

  it('leaves an already-6-point persisted outlineCorners alone on rehydrate (no double-upgrade)', async () => {
    const legacyBlob = JSON.stringify({
      state: {
        address: '1530 Main St, Sarasota, FL',
        mapMeta: MAP_META,
        outlineCorners: ADJUSTED_CORNERS,
      },
      version: 0,
    });

    useBuild.getState().reset();
    localStorage.setItem(STORAGE_KEY, legacyBlob);

    await useBuild.persist.rehydrate();

    expect(useBuild.getState().outlineCorners).toEqual(ADJUSTED_CORNERS);
  });

  it('rehydrating with a null persisted outlineCorners does not crash and stays null', async () => {
    const legacyBlob = JSON.stringify({
      state: { address: '1530 Main St, Sarasota, FL', mapMeta: null, outlineCorners: null },
      version: 0,
    });

    useBuild.getState().reset();
    localStorage.setItem(STORAGE_KEY, legacyBlob);

    await useBuild.persist.rehydrate();

    expect(useBuild.getState().outlineCorners).toBeNull();
  });

  describe('setSeedOutline (feedback round 7, Task C item 2: the no-solar-data trace flow)', () => {
    const SEED_CORNERS = [
      { lat: 27.1, lng: -82.1 },
      { lat: 27.10005, lng: -82.1 },
      { lat: 27.1001, lng: -82.1 },
      { lat: 27.1001, lng: -82.0999 },
      { lat: 27.10005, lng: -82.0999 },
      { lat: 27.1, lng: -82.0999 },
    ];
    const SEED_MAP_META = {
      centerLat: 27.10005,
      centerLng: -82.09995,
      zoom: 20,
      sw: { lat: 27.1, lng: -82.1 },
      ne: { lat: 27.1001, lng: -82.0999 },
      imgW: 1280,
      imgH: 800,
    };

    it('sets mapMeta and outlineCorners directly from the given seed corners, not re-derived from the bbox', () => {
      useBuild.getState().setSeedOutline(SEED_MAP_META, SEED_CORNERS);
      const s = useBuild.getState();
      expect(s.mapMeta).toEqual(SEED_MAP_META);
      expect(s.outlineCorners).toEqual(SEED_CORNERS);
    });

    it('overwrites unconditionally, unlike setMeasuredMapMeta -- even an already-adjusted outline is replaced', () => {
      useBuild.getState().setMeasuredMapMeta(MAP_META);
      useBuild.getState().setOutlineAdjusted(2150, ADJUSTED_CORNERS);
      expect(useBuild.getState().outlineSource).toBe('adjusted');

      useBuild.getState().setSeedOutline(SEED_MAP_META, SEED_CORNERS);

      const s = useBuild.getState();
      expect(s.mapMeta).toEqual(SEED_MAP_META);
      expect(s.outlineCorners).toEqual(SEED_CORNERS);
    });
  });
});

describe('adoptCanonicalAddress (feedback round 7, Task C item 1)', () => {
  it('replaces the address text with the canonical formattedAddress, without touching placeId/outline/mapMeta/propertyImageUrl', () => {
    const s0 = useBuild.getState();
    s0.setAddress('8491 60th Street, Pinellas Park, FL, USA', 'places/abc123');
    s0.setOutlineFromSatellite(1900);
    s0.setPropertyImageUrl('https://example.com/aerial.png');

    useBuild.getState().adoptCanonicalAddress('8491 60th St, Pinellas Park, FL 33781, USA');

    const s = useBuild.getState();
    expect(s.address).toBe('8491 60th St, Pinellas Park, FL 33781, USA');
    expect(s.placeId).toBe('places/abc123');
    expect(s.outlineSqft).toBe(1900);
    expect(s.propertyImageUrl).toBe('https://example.com/aerial.png');
  });

  it('is a no-op when the address already matches', () => {
    useBuild.getState().setAddress('8491 60th St, Pinellas Park, FL 33781, USA');
    setMeasurementAttempt({ address: '8491 60th St, Pinellas Park, FL 33781, USA', outcome: 'found', sqft: 1900 });

    useBuild.getState().adoptCanonicalAddress('8491 60th St, Pinellas Park, FL 33781, USA');

    // Untouched -- a genuine no-op, not just an equal string re-set.
    expect(getMeasurementAttempt()).not.toBeNull();
  });

  it('is a no-op for an empty formattedAddress', () => {
    useBuild.getState().setAddress('123 Palm Ave, Tampa, FL 33602');

    useBuild.getState().adoptCanonicalAddress('');

    expect(useBuild.getState().address).toBe('123 Palm Ave, Tampa, FL 33602');
  });
});

describe('derived selectors', () => {
  it('are null before sq/shingle are set', () => {
    const s = useBuild.getState();
    expect(selectTotal(s)).toBeNull();
    expect(selectMonthly(s)).toBeNull();
    expect(selectGuarantee(s)).toBeNull();
    expect(selectCash(s)).toBeNull();
    expect(selectUpgradeDelta(s)).toBeNull();
    expect(selectPeelStickDelta(s)).toBeNull();
  });

  it('golden: outline 2000 + IKO + peel-stick -> total 13200, monthly 132, guarantee BETTER+/10yr', () => {
    const s0 = useBuild.getState();
    s0.setOutline(2000);
    s0.setShingle('iko-cambridge');
    s0.setUnderlayment('peel-stick');

    const s = useBuild.getState();
    expect(selectTotal(s)).toBe(13200);
    expect(selectMonthly(s)).toBe(132);
    expect(selectGuarantee(s)).toEqual({ level: 'BETTER+', years: 10 });
  });

  it('golden: titanUpgrade(sq 24) = 1200 via selectUpgradeDelta', () => {
    useBuild.getState().setOutline(2000); // sq = 24
    expect(selectUpgradeDelta(useBuild.getState())).toBe(1200);
    expect(titanUpgrade(24)).toBe(1200);
  });

  it('match direct engine calls for an arbitrary (non-golden) configuration', () => {
    const s0 = useBuild.getState();
    s0.setOutline(2286);
    s0.setShingle('tamko-titan-xt');
    s0.setUnderlayment('synthetic');

    const s = useBuild.getState();
    const sq = sqFromOutline(2286);
    const expectedTotal = configuredTotal(sq, 'tamko-titan-xt', 'synthetic');

    expect(selectTotal(s)).toBe(expectedTotal);
    expect(selectMonthly(s)).toBe(estimatedMonthly(expectedTotal));
    expect(selectUpgradeDelta(s)).toBe(titanUpgrade(sq));
    expect(selectPeelStickDelta(s)).toBe(peelStickUpgrade(sq));
    expect(selectGuarantee(s)).toEqual(guarantee('tamko-titan-xt', 'synthetic'));
    expect(selectCash(s)).toBe(cashPrice(expectedTotal));
  });
});

describe('persistence', () => {
  it('round-trips state through the persist storage (serialize then deserialize)', async () => {
    const s0 = useBuild.getState();
    s0.setAddress('42 Wallaby Way');
    s0.setOutline(2000);
    s0.setShingle('iko-cambridge');
    s0.setColor('Dual Black');

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw as string);
    expect(parsed.state.address).toBe('42 Wallaby Way');
    expect(parsed.state.shingle).toBe('iko-cambridge');
    expect(parsed.state.color).toBe('Dual Black');
    expect(parsed.state.sq).toBe(sqFromOutline(2000));

    // Simulate a fresh page load: blow away in-memory state, put the
    // captured snapshot back in storage, then rehydrate from it.
    useBuild.setState({ address: null, shingle: null, color: null, sq: null, outlineSqft: null });
    localStorage.setItem(STORAGE_KEY, raw as string);

    await useBuild.persist.rehydrate();

    const rehydrated = useBuild.getState();
    expect(rehydrated.address).toBe('42 Wallaby Way');
    expect(rehydrated.shingle).toBe('iko-cambridge');
    expect(rehydrated.color).toBe('Dual Black');
    expect(rehydrated.sq).toBe(sqFromOutline(2000));
  });

  it('rehydrates cleanly from a pre-Plan-4 persisted blob that has no outlineSource key', async () => {
    // Simulates localStorage written by a build of the app from before this
    // field existed: the persisted JSON simply doesn't have the key at all.
    const legacyBlob = JSON.stringify({
      state: {
        address: '42 Wallaby Way',
        outlineSqft: 2000,
        sq: 24,
        shingle: 'iko-cambridge',
        color: 'Dual Black',
        underlayment: 'synthetic',
        dripEdge: null,
        accepted: false,
        contact: null,
        visit: null,
      },
      version: 0,
    });

    // Mirrors what actually happens on a fresh page load: the store starts
    // from its plain defaults (outlineSource: null among them) before the
    // persist middleware's rehydrate merges in whatever's in storage.
    useBuild.getState().reset();
    localStorage.setItem(STORAGE_KEY, legacyBlob);

    await useBuild.persist.rehydrate();

    const s = useBuild.getState();
    expect(s.address).toBe('42 Wallaby Way');
    expect(s.sq).toBe(24);
    // Missing from the legacy blob -> falls back to the default, not undefined.
    expect(s.outlineSource).toBeNull();
    // placeId is even newer than outlineSource -- same missing-key safety.
    expect(s.placeId).toBeNull();
  });
});
