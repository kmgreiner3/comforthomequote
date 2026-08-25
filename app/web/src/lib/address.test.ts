import { describe, expect, it } from 'vitest';
import { validateFloridaAddress } from './address';

describe('validateFloridaAddress', () => {
  it('accepts a full Sarasota address with ZIP', () => {
    expect(validateFloridaAddress('1530 Main St, Sarasota, FL 34236')).toEqual({ ok: true });
  });

  it('accepts a full Tampa address with ZIP', () => {
    expect(validateFloridaAddress('123 Palm Ave, Tampa, FL 33602')).toEqual({ ok: true });
  });

  it('rejects an address missing a ZIP code entirely', () => {
    expect(validateFloridaAddress('123 Palm Ave, Tampa, FL')).toEqual({
      ok: false,
      error: 'Include your ZIP code so we find the right home.',
    });
  });

  it('rejects a Georgia address as outside Florida', () => {
    expect(validateFloridaAddress('123 Peachtree St, Atlanta, GA 30303')).toEqual({
      ok: false,
      error: 'We currently serve Florida homes only.',
    });
  });

  it('rejects a Florida-looking ZIP paired with a non-FL state token', () => {
    expect(validateFloridaAddress('123 Peachtree St, Somewhere, GA 34236')).toEqual({
      ok: false,
      error: 'We currently serve Florida homes only.',
    });
  });

  it('rejects junk input that is too short and has no comma', () => {
    expect(validateFloridaAddress('roof pls')).toEqual({
      ok: false,
      error: 'Enter your full street address with city and ZIP code.',
    });
  });

  it('rejects input long enough but with no comma at all', () => {
    expect(validateFloridaAddress('1530 Main Street Sarasota FL 34236')).toEqual({
      ok: false,
      error: 'Enter your full street address with city and ZIP code.',
    });
  });

  it('rejects empty input', () => {
    expect(validateFloridaAddress('')).toEqual({
      ok: false,
      error: 'Enter your full street address with city and ZIP code.',
    });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateFloridaAddress('  123 Palm Ave, Tampa, FL 33602  ')).toEqual({ ok: true });
  });

  it('is case-insensitive on the FL state token', () => {
    expect(validateFloridaAddress('123 Palm Ave, Tampa, fl 33602')).toEqual({ ok: true });
  });

  it('does not misread the tail of a city name as a state token', () => {
    // "Sarasota" ends in "ta" -- must not be mistaken for a two-letter
    // state abbreviation just because it sits in front of a Florida ZIP.
    expect(validateFloridaAddress('1530 Main St, Sarasota, 34236')).toEqual({ ok: true });
  });

  it('rejects a non-Florida ZIP even with no state token at all', () => {
    expect(validateFloridaAddress('1 Infinite Loop, Cupertino, 95014')).toEqual({
      ok: false,
      error: 'We currently serve Florida homes only.',
    });
  });
});
