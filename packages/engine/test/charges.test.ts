import { describe, expect, it } from 'vitest';
import { equityCharges, testConfig } from '../src';
import { R } from './fixtures';

describe('equity charges (testcases.md §2)', () => {
  it('TC-CHG-01 buy 10 @ ₹4,000 → ₹71.06', () => {
    expect(equityCharges('BUY', R(40_000), testConfig.charges)).toEqual({ brokerage: 2000, stt: 4000, exchange: 120, regulator: 4, stamp: 600, gst: 382, total: 7106 });
  });

  it('TC-CHG-02 sell 10 @ ₹4,200 → ₹67.13, credit ₹41,932.87', () => {
    const c = equityCharges('SELL', R(42_000), testConfig.charges);
    expect(c).toEqual({ brokerage: 2000, stt: 4200, exchange: 126, regulator: 4, stamp: 0, gst: 383, total: 6713 });
    expect(R(42_000) - c.total).toBe(4_193_287);
  });
});
