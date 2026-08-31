import { beforeEach, describe, expect, it } from 'vitest';
import { clearStepFlags, getStepFlags, setStepFlagDone } from './useStepFlags';

const STORAGE_KEY = 'chq-build-flow-v1';

beforeEach(() => {
  localStorage.clear();
});

describe('useStepFlags (feedback round 8: included is the only remaining flag)', () => {
  it('defaults to { included: false } with nothing in storage', () => {
    expect(getStepFlags()).toEqual({ included: false });
  });

  it('setStepFlagDone persists and getStepFlags reflects it', () => {
    setStepFlagDone('included');
    expect(getStepFlags()).toEqual({ included: true });
  });

  it('clearStepFlags resets back to defaults', () => {
    setStepFlagDone('included');
    clearStepFlags();
    expect(getStepFlags()).toEqual({ included: false });
  });

  it('discards a pre-round-8 blob (no version stamp) instead of partially applying it', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ underlayment: true, protection: true, included: true }));
    expect(getStepFlags()).toEqual({ included: false });
  });

  it('discards a blob stamped with the wrong version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, included: true }));
    expect(getStepFlags()).toEqual({ included: false });
  });

  it('never crashes on corrupt JSON -- falls back to defaults', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => getStepFlags()).not.toThrow();
    expect(getStepFlags()).toEqual({ included: false });
  });

  it('never crashes on a valid JSON value that is not an object', () => {
    localStorage.setItem(STORAGE_KEY, '"just a string"');
    expect(() => getStepFlags()).not.toThrow();
    expect(getStepFlags()).toEqual({ included: false });
  });
});
