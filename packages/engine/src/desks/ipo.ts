// IPO desk (prd.md §6.2, market-engine.md §5.2). Fictional companies come to market one by one:
// announce → bid for 3 trading days (money blocked) → retail lottery on allotment day → listing.
// After listing, the shares trade on the stock order engine like any other stock.
import { addDays, addTradingDays, prettyDate } from '../calendar';
import type { MarketConfig } from '../config';
import { GameError } from '../errors';
import { inr } from '../money';
import { stream } from '../rng';
import { capture, release, reserve } from '../treasury';
import type { CareerState, ContentPack, GameEvent, IpoState, Regime } from '../types';
import { addUnits, assertDesk, nextId } from './common';

/** Retail subscription a typical IPO reaches by the last day, per regime. */
const BASE_SUBSCRIPTION: Record<Regime, number> = { EUPHORIA: 40, CALM: 8, RECOVERY: 5, STRESSED: 1.5, CRISIS: 0.6 };
/** Share of the final subscription that arrives on each bidding day (the last-day rush). */
const DAY_SHARE = [0.15, 0.25, 0.6];

export const ipoCost = (ipo: IpoState, lots: number): number => ipo.bandHiPaise * ipo.lotSize * lots;
export const maxRetailLots = (ipo: IpoState, cfg: MarketConfig): number => Math.max(1, Math.floor(cfg.ipo.retailMaxPaise / (ipo.bandHiPaise * ipo.lotSize)));

export function applyIpo(s: CareerState, input: { ipoId: string; lots: number }, cfg: MarketConfig): { state: CareerState; ipo: IpoState } {
  assertDesk(s, 'IPO');
  const ipo = s.ipos[input.ipoId];
  if (!ipo) throw new GameError('NOT_FOUND', 'Unknown IPO.');
  if (ipo.status !== 'OPEN') throw new GameError('VALIDATION', ipo.status === 'UPCOMING' ? `Bidding opens on ${prettyDate(ipo.openDate)}.` : 'Bidding for this IPO has closed.');
  const max = maxRetailLots(ipo, cfg);
  if (!Number.isInteger(input.lots) || input.lots < 1 || input.lots > max) throw new GameError('VALIDATION', `Apply for 1 to ${max} lots (retail investors can bid up to ${inr(cfg.ipo.retailMaxPaise)}).`);
  const st = structuredClone(s);
  const it = st.ipos[ipo.id]!;
  const prior = it.application;
  if (prior) release(st.treasury, { date: st.date, desk: 'IPO', ref: prior.ref, memo: `Changed IPO bid (${ipo.id})` });
  const need = ipoCost(it, input.lots);
  if (need > st.treasury.available) throw new GameError('INSUFFICIENT_FUNDS', `This bid blocks ${inr(need)}; you have ${inr(st.treasury.available)} available.`);
  const ref = nextId(st, 'P');
  reserve(st.treasury, need, { date: st.date, desk: 'IPO', ref, memo: `IPO bid: ${input.lots} lot${input.lots > 1 ? 's' : ''} of ${ipo.id}` });
  it.application = { ref, lots: input.lots, reservedPaise: need };
  return { state: st, ipo: it };
}

export function withdrawIpo(s: CareerState, ipoId: string): { state: CareerState; ipo: IpoState } {
  assertDesk(s, 'IPO');
  const ipo = s.ipos[ipoId];
  if (!ipo?.application || ipo.status !== 'OPEN') throw new GameError('NOT_FOUND', 'No open bid to withdraw.');
  const st = structuredClone(s);
  const it = st.ipos[ipoId]!;
  release(st.treasury, { date: st.date, desk: 'IPO', ref: it.application!.ref, memo: `IPO bid withdrawn (${ipoId})` });
  it.application = null;
  return { state: st, ipo: it };
}

/** Every calendar day: announce, open, update subscription, close, allot and mark listings. */
export function ipoTick(st: CareerState, inOpen: boolean, listings: Record<string, number>, content: ContentPack, cfg: MarketConfig, events: GameEvent[]): void {
  const cal = cfg.calendars;
  const q = st.ipoQueue;
  // Story keeps the IPO desk shut until its chapter: the pipeline waits rather than running past the player.
  if (!st.unlockedDesks.includes('IPO')) return;
  while (q.next < content.ipos.length && st.ipos[content.ipos[q.next]!.instrumentId]) q.next += 1; // never re-announce a company
  if (st.date >= q.announceDate && q.next < content.ipos.length) {
    if (st.world.regime === 'CRISIS') q.announceDate = addDays(st.date, 7); // nobody lists into a crash
    else {
      const def = content.ipos[q.next]!;
      const inst = content.instruments.find((i) => i.id === def.instrumentId)!;
      const openDate = addTradingDays('IN', st.date, cfg.ipo.leadDays, cal);
      const closeDate = addTradingDays('IN', openDate, cfg.ipo.bidDays - 1, cal);
      const allotDate = addTradingDays('IN', closeDate, 1, cal);
      const lo = Math.round((def.bandHiPaise * 0.95) / 100) * 100;
      st.ipos[def.instrumentId] = {
        id: def.instrumentId,
        status: 'UPCOMING',
        announceDate: st.date,
        openDate,
        closeDate,
        allotDate,
        listDate: addTradingDays('IN', allotDate, 2, cal),
        bandLoPaise: lo,
        bandHiPaise: def.bandHiPaise,
        lotSize: def.lotSize,
        subscription: 0,
        application: null,
        allottedLots: null,
        listingOpenPaise: null,
      };
      events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'IPO', message: `New IPO: ${inst.name}. Price band ${inr(lo)}–${inr(def.bandHiPaise)}, lot of ${def.lotSize} shares. Bidding opens ${prettyDate(openDate)}.` });
      const r = stream(st.seed, 'world.ipo', `gap|${q.next}`);
      q.next += 1;
      q.announceDate = addDays(st.date, cfg.ipo.gapDaysMin + Math.floor(r.next() * (cfg.ipo.gapDaysMax - cfg.ipo.gapDaysMin + 1)));
    }
  }

  for (const ipo of Object.values(st.ipos)) {
    const def = content.ipos.find((d) => d.instrumentId === ipo.id);
    const inst = content.instruments.find((i) => i.id === ipo.id)!;
    if (ipo.status === 'UPCOMING' && st.date >= ipo.openDate) {
      ipo.status = 'OPEN';
      events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'IPO', message: `${inst.name} IPO is open for bids until ${prettyDate(ipo.closeDate)}.` });
    }
    if (ipo.status === 'OPEN' && inOpen) {
      let day = 0;
      for (let d = ipo.openDate; d < st.date; d = addTradingDays('IN', d, 1, cal)) day++;
      const noise = Math.exp(0.6 * stream(st.seed, 'world.ipo', `${ipo.id}|target`).normal());
      const target = BASE_SUBSCRIPTION[st.world.regime] * (def?.hype ?? 1) * noise;
      ipo.subscription = Math.round((ipo.subscription + target * (DAY_SHARE[Math.min(day, DAY_SHARE.length - 1)] ?? 0.3)) * 100) / 100;
      if (st.date >= ipo.closeDate) {
        ipo.status = 'CLOSED';
        events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'IPO', message: `${inst.name} IPO closed. Retail investors bid for ${ipo.subscription.toFixed(1)}× the shares on offer.` });
      }
    }
    if (ipo.status === 'CLOSED' && ipo.allottedLots === null && st.date >= ipo.allotDate) {
      const app = ipo.application;
      if (!app) ipo.allottedLots = 0;
      else {
        // Oversubscribed: SEBI-style retail lottery, at most one lot each. Undersubscribed: everyone gets all they bid for.
        const u = stream(st.seed, 'world.ipo', `${ipo.id}|lottery`).next();
        const lots = ipo.subscription <= 1 ? app.lots : u < 1 / ipo.subscription ? 1 : 0;
        const c = { date: st.date, desk: 'IPO' as const, ref: app.ref };
        if (lots) {
          const cost = ipoCost(ipo, lots);
          capture(st.treasury, cost, 'buy', { ...c, memo: `IPO allotment: ${lots * ipo.lotSize} ${ipo.id} @ ${inr(ipo.bandHiPaise)}` });
          addUnits(st, inst, lots * ipo.lotSize, cost);
          const p = ipo.bandHiPaise;
          st.prices[ipo.id] = { date: st.date, o: p, h: p, l: p, c: p, v: 0, prevClose: p, circuit: null };
        }
        if (st.treasury.reservations[app.ref]) release(st.treasury, { ...c, memo: `IPO refund (${ipo.id})` });
        ipo.allottedLots = lots;
        events.push({
          kind: 'NOTICE',
          date: st.date,
          level: lots ? 'WATCH' : 'INFO',
          desk: 'IPO',
          message: lots ? `You were allotted ${lots * ipo.lotSize} shares of ${inst.name}. They list on ${prettyDate(ipo.listDate)}.` : `No allotment in the ${inst.name} lottery this time. Your blocked money is back in Available.`,
        });
      }
    }
    if (ipo.status === 'CLOSED' && listings[ipo.id] !== undefined) {
      ipo.status = 'LISTED';
      ipo.listingOpenPaise = listings[ipo.id]!;
      const gain = ipo.listingOpenPaise / ipo.bandHiPaise - 1;
      events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'IPO', message: `${inst.name} listed at ${inr(ipo.listingOpenPaise)}, ${gain >= 0 ? 'up' : 'down'} ${Math.abs(gain * 100).toFixed(1)}% on its issue price. It now trades like any stock.` });
    }
  }
}
