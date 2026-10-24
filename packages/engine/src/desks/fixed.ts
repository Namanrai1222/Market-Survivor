// Fixed deposits (market-engine.md §5.2): the rate is locked at booking (policy rate + tenor spread),
// interest compounds quarterly and is paid at maturity. Breaking early pays the rate minus a penalty.
// Government bonds trade on the instant desk (desks/instant.ts) and price through duration.
import { addDays, prettyDate } from '../calendar';
import type { MarketConfig } from '../config';
import { GameError } from '../errors';
import { inr } from '../money';
import { credit, spend } from '../treasury';
import type { CareerState, FixedDeposit, GameEvent, ISODate } from '../types';
import { assertDesk, nextId } from './common';

const daysBetween = (a: ISODate, b: ISODate): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Principal + interest at `ratePct` after `days`: quarterly compounding, simple within the quarter. */
export function fdGrowth(principal: number, ratePct: number, days: number): number {
  const r = ratePct / 100;
  const quarters = Math.floor(days / 91);
  const rem = days - quarters * 91;
  return Math.round(principal * (1 + r / 4) ** quarters * (1 + (r * rem) / 365));
}

/** What an active FD is worth today (accrued, not yet paid). */
export const fdValue = (fd: FixedDeposit, date: ISODate): number => (fd.status === 'ACTIVE' ? fdGrowth(fd.principalPaise, fd.ratePct, Math.max(0, daysBetween(fd.startDate, date < fd.maturityDate ? date : fd.maturityDate))) : 0);

export const fdRate = (s: CareerState, tenor: MarketConfig['fixedIncome']['fdTenors'][number]): number => Math.max(1, Math.round((s.world.policyRate + tenor.spreadPct) * 100) / 100);

export function bookFd(s: CareerState, input: { tenorId: string; amountPaise: number }, cfg: MarketConfig): { state: CareerState; fd: FixedDeposit } {
  assertDesk(s, 'FIXED_INCOME');
  const tenor = cfg.fixedIncome.fdTenors.find((t) => t.id === input.tenorId);
  if (!tenor) throw new GameError('VALIDATION', 'Pick a deposit term.');
  const amount = input.amountPaise;
  if (!Number.isSafeInteger(amount) || amount < cfg.fixedIncome.fdMinPaise) throw new GameError('VALIDATION', `The minimum deposit is ${inr(cfg.fixedIncome.fdMinPaise)}.`);
  if (amount > s.treasury.available) throw new GameError('INSUFFICIENT_FUNDS', `Not enough available cash. You have ${inr(s.treasury.available)} available.`);
  if (s.fds.filter((f) => f.status === 'ACTIVE').length >= 20) throw new GameError('VALIDATION', 'You can hold up to 20 deposits at once.');
  const st = structuredClone(s);
  const rate = fdRate(st, tenor);
  const fd: FixedDeposit = { id: nextId(st, 'FD'), principalPaise: amount, ratePct: rate, startDate: st.date, maturityDate: addDays(st.date, tenor.days), status: 'ACTIVE', paidPaise: null, closedDate: null };
  spend(st.treasury, amount, 'buy', { date: st.date, desk: 'FIXED_INCOME', ref: fd.id, memo: `Fixed deposit: ${tenor.label} at ${rate.toFixed(2)}%` });
  st.fds.push(fd);
  return { state: st, fd };
}

function payOut(st: CareerState, fd: FixedDeposit, total: number, how: string): void {
  const c = { date: st.date, desk: 'FIXED_INCOME' as const, ref: fd.id };
  const principal = Math.min(total, fd.principalPaise);
  credit(st.treasury, principal, 'maturity', { ...c, memo: `${how}: deposit returned` });
  credit(st.treasury, total - principal, 'interest', { ...c, memo: `${how}: interest` });
  fd.paidPaise = total;
  fd.closedDate = st.date;
}

export function breakFd(s: CareerState, fdId: string, cfg: MarketConfig): { state: CareerState; fd: FixedDeposit } {
  assertDesk(s, 'FIXED_INCOME');
  if (!s.fds.some((f) => f.id === fdId && f.status === 'ACTIVE')) throw new GameError('NOT_FOUND', 'Deposit not found or already closed.');
  const st = structuredClone(s);
  const fd = st.fds.find((f) => f.id === fdId)!;
  // Early withdrawal: interest at the booked rate minus the penalty, for the time actually held.
  const total = fdGrowth(fd.principalPaise, Math.max(0, fd.ratePct - cfg.fees.fdEarlyBreakPenaltyPct), daysBetween(fd.startDate, st.date));
  fd.status = 'BROKEN';
  payOut(st, fd, total, 'Deposit broken early');
  return { state: st, fd };
}

/** Every calendar day: pay out deposits that reached maturity. */
export function matureFds(st: CareerState, events: GameEvent[]): void {
  for (const fd of st.fds) {
    if (fd.status !== 'ACTIVE' || fd.maturityDate > st.date) continue;
    const total = fdGrowth(fd.principalPaise, fd.ratePct, daysBetween(fd.startDate, fd.maturityDate));
    fd.status = 'MATURED';
    payOut(st, fd, total, 'Deposit matured');
    events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'FIXED_INCOME', message: `Your fixed deposit from ${prettyDate(fd.startDate)} matured: ${inr(total)} is back in Available.` });
  }
  const closed = st.fds.filter((f) => f.status !== 'ACTIVE');
  st.fds = [...st.fds.filter((f) => f.status === 'ACTIVE'), ...closed.slice(-20)];
}
