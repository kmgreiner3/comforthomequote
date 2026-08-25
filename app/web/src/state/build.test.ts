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
  });
});
