import { describe, expect, it } from 'vitest';
import { advance, applyDay, cholesky, correlationMatrix, GameError, generateDay, placeOrder, priceBand, testConfig, type CareerState, type ContentPack, type PlaceOrderInput } from '../src';
import { content, newCareer } from './fixtures';

const buySoft = (qty: number): PlaceOrderInput => ({ desk: 'STOCKS', instrumentId: 'SOFT', side: 'BUY', type: 'MARKET', qty });

/** Run `days` calendar days, reopening after any halt. */
function runDays(s: CareerState, days: number, pack: ContentPack = content): CareerState {
  let st = s;
  let done = 0;
  while (done < days) {
    const r = advance(st, Math.min(30, days - done), pack, testConfig);
    st = r.state;
    done += r.records.length;
  }
  return st;
}

/** Career whose next India open carries a huge negative global-risk shock. */
function crashing(pack: ContentPack, grShock: number): CareerState {
  const s = newCareer({ seed: 'crash' }, testConfig, pack);
  const pending = s.world.pending.IN.map((v, k) => (k === 0 ? grShock : v));
  return { ...s, world: { ...s.world, pending: { ...s.world.pending, IN: pending } } };
}

const withBand = (bandPct: number): ContentPack => ({ ...content, instruments: content.instruments.map((i) => ({ ...i, bandPct })) });

describe('world engine', () => {
  it('factor correlation matrix is positive definite', () => {
    expect(() => cholesky(correlationMatrix())).not.toThrow();
  });

  it('TC-WLD-01 same seed → identical world', () => {
    const a = runDays(newCareer({ seed: 'same' }), 400);
    const b = runDays(newCareer({ seed: 'same' }), 400);
    expect(a.prices).toEqual(b.prices);
    expect(a.indices).toEqual(b.indices);
    expect(a.world).toEqual(b.world);
    expect(runDays(newCareer({ seed: 'other' }), 400).prices).not.toEqual(a.prices);
  });

  it('TC-WLD-02 player trades never change prices', () => {
    let quiet = newCareer({ seed: 'indep' });
    let busy = placeOrder(newCareer({ seed: 'indep' }), buySoft(100), content, testConfig).state;
    for (let i = 0; i < 12; i++) {
      const q = advance(quiet, 30, content, testConfig);
      const b = advance(busy, 30, content, testConfig);
      expect(b.records.map((r) => r.bars)).toEqual(q.records.map((r) => r.bars));
      quiet = q.state;
      busy = b.state;
      try {
        busy = placeOrder(busy, { ...buySoft(5), side: i % 2 ? 'SELL' : 'BUY' }, content, testConfig).state;
      } catch (e) {
        if (!(e instanceof GameError)) throw e;
      }
    }
  });

  it('TC-WLD-03/04 prices positive, OHLC valid, bands respected (20 seeds × 2 years, chaotic)', () => {
    for (let k = 0; k < 20; k++) {
      let s = newCareer({ seed: `ohlc-${k}`, difficulty: 'CHAOTIC' });
      for (let d = 0; d < 730; d++) {
        const day = generateDay(s, content, testConfig);
        if (day.bars)
          for (const inst of content.instruments) {
            const b = day.bars[inst.id]!;
            const { lo, hi } = priceBand(b.prevClose, inst, testConfig);
            if (!(b.l > 0 && b.l <= Math.min(b.o, b.c) && b.h >= Math.max(b.o, b.c) && b.l >= lo && b.h <= hi))
              throw new Error(`bad bar ${inst.id} ${day.date}: ${JSON.stringify(b)}`);
          }
        s = applyDay(s, day, content, testConfig).state;
        if (s.world.halt) s = { ...s, world: { ...s.world, halt: null } };
      }
    }
  }, 60_000);

  it('TC-WLD-08 weekend: no India bars, shocks carry into Monday', () => {
    const fri = runDays(newCareer(), 3);
    expect(fri.date).toBe('2030-01-04');
    const sat = generateDay(fri, content, testConfig);
    expect(sat.bars).toBeNull();
    expect(sat.world.pending.IN.some((v) => v !== 0)).toBe(true);
    const sun = generateDay(applyDay(fri, sat, content, testConfig).state, content, testConfig);
    const mon = generateDay(applyDay(applyDay(fri, sat, content, testConfig).state, sun, content, testConfig).state, content, testConfig);
    expect(mon.bars).not.toBeNull();
    expect(mon.world.pending.IN.every((v) => v === 0)).toBe(true);
  });
});

describe('market-wide circuit breakers', () => {
  it('TC-CIR-03 index −10%: halt, clock pauses, trading disabled until the next day', () => {
    const r = advance(crashing(content, -60), 10, content, testConfig);
    expect(r.paused).toBe('HALT');
    expect(r.records).toHaveLength(1);
    expect(r.events).toContainEqual(expect.objectContaining({ kind: 'MARKET_HALT', levelPct: 10 }));
    expect(r.state.world.halt?.indexMovePct).toBeCloseTo(-10, 6);
    expect(() => placeOrder(r.state, buySoft(1), content, testConfig)).toThrow(/Trading is paused/);

    const next = advance(r.state, 1, content, testConfig);
    expect(next.state.world.halt).toBeNull();
    expect(() => placeOrder(next.state, buySoft(1), content, testConfig)).not.toThrow();
  });

  it('TC-CIR-04 a 15% fall triggers the 15% level', () => {
    const pack = withBand(15);
    const r = advance(crashing(pack, -80), 1, pack, testConfig);
    expect(r.state.world.halt?.levelPct).toBe(15);
  });

  it('TC-CIR-04 a 20% fall closes the market for the day at −20%', () => {
    const pack = withBand(50);
    const r = advance(crashing(pack, -300), 1, pack, testConfig);
    expect(r.state.world.halt?.levelPct).toBe(20);
    expect(r.state.world.halt?.indexMovePct).toBeCloseTo(-20, 6);
    expect(r.state.indices.IDX!.level).toBeCloseTo(8000, 1);
  });
});
