// Career service: the only code that loads, mutates and saves careers.
// Every mutation: lock → idempotency replay → version check → pure engine call →
// invariant check → save → { career view, treasury, netWorth, stateVersion, newAlerts }.
import { randomBytes, randomUUID } from 'node:crypto';
import { BREAKER_INDEX, universe } from '@ms/content/universe';
import {
  advance,
  applyIpo,
  bookFd,
  breakFd,
  cancelFundOrder,
  cancelSip,
  createSip,
  instantTrade,
  moveCustody,
  placeFundOrder,
  tradeForecast,
  withdrawIpo,
  cancelOrder,
  checkInvariants,
  createCareerWithHistory,
  defaultConfig,
  InvariantError,
  placeOrder,
  toCareerSummary,
  toPublicView,
  type CareerState,
  type CareerView,
  type DayRecord,
  type Desk,
  type GameEvent,
} from '@ms/engine';
import type { AdvanceBody, CheckpointBody, CreateCareerBody, DeskActionBody, PlaceOrderBody } from '../lib/schemas';
import { HttpError } from './http';
import { requireConsent, updateProgress } from './player';
import { dailySetup, timeMachineSetup, todayIST } from './scenarios';
import { appendDays, deleteDoc, isUuid, listDocs, readDays, readDoc, withLock, writeDoc, type CareerDoc } from './store';
import { answerCheckpoint, arriveAtCheckpoint, nextCheckpoint, startNextChapter, storyNews, storySetup, storyView, trackIndex } from './story';

/** Save slots 1–3 hold Story / Free Play careers; side runs use fixed internal slots. */
const DAILY_SLOT = 4;
const TIME_MACHINE_SLOT = 5;

const cfg = defaultConfig;
const IDEM_KEEP = 100;

export interface Alert {
  level: 'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL' | 'HALT';
  date: string;
  message: string;
}

// ponytail: events mapped to alerts inline; the full alert engine (levels, dedupe, cooldowns) is Phase 4.
// Desk news only reaches players who have that desk (no Vaultex alerts in a stocks-only chapter).
function toAlerts(events: GameEvent[], unlocked: Desk[]): Alert[] {
  return events.flatMap((e): Alert[] => {
    if (e.kind === 'MARKET_HALT') return [{ level: 'HALT', date: e.date, message: `${BREAKER_INDEX.name} fell ${Math.abs(e.indexMovePct).toFixed(1)}% today. The ${e.levelPct}% market-wide circuit breaker paused trading.` }];
    if (e.kind === 'ORDER_CANCELLED') return [{ level: 'INFO', date: e.date, message: `Order ${e.orderId} was cancelled: ${e.reason}.` }];
    return e.desk && !unlocked.includes(e.desk) ? [] : [{ level: e.level, date: e.date, message: e.message }];
  });
}

const notFound = (): HttpError => new HttpError(404, 'NOT_FOUND', 'Career not found.');

/** Return on the starting Treasury, as a fraction. */
const runReturn = (c: CareerState): number => toPublicView(c).netWorthPaise / cfg.startingTreasuryPaise - 1;

function runInfo(doc: CareerDoc) {
  const c = doc.career;
  if (c.type === 'DAILY') return { kind: 'DAILY' as const, dailyDate: doc.meta?.dailyDate ?? null, scenarioId: null, returnPct: runReturn(c) };
  if (c.type === 'TIMEMACHINE') return { kind: 'TIMEMACHINE' as const, dailyDate: null, scenarioId: doc.meta?.scenarioId ?? null, returnPct: runReturn(c) };
  return null;
}

/** Everything the client may see about one career (its public view + story + side-run info). */
export function envelope(doc: CareerDoc, extra: Record<string, unknown> = {}) {
  const view: CareerView = toPublicView(doc.career);
  return {
    career: view,
    treasury: view.treasury,
    netWorthPaise: view.netWorthPaise,
    stateVersion: view.stateVersion,
    story: storyView(doc.career, cfg),
    run: runInfo(doc),
    newAlerts: [] as Alert[],
    ...extra,
  };
}

async function load(playerId: string, careerId: string): Promise<CareerDoc> {
  if (!isUuid(careerId)) throw notFound();
  const doc = await readDoc(playerId, careerId); // scoped by player directory: other players' careers are invisible (TC-SEC-01/02)
  if (!doc) throw notFound();
  return doc;
}

export async function listCareers(playerId: string) {
  const docs = await listDocs(playerId);
  const side = (slot: number) => {
    const d = docs.find((x) => x.career.slot === slot);
    return d ? { ...toCareerSummary(d.career), run: runInfo(d) } : null;
  };
  const daily = side(DAILY_SLOT);
  return {
    careers: docs.filter((d) => d.career.slot <= 3).map((d) => toCareerSummary(d.career)).sort((a, b) => a.slot - b.slot),
    // Yesterday's challenge is over; only today's run is offered.
    daily: daily && daily.run?.dailyDate === todayIST() ? daily : null,
    timeMachine: side(TIME_MACHINE_SLOT),
  };
}

const newSeed = (): string => randomBytes(16).toString('hex');

export function newCareer(playerId: string, body: CreateCareerBody) {
  return withLock(`player:${playerId}`, async () => {
    await requireConsent(playerId);
    const docs = await listDocs(playerId);
    const base = { id: randomUUID(), difficulty: 'REALISTIC' as const };

    if (body.type === 'DAILY') {
      const today = todayIST();
      const existing = docs.find((d) => d.career.slot === DAILY_SLOT);
      if (existing?.meta?.dailyDate === today) return envelope(existing); // one run per day: reopen it
      if (existing) await deleteDoc(playerId, existing.career.id);
      const setup = dailySetup(today);
      const { state: career, records } = createCareerWithHistory({ ...base, slot: DAILY_SLOT, type: 'DAILY', ...setup }, universe, cfg);
      const doc: CareerDoc = { career, idem: {}, meta: { dailyDate: today } };
      await writeDoc(playerId, doc);
      await appendDays(playerId, career.id, records);
      return envelope(doc);
    }

    if (body.type === 'TIMEMACHINE') {
      const setup = timeMachineSetup(body.scenarioId);
      if (!setup) throw new HttpError(404, 'NOT_FOUND', 'Unknown Time Machine scenario.');
      const existing = docs.find((d) => d.career.slot === TIME_MACHINE_SLOT);
      if (existing) await deleteDoc(playerId, existing.career.id); // one replay at a time
      const { state: career, records } = createCareerWithHistory({ ...base, slot: TIME_MACHINE_SLOT, type: 'TIMEMACHINE', seed: newSeed(), ...setup }, universe, cfg);
      const doc: CareerDoc = { career, idem: {}, meta: { scenarioId: body.scenarioId } };
      await writeDoc(playerId, doc);
      await appendDays(playerId, career.id, records);
      return envelope(doc);
    }

    if (docs.some((d) => d.career.slot === body.slot)) throw new HttpError(409, 'SLOT_TAKEN', `Slot ${body.slot} already has a career. Delete it first.`);
    const story = body.type === 'STORY' ? storySetup() : {};
    // Two years of market history are played first, so the career opens on a market already in motion.
    const { state: career, records } = createCareerWithHistory({ ...base, slot: body.slot, type: body.type, difficulty: body.difficulty, seed: newSeed(), ...story }, universe, cfg);
    const doc: CareerDoc = { career, idem: {} };
    await writeDoc(playerId, doc);
    await appendDays(playerId, career.id, records);
    return envelope(doc);
  });
}

export async function getCareer(playerId: string, careerId: string) {
  return envelope(await load(playerId, careerId));
}

export interface Candle {
  /** ISO date (the chart treats it as a business day). */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Daily bars for one stock, oldest first, ending at the career's current date (never beyond:
 * the day log only holds days that have happened — TC-SEC-09). Prices in paise.
 */
export async function getHistory(playerId: string, careerId: string, instrumentId: string, days: number) {
  const doc = await load(playerId, careerId);
  if (!universe.instruments.some((i) => i.id === instrumentId)) throw new HttpError(404, 'NOT_FOUND', 'Unknown instrument.');
  const records = await readDays(playerId, careerId);
  const candles: Candle[] = [];
  for (const r of records) {
    const b = r.bars?.[instrumentId];
    if (b && r.date <= doc.career.date) candles.push({ time: r.date, open: b[0], high: b[1], low: b[2], close: b[3], volume: b[4] });
  }
  return { instrumentId, date: doc.career.date, candles: candles.slice(-days) };
}

/** Instruments whose 30-day trail the World desk draws (one per market tile). */
const DASH_SPARKS = ['INGOT', 'BARREL', 'FRONT500', 'CSTN', 'SURV50IDX'];

/**
 * World desk series from the day log, read once: your net worth since day one, the breaker index for a
 * year (two years of pre-career history included), and short price trails. Public data only: the log's
 * hidden factor levels never leave the server.
 */
export async function getDashboard(playerId: string, careerId: string) {
  const doc = await load(playerId, careerId);
  const c = doc.career;
  const records = (await readDays(playerId, careerId)).filter((r) => r.date <= c.date);
  const worth = records.filter((r) => r.date >= c.baseline.date).map((r) => ({ time: r.date, value: r.netWorthPaise }));
  const index = records.flatMap((r) => (r.indices?.[BREAKER_INDEX.id] ? [{ time: r.date, value: r.indices[BREAKER_INDEX.id]! }] : [])).slice(-500);
  const sparks: Record<string, number[]> = {};
  for (const id of DASH_SPARKS) sparks[id] = records.flatMap((r) => (r.bars?.[id] ? [r.bars[id][3]] : [])).slice(-30);
  return { date: c.date, worth, index, sparks };
}

export function removeCareer(playerId: string, careerId: string) {
  return withLock(`${playerId}/${careerId}`, async () => {
    await load(playerId, careerId);
    await deleteDoc(playerId, careerId);
    return { deleted: careerId };
  });
}

interface Step<R> {
  state: CareerState;
  result: R;
  records?: DayRecord[];
  events?: GameEvent[];
}

function mutate<R>(playerId: string, careerId: string, key: string, expectedVersion: number, fn: (c: CareerState) => Step<R>) {
  return withLock(`${playerId}/${careerId}`, async () => {
    const doc = await load(playerId, careerId); // not yours → 404 before anything else (TC-SEC-02)
    await requireConsent(playerId);
    const prior = doc.idem[key];
    if (prior) return envelope(doc, { result: prior.result as R, replayed: true }); // TC-SEC-04
    if (doc.career.stateVersion !== expectedVersion)
      throw new HttpError(409, 'STALE_STATE', 'Your screen was out of date and has been refreshed. Review and try again.', { career: toPublicView(doc.career) });

    const out = fn(doc.career); // GameError → nothing saved
    // A story checkpoint whose date arrived pauses the clock until it is answered.
    const next: CareerState = { ...arriveAtCheckpoint(out.state), stateVersion: doc.career.stateVersion + 1 };
    const violations = checkInvariants(next);
    if (violations.length) throw new InvariantError(violations.join('; '));

    const idem = { ...doc.idem, [key]: { at: Date.now(), result: out.result } };
    const keep = Object.entries(idem).sort((a, b) => b[1].at - a[1].at).slice(0, IDEM_KEEP);
    // ponytail: doc first, then the days log; without a DB transaction a crash between them can drop history rows.
    const saved: CareerDoc = { ...doc, career: next, idem: Object.fromEntries(keep) };
    await writeDoc(playerId, saved);
    await appendDays(playerId, careerId, out.records ?? []);
    if (next.ended && !doc.career.ended) await recordBest(playerId, saved);
    return { ...envelope(saved, { result: out.result }), newAlerts: toAlerts(out.events ?? [], next.unlockedDesks) };
  });
}

/** Keep each player's best Daily / Time Machine return (virtual only, no rewards: legal review L-11). */
async function recordBest(playerId: string, doc: CareerDoc) {
  const r = runReturn(doc.career);
  const { dailyDate, scenarioId } = doc.meta ?? {};
  if (doc.career.type === 'DAILY' && dailyDate)
    await updateProgress(playerId, (p) => ({ ...p, dailyBest: { ...p.dailyBest, [dailyDate]: Math.max(r, p.dailyBest[dailyDate] ?? -Infinity) } }));
  if (doc.career.type === 'TIMEMACHINE' && scenarioId)
    await updateProgress(playerId, (p) => ({ ...p, timeMachineBest: { ...p.timeMachineBest, [scenarioId]: Math.max(r, p.timeMachineBest[scenarioId] ?? -Infinity) } }));
}

export const advanceCareer = (playerId: string, careerId: string, key: string, body: AdvanceBody) =>
  mutate(playerId, careerId, key, body.expectedVersion, (c) => {
    // Story: stop on the next checkpoint date so the question lands on its day.
    const r = advance(c, body.days, universe, cfg, { stopAt: nextCheckpoint(c)?.date ?? null });
    const events = [...r.events, ...storyNews(r.state, c.date)];
    return { state: trackIndex(r.state, r.records), records: r.records, events, result: { fills: r.fills, events, paused: r.paused, days: r.records.length } };
  });

export const placeCareerOrder = (playerId: string, careerId: string, key: string, body: PlaceOrderBody) =>
  mutate(playerId, careerId, key, body.expectedVersion, (c) => {
    const { expectedVersion: _v, ...input } = body;
    const r = placeOrder(c, input, universe, cfg);
    return { state: r.state, result: { order: r.order } };
  });

export const cancelCareerOrder = (playerId: string, careerId: string, orderId: string, key: string, expectedVersion: number) =>
  mutate(playerId, careerId, key, expectedVersion, (c) => {
    const r = cancelOrder(c, orderId);
    return { state: r.state, result: { order: r.order } };
  });

export const answerCareerCheckpoint = (playerId: string, careerId: string, key: string, body: CheckpointBody) =>
  mutate(playerId, careerId, key, body.expectedVersion, (c) => {
    const r = answerCheckpoint(c, body.checkpointId, body.choiceId);
    if (!r) throw new HttpError(409, 'NO_CHECKPOINT', 'That question is no longer waiting for an answer.');
    return { state: r.state, result: { reply: r.reply } };
  });

/** Every desk action beyond the stock order book (IPOs, funds, SIPs, deposits, ETFs, bonds, US, crypto, forecasts). */
export const deskAction = (playerId: string, careerId: string, key: string, body: DeskActionBody) =>
  mutate<Record<string, unknown>>(playerId, careerId, key, body.expectedVersion, (c) => {
    switch (body.kind) {
      case 'TRADE': {
        const r = instantTrade(c, { instrumentId: body.instrumentId, side: body.side, qty: body.qty }, universe, cfg);
        return { state: r.state, result: { fill: r.fill } };
      }
      case 'CUSTODY': {
        const r = moveCustody(c, { instrumentId: body.instrumentId, to: body.to, qty: body.qty }, universe, cfg);
        return { state: r.state, result: { transfer: r.transfer } };
      }
      case 'FUND_BUY': {
        const r = placeFundOrder(c, { fundId: body.fundId, side: 'BUY', amountPaise: body.amountPaise }, universe, cfg);
        return { state: r.state, result: { fundOrder: r.order } };
      }
      case 'FUND_REDEEM': {
        const r = placeFundOrder(c, { fundId: body.fundId, side: 'SELL', units: body.units }, universe, cfg);
        return { state: r.state, result: { fundOrder: r.order } };
      }
      case 'FUND_CANCEL': {
        const r = cancelFundOrder(c, body.orderId);
        return { state: r.state, result: { fundOrder: r.order } };
      }
      case 'SIP_START': {
        const r = createSip(c, { fundId: body.fundId, amountPaise: body.amountPaise, dayOfMonth: body.dayOfMonth, stepUpPct: body.stepUpPct }, universe, cfg);
        return { state: r.state, result: { sip: r.sip } };
      }
      case 'SIP_STOP': {
        const r = cancelSip(c, body.sipId);
        return { state: r.state, result: { sip: r.sip } };
      }
      case 'IPO_APPLY': {
        const r = applyIpo(c, { ipoId: body.ipoId, lots: body.lots }, cfg);
        return { state: r.state, result: { ipo: r.ipo } };
      }
      case 'IPO_WITHDRAW': {
        const r = withdrawIpo(c, body.ipoId);
        return { state: r.state, result: { ipo: r.ipo } };
      }
      case 'FD_BOOK': {
        const r = bookFd(c, { tenorId: body.tenorId, amountPaise: body.amountPaise }, cfg);
        return { state: r.state, result: { fd: r.fd } };
      }
      case 'FD_BREAK': {
        const r = breakFd(c, body.fdId, cfg);
        return { state: r.state, result: { fd: r.fd } };
      }
      case 'NEXT_CHAPTER': {
        const next = startNextChapter(c, cfg);
        if (!next) throw new HttpError(409, 'NO_NEXT_CHAPTER', 'Finish this chapter first, or the next one isn’t open yet.');
        return { state: next, result: { chapter: next.chapter } };
      }
      case 'FORECAST': {
        const r = tradeForecast(c, { forecastId: body.forecastId, outcome: body.outcome, side: body.side, shares: body.shares }, cfg);
        return { state: r.state, result: { amountPaise: r.amountPaise } };
      }
    }
  });
