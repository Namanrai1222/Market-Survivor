// Every desk beyond stocks (prd.md §6.2, P3-T01..T08) against the real fictional universe.
import { describe, expect, it } from 'vitest';
import {
  advance,
  applyIpo,
  bookFd,
  breakFd,
  checkInvariants,
  createCareer,
  createSip,
  defaultConfig as cfg,
  fdGrowth,
  generateDay,
  instantTrade,
  isOpen,
  moveCustody,
  netWorth,
  placeFundOrder,
  placeOrder,
  priceYes,
  toPublicView,
  tradeCost,
  tradeForecast,
  upgradeCareer,
  type CareerState,
} from '@ms/engine';
import { universe } from '@ms/content/universe';

const fresh = (seed = 'desks', type: CareerState['type'] = 'FREEPLAY'): CareerState =>
  createCareer({ id: 'c', slot: 1, type, difficulty: 'REALISTIC', seed }, universe, cfg);

/** Advance one calendar day at a time until `pred` holds (halts are resumed). */
function until(s: CareerState, pred: (s: CareerState) => boolean, max = 400): CareerState {
  for (let i = 0; i < max && !pred(s); i++) s = advance(s.world.halt ? { ...s, world: { ...s.world, halt: null } } : s, 1, universe, cfg).state;
  if (!pred(s)) throw new Error('condition never reached');
  return s;
}
const days = (s: CareerState, n: number) => until(s, (x) => x.date >= addDaysIso(s.date, n), n + 5);
const addDaysIso = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const inOpen = (s: CareerState) => isOpen('IN', s.date, cfg.calendars) && !s.world.halt;
const usOpen = (s: CareerState) => isOpen('US', s.date, cfg.calendars);

describe('world: one clock, many markets', () => {
  it('crypto moves at weekends while India and US are closed; US prices are in dollars', () => {
    let s = fresh();
    s = until(s, (x) => new Date(`${x.date}T00:00:00Z`).getUTCDay() === 5); // Friday
    const sat = generateDay(s, universe, cfg);
    expect(sat.inOpen).toBe(false);
    expect(Object.keys(sat.bars!).sort()).toEqual(universe.instruments.filter((i) => i.market === 'CRYPTO').map((i) => i.id).sort());
    expect(s.prices.ORCHARD!.c).toBeGreaterThan(10_000); // cents, ~$210
  });

  it('the policy rate changes only at meetings, in 0.25/0.5 steps, within bounds', () => {
    let s = fresh('rates');
    const seen: number[] = [s.world.policyRate];
    for (let i = 0; i < 24; i++) {
      s = advance(s.world.halt ? { ...s, world: { ...s.world, halt: null } } : s, 30, universe, cfg).state;
      seen.push(s.world.policyRate);
    }
    for (const r of seen) {
      expect(r).toBeGreaterThanOrEqual(cfg.world.policyRateMin);
      expect(r).toBeLessThanOrEqual(cfg.world.policyRateMax);
      expect((r * 100) % 25).toBe(0);
    }
    expect(s.world.lastPolicy).not.toBeNull();
  });

  it('a long-bond holder loses about duration × Δyield when yields jump', () => {
    const s = until(fresh('bond'), inOpen);
    const before = { y: s.world.yields.y10, p: s.prices.GB2040!.c };
    const d = generateDay({ ...s, world: { ...s.world, factors: s.world.factors.map((f, k) => (k === 3 ? f + 12 : f)) } }, universe, cfg);
    if (!d.inOpen) return;
    const dy = (d.world.yields.y10 - before.y) / 100;
    const move = d.bars!.GB2040!.c / before.p - 1;
    expect(dy).toBeGreaterThan(0.005);
    expect(move).toBeLessThan(0);
    expect(Math.abs(Math.log(1 + move) - -7.6 * dy)).toBeLessThan(0.003); // carry, noise and rounding
  });
});

describe('instant desks: ETFs, bonds, US stocks, crypto', () => {
  it('buys gold on an India day; refuses on a closed day; the sale settles T+1', () => {
    let s = until(fresh(), inOpen);
    s = instantTrade(s, { instrumentId: 'INGOT', side: 'BUY', qty: 100 }, universe, cfg).state;
    expect(s.positions.INGOT!.qty).toBe(100);
    expect(checkInvariants(s)).toEqual([]);
    const sat = until(s, (x) => !isOpen('IN', x.date, cfg.calendars));
    expect(() => instantTrade(sat, { instrumentId: 'INGOT', side: 'SELL', qty: 10 }, universe, cfg)).toThrow(/closed today/);
    const open = until(sat, inOpen);
    const r = instantTrade(open, { instrumentId: 'INGOT', side: 'SELL', qty: 100 }, universe, cfg);
    expect(r.fill.settleDate! > open.date).toBe(true);
    expect(r.state.treasury.unsettled).toBe(r.fill.netPaise);
  });

  it('US stocks pay a conversion fee and value at today’s USD/INR', () => {
    const s = until(fresh(), usOpen);
    const r = instantTrade(s, { instrumentId: 'ORCHARD', side: 'BUY', qty: 5 }, universe, cfg);
    expect(r.fill.fees[0]!.label).toMatch(/conversion/i);
    expect(r.fill.usdInr).toBe(s.world.usdInr);
    expect(Math.abs(r.fill.valuePaise - Math.round(5 * r.fill.priceQuote * s.world.usdInr))).toBeLessThanOrEqual(1);
    const p = r.state.positions.ORCHARD!;
    expect(p.quote).toBe('USD');
    expect(p.costQuote).toBeCloseTo(5 * r.fill.priceQuote, 4);
  });

  it('crypto trades on Sunday, in fractions, and selling withholds 1% TDS instantly', () => {
    let s = until(fresh(), (x) => new Date(`${x.date}T00:00:00Z`).getUTCDay() === 0);
    s = instantTrade(s, { instrumentId: 'CSTN', side: 'BUY', qty: 12_345 }, universe, cfg).state; // 0.012345 coin
    const cash = s.treasury.available;
    const r = instantTrade(s, { instrumentId: 'CSTN', side: 'SELL', qty: 12_345 }, universe, cfg);
    expect(r.fill.fees.map((f) => f.label).join()).toMatch(/TDS/);
    expect(r.state.treasury.available - cash).toBe(r.fill.netPaise);
    expect(r.state.treasury.unsettled).toBe(0);
  });

  it('self-custody coins can’t be sold until moved back, which takes a day and a fee', () => {
    let s = fresh();
    s = instantTrade(s, { instrumentId: 'ETRN', side: 'BUY', qty: 1_000_000 }, universe, cfg).state;
    s = moveCustody(s, { instrumentId: 'ETRN', to: 'SELF', qty: 1_000_000 }, universe, cfg).state;
    expect(s.positions['ETRN@SELF']!.qty).toBe(1_000_000);
    expect(() => instantTrade(s, { instrumentId: 'ETRN', side: 'SELL', qty: 500_000 }, universe, cfg)).toThrow(/no ETRN/);
    s = moveCustody(s, { instrumentId: 'ETRN', to: 'EXCHANGE', qty: 1_000_000 }, universe, cfg).state;
    expect(s.transfers).toHaveLength(1);
    expect(netWorth(s)).toBeGreaterThan(0);
    s = days(s, 1);
    expect(s.transfers).toHaveLength(0);
    expect(s.positions.ETRN!.qty).toBe(1_000_000);
  });
});

describe('funds & SIP', () => {
  it('a buy fills at the NEXT trading day’s NAV, never today’s', () => {
    let s = until(fresh(), inOpen);
    const navToday = s.prices.SURV50IDX!.c;
    s = placeFundOrder(s, { fundId: 'SURV50IDX', side: 'BUY', amountPaise: 1_000_000 }, universe, cfg).state;
    expect(s.treasury.blocked).toBe(1_000_000);
    s = until(s, (x) => x.fundOrders[0]!.status === 'DONE');
    const o = s.fundOrders[0]!;
    expect(o.doneDate! > o.placedDate).toBe(true);
    expect(o.navPaise).toBe(s.prices.SURV50IDX!.c);
    expect(o.navPaise).not.toBe(navToday);
    expect(s.treasury.blocked).toBe(0);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('redeeming within a year pays the 1% exit load', () => {
    let s = placeFundOrder(fresh(), { fundId: 'LIGHTHOUSE', side: 'BUY', amountPaise: 5_000_000 }, universe, cfg).state;
    s = until(s, (x) => x.fundOrders[0]!.status === 'DONE');
    s = placeFundOrder(s, { fundId: 'LIGHTHOUSE', side: 'SELL', units: s.positions.LIGHTHOUSE!.qty }, universe, cfg).state;
    s = until(s, (x) => x.fundOrders[1]!.status === 'DONE');
    const o = s.fundOrders[1]!;
    expect(o.exitLoadPaise).toBeGreaterThan(0);
    expect(Math.abs(o.exitLoadPaise / ((o.units / 1000) * o.navPaise!) - 0.01)).toBeLessThan(0.0005);
  });

  it('SIPs invest monthly and skip with a warning when cash runs out', () => {
    let s = createSip(fresh(), { fundId: 'MONSOON', amountPaise: 30_000_000, dayOfMonth: 5, stepUpPct: 0 }, universe, cfg).state;
    let skipped = false;
    for (let i = 0; i < 5; i++) {
      const r = advance(s, 30, universe, cfg);
      s = r.state;
      skipped ||= r.events.some((e) => e.kind === 'NOTICE' && /skipped/.test(e.message));
    }
    expect(s.sips[0]!.installments).toBe(3); // ₹3 lakh × 3 uses most of ₹10 lakh
    expect(s.sips[0]!.skipped).toBeGreaterThan(0);
    expect(skipped).toBe(true);
    expect(checkInvariants(s)).toEqual([]);
  });
});

describe('fixed income', () => {
  it('a deposit pays quarterly-compounded interest at maturity', () => {
    let s = bookFd(fresh(), { tenorId: '91D', amountPaise: 10_000_000 }, cfg).state;
    const fd = s.fds[0]!;
    s = days(s, 92);
    expect(s.fds[0]!.status).toBe('MATURED');
    expect(s.fds[0]!.paidPaise).toBe(fdGrowth(10_000_000, fd.ratePct, 91));
  });

  it('breaking early pays less than holding would', () => {
    let s = bookFd(fresh(), { tenorId: '1Y', amountPaise: 10_000_000 }, cfg).state;
    s = days(s, 180);
    const r = breakFd(s, s.fds[0]!.id, cfg);
    const paid = r.state.fds.find((f) => f.id === s.fds[0]!.id)!.paidPaise!;
    expect(paid).toBeGreaterThan(10_000_000);
    expect(paid).toBeLessThan(fdGrowth(10_000_000, s.fds[0]!.ratePct, 180));
  });
});

describe('IPOs', () => {
  it('announce → bid (blocked) → allot or refund → list, with invariants every day', () => {
    let s = until(fresh('ipo'), (x) => Object.values(x.ipos).some((i) => i.status === 'OPEN'));
    const ipo = Object.values(s.ipos).find((i) => i.status === 'OPEN')!;
    s = applyIpo(s, { ipoId: ipo.id, lots: 1 }, cfg).state;
    expect(s.treasury.blocked).toBe(ipo.bandHiPaise * ipo.lotSize);
    while (s.ipos[ipo.id]!.status !== 'LISTED') {
      s = advance(s, 1, universe, cfg).state;
      expect(checkInvariants(s)).toEqual([]);
    }
    const done = s.ipos[ipo.id]!;
    expect(s.treasury.blocked).toBe(0);
    if (done.allottedLots) expect(s.positions[ipo.id]!.qty).toBe(done.lotSize);
    expect(s.prices[ipo.id]!.o).toBe(done.listingOpenPaise);
    // After listing it trades on the stock order engine.
    expect(() => placeOrder(s, { desk: 'STOCKS', instrumentId: ipo.id, side: 'BUY', type: 'MARKET', qty: 1 }, universe, cfg)).not.toThrow();
  });
});

describe('forecasts (coins only, in-game events)', () => {
  it('LMSR: buying then selling at once never makes money; resolution pays per winning share', () => {
    let s = until(fresh('fc'), (x) => x.forecasts.some((f) => f.status === 'OPEN'));
    const f = s.forecasts.find((x) => x.status === 'OPEN')!;
    const cash = s.treasury.available;
    const p = priceYes(f);
    s = tradeForecast(s, { forecastId: f.id, outcome: 'YES', side: 'BUY', shares: 50 }, cfg).state;
    expect(priceYes(s.forecasts.find((x) => x.id === f.id)!)).toBeGreaterThan(p);
    const back = tradeForecast(s, { forecastId: f.id, outcome: 'YES', side: 'SELL', shares: 50 }, cfg).state;
    expect(back.treasury.available).toBeLessThanOrEqual(cash + 1);
    expect(tradeCost(f, 'YES', 50)).toBeLessThan(50 * f.sharePaise);

    const held = s.forecasts.find((x) => x.id === f.id)!;
    const before = s.treasury.available;
    s = until(s, (x) => x.forecasts.find((y) => y.id === f.id)?.status === 'RESOLVED');
    const r = s.forecasts.find((y) => y.id === f.id)!;
    expect(r.payoutPaise).toBe(r.outcome === 'YES' ? held.yes * f.sharePaise : 0);
    expect(s.treasury.available).toBeGreaterThanOrEqual(before);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('questions are only about in-game data', () => {
    const s = until(fresh('fc2'), (x) => x.forecasts.length >= 3);
    for (const f of s.forecasts) expect(f.question).toMatch(/Survivor 50|central bank|Ingot|Coinstone/);
  });
});

describe('a year of Free Play touching every desk keeps the books balanced', () => {
  it('invariants hold every day; net worth equals cash + marks', () => {
    let s = fresh('year');
    let ipoApplied = 0;
    for (let day = 0; day < 365; day++) {
      const tryDo = (fn: () => CareerState) => {
        try {
          s = fn();
        } catch (e) {
          if (!(e instanceof Error) || e.name !== 'GameError') throw e;
        }
      };
      if (day % 9 === 0) tryDo(() => instantTrade(s, { instrumentId: ['INGOT', 'GB2040', 'ORCHARD', 'CSTN', 'PUP'][day % 5]!, side: 'BUY', qty: day % 5 >= 3 ? 50_000_000 : 20 }, universe, cfg).state);
      if (day % 13 === 0) tryDo(() => instantTrade(s, { instrumentId: ['INGOT', 'GB2040', 'ORCHARD', 'CSTN'][day % 4]!, side: 'SELL', qty: day % 4 === 3 ? 1_000 : 5 }, universe, cfg).state);
      if (day % 20 === 0) tryDo(() => placeFundOrder(s, { fundId: 'SPARROW', side: 'BUY', amountPaise: 2_000_000 }, universe, cfg).state);
      if (day === 3) tryDo(() => createSip(s, { fundId: 'SURV50IDX', amountPaise: 1_000_000, dayOfMonth: 10, stepUpPct: 10 }, universe, cfg).state);
      if (day % 60 === 0) tryDo(() => bookFd(s, { tenorId: '91D', amountPaise: 2_000_000 }, cfg).state);
      for (const ipo of Object.values(s.ipos)) if (ipo.status === 'OPEN' && !ipo.application) tryDo(() => (ipoApplied++, applyIpo(s, { ipoId: ipo.id, lots: 1 }, cfg).state));
      const open = s.forecasts.find((f) => f.status === 'OPEN');
      if (open && day % 7 === 0) tryDo(() => tradeForecast(s, { forecastId: open.id, outcome: day % 2 ? 'YES' : 'NO', side: 'BUY', shares: 10 }, cfg).state);
      s = advance(s.world.halt ? { ...s, world: { ...s.world, halt: null } } : s, 1, universe, cfg).state;
      expect(checkInvariants(s)).toEqual([]);
    }
    expect(ipoApplied).toBeGreaterThan(3);
    const v = toPublicView(s);
    const marks = v.positions.reduce((a, p) => a + p.valuePaise, 0) + v.fds.filter((f) => f.status === 'ACTIVE').reduce((a, f) => a + (f.valuePaise ?? 0), 0) + v.forecasts.reduce((a, f) => a + f.valuePaise, 0);
    expect(v.netWorthPaise).toBe(s.treasury.available + s.treasury.blocked + s.treasury.unsettled + marks);
  });
});

describe('saves and secrecy', () => {
  it('schema 2 saves gain every desk without losing holdings', () => {
    const s = fresh('old');
    const { ipos: _a, ipoQueue: _b, fundOrders: _c, sips: _d, fds: _e, forecasts: _f, transfers: _g, deskFills: _h, ...rest } = s;
    const old = { ...rest, schema: 2 as const, prices: { MERIDIAN: s.prices.MERIDIAN! }, positions: { MERIDIAN: { instrumentId: 'MERIDIAN', qty: 3, costBasisPaise: 630_000 } }, world: { regime: s.world.regime, factors: s.world.factors, cpiIndex: 1, halt: null, pending: { IN: s.world.pending.IN } } };
    const up = upgradeCareer(old as never, universe, cfg);
    expect(up.schema).toBe(3);
    expect(up.positions.MERIDIAN!.qty).toBe(3);
    expect(up.prices.CSTN).toBeDefined();
    expect(up.world.usdInr).toBe(cfg.world.usdInrStart);
    expect(checkInvariants(up)).toEqual([]);
  });

  it('the public view hides the IPO queue and the exchange’s hidden outcome', () => {
    const s = fresh();
    const frozen = { ...s, world: { ...s.world, exchange: { status: 'FROZEN' as const, since: s.date, resolveDate: '2030-06-01', recoveryPct: 0.42 } } };
    const json = JSON.stringify(toPublicView(frozen));
    expect(json).not.toContain('ipoQueue');
    expect(json).not.toContain('2030-06-01');
    expect(json).not.toContain('0.42');
    expect(json).not.toContain('"factors"');
  });
});

describe('two years of history before day one', () => {
  it('opens on a moving market with a fresh wallet, history up to the start date, and inflation from day one', async () => {
    const { createCareerWithHistory, HISTORY_DAYS } = await import('@ms/engine');
    const { state, records } = createCareerWithHistory({ id: 'h', slot: 1, type: 'FREEPLAY', difficulty: 'REALISTIC', seed: 'hist' }, universe, cfg);
    expect(state.date).toBe(cfg.startDate);
    expect(records).toHaveLength(HISTORY_DAYS);
    expect(records.at(-1)!.date).toBe(cfg.startDate);
    expect(state.indices.MS50!.level).not.toBe(30_000);
    expect(state.baseline.indices.MS50).toBe(state.indices.MS50!.level);
    expect(state.world.cpiIndex).toBe(1);
    expect(state.treasury.available).toBe(cfg.startingTreasuryPaise);
    expect(state.treasury.ledger).toHaveLength(1);
    expect(Object.keys(state.positions)).toHaveLength(0);
    expect(state.ipos).toEqual({});
    expect(netWorth(state)).toBe(cfg.startingTreasuryPaise);
    expect(checkInvariants(state)).toEqual([]);
    // Same seed, same history (deterministic), different seed, different market.
    expect(createCareerWithHistory({ id: 'h2', slot: 1, type: 'FREEPLAY', difficulty: 'REALISTIC', seed: 'hist' }, universe, cfg).state.prices).toEqual(state.prices);
    expect(createCareerWithHistory({ id: 'h3', slot: 1, type: 'FREEPLAY', difficulty: 'REALISTIC', seed: 'other' }, universe, cfg).state.indices.MS50!.level).not.toBe(state.indices.MS50!.level);
  });
});
