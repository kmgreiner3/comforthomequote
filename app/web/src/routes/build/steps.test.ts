import { describe, expect, it } from 'vitest';
import type { BuildState } from '../../state/build';
import { DEFAULT_STEP_FLAGS, maxAllowedIndex, stepIdFromHash, stepIndex, STEP_IDS, type StepFlags } from './steps';

// Feedback round 8: old (pre-round-8) hash bookmarks/links must still land
// somewhere sane on the new 5-step flow instead of falling through to
// nothing.
describe('stepIdFromHash: pre-round-8 aliases', () => {
  it.each([
    ['#address', 'home'],
    ['#color', 'appearance'],
    ['#finishing', 'appearance'],
    ['#underlayment', 'included'],
    ['#protection', 'included'],
  ])('%s resolves to %s', (hash, expected) => {
    expect(stepIdFromHash(hash)).toBe(expected);
  });

  it.each(STEP_IDS)('current step id %s resolves to itself', (id) => {
    expect(stepIdFromHash(`#${id}`)).toBe(id);
  });

  it('an unknown hash resolves to null (no crash)', () => {
    expect(stepIdFromHash('#not-a-real-step')).toBeNull();
    expect(stepIdFromHash('')).toBeNull();
  });
});

function baseState(overrides: Partial<BuildState> = {}): BuildState {
  return {
    address: null,
    placeId: null,
    outlineSqft: null,
    sq: null,
    outlineSource: null,
    propertyImageUrl: null,
    mapMeta: null,
    outlineCorners: null,
    shingle: null,
    color: null,
    solarPanels: null,
    dripEdge: null,
    accepted: false,
    contact: null,
    visit: null,
    setAddress: () => {},
    adoptCanonicalAddress: () => {},
    setOutline: () => {},
    setOutlineFromSatellite: () => {},
    setOutlineAdjusted: () => {},
    setMeasuredMapMeta: () => {},
    setSeedOutline: () => {},
    setPropertyImageUrl: () => {},
    setShingle: () => {},
    setColor: () => {},
    setSolarPanels: () => {},
    setDripEdge: () => {},
    accept: () => {},
    setContact: () => {},
    setVisit: () => {},
    reset: () => {},
    resetQuote: () => {},
    ...overrides,
  } as BuildState;
}

describe('maxAllowedIndex: 5-step gating (feedback round 8)', () => {
  const flagsDone: StepFlags = { included: true };

  it('stays on home until address, sq, AND solarPanels are all set', () => {
    expect(maxAllowedIndex(baseState(), DEFAULT_STEP_FLAGS)).toBe(stepIndex('home'));
    expect(maxAllowedIndex(baseState({ address: '1 Main St' }), DEFAULT_STEP_FLAGS)).toBe(stepIndex('home'));
    expect(
      maxAllowedIndex(baseState({ address: '1 Main St', sq: 24 }), DEFAULT_STEP_FLAGS)
    ).toBe(stepIndex('home'));
    // solarPanels answered, but no sq yet.
    expect(
      maxAllowedIndex(baseState({ address: '1 Main St', solarPanels: 0 }), DEFAULT_STEP_FLAGS)
    ).toBe(stepIndex('home'));
  });

  it('unlocks shingle once address + sq + solarPanels (0 counts as answered) are set', () => {
    const s = baseState({ address: '1 Main St', sq: 24, solarPanels: 0 });
    expect(maxAllowedIndex(s, DEFAULT_STEP_FLAGS)).toBe(stepIndex('shingle'));
  });

  it('unlocks appearance once shingle is chosen', () => {
    const s = baseState({ address: '1 Main St', sq: 24, solarPanels: 0, shingle: 'iko-cambridge' });
    expect(maxAllowedIndex(s, DEFAULT_STEP_FLAGS)).toBe(stepIndex('appearance'));
  });

  it('stays on appearance until BOTH color and dripEdge are chosen', () => {
    const withColorOnly = baseState({
      address: '1 Main St',
      sq: 24,
      solarPanels: 0,
      shingle: 'iko-cambridge',
      color: 'Dual Black',
    });
    expect(maxAllowedIndex(withColorOnly, DEFAULT_STEP_FLAGS)).toBe(stepIndex('appearance'));
  });

  it('unlocks included once color and dripEdge are both chosen', () => {
    const s = baseState({
      address: '1 Main St',
      sq: 24,
      solarPanels: 0,
      shingle: 'iko-cambridge',
      color: 'Dual Black',
      dripEdge: 'Black',
    });
    expect(maxAllowedIndex(s, DEFAULT_STEP_FLAGS)).toBe(stepIndex('included'));
  });

  it('unlocks review once the included flag is set', () => {
    const s = baseState({
      address: '1 Main St',
      sq: 24,
      solarPanels: 0,
      shingle: 'iko-cambridge',
      color: 'Dual Black',
      dripEdge: 'Black',
    });
    expect(maxAllowedIndex(s, flagsDone)).toBe(stepIndex('review'));
  });
});
