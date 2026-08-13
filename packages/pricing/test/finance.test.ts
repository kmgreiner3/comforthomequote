import { describe, it, expect } from 'vitest';
import { monthlyPayment } from '../src/finance';

describe('monthlyPayment', () => {
  it('amortizes a standard loan (15000 @ 7.99% / 120mo ≈ 181.91)', () => {
    expect(monthlyPayment(15000, 7.99, 120)).toBeCloseTo(181.91, 1);
  });
  it('handles zero APR as simple division', () => {
    expect(monthlyPayment(12000, 0, 60)).toBe(200);
  });
  it('rejects nonsense inputs', () => {
    expect(() => monthlyPayment(0, 7.99, 120)).toThrow(RangeError);
    expect(() => monthlyPayment(15000, 7.99, 0)).toThrow(RangeError);
    expect(() => monthlyPayment(15000, -1, 120)).toThrow(RangeError);
  });
});
