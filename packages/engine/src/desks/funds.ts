// Funds & SIP desk (market-engine.md §5.2, §7.3). Orders fill at the NEXT trading day's NAV, never
// today's. Redemptions within the exit-load period pay a load; proceeds arrive after `redemptionDays`.
// SIPs place a buy on their day each month and skip (with a warning) when cash is short.
import { addDays, addTradingDays, prettyDate } from '../calendar';
import type { MarketConfig } from '../config';
import { GameError } from '../errors';
import { applyRate, inr, pctToE7 } from '../money';
import { capture, chargeUnsettled, creditUnsettled, release, reserve } from '../treasury';
import type { Bar, CareerState, ContentPack, FundOrder, GameEvent, Sip } from '../types';
import { addUnits, assertDesk, instrumentOf, nextId, removeUnits, scaleOf, valuePaise } from './common';

export interface FundOrderInput {
  fundId: string;
  side: 'BUY' | 'SELL';
  amountPaise?: number;
  units?: number;
}

/** Units held minus units already in pending redemptions. */
export function redeemableUnits(s: CareerState, fundId: string): number {
  const held = s.positions[fundId]?.qty ?? 0;
  return held - s.fundOrders.filter((o) => o.status === 'PENDING' && o.side === 'SELL' && o.fundId === fundId).reduce((a, o) => a + o.units, 0);
}

function newBuy(st: CareerState, fundId: string, amountPaise: number, sipId: string | null, memo: string): FundOrder {
  const id = nextId(st, 'M');
  reserve(st.treasury, amountPaise, { date: st.date, desk: 'FUNDS', ref: id, memo });
  const order: FundOrder = { id, fundId, side: 'BUY', amountPaise, units: 0, placedDate: st.date, sipId, status: 'PENDING', navPaise: null, doneDate: null, exitLoadPaise: 0 };
  st.fundOrders.push(order);
  return order;
}

export function placeFundOrder(s: CareerState, input: FundOrderInput, content: ContentPack, cfg: MarketConfig): { state: CareerState; order: FundOrder } {
  const fund = instrumentOf(content, input.fundId, ['FUNDS']);
  assertDesk(s, 'FUNDS');
  const st = structuredClone(s);
  if (input.side === 'BUY') {
    const amount = input.amountPaise ?? 0;
    if (!Number.isSafeInteger(amount) || amount < cfg.sip.minPaise) throw new GameError('VALIDATION', `The minimum investment is ${inr(cfg.sip.minPaise)}.`);
    if (amount > st.treasury.available) throw new GameError('INSUFFICIENT_FUNDS', `Not enough available cash. You have ${inr(st.treasury.available)} available.`);
    return { state: st, order: newBuy(st, fund.id, amount, null, `Invest in ${fund.name}`) };
  }
  const units = input.units ?? 0;
  if (!Number.isSafeInteger(units) || units < 1) throw new GameError('VALIDATION', 'Enter how many units to redeem.');
  if (units > redeemableUnits(st, fund.id)) throw new GameError('INSUFFICIENT_QTY', `You can redeem up to ${(redeemableUnits(st, fund.id) / scaleOf(fund)).toFixed(3)} units.`);
  const order: FundOrder = { id: nextId(st, 'M'), fundId: fund.id, side: 'SELL', amountPaise: 0, units, placedDate: st.date, sipId: null, status: 'PENDING', navPaise: null, doneDate: null, exitLoadPaise: 0 };
  st.fundOrders.push(order);
  return { state: st, order };
}

export function cancelFundOrder(s: CareerState, orderId: string): { state: CareerState; order: FundOrder } {
  if (!s.fundOrders.some((o) => o.id === orderId && o.status === 'PENDING')) throw new GameError('NOT_FOUND', 'Order not found or already done.');
  const st = structuredClone(s);
  const o = st.fundOrders.find((x) => x.id === orderId)!;
  if (st.treasury.reservations[o.id]) release(st.treasury, { date: st.date, desk: 'FUNDS', ref: o.id, memo: 'Fund order cancelled' });
  o.status = 'CANCELLED';
  o.doneDate = st.date;
  return { state: st, order: o };
}

export interface SipInput {
  fundId: string;
  amountPaise: number;
  dayOfMonth: number;
  stepUpPct: number;
}

/** First date after `from` falling on `day` of a month (days 1–28 exist in every month). */
function nextMonthDay(from: string, day: number): string {
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const d = Number(from.slice(8, 10));
  if (d >= day) m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function createSip(s: CareerState, input: SipInput, content: ContentPack, cfg: MarketConfig): { state: CareerState; sip: Sip } {
  const fund = instrumentOf(content, input.fundId, ['FUNDS']);
  assertDesk(s, 'FUNDS');
  const { amountPaise, dayOfMonth, stepUpPct } = input;
  if (!Number.isSafeInteger(amountPaise) || amountPaise < cfg.sip.minPaise) throw new GameError('VALIDATION', `The minimum SIP is ${inr(cfg.sip.minPaise)} a month.`);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) throw new GameError('VALIDATION', 'Pick a day from 1 to 28.');
  if (!(stepUpPct >= 0 && stepUpPct <= 25)) throw new GameError('VALIDATION', 'Step-up must be between 0% and 25% a year.');
  if (s.sips.filter((x) => x.active).length >= cfg.sip.maxActive) throw new GameError('VALIDATION', `You can run up to ${cfg.sip.maxActive} SIPs at once.`);
  const st = structuredClone(s);
  const sip: Sip = { id: nextId(st, 'S'), fundId: fund.id, amountPaise, stepUpPct, dayOfMonth, nextDate: nextMonthDay(st.date, dayOfMonth), installments: 0, skipped: 0, active: true };
  st.sips.push(sip);
  return { state: st, sip };
}

export function cancelSip(s: CareerState, sipId: string): { state: CareerState; sip: Sip } {
  if (!s.sips.some((x) => x.id === sipId && x.active)) throw new GameError('NOT_FOUND', 'SIP not found or already stopped.');
  const st = structuredClone(s);
  const sip = st.sips.find((x) => x.id === sipId)!;
  sip.active = false;
  return { state: st, sip };
}

/** India trading day: execute pending fund orders placed before today at today's NAV. */
export function processFundOrders(st: CareerState, bars: Record<string, Bar>, content: ContentPack, cfg: MarketConfig): void {
  for (const o of st.fundOrders) {
    if (o.status !== 'PENDING' || o.placedDate >= st.date) continue;
    const bar = bars[o.fundId];
    if (!bar) continue;
    const fund = content.instruments.find((i) => i.id === o.fundId)!;
    const scale = scaleOf(fund);
    const nav = bar.c;
    const c = { date: st.date, desk: 'FUNDS' as const, ref: o.id };
    if (o.side === 'BUY') {
      const units = Math.floor((o.amountPaise * scale) / nav);
      const cost = Math.min(o.amountPaise, valuePaise(units, scale, nav, 'INR', 1));
      if (units < 1) {
        release(st.treasury, { ...c, memo: 'Too small to buy one unit' });
        o.status = 'CANCELLED';
      } else {
        capture(st.treasury, cost, 'buy', { ...c, memo: `Bought ${(units / scale).toFixed(3)} units of ${fund.symbol} @ ${inr(nav)}` });
        if (st.treasury.reservations[o.id]) release(st.treasury, { ...c, memo: `Rounding returned (${fund.symbol})` });
        addUnits(st, fund, units, cost, { lotDate: st.date });
        o.units = units;
        o.status = 'DONE';
      }
    } else {
      const pos = st.positions[o.fundId];
      const units = Math.min(o.units, pos?.qty ?? 0);
      if (!pos || units < 1) {
        o.status = 'CANCELLED';
        o.doneDate = st.date;
        continue;
      }
      // Exit load: on units bought within the load period (FIFO lots, oldest first).
      let loadUnits = 0;
      let left = units;
      const cutoff = addDays(st.date, -(fund.exitLoadDays ?? 0));
      for (const lot of pos.lots ?? []) {
        if (left <= 0) break;
        const take = Math.min(left, lot.qty);
        if (lot.date > cutoff) loadUnits += take;
        left -= take;
      }
      const gross = valuePaise(units, scale, nav, 'INR', 1);
      const load = fund.exitLoadPct ? applyRate(valuePaise(loadUnits, scale, nav, 'INR', 1), pctToE7(fund.exitLoadPct)) : 0;
      removeUnits(st, o.fundId, units);
      const settle = addTradingDays('IN', st.date, cfg.funds.redemptionDays, cfg.calendars);
      creditUnsettled(st.treasury, gross, settle, { ...c, memo: `Redeemed ${(units / scale).toFixed(3)} units of ${fund.symbol} @ ${inr(nav)}` });
      if (load) chargeUnsettled(st.treasury, load, { ...c, memo: `Exit load on ${fund.symbol}` });
      o.units = units;
      o.exitLoadPaise = load;
      o.status = 'DONE';
    }
    o.navPaise = nav;
    o.doneDate = st.date;
  }
  // Keep pending orders and the 40 most recent finished ones.
  const done = st.fundOrders.filter((o) => o.status !== 'PENDING');
  st.fundOrders = [...done.slice(-40), ...st.fundOrders.filter((o) => o.status === 'PENDING')];
}

/** Every calendar day: SIPs due today place their buy (or skip when cash is short). */
export function runSips(st: CareerState, content: ContentPack, events: GameEvent[]): void {
  for (const sip of st.sips) {
    if (!sip.active || sip.nextDate > st.date) continue;
    const fund = content.instruments.find((i) => i.id === sip.fundId)!;
    if (st.treasury.available >= sip.amountPaise) {
      newBuy(st, sip.fundId, sip.amountPaise, sip.id, `SIP into ${fund.name}`);
      sip.installments += 1;
      if (sip.stepUpPct && sip.installments % 12 === 0) sip.amountPaise = Math.round((sip.amountPaise * (100 + sip.stepUpPct)) / 100);
    } else {
      sip.skipped += 1;
      events.push({ kind: 'NOTICE', date: st.date, level: 'WARNING', desk: 'FUNDS', message: `Your ${inr(sip.amountPaise)} SIP into ${fund.name} was skipped: not enough available cash.` });
    }
    sip.nextDate = nextMonthDay(st.date, sip.dayOfMonth);
  }
}

export const sipNextLabel = (sip: Sip): string => prettyDate(sip.nextDate);
