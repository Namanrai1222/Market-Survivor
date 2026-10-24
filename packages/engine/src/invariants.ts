// Treasury and position invariants (market-engine.md §7.4). Checked after every mutation;
// any violation aborts the write. Returns human-readable violations (empty = healthy).
import { BUCKETS, type CareerState } from './types';

export function checkInvariants(s: CareerState): string[] {
  const v: string[] = [];
  const t = s.treasury;

  const fromLedger = { available: 0, blocked: 0, unsettled: 0 };
  for (const e of t.ledger) {
    if (e.from !== 'external') fromLedger[e.from] -= e.amountPaise;
    if (e.to !== 'external') fromLedger[e.to] += e.amountPaise;
  }
  for (const b of BUCKETS) {
    if (!Number.isSafeInteger(t[b]) || t[b] < 0) v.push(`${b} is negative or not whole paise: ${t[b]}`);
    if (fromLedger[b] !== t[b]) v.push(`ledger says ${b} = ${fromLedger[b]}, bucket holds ${t[b]}`);
  }

  const reserved = Object.values(t.reservations).reduce((a, x) => a + x, 0);
  if (reserved !== t.blocked) v.push(`blocked ${t.blocked} != open reservations ${reserved}`);
  // Every reservation belongs to something waiting: a stock buy, a fund buy or an IPO bid.
  const waiting = new Set([
    ...s.orders.filter((o) => o.status === 'OPEN' && o.side === 'BUY').map((o) => o.id),
    ...s.fundOrders.filter((o) => o.status === 'PENDING' && o.side === 'BUY').map((o) => o.id),
    ...Object.values(s.ipos).flatMap((i) => (i.application && i.allottedLots === null ? [i.application.ref] : [])),
  ]);
  for (const [ref, amt] of Object.entries(t.reservations)) {
    if (!(amt > 0)) v.push(`reservation ${ref} is ${amt}`);
    if (!waiting.has(ref)) v.push(`reservation ${ref} has nothing waiting on it`);
  }
  for (const id of waiting) if (!t.reservations[id]) v.push(`${id} is waiting but has no reservation`);
  for (const fd of s.fds) if (!(fd.principalPaise > 0)) v.push(`deposit ${fd.id} principal ${fd.principalPaise}`);
  for (const f of s.forecasts) if (f.yes < 0 || f.no < 0 || !Number.isInteger(f.yes) || !Number.isInteger(f.no)) v.push(`forecast ${f.id} shares ${f.yes}/${f.no}`);

  const owed = t.unsettledItems.reduce((a, i) => a + i.amountPaise, 0);
  if (owed !== t.unsettled) v.push(`unsettled ${t.unsettled} != items ${owed}`);

  for (const p of Object.values(s.positions)) {
    if (!Number.isSafeInteger(p.qty) || p.qty <= 0) v.push(`position ${p.instrumentId} qty ${p.qty}`);
    if (p.lots && p.lots.reduce((a, l) => a + l.qty, 0) !== p.qty) v.push(`position ${p.instrumentId} lots don't add up to its units`);
    if (p.costBasisPaise < 0) v.push(`position ${p.instrumentId} negative cost basis`);
  }
  for (const o of s.orders) if (o.filledQty < 0 || o.filledQty > o.qty) v.push(`order ${o.id} filled ${o.filledQty}/${o.qty}`);
  return v;
}
