// Asset model (market-engine.md §5): daily bars for every market from factor shocks, sector
// loadings, idiosyncratic noise and jumps. India stocks get price bands and market-wide circuit
// breakers; funds, ETFs and bonds price on India days; US stocks on US days (in dollars); crypto
// every day (in dollars). IPO companies get a listing-day bar, then trade like stocks.
import { addDays, isOpen } from '../calendar';
import type { MarketConfig } from '../config';
import { ceilToTick, clamp, floorToTick, roundToTick } from '../money';
import { stream } from '../rng';
import type { Bar, CareerState, ContentPack, FactorVector, GameEvent, IndexDef, IndexQuote, Instrument, ISODate, Regime, WorldState } from '../types';
import { FACTOR_UNIT, REGIME_PARAMS, idx, scriptedStep, stepWorld, zeros } from './factors';

const TRADING_DAYS = 250;
const JUMP_PROB = 0.004;
const JUMP_MIN = 0.03;
const JUMP_MAX = 0.08;
/** Share of today's move already visible at the open (the rest happens intraday). */
const GAP_SHARE = 0.35;
const EPS = 1e-6;

export interface DayMarket {
  date: ISODate;
  world: WorldState;
  /** Bars for every market that traded today (crypto trades daily); null only if nothing traded. */
  bars: Record<string, Bar> | null;
  /** India traded today (stocks, funds, ETFs, bonds). */
  inOpen: boolean;
  /** IPO companies that listed today, with their listing open (paise). */
  listings: Record<string, number>;
  /** World and market news (rate decisions, exchange failure, rug pulls). */
  events: GameEvent[];
  indices: Record<string, IndexQuote> | null;
  /** Broad index close-to-close move in percent, when India traded. */
  indexMovePct: number | null;
  /** Highest market-wide breaker level hit today, if any. */
  breakerPct: number | null;
  /** Factor shock applied today (server-side records only). */
  shock: FactorVector;
}

export function priceBand(prevClose: number, inst: Instrument, cfg: MarketConfig): { lo: number; hi: number } {
  const band = (inst.bandPct ?? cfg.stocks.defaultBandPct) / 100;
  const tick = cfg.stocks.tickPaise;
  return { lo: ceilToTick(prevClose * (1 - band) - EPS, tick), hi: floorToTick(prevClose * (1 + band) + EPS, tick) };
}

const dot = (a: FactorVector, b: FactorVector): number => a.reduce((s, x, k) => s + x * b[k]!, 0);

/** Market-cap weighted return of an index, weights drifting with each member's price. */
function indexReturn(def: IndexDef, s: CareerState, byId: Map<string, Instrument>, ret: (id: string) => number): number {
  let w = 0;
  let acc = 0;
  for (const id of def.members) {
    const inst = byId.get(id)!;
    const wi = (inst.indexWeight * s.prices[id]!.c) / inst.startPricePaise;
    w += wi;
    acc += wi * ret(id);
  }
  return w === 0 ? 0 : acc / w;
}

const add = (a: FactorVector, b: FactorVector): FactorVector => a.map((x, k) => x + b[k]!);

/** Listing-day pop: subscription, mood and hype (market-engine.md §5.2). */
const LISTING_MOOD: Record<Regime, number> = { EUPHORIA: 0.12, CALM: 0.03, RECOVERY: 0, STRESSED: -0.06, CRISIS: -0.15 };

/** Is this instrument a stock today (India stocks + IPO companies that have listed)? */
export const tradesAsStock = (inst: Instrument, s: Pick<CareerState, 'ipos'>): boolean => inst.desk === 'STOCKS' || (inst.desk === 'IPO' && s.ipos[inst.id]?.status === 'LISTED');

/** Generate the next calendar day's world and bars for every market open today. Pure. */
export function generateDay(s: CareerState, content: ContentPack, cfg: MarketConfig): DayMarket {
  const date = addDays(s.date, 1);
  const inOpen = isOpen('IN', date, cfg.calendars);
  const usOpen = isOpen('US', date, cfg.calendars);
  const stepped = stepWorld(s.world, date, s.seed, s.type, s.difficulty, s.script, { inOpen, rateBounds: { min: cfg.world.policyRateMin, max: cfg.world.policyRateMax } });
  const { shock } = stepped;
  let world = stepped.world;
  const events: GameEvent[] = [...stepped.notices];
  const carried = s.world.pending;
  // Shocks pile up while a market is closed and hit it at the next open (the Monday gap).
  const pending = { IN: inOpen ? zeros() : add(carried.IN, shock), US: usOpen ? zeros() : add(carried.US, shock) };
  const rp = REGIME_PARAMS[world.regime];
  const hits = scriptedStep(s.script, date)?.hits ?? {};
  const byId = new Map(content.instruments.map((i) => [i.id, i]));
  const bars: Record<string, Bar> = {};
  const listings: Record<string, number> = {};
  let indices: Record<string, IndexQuote> | null = null;
  let indexMovePct: number | null = null;
  let breakerPct: number | null = null;

  const betaOf = (inst: Instrument): FactorVector => {
    const sector = content.sectors[inst.sector];
    if (!sector) throw new Error(`unknown sector ${inst.sector}`);
    // Correlation boost: in stress everything loads more on global risk and liquidity.
    return sector.loadings.map((b, k) => (k === idx('GR') || k === idx('LIQ') ? b + rp.corrBoost : b));
  };

  if (inOpen) {
    const stocks = content.instruments.filter((i) => tradesAsStock(i, s));
    const moves = new Map<string, { ret: number; gapLog: number; sigma: number }>();

    for (const inst of stocks) {
      const sector = content.sectors[inst.sector]!;
      const beta = betaOf(inst);
      const fCarried = dot(beta, carried.IN) * FACTOR_UNIT;
      const fToday = dot(beta, shock) * FACTOR_UNIT;
      const r = stream(s.seed, 'world.assets', `${date}|${inst.id}`);
      const sigmaIdio = (sector.idioVolPct / 100 / Math.sqrt(TRADING_DAYS)) * rp.volMult;
      const idio = sigmaIdio * r.normal();
      const jump = r.next() < JUMP_PROB * rp.volMult ? (r.next() < 0.5 ? -1 : 1) * (JUMP_MIN + (JUMP_MAX - JUMP_MIN) * r.next()) : 0;
      const hit = hits[inst.id] ?? 0;
      const logRet = sector.alphaPct / 100 / TRADING_DAYS + fCarried + fToday + idio + jump + hit;
      const gapLog = fCarried + hit + GAP_SHARE * (fToday + idio + jump) + 0.2 * sigmaIdio * r.normal();
      const sigma = Math.hypot(sigmaIdio, FACTOR_UNIT * rp.volMult * Math.hypot(...beta));
      moves.set(inst.id, { ret: Math.exp(logRet) - 1, gapLog, sigma });
    }

    const bandOf = (i: Instrument): number => (i.bandPct ?? cfg.stocks.defaultBandPct) / 100;
    const clampAll = (lift: number): void => {
      for (const i of stocks) {
        const m = moves.get(i.id)!;
        m.ret = clamp(m.ret + lift, -bandOf(i), bandOf(i));
      }
    };
    clampAll(0);

    // ponytail: breakers use the close-to-close index move (daily bars have no intraday path);
    // add an intraday index path if the halt timing rules need it.
    const breakerDef = content.indices.find((d) => d.id === content.breakerIndexId)!;
    const retOf = (id: string): number => moves.get(id)!.ret;
    let idxRet = indexReturn(breakerDef, s, byId, retOf);
    const floor = -Math.max(...cfg.stocks.breakersPct) / 100;
    if (idxRet < floor) {
      // Final breaker: the market closes for the day at the limit.
      clampAll(floor - idxRet);
      idxRet = indexReturn(breakerDef, s, byId, retOf);
    }
    const hit = cfg.stocks.breakersPct.filter((b) => idxRet <= -b / 100 + EPS);
    breakerPct = hit.length ? Math.max(...hit) : null;
    indexMovePct = idxRet * 100;

    const tick = cfg.stocks.tickPaise;
    for (const inst of stocks) {
      const m = moves.get(inst.id)!;
      const prev = s.prices[inst.id]!.c;
      const { lo, hi } = priceBand(prev, inst, cfg);
      const r = stream(s.seed, 'world.assets', `${date}|${inst.id}|ohlc`);
      const c = clamp(roundToTick(prev * (1 + m.ret), tick), lo, hi);
      const o = clamp(roundToTick(prev * Math.exp(m.gapLog), tick), lo, hi);
      const h = clamp(ceilToTick(Math.max(o, c) * Math.exp(Math.abs(r.normal()) * 0.5 * m.sigma), tick), Math.max(o, c), hi);
      const l = clamp(floorToTick(Math.min(o, c) * Math.exp(-Math.abs(r.normal()) * 0.5 * m.sigma), tick), lo, Math.min(o, c));
      const v = Math.round((inst.advPaise / prev) * (1 + Math.abs(m.ret) * 20) * rp.volMult);
      bars[inst.id] = { date, o, h, l, c, v, prevClose: prev, circuit: c >= hi ? 'UPPER' : c <= lo ? 'LOWER' : null };
    }

    indices = {};
    for (const def of content.indices) {
      const prevLevel = s.indices[def.id]!.level;
      indices[def.id] = { level: Math.round(prevLevel * (1 + indexReturn(def, s, byId, retOf)) * 100) / 100, prevLevel };
    }

    // IPO listing day: the price opens at a pop (or a flop), then moves inside a listing band.
    for (const ipo of Object.values(s.ipos)) {
      if (ipo.status !== 'CLOSED' || ipo.listDate !== date) continue;
      const inst = byId.get(ipo.id)!;
      const def = content.ipos.find((d) => d.instrumentId === ipo.id);
      const r = stream(s.seed, 'world.ipo', `${ipo.id}|list`);
      const gain = clamp(-0.02 + 0.09 * Math.log(Math.max(0.2, ipo.subscription)) + LISTING_MOOD[world.regime] + 0.05 * ((def?.hype ?? 1) - 1) + 0.08 * r.normal(), -0.3, 1.2);
      const issue = ipo.bandHiPaise;
      const o = roundToTick(issue * (1 + gain), tick);
      const band = cfg.ipo.listingBandPct / 100;
      const dayRet = clamp(dot(betaOf(inst), shock) * FACTOR_UNIT + 0.05 * rp.volMult * r.normal(), -band, band);
      const c = roundToTick(o * (1 + dayRet), tick);
      const h = ceilToTick(Math.max(o, c) * (1 + Math.abs(r.normal()) * 0.02), tick);
      const l = floorToTick(Math.min(o, c) * (1 - Math.abs(r.normal()) * 0.02), tick);
      bars[ipo.id] = { date, o, h, l, c, v: Math.round((inst.advPaise / issue) * 4), prevClose: issue, circuit: null };
      listings[ipo.id] = o;
    }

    // Funds, ETFs and bonds price on India trading days.
    for (const inst of content.instruments) {
      if (inst.market !== 'IN' || inst.desk === 'STOCKS' || inst.desk === 'IPO') continue;
      const prevBar = s.prices[inst.id];
      if (!prevBar) continue;
      const calDays = Math.max(1, Math.round((Date.parse(date) - Date.parse(prevBar.date)) / 86_400_000));
      const r = stream(s.seed, 'world.assets', `${date}|${inst.id}`);
      const fee = ((inst.expensePct ?? 0) / 100) * (calDays / 365);
      let logRet: number;
      let sigma: number;
      const pr = inst.pricing ?? { kind: 'FACTOR' as const };
      if (pr.kind === 'INDEX') {
        const q = indices[pr.indexId]!;
        logRet = Math.log(q.level / q.prevLevel) - fee;
        sigma = Math.abs(logRet) / 2 + 0.002;
      } else if (pr.kind === 'DURATION') {
        // ΔP/P ≈ −D·Δy + y·t (market-engine.md §5.2), with a little noise for supply and demand.
        const y = world.yields[pr.curve] / 100;
        const dy = (world.yields[pr.curve] - s.world.yields[pr.curve]) / 100;
        logRet = -pr.duration * dy + y * (calDays / 365) - fee + 0.0004 * pr.duration * 0.2 * r.normal();
        sigma = 0.0006 * pr.duration;
      } else {
        const sector = content.sectors[inst.sector]!;
        const beta = betaOf(inst);
        const sigmaIdio = (sector.idioVolPct / 100 / Math.sqrt(TRADING_DAYS)) * rp.volMult;
        logRet = sector.alphaPct / 100 / TRADING_DAYS + dot(beta, add(carried.IN, shock)) * FACTOR_UNIT + sigmaIdio * r.normal() - fee;
        sigma = Math.hypot(sigmaIdio, FACTOR_UNIT * rp.volMult * Math.hypot(...beta));
      }
      bars[inst.id] = freeBar(date, prevBar.c, logRet, sigma, r, 1, (inst.advPaise / prevBar.c) * rp.volMult);
    }
  }

  // US stocks: dollar prices on US trading days.
  if (usOpen) {
    for (const inst of content.instruments) {
      if (inst.market !== 'US') continue;
      const prevBar = s.prices[inst.id];
      if (!prevBar) continue;
      const sector = content.sectors[inst.sector]!;
      const beta = betaOf(inst);
      const r = stream(s.seed, 'world.assets', `${date}|${inst.id}`);
      const sigmaIdio = (sector.idioVolPct / 100 / Math.sqrt(TRADING_DAYS)) * rp.volMult;
      const jump = r.next() < JUMP_PROB * rp.volMult ? (r.next() < 0.5 ? -1 : 1) * (JUMP_MIN + (JUMP_MAX - JUMP_MIN) * r.next()) : 0;
      const logRet = sector.alphaPct / 100 / TRADING_DAYS + dot(beta, add(carried.US, shock)) * FACTOR_UNIT + sigmaIdio * r.normal() + jump - (inst.expensePct ?? 0) / 100 / TRADING_DAYS;
      bars[inst.id] = freeBar(date, prevBar.c, logRet, Math.hypot(sigmaIdio, FACTOR_UNIT * rp.volMult * Math.hypot(...beta)), r, 0.01, 2e6 * rp.volMult);
    }
  }

  // Crypto never closes. Dollar prices, 365-day volatility, and the odd rug pull.
  const rugged = [...world.rugged];
  for (const inst of content.instruments) {
    if (inst.market !== 'CRYPTO') continue;
    const prevBar = s.prices[inst.id];
    if (!prevBar) continue;
    const r = stream(s.seed, 'world.assets', `${date}|${inst.id}`);
    if (inst.pricing?.kind === 'PEGGED') {
      bars[inst.id] = freeBar(date, prevBar.c, Math.log(inst.startPricePaise / prevBar.c) + 0.0003 * r.normal(), 0.0004, r, 0.0001, 1e9);
      continue;
    }
    const sector = content.sectors[inst.sector]!;
    const beta = betaOf(inst);
    const sigmaIdio = (sector.idioVolPct / 100 / Math.sqrt(365)) * rp.volMult;
    let logRet = sector.alphaPct / 100 / 365 + dot(beta, shock) * FACTOR_UNIT + sigmaIdio * r.normal() + (hits[inst.id] ?? 0);
    if (inst.rugPullRisk && !rugged.includes(inst.id)) {
      const u = stream(s.seed, 'world.crypto', `rug|${inst.id}|${date}`).next();
      if (u < inst.rugPullRisk * (world.regime === 'EUPHORIA' ? 2 : 1)) {
        rugged.push(inst.id);
        logRet = Math.log(0.03);
        events.push({ kind: 'NOTICE', date, level: 'CRITICAL', desk: 'CRYPTO', message: `${inst.name}'s anonymous team vanished with investors' money. ${inst.symbol} fell 97% in a day.` });
      }
    }
    bars[inst.id] = freeBar(date, prevBar.c, logRet, Math.hypot(sigmaIdio, FACTOR_UNIT * rp.volMult * Math.hypot(...beta)), r, 0.0001, 5e5 * rp.volMult);
  }
  if (rugged.length !== world.rugged.length) world = { ...world, rugged };

  return {
    date,
    world: { ...world, pending },
    bars: Object.keys(bars).length ? bars : null,
    inOpen,
    listings,
    events,
    indices,
    indexMovePct,
    breakerPct,
    shock,
  };
}

/** OHLC bar for an instrument without price bands. `tick` is the price step (1 paisa; 0.01 or 0.0001 cents). */
function freeBar(date: ISODate, prev: number, logRet: number, sigma: number, r: { normal: () => number }, tick: number, volume: number): Bar {
  const round = (x: number) => Math.max(tick, Math.round(x / tick) * tick);
  const fix = (x: number) => Number(round(x).toFixed(tick < 1 ? 4 : 0));
  const c = fix(prev * Math.exp(logRet));
  const o = fix(prev * Math.exp(GAP_SHARE * logRet + 0.2 * sigma * r.normal()));
  const h = fix(Math.max(o, c) * Math.exp(Math.abs(r.normal()) * 0.5 * sigma));
  const l = fix(Math.min(o, c) * Math.exp(-Math.abs(r.normal()) * 0.5 * sigma));
  return { date, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v: Math.round(volume * (1 + Math.abs(logRet) * 20)), prevClose: prev, circuit: null };
}
