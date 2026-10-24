// Central Treasury (market-engine.md §7). One per career; every desk moves money only
// through these operations. Double-entry: each entry moves an amount between two accounts,
// so replaying the ledger always reproduces the bucket balances.
import { InvariantError } from './errors';
import type { Account, Desk, EntryType, ISODate, Treasury } from './types';

export const newTreasury = (): Treasury => ({ available: 0, blocked: 0, unsettled: 0, reservations: {}, unsettledItems: [], ledger: [] });

export interface EntryCtx {
  date: ISODate;
  desk: Desk | null;
  ref: string | null;
  memo: string;
}
type RefCtx = EntryCtx & { ref: string };

function post(t: Treasury, from: Account, to: Account, amount: number, type: EntryType, c: EntryCtx): void {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new InvariantError(`invalid amount ${amount}`);
  if (amount === 0) return;
  if (from !== 'external') {
    if (t[from] < amount) throw new InvariantError(`${from} would go negative`);
    t[from] -= amount;
  }
  if (to !== 'external') t[to] += amount;
  t.ledger.push({ id: t.ledger.length + 1, date: c.date, from, to, amountPaise: amount, type, desk: c.desk, ref: c.ref, memo: c.memo });
}

function takeReservation(t: Treasury, ref: string, amount: number): void {
  const have = t.reservations[ref] ?? 0;
  if (amount > have) throw new InvariantError(`reservation ${ref} is ${have}, cannot take ${amount}`);
  if (have === amount) delete t.reservations[ref];
  else t.reservations[ref] = have - amount;
}

/** in → available (starting grant, rewards). */
export const grant = (t: Treasury, amount: number, c: EntryCtx): void => post(t, 'external', 'available', amount, 'grant', c);

/** available → blocked (order placed, IPO applied). */
export function reserve(t: Treasury, amount: number, c: RefCtx): void {
  post(t, 'available', 'blocked', amount, 'reserve', c);
  if (amount > 0) t.reservations[c.ref] = (t.reservations[c.ref] ?? 0) + amount;
}

/** blocked → available (order cancelled, unused reserve). Defaults to the whole reservation. */
export function release(t: Treasury, c: RefCtx, amount = t.reservations[c.ref] ?? 0): void {
  takeReservation(t, c.ref, amount);
  post(t, 'blocked', 'available', amount, 'release', c);
}

/** available → out: instant purchases, fees, FD bookings, forecast shares. */
export const spend = (t: Treasury, amount: number, type: 'buy' | 'charge' | 'fee', c: EntryCtx): void => post(t, 'available', 'external', amount, type, c);

/** in → available: instant sale proceeds, interest, maturities, forecast payouts, exchange recoveries. */
export const credit = (t: Treasury, amount: number, type: 'sell' | 'interest' | 'maturity' | 'payout' | 'recovery', c: EntryCtx): void =>
  post(t, 'external', 'available', amount, type, c);

/** blocked → spent (order filled). */
export function capture(t: Treasury, amount: number, type: 'buy' | 'charge', c: RefCtx): void {
  takeReservation(t, c.ref, amount);
  post(t, 'blocked', 'external', amount, type, c);
}

/** Sale proceeds → unsettled, arriving on `settleDate`. */
export function creditUnsettled(t: Treasury, amount: number, settleDate: ISODate, c: RefCtx & { desk: Desk }): void {
  post(t, 'external', 'unsettled', amount, 'sell', c);
  t.unsettledItems.push({ ref: c.ref, desk: c.desk, amountPaise: amount, settleDate, memo: c.memo });
}

/** Charges deducted from not-yet-settled proceeds. */
export function chargeUnsettled(t: Treasury, amount: number, c: RefCtx): void {
  const item = t.unsettledItems.find((i) => i.ref === c.ref);
  if (!item || item.amountPaise < amount) throw new InvariantError(`unsettled item ${c.ref} cannot cover ${amount}`);
  item.amountPaise -= amount;
  post(t, 'unsettled', 'external', amount, 'charge', c);
}

/** unsettled → available for every item due on or before `date`. Runs on each clock tick. */
export function settleDue(t: Treasury, date: ISODate): void {
  const due = t.unsettledItems.filter((i) => i.settleDate <= date);
  t.unsettledItems = t.unsettledItems.filter((i) => i.settleDate > date);
  for (const i of due) post(t, 'unsettled', 'available', i.amountPaise, 'settle', { date, desk: i.desk, ref: i.ref, memo: `Settled: ${i.memo}` });
}
