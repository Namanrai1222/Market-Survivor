// Forecasts (the PREDICTION desk, renamed per legal review L-09): coins-only YES/NO questions about
// in-game outcomes — never real-world events. Priced by LMSR (market-engine.md §8.1); bot traders move
// the odds toward what the in-game data implies, plus herding and noise (§8.2).
import { addDays, addTradingDays, isOpen, prettyDate } from '../calendar';
import type { MarketConfig } from '../config';
import { GameError } from '../errors';
import { inr } from '../money';
import { stream } from '../rng';
import { credit, spend } from '../treasury';
import type { CareerState, ContentPack, Forecast, ForecastKind, GameEvent, ISODate } from '../types';
import { REGIME_PARAMS, HIKE_AT, nextPolicyMeeting, policyPressure } from '../world/factors';
import { assertDesk, nextId } from './common';

// ---------- LMSR ----------

/** C(q) = b·ln(e^(qY/b) + e^(qN/b)), computed without overflow. */
export function lmsrCost(qYes: number, qNo: number, b: number): number {
  const m = Math.max(qYes, qNo);
  return m + b * Math.log(Math.exp((qYes - m) / b) + Math.exp((qNo - m) / b));
}
export const priceYes = (f: Pick<Forecast, 'qYes' | 'qNo' | 'b'>): number => 1 / (1 + Math.exp((f.qNo - f.qYes) / f.b));

/** Paise to buy (positive Δ) or received for selling (negative Δ) shares of one outcome. */
export function tradeCost(f: Pick<Forecast, 'qYes' | 'qNo' | 'b' | 'sharePaise'>, outcome: 'YES' | 'NO', delta: number): number {
  const before = lmsrCost(f.qYes, f.qNo, f.b);
  const after = outcome === 'YES' ? lmsrCost(f.qYes + delta, f.qNo, f.b) : lmsrCost(f.qYes, f.qNo + delta, f.b);
  return Math.round((after - before) * f.sharePaise);
}

/** Your shares at today's odds (what selling them all would roughly fetch). */
export function forecastValue(f: Forecast): number {
  if (f.status === 'RESOLVED') return 0;
  const p = priceYes(f);
  return Math.round((f.yes * p + f.no * (1 - p)) * f.sharePaise);
}

// ---------- Trading ----------

export interface ForecastTradeInput {
  forecastId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  shares: number;
}

export function tradeForecast(s: CareerState, input: ForecastTradeInput, cfg: MarketConfig): { state: CareerState; forecast: Forecast; amountPaise: number } {
  assertDesk(s, 'PREDICTION');
  const f0 = s.forecasts.find((f) => f.id === input.forecastId);
  if (!f0) throw new GameError('NOT_FOUND', 'Unknown forecast.');
  if (f0.status !== 'OPEN') throw new GameError('VALIDATION', 'This forecast is closed to new trades. It resolves soon.');
  const { shares, outcome, side } = input;
  if (!Number.isInteger(shares) || shares < 1 || shares > cfg.prediction.maxSharesPerTrade) throw new GameError('VALIDATION', `Trade 1 to ${cfg.prediction.maxSharesPerTrade} shares at a time.`);
  const st = structuredClone(s);
  const f = st.forecasts.find((x) => x.id === f0.id)!;
  const c = { date: st.date, desk: 'PREDICTION' as const, ref: f.id };
  let amount: number;
  if (side === 'BUY') {
    amount = tradeCost(f, outcome, shares);
    if (amount > st.treasury.available) throw new GameError('INSUFFICIENT_FUNDS', `${shares} ${outcome} shares cost ${inr(amount)}; you have ${inr(st.treasury.available)} available.`);
    spend(st.treasury, amount, 'buy', { ...c, memo: `Forecast: ${shares} ${outcome} on “${f.question}”` });
    if (outcome === 'YES') { f.qYes += shares; f.yes += shares; } else { f.qNo += shares; f.no += shares; }
    f.costPaise += amount;
  } else {
    const held = outcome === 'YES' ? f.yes : f.no;
    if (shares > held) throw new GameError('INSUFFICIENT_QTY', `You hold ${held} ${outcome} shares.`);
    amount = -tradeCost(f, outcome, -shares);
    const total = f.yes + f.no;
    const basis = Math.round((f.costPaise * shares) / total);
    credit(st.treasury, amount, 'sell', { ...c, memo: `Forecast: sold ${shares} ${outcome} on “${f.question}”` });
    if (outcome === 'YES') { f.qYes -= shares; f.yes -= shares; } else { f.qNo -= shares; f.no -= shares; }
    f.costPaise -= basis;
  }
  return { state: st, forecast: f, amountPaise: amount };
}

// ---------- Markets: creation, bots, resolution ----------

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const logit = (p: number) => Math.log(p / (1 - p));
const clampP = (p: number) => Math.min(0.98, Math.max(0.02, p));

function tradingDaysLeft(from: ISODate, to: ISODate, cfg: MarketConfig): number {
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isOpen('IN', d, cfg.calendars)) n++;
  return n;
}

/** Current level of the thing a forecast is about. */
function subjectLevel(s: CareerState, f: Pick<Forecast, 'kind' | 'subject'>): number {
  if (f.kind === 'INDEX_ABOVE') return s.indices[f.subject]!.level;
  if (f.kind === 'RATE_HIKE') return policyPressure(s.world);
  return s.prices[f.subject]!.c;
}

/** What the in-game data says the YES probability is (the informed bots' anchor). */
function fairProbability(s: CareerState, f: Forecast, cfg: MarketConfig): number {
  const vol = REGIME_PARAMS[s.world.regime].volMult;
  if (f.kind === 'RATE_HIKE') return clampP(1 / (1 + Math.exp(-(policyPressure(s.world) - HIKE_AT) / 1.5)));
  const level = subjectLevel(s, f);
  const coin = f.kind === 'COIN_ABOVE';
  const t = coin ? Math.max(0, Math.round((Date.parse(f.resolveDate) - Date.parse(s.date)) / 86_400_000)) : tradingDaysLeft(s.date, f.resolveDate, cfg);
  if (t === 0) return clampP(level > f.threshold ? 1 : 0);
  const sd = (coin ? 0.035 : f.kind === 'GOLD_HIGHER' ? 0.008 : 0.009) * vol * Math.sqrt(t);
  return clampP(phi(Math.log(level / f.threshold) / sd));
}

const fmtLevel = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function makeForecast(s: CareerState, kind: ForecastKind, content: ContentPack, cfg: MarketConfig, r: () => number): Forecast | null {
  const base = { openedDate: s.date, qYes: 0, qNo: 0, b: cfg.prediction.lmsrB, sharePaise: cfg.prediction.sharePayoutPaise, status: 'OPEN' as const, outcome: null, yes: 0, no: 0, costPaise: 0, payoutPaise: 0, history: [] as number[] };
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
  if (kind === 'INDEX_ABOVE') {
    const id = content.breakerIndexId;
    const name = content.indices.find((d) => d.id === id)!.name;
    const level = s.indices[id]!.level;
    const threshold = Math.round((level * (1 + pick([-0.02, 0, 0.03, 0.05]))) / 50) * 50;
    const resolveDate = addTradingDays('IN', s.date, 20, cfg.calendars);
    return { ...base, id: '', kind, subject: id, threshold, closeDate: addDays(resolveDate, -1), resolveDate, question: `Will the ${name} close above ${fmtLevel(threshold)} on ${prettyDate(resolveDate)}?` };
  }
  if (kind === 'RATE_HIKE') {
    let meeting = nextPolicyMeeting(s.date);
    if (Date.parse(meeting) - Date.parse(s.date) < 10 * 86_400_000) meeting = nextPolicyMeeting(meeting);
    return { ...base, id: '', kind, subject: 'POLICY', threshold: s.world.policyRate, closeDate: addDays(meeting, -1), resolveDate: meeting, question: `Will the central bank raise its policy rate at the ${prettyDate(meeting)} meeting?` };
  }
  if (kind === 'GOLD_HIGHER') {
    const id = 'INGOT';
    if (!s.prices[id]) return null;
    const threshold = s.prices[id]!.c;
    const resolveDate = addTradingDays('IN', s.date, 20, cfg.calendars);
    return { ...base, id: '', kind, subject: id, threshold, closeDate: addDays(resolveDate, -1), resolveDate, question: `Will the Ingot Gold ETF be above ${inr(threshold)} on ${prettyDate(resolveDate)}?` };
  }
  const id = 'CSTN';
  if (!s.prices[id]) return null;
  const usd = s.prices[id]!.c / 100;
  const threshold = Math.round((usd * (1 + pick([-0.05, 0, 0.08]))) / 500) * 500 * 100;
  const resolveDate = addDays(s.date, 21);
  return { ...base, id: '', kind, subject: id, threshold, closeDate: addDays(resolveDate, -1), resolveDate, question: `Will Coinstone trade above $${fmtLevel(threshold / 100)} on ${prettyDate(resolveDate)}?` };
}

const KINDS: ForecastKind[] = ['INDEX_ABOVE', 'RATE_HIKE', 'GOLD_HIGHER', 'COIN_ABOVE'];

/** Every calendar day: bots trade, markets close and resolve (paying out), new questions open. */
export function forecastTick(st: CareerState, content: ContentPack, cfg: MarketConfig, events: GameEvent[]): void {
  if (!st.unlockedDesks.includes('PREDICTION')) return;
  for (const f of st.forecasts) {
    if (f.status === 'RESOLVED') continue;
    // Resolution uses today's data, after today's prices are in.
    if (st.date >= f.resolveDate) {
      const yes = f.kind === 'RATE_HIKE' ? (st.world.lastPolicy?.date === f.resolveDate && st.world.lastPolicy.change > 0) : subjectLevel(st, f) > f.threshold;
      f.status = 'RESOLVED';
      f.outcome = yes ? 'YES' : 'NO';
      const won = yes ? f.yes : f.no;
      const payout = won * f.sharePaise;
      if (payout) credit(st.treasury, payout, 'payout', { date: st.date, desk: 'PREDICTION', ref: f.id, memo: `Forecast paid: ${won} ${f.outcome} shares` });
      if (f.yes || f.no) events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'PREDICTION', message: `“${f.question}” resolved ${f.outcome}. ${payout ? `You were paid ${inr(payout)} in coins.` : 'Your shares expired worthless.'}` });
      f.payoutPaise = payout;
      f.yes = 0;
      f.no = 0;
      f.history.push(yes ? 1 : 0);
      continue;
    }
    if (f.status === 'OPEN' && st.date > f.closeDate) f.status = 'CLOSED';
    if (f.status !== 'OPEN') continue;
    // Bots: informed traders pull the odds toward fair value, herders chase the last move, noise traders jiggle.
    const r = stream(st.seed, 'forecast.bots', `${f.id}|${st.date}`);
    const b = f.b;
    const p = priceYes(f);
    const fair = clampP(fairProbability(st, f, cfg) + 0.05 * r.normal());
    const last = f.history.length >= 2 ? logit(clampP(f.history.at(-1)!)) - logit(clampP(f.history.at(-2)!)) : 0;
    const target = logit(p) + 0.35 * (logit(fair) - logit(p)) + 0.2 * last + 0.12 * r.normal();
    const diff = b * logit(clampP(1 / (1 + Math.exp(-target))));
    // Bots trade one side only; the player's own shares stay in q, so move qYes to reach the target gap.
    f.qYes = f.qNo + diff;
    f.history = [...f.history, Math.round(priceYes(f) * 1000) / 1000].slice(-60);
  }

  // Keep resolved questions you traded for a while, and the latest few others.
  const resolved = st.forecasts.filter((f) => f.status === 'RESOLVED');
  st.forecasts = [...st.forecasts.filter((f) => f.status !== 'RESOLVED'), ...resolved.slice(-6)];

  // Top up to `openMarkets` live questions, rotating kinds.
  let live = st.forecasts.filter((f) => f.status !== 'RESOLVED').length;
  let guard = 0;
  while (live < cfg.prediction.openMarkets && guard++ < 8) {
    const r = stream(st.seed, 'forecast.bots', `new|${st.seq}|${st.date}`);
    const kind = KINDS[st.seq % KINDS.length]!;
    st.seq += 1;
    if (st.forecasts.some((f) => f.kind === kind && f.status !== 'RESOLVED')) continue;
    const f = makeForecast(st, kind, content, cfg, () => r.next());
    if (!f) continue;
    f.id = nextId(st, 'Q');
    const p0 = clampP(fairProbability(st, f, cfg) + 0.06 * r.normal());
    f.qYes = f.b * logit(p0);
    f.history = [Math.round(p0 * 1000) / 1000];
    st.forecasts.push(f);
    live++;
  }
}
