import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  advance,
  cancelOrder,
  checkInvariants,
  GameError,
  MarketConfigSchema,
  netWorth,
  placeOrder,
  realNetWorth,
  testConfig,
  type CareerState,
  type OrderType,
  type PlaceOrderInput,
} from '../src';
import { content, newCareer, ohlc, R, step } from './fixtures';

const order = (instrumentId: string, side: 'BUY' | 'SELL', qty: number, extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  desk: 'STOCKS',
  instrumentId,
  side,
  type: 'MARKET',
  qty,
  ...extra,
});

describe('Central Treasury', () => {
  it('TC-TRS-01 new career: ₹1,000,000 available, one grant entry', () => {
    const s = newCareer();
    expect(s.treasury).toMatchObject({ available: R(1_000_000), blocked: 0, unsettled: 0 });
    expect(s.treasury.ledger).toHaveLength(1);
    expect(s.treasury.ledger[0]).toMatchObject({ type: 'grant', from: 'external', to: 'available', amountPaise: R(1_000_000) });
    expect(checkInvariants(s)).toEqual([]);
  });

  it('TC-TRS-05 reserve → capture: ₹40,071.06 blocked, then position on fill', () => {
    const { state: placed } = placeOrder(newCareer(), order('SOFT', 'BUY', 10, { type: 'LIMIT', limitPaise: R(4000) }), content, testConfig);
    expect(placed.treasury.blocked).toBe(4_007_106);
    const { state } = step(placed, { SOFT: ohlc(4000, 4010, 3990, 4000) });
    expect(state.treasury.blocked).toBe(0);
    expect(state.positions.SOFT).toEqual({ instrumentId: 'SOFT', qty: 10, costBasisPaise: 4_007_106 });
    expect(state.treasury.available).toBe(R(1_000_000) - 4_007_106);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('TC-TRS-06 reserve → release on cancel', () => {
    const { state: placed, order: o } = placeOrder(newCareer(), order('SOFT', 'BUY', 10, { type: 'LIMIT', limitPaise: R(3900) }), content, testConfig);
    const { state } = cancelOrder(placed, o.id);
    expect(state.treasury).toMatchObject({ available: R(1_000_000), blocked: 0 });
    expect(state.orders[0]!.status).toBe('CANCELLED');
    expect(checkInvariants(state)).toEqual([]);
  });

  it('TC-TRS-07 one wallet: cash committed to one order cannot fund another', () => {
    const cfg = MarketConfigSchema.parse({ ...testConfig, startingTreasuryPaise: R(100_000) });
    const { state } = placeOrder(newCareer({}, cfg), order('SOFT', 'BUY', 17, { type: 'LIMIT', limitPaise: R(4000) }), content, cfg);
    expect(() => placeOrder(state, order('BANK', 'BUY', 50, { type: 'LIMIT', limitPaise: R(1000) }), content, cfg)).toThrow(/Not enough available cash/);
  });

  it('TC-TRS-08 Monday sale is unsettled, then available after Tuesday tick (T+1)', () => {
    let s = placeOrder(newCareer(), order('SOFT', 'BUY', 10), content, testConfig).state;
    s = step(s).state; // Wed 2 Jan: bought
    s = step(step(s).state).state; // Thu, Fri
    expect(s.date).toBe('2030-01-04');
    s = placeOrder(s, order('SOFT', 'SELL', 10), content, testConfig).state;
    s = step(step(s).state).state; // Sat, Sun: nothing trades
    const before = s.treasury.available;
    const mon = step(s);
    expect(mon.state.date).toBe('2030-01-07');
    expect(mon.fills).toHaveLength(1);
    expect(mon.fills[0]!.settleDate).toBe('2030-01-08');
    expect(mon.state.treasury.unsettled).toBe(mon.fills[0]!.netPaise);
    expect(mon.state.treasury.available).toBe(before);
    const tue = step(mon.state);
    expect(tue.state.treasury.unsettled).toBe(0);
    expect(tue.state.treasury.available).toBe(before + mon.fills[0]!.netPaise);
    expect(checkInvariants(tue.state)).toEqual([]);
  });

  it('TC-TRS-10 net worth = cash buckets + positions at last close', () => {
    let s = placeOrder(newCareer(), order('SOFT', 'BUY', 10), content, testConfig).state;
    s = step(s).state;
    s = placeOrder(s, order('BANK', 'BUY', 5, { type: 'LIMIT', limitPaise: R(950) }), content, testConfig).state;
    s = step(s, { SOFT: ohlc(4000, 4200, 3990, 4150) }).state;
    const t = s.treasury;
    expect(netWorth(s)).toBe(t.available + t.blocked + t.unsettled + 10 * R(4150));
  });

  it('TC-TRS-11 real net worth deflates by in-world CPI', () => {
    const s = newCareer();
    const inflated: CareerState = { ...s, world: { ...s.world, cpiIndex: 1.1 } };
    expect(realNetWorth(inflated) / netWorth(inflated) - 1).toBeCloseTo(-0.0909, 4);
  });
});

// ---- Property test: invariants survive ~10,000 random actions (TC-TRS-02/03/04) ----

type Act = { k: 'buy' | 'sell'; i: number; qty: number; type: OrderType; off: number } | { k: 'cancel'; n: number } | { k: 'advance'; days: number };

const act: fc.Arbitrary<Act> = fc.oneof(
  fc.record({
    k: fc.constantFrom('buy' as const, 'sell' as const),
    i: fc.nat(2),
    qty: fc.integer({ min: 1, max: 400 }),
    type: fc.constantFrom<OrderType>('MARKET', 'LIMIT', 'SL', 'SL-M'),
    off: fc.integer({ min: -9, max: 9 }),
  }),
  fc.record({ k: fc.constant('cancel' as const), n: fc.nat(10) }),
  fc.record({ k: fc.constant('advance' as const), days: fc.integer({ min: 1, max: 5 }) }),
);

function apply(s: CareerState, a: Act): CareerState {
  if (a.k === 'advance') return advance(s, a.days, content, testConfig).state;
  if (a.k === 'cancel') {
    const open = s.orders.filter((o) => o.status === 'OPEN');
    return open.length ? cancelOrder(s, open[a.n % open.length]!.id).state : s;
  }
  const tick = testConfig.stocks.tickPaise;
  const inst = content.instruments[a.i]!;
  const last = s.prices[inst.id]!.c;
  const p = Math.round((last * (1 + a.off / 100)) / tick) * tick;
  const adj = Math.round((last * 0.005) / tick) * tick;
  const side = a.k === 'buy' ? 'BUY' : 'SELL';
  const limitPaise = a.type === 'LIMIT' ? p : a.type === 'SL' ? (side === 'BUY' ? p + adj : p - adj) : null;
  const triggerPaise = a.type === 'SL' || a.type === 'SL-M' ? p : null;
  return placeOrder(s, order(inst.id, side, a.qty, { type: a.type, limitPaise, triggerPaise }), content, testConfig).state;
}

describe('Treasury invariants (property)', () => {
  it('TC-TRS-02/03/04 ledger == buckets, buckets ≥ 0, blocked == reservations across random play', () => {
    fc.assert(
      fc.property(fc.array(act, { minLength: 60, maxLength: 100 }), fc.string({ minLength: 1, maxLength: 8 }), (acts, seed) => {
        let s = newCareer({ seed, difficulty: 'CHAOTIC' });
        for (const a of acts) {
          try {
            s = apply(s, a);
          } catch (e) {
            if (!(e instanceof GameError)) throw e;
          }
          const v = checkInvariants(s);
          if (v.length) throw new Error(v.join('; '));
        }
      }),
      { numRuns: 125 },
    );
  }, 120_000);
});
