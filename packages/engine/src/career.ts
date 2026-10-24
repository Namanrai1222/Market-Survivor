// Career lifecycle: creation, the daily tick, multi-day advance, net worth.
import type { MarketConfig } from './config';
import { addDays } from './calendar';
import { positionValue } from './desks/common';
import { cryptoTick } from './desks/crypto';
import { fdValue, matureFds } from './desks/fixed';
import { forecastTick, forecastValue } from './desks/forecast';
import { processFundOrders, runSips } from './desks/funds';
import { ipoTick } from './desks/ipo';
import { processStockFills } from './desks/stocks/orders';
import { GameError } from './errors';
import { grant, newTreasury, settleDue } from './treasury';
import { DESKS, type CareerState, type CareerType, type ContentPack, type Desk, type Difficulty, type Fill, type GameEvent, type ISODate, type Regime, type ScriptStep, type StoryProgress, type WorldState } from './types';
import { scriptedRegime, yieldsFor, zeros } from './world/factors';
import { generateDay, type DayMarket } from './world/prices';

export interface NewCareerInput {
  id: string;
  slot: number;
  type: CareerType;
  difficulty: Difficulty;
  /** From a CSPRNG, server-side only. */
  seed: string;
  /** Scenario / chapter setup (side runs and story). */
  script?: ScriptStep[] | null;
  endDate?: ISODate | null;
  label?: string | null;
  story?: StoryProgress | null;
  unlockedDesks?: Desk[];
}

/** Desks each career type starts with (Story unlocks the rest chapter by chapter, prd.md §6.2). */
export function startingDesks(type: CareerType): Desk[] {
  if (type === 'FREEPLAY') return [...DESKS];
  // Crash replays teach where money hides: bonds, gold and funds come along.
  if (type === 'TIMEMACHINE') return ['STOCKS', 'FUNDS', 'FIXED_INCOME', 'COMMODITIES'];
  return ['STOCKS'];
}

/** Starting bars for every instrument except IPO companies (they get a price when allotted/listed). */
export function startingPrices(content: ContentPack, date: ISODate): CareerState['prices'] {
  const prices: CareerState['prices'] = {};
  for (const i of content.instruments) {
    if (i.desk === 'IPO') continue;
    const p = i.startPricePaise;
    prices[i.id] = { date, o: p, h: p, l: p, c: p, v: 0, prevClose: p, circuit: null };
  }
  return prices;
}

export function startingWorld(cfg: MarketConfig): WorldState {
  const factors = zeros();
  return {
    regime: 'CALM',
    factors,
    pending: { IN: zeros(), US: zeros() },
    cpiIndex: 1,
    halt: null,
    usdInr: cfg.world.usdInrStart,
    policyRate: cfg.world.policyRateStart,
    yields: yieldsFor(cfg.world.policyRateStart, factors),
    lastPolicy: null,
    exchange: { status: 'OK', since: null, resolveDate: null, recoveryPct: null },
    rugged: [],
  };
}

export function createCareer(input: NewCareerInput, content: ContentPack, cfg: MarketConfig): CareerState {
  const date = cfg.startDate;
  const { script = null, endDate = null, label = null, story = null, unlockedDesks, ...ids } = input;
  const prices = startingPrices(content, date);
  const treasury = newTreasury();
  grant(treasury, cfg.startingTreasuryPaise, { date, desk: null, ref: null, memo: 'Starting Treasury' });
  return {
    schema: 3,
    ...ids,
    startDate: date,
    date,
    stateVersion: 1,
    chapter: 1,
    unlockedDesks: unlockedDesks ?? startingDesks(input.type),
    world: startingWorld(cfg),
    prices,
    indices: Object.fromEntries(content.indices.map((d) => [d.id, { level: d.startLevel, prevLevel: d.startLevel }])),
    treasury,
    positions: {},
    orders: [],
    fills: [],
    seq: 0,
    netWorthPrevPaise: cfg.startingTreasuryPaise,
    netWorthPeakPaise: cfg.startingTreasuryPaise,
    maxDrawdown: 0,
    script,
    endDate,
    ended: false,
    label,
    story,
    ipos: {},
    ipoQueue: { next: 0, announceDate: addDays(date, cfg.ipo.firstAnnounceDays) },
    fundOrders: [],
    sips: [],
    fds: [],
    forecasts: [],
    transfers: [],
    deskFills: [],
    baseline: {
      date,
      indices: Object.fromEntries(content.indices.map((d) => [d.id, d.startLevel])),
      prices: Object.fromEntries(Object.entries(prices).map(([k, b]) => [k, b.c])),
    },
  };
}

/** Years of market history played before a new career's first day. */
export const HISTORY_DAYS = 730;

/**
 * A new career that opens on a market already in motion (prd.md: "the world was here before you"):
 * the world and every market run for `HISTORY_DAYS` before the start date, so charts have two years of
 * candles and indices have a past. The player's wallet, desks and story begin fresh on the start date.
 * History is calm-biased Free Play dynamics; scam-coin rug pulls and exchange failures are kept for
 * the player's own era. Returns the career and the day log to store.
 */
export function createCareerWithHistory(input: NewCareerInput, content: ContentPack, cfg: MarketConfig, historyDays = HISTORY_DAYS): { state: CareerState; records: DayRecord[] } {
  const fresh = createCareer(input, content, cfg);
  if (historyDays <= 0) return { state: fresh, records: [] };
  const quiet: ContentPack = { ...content, instruments: content.instruments.map((i) => (i.rugPullRisk ? { ...i, rugPullRisk: 0 } : i)) };
  const from = addDays(cfg.startDate, -historyDays);
  const histCfg = { ...cfg, startDate: from };
  let st = createCareer({ ...input, type: 'FREEPLAY', difficulty: 'CALM', script: null, endDate: null, story: null, unlockedDesks: [] }, quiet, histCfg);
  st = { ...st, ipoQueue: { next: 0, announceDate: addDays(cfg.startDate, 3650) } };
  const records: DayRecord[] = [];
  while (st.date < cfg.startDate) {
    if (st.world.halt) st = { ...st, world: { ...st.world, halt: null } };
    const day = generateDay(st, quiet, histCfg);
    st = applyDay(st, day, quiet, histCfg).state;
    records.push(dayRecord(st, day));
  }
  // Inflation and real net worth are measured from the player's first day, not from the start of history.
  // A scripted career (story chapter, replay, daily) opens in its script's first regime.
  const regime = scriptedRegime(fresh.script, cfg.startDate) ?? st.world.regime;
  const world = { ...st.world, regime, halt: null, cpiIndex: 1, exchange: fresh.world.exchange, rugged: [] };
  return {
    state: {
      ...fresh,
      world,
      prices: st.prices,
      indices: st.indices,
      baseline: {
        date: cfg.startDate,
        indices: Object.fromEntries(Object.entries(st.indices).map(([k, q]) => [k, q.level])),
        prices: Object.fromEntries(Object.entries(st.prices).map(([k, b]) => [k, b.c])),
      },
    },
    records: records.map((r) => ({ ...r, netWorthPaise: cfg.startingTreasuryPaise })),
  };
}

function dayRecord(st: CareerState, day: DayMarket): DayRecord {
  return {
    date: st.date,
    regime: st.world.regime,
    cpiIndex: st.world.cpiIndex,
    factors: st.world.factors,
    indices: day.indices && Object.fromEntries(Object.entries(day.indices).map(([k, q]) => [k, q.level])),
    bars: day.bars && Object.fromEntries(Object.entries(day.bars).map(([k, b]) => [k, [b.o, b.h, b.l, b.c, b.v]])),
    netWorthPaise: netWorth(st),
  };
}

/**
 * Market-engine.md §7.5: cash in every bucket + every position at its last price (USD at today's
 * USD/INR, frozen coins at the recovery estimate) + deposits with accrued interest + coins in transit
 * + forecast shares at today's odds.
 */
export function netWorth(s: CareerState): number {
  const t = s.treasury;
  let nw = t.available + t.blocked + t.unsettled;
  for (const p of Object.values(s.positions)) nw += positionValue(s, p);
  for (const fd of s.fds) nw += fdValue(fd, s.date);
  for (const tr of s.transfers) nw += positionValue(s, { instrumentId: tr.instrumentId, qty: tr.qty, costBasisPaise: 0, unitScale: 1_000_000, quote: 'USD' });
  for (const f of s.forecasts) nw += forecastValue(f);
  return nw;
}

/** Net worth in start-of-career rupees (deflated by in-world CPI). */
export const realNetWorth = (s: CareerState): number => Math.round(netWorth(s) / s.world.cpiIndex);

/** Apply one generated day: prices, fills, settlement, breakers. Pure. */
export function applyDay(s: CareerState, day: DayMarket, content: ContentPack, cfg: MarketConfig): { state: CareerState; fills: Fill[]; events: GameEvent[] } {
  const st = structuredClone(s);
  st.netWorthPrevPaise = netWorth(s);
  st.date = day.date;
  st.world = day.world;
  let fills: Fill[] = [];
  const events: GameEvent[] = [...day.events];
  if (day.bars) Object.assign(st.prices, day.bars);
  if (day.indices) st.indices = day.indices;
  if (day.inOpen && day.bars) {
    const r = processStockFills(st, day.bars, content, cfg);
    fills = r.fills;
    events.push(...r.events);
    processFundOrders(st, day.bars, content, cfg);
  }
  ipoTick(st, day.inOpen, day.listings, content, cfg, events);
  cryptoTick(st, s.world.exchange.status, content, events);
  matureFds(st, events);
  runSips(st, content, events);
  forecastTick(st, content, cfg, events);
  settleDue(st.treasury, st.date);
  if (day.breakerPct !== null && day.indexMovePct !== null) {
    st.world.halt = { levelPct: day.breakerPct, date: st.date, indexMovePct: day.indexMovePct };
    events.push({ kind: 'MARKET_HALT', date: st.date, levelPct: day.breakerPct, indexMovePct: day.indexMovePct });
  }
  const nw = netWorth(st);
  st.netWorthPeakPaise = Math.max(st.netWorthPeakPaise, nw);
  st.maxDrawdown = Math.max(st.maxDrawdown, 1 - nw / st.netWorthPeakPaise);
  return { state: st, fills, events };
}

/** Append-only history row (world_days + prices_daily + net_worth_snapshots). Server-side only. */
export interface DayRecord {
  date: ISODate;
  regime: Regime;
  cpiIndex: number;
  factors: number[];
  indices: Record<string, number> | null;
  /** id → [o, h, l, c, v] */
  bars: Record<string, [number, number, number, number, number]> | null;
  netWorthPaise: number;
}

export interface AdvanceResult {
  state: CareerState;
  fills: Fill[];
  events: GameEvent[];
  records: DayRecord[];
  /** Why the clock stopped early: a market-wide halt, a story checkpoint date, or the run's end date. */
  paused: 'HALT' | 'CHECKPOINT' | 'ENDED' | null;
}

export interface AdvanceOptions {
  /** Stop once the world reaches this date (a story checkpoint). */
  stopAt?: ISODate | null;
}

export function advance(s: CareerState, days: number, content: ContentPack, cfg: MarketConfig, opts: AdvanceOptions = {}): AdvanceResult {
  if (s.ended) throw new GameError('ENDED', 'This run has finished. Start a new one from the menu.');
  if (s.story?.pending) throw new GameError('CHECKPOINT', 'Answer the checkpoint question to continue.');
  if (!Number.isInteger(days) || days < 1 || days > cfg.maxAdvanceDays) throw new GameError('VALIDATION', `Advance between 1 and ${cfg.maxAdvanceDays} days at a time.`);
  // A halt pauses the clock; advancing again means the market reopens.
  let st: CareerState = s.world.halt ? { ...s, world: { ...s.world, halt: null } } : s;
  const fills: Fill[] = [];
  const events: GameEvent[] = [];
  const records: DayRecord[] = [];
  for (let i = 0; i < days; i++) {
    const day = generateDay(st, content, cfg);
    const r = applyDay(st, day, content, cfg);
    st = r.state;
    fills.push(...r.fills);
    events.push(...r.events);
    records.push(dayRecord(st, day));
    if (st.endDate && st.date >= st.endDate) {
      st = { ...st, ended: true };
      return { state: st, fills, events, records, paused: 'ENDED' };
    }
    if (st.world.halt) return { state: st, fills, events, records, paused: 'HALT' };
    if (opts.stopAt && st.date >= opts.stopAt) return { state: st, fills, events, records, paused: 'CHECKPOINT' };
  }
  return { state: st, fills, events, records, paused: null };
}
