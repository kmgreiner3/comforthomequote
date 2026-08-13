import { describe, it, expect } from 'vitest';
import { pitchClassFromDeg } from '../src/pitch';

describe('pitchClassFromDeg', () => {
  it('classifies below steepFrom as walkable', () => {
    expect(pitchClassFromDeg(0)).toBe('walkable');
    expect(pitchClassFromDeg(20)).toBe('walkable');
  });
  it('classifies [steepFrom, verySteepFrom) as steep — boundary inclusive', () => {
    expect(pitchClassFromDeg(26.6)).toBe('steep');   // exactly 6/12
    expect(pitchClassFromDeg(30)).toBe('steep');
  });
  it('classifies >= verySteepFrom as verySteep — boundary inclusive', () => {
    expect(pitchClassFromDeg(36.9)).toBe('verySteep'); // exactly 9/12
    expect(pitchClassFromDeg(45)).toBe('verySteep');
  });
});
