import { describe, expect, it } from 'vitest';
import { formatFootprintSqft, roundToNearestFifty } from './format';

describe('roundToNearestFifty', () => {
  it('rounds down at the lower edge of a 50-wide bucket', () => {
    expect(roundToNearestFifty(2324)).toBe(2300);
  });

  it('rounds up at the upper edge of a 50-wide bucket', () => {
    expect(roundToNearestFifty(2326)).toBe(2350);
  });

  it('rounds a fractional value from the satellite measurement', () => {
    expect(roundToNearestFifty(2308.32)).toBe(2300);
  });

  it('rounds exactly on the boundary up (half-away-from-zero)', () => {
    expect(roundToNearestFifty(2325)).toBe(2350);
  });
});

describe('formatFootprintSqft', () => {
  it('renders a rounded value with a thousands separator', () => {
    expect(formatFootprintSqft(2308.32)).toBe('2,300');
  });

  it('renders the lower edge case with a thousands separator', () => {
    expect(formatFootprintSqft(2324)).toBe('2,300');
  });

  it('renders the upper edge case with a thousands separator', () => {
    expect(formatFootprintSqft(2326)).toBe('2,350');
  });

  it('renders sub-1000 values with no separator needed', () => {
    expect(formatFootprintSqft(742)).toBe('750');
  });
});
