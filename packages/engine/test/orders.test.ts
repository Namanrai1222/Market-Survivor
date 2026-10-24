import { describe, expect, it } from 'vitest';
import { cancelOrder, checkInvariants, GameError, MarketConfigSchema, placeOrder, priceBand, slippagePrice, testConfig, type CareerState, type MarketConfig, type PlaceOrderInput } from '../src';
import { content, newCareer, ohlc, R, step, stock } from './fixtures';

const buy = (instrumentId: string, qty: number, extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({ desk: 'STOCKS', instrumentId, side: 'BUY', type: 'MARKET', qty, ...extra });
const sell = (instrumentId: string, qty: number, extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({ ...buy(instrumentId, qty, extra), side: 'SELL' });
const place = (s: CareerState, input: PlaceOrderInput, cfg: MarketConfig = testConfig): CareerState => placeOrder(s, input, content, cfg).state;
/** A career holding `qty` shares bought flat at the start price (date: Wed 2 Jan 2030). */
const holding = (qty: number, id = 'SOFT'): CareerState => step(place(newCareer(), buy(id, qty))).state;

describe('fills on the next trading day (testcases.md §2)', () => {
  it('TC-ORD-01 market buy fills at the next open', () => {
    const { fills } = step(place(newCareer(), buy('SOFT', 10)), { SOFT: ohlc(4000, 4050, 3950, 4020) });
    expect(fills).toMatchObject([{ qty: 10, pricePaise: R(4000), side: 'BUY', date: '2030-01-02' }]);
  });

  it('TC-ORD-02 limit fills at the limit when the range touches it', () => {
    const { fills } = step(place(newCareer(), buy('SOFT', 10, { type: 'LIMIT', limitPaise: R(3990) })), { SOFT: ohlc(4000, 4010, 3980, 4000) });
    expect(fills[0]?.pricePaise).toBe(R(3990));
  });

  it('TC-ORD-02 limit fills at the open when the open is better', () => {
    const { fills } = step(place(newCareer(), buy('SOFT', 10, { type: 'LIMIT', limitPaise: R(3990) })), { SOFT: ohlc(3985, 4010, 3980, 4000) });
    expect(fills[0]?.pricePaise).toBe(R(3985));
  });

  it('TC-ORD-03 limit not reached stays open and blocked', () => {
    const r = step(place(newCareer(), buy('SOFT', 10, { type: 'LIMIT', limitPaise: R(3970) })), { SOFT: ohlc(4000, 4010, 3980, 4000) });
    expect(r.fills).toHaveLength(0);
    expect(r.state.orders[0]!.status).toBe('OPEN');
    expect(r.state.treasury.blocked).toBe(r.state.treasury.reservations[r.state.orders[0]!.id]);
    expect(r.state.treasury.blocked).toBeGreaterThan(R(39_700));
  });

  it('TC-ORD-04 gap-down below the limit fills at the open', () => {
    const { fills } = step(place(newCareer(), buy('SOFT', 10, { type: 'LIMIT', limitPaise: R(3990) })), { SOFT: ohlc(3950, 3960, 3940, 3955) });
    expect(fills[0]?.pricePaise).toBe(R(3950));
  });

  it('TC-ORD-05 SL-M sell gapping through the trigger fills at the open', () => {
    const s = place(holding(10), sell('SOFT', 10, { type: 'SL-M', triggerPaise: R(3900) }));
    const { fills } = step(s, { SOFT: ohlc(3700, 3750, 3650, 3720) });
    expect(fills[0]?.pricePaise).toBe(R(3700));
  });

  it('SL-M sell does not trigger while price stays above the trigger', () => {
    const s = place(holding(10), sell('SOFT', 10, { type: 'SL-M', triggerPaise: R(3900) }));
    const r = step(s, { SOFT: ohlc(3950, 4000, 3920, 3960) });
    expect(r.fills).toHaveLength(0);
    expect(r.state.orders.at(-1)).toMatchObject({ status: 'OPEN', triggered: false });
  });

  it('SL buy triggers intraday, then fills at the trigger inside its limit', () => {
    const s = place(newCareer(), buy('SOFT', 10, { type: 'SL', triggerPaise: R(4100), limitPaise: R(4120) }));
    const { fills } = step(s, { SOFT: ohlc(4050, 4150, 4040, 4130) });
    expect(fills[0]?.pricePaise).toBe(R(4100));
  });

  it('TC-ORD-06 cannot sell more than held', () => {
    expect(() => place(holding(5), sell('SOFT', 10))).toThrow(GameError);
  });

  it('open sell orders count against what can be sold (no double sell)', () => {
    const s = place(holding(10), sell('SOFT', 6));
    expect(() => place(s, sell('SOFT', 5))).toThrow(/up to 4/);
  });

  it('TC-ORD-07 rejects 0, −1, 1.5 and 10,001 shares', () => {
    for (const q of [0, -1, 1.5, 10_001]) expect(() => place(newCareer(), buy('SOFT', q))).toThrow(/whole number from 1 to 10,000/);
  });

  it('TC-ORD-08 order placed Friday before a Monday holiday fills Tuesday', () => {
    const cfg = MarketConfigSchema.parse({ ...testConfig, calendars: { ...testConfig.calendars, IN: { ...testConfig.calendars.IN, dates: ['2030-01-07'] } } });
    let s = newCareer({}, cfg);
    for (let i = 0; i < 3; i++) s = step(s, {}, cfg).state; // Wed, Thu, Fri
    expect(s.date).toBe('2030-01-04');
    s = place(s, buy('SOFT', 1), cfg);
    for (let i = 0; i < 3; i++) {
      const r = step(s, {}, cfg); // Sat, Sun, Mon (holiday)
      expect(r.fills).toHaveLength(0);
      s = r.state;
    }
    expect(step(s, {}, cfg).fills[0]?.date).toBe('2030-01-08');
  });

  it('TC-ORD-09 an order of 20% ADV slips more in CRISIS by the configured multiplier', () => {
    const inst = stock('SMALL', 'IT', 4000, 1_000_000); // ADV ₹10 lakh; 50 shares = ₹2 lakh = 20%
    const calm = slippagePrice(R(4000), 'BUY', 50, inst, R(4000), 'CALM', testConfig);
    const crisis = slippagePrice(R(4000), 'BUY', 50, inst, R(4000), 'CRISIS', testConfig);
    expect(calm).toBe(R(4040)); // capped at 100 bps
    expect(crisis - R(4000)).toBe((calm - R(4000)) * testConfig.liquidity.slippageMult.CRISIS);
  });

  it('cancel releases the reserve and closes the order', () => {
    const placed = placeOrder(newCareer(), buy('SOFT', 10, { type: 'LIMIT', limitPaise: R(3900) }), content, testConfig);
    const { state, order } = cancelOrder(placed.state, placed.order.id);
    expect(order).toMatchObject({ status: 'CANCELLED', cancelReason: 'Cancelled by you' });
    expect(state.treasury.blocked).toBe(0);
    expect(() => cancelOrder(state, order.id)).toThrow(/already closed/);
  });
});

describe('price bands and circuits', () => {
  it('TC-CIR-01 limit above the 10% band is rejected, at the band accepted', () => {
    const s = newCareer(); // BANK last close ₹1,000
    expect(() => place(s, buy('BANK', 1, { type: 'LIMIT', limitPaise: R(1101) }))).toThrow(/price band: ₹900 to ₹1,100/);
    expect(() => place(s, buy('BANK', 1, { type: 'LIMIT', limitPaise: R(1100) }))).not.toThrow();
  });

  it('rejects prices off the ₹0.05 tick', () => {
    expect(() => place(newCareer(), buy('BANK', 1, { type: 'LIMIT', limitPaise: 100_002 }))).toThrow(/multiple of ₹0.05/);
  });

  it('TC-CIR-02 sells at a locked lower circuit fill at most 20% of the queue per day', () => {
    let s = place(holding(800, 'BANK'), sell('BANK', 800));
    const bankInst = content.instruments.find((i) => i.id === 'BANK')!;
    let remaining = 800;
    for (let d = 0; d < 7; d++) {
      const { lo } = priceBand(s.prices.BANK!.c, bankInst, testConfig);
      const r = step(s, { BANK: { o: lo, h: lo, l: lo, c: lo, circuit: 'LOWER' } });
      const filled = r.fills.reduce((n, f) => n + f.qty, 0);
      expect(filled).toBeLessThanOrEqual(Math.floor(remaining * 0.2));
      remaining -= filled;
      s = r.state;
    }
    expect(remaining).toBeGreaterThan(0);
    expect(s.orders.at(-1)).toMatchObject({ status: 'OPEN', filledQty: 800 - remaining });
    expect(checkInvariants(s)).toEqual([]);
  });
});
