// Helpers shared by every desk: lookups, desk gating, position bookkeeping and valuation.
import { GameError, InvariantError } from '../errors';
import type { CareerState, ContentPack, Desk, Instrument, Position } from '../types';

/** Frozen exchange coins count at this share of their frozen value until administrators decide. */
export const FROZEN_ESTIMATE = 0.5;

const DESK_NAMES: Record<Desk, string> = {
  STOCKS: 'Stocks',
  IPO: 'IPO',
  FUNDS: 'Funds & SIP',
  FIXED_INCOME: 'Fixed income',
  COMMODITIES: 'Commodities',
  GLOBAL: 'Global',
  CRYPTO: 'Crypto',
  PREDICTION: 'Forecasts',
};

export function assertDesk(s: CareerState, desk: Desk): void {
  if (s.ended) throw new GameError('ENDED', 'This run has finished.');
  if (!s.unlockedDesks.includes(desk)) throw new GameError('DESK_LOCKED', `The ${DESK_NAMES[desk]} desk is locked.`);
}

export function instrumentOf(content: ContentPack, id: string, desks: Desk[]): Instrument {
  const inst = content.instruments.find((i) => i.id === id && desks.includes(i.desk));
  if (!inst) throw new GameError('NOT_FOUND', 'Unknown instrument.');
  return inst;
}

export const scaleOf = (i: Pick<Instrument, 'unitScale'>): number => i.unitScale ?? 1;

/** INR value (paise) of `qty` units at `price` (paise, or cents for USD instruments). */
export function valuePaise(qty: number, scale: number, price: number, quote: 'INR' | 'USD' | undefined, usdInr: number): number {
  return Math.round((qty / scale) * price * (quote === 'USD' ? usdInr : 1));
}

/** Mark-to-market value of one position (frozen coins at the public recovery estimate). */
export function positionValue(s: CareerState, p: Position): number {
  if (p.frozenValuePaise !== undefined) return Math.round(p.frozenValuePaise * FROZEN_ESTIMATE);
  const bar = s.prices[p.instrumentId];
  if (!bar) return 0;
  return valuePaise(p.qty, p.unitScale ?? 1, bar.c, p.quote, s.world.usdInr);
}

export const positionKey = (instrumentId: string, custody?: 'EXCHANGE' | 'SELF'): string => (custody === 'SELF' ? `${instrumentId}@SELF` : instrumentId);

/** Add units to a position (creating it), with their cost in paise and (USD) cents. */
export function addUnits(st: CareerState, inst: Instrument, qty: number, costPaise: number, opts: { costQuote?: number; feesPaise?: number; custody?: 'EXCHANGE' | 'SELF'; lotDate?: string } = {}): Position {
  const key = positionKey(inst.id, opts.custody);
  const pos = (st.positions[key] ??= {
    instrumentId: inst.id,
    qty: 0,
    costBasisPaise: 0,
    ...(inst.unitScale && inst.unitScale !== 1 ? { unitScale: inst.unitScale } : {}),
    ...(inst.quote === 'USD' ? { quote: 'USD' as const, costQuote: 0, feesPaise: 0 } : {}),
    ...(opts.custody ? { custody: opts.custody } : {}),
  });
  pos.qty += qty;
  pos.costBasisPaise += costPaise;
  if (pos.costQuote !== undefined) pos.costQuote += opts.costQuote ?? 0;
  if (pos.feesPaise !== undefined) pos.feesPaise += opts.feesPaise ?? 0;
  if (opts.lotDate) (pos.lots ??= []).push({ date: opts.lotDate, qty });
  return pos;
}

/** Remove units (FIFO lots); returns the cost basis (paise) and cost in cents that left with them. */
export function removeUnits(st: CareerState, key: string, qty: number): { basis: number; basisQuote: number; basisFees: number } {
  const pos = st.positions[key];
  if (!pos || pos.qty < qty) throw new InvariantError(`remove ${qty} from ${key} exceeds holding`);
  const basis = Math.round((pos.costBasisPaise * qty) / pos.qty);
  const basisQuote = pos.costQuote !== undefined ? (pos.costQuote * qty) / pos.qty : 0;
  const basisFees = pos.feesPaise !== undefined ? Math.round((pos.feesPaise * qty) / pos.qty) : 0;
  pos.qty -= qty;
  pos.costBasisPaise -= basis;
  if (pos.costQuote !== undefined) pos.costQuote -= basisQuote;
  if (pos.feesPaise !== undefined) pos.feesPaise -= basisFees;
  if (pos.lots) {
    let left = qty;
    while (left > 0 && pos.lots.length) {
      const lot = pos.lots[0]!;
      const take = Math.min(left, lot.qty);
      lot.qty -= take;
      left -= take;
      if (lot.qty === 0) pos.lots.shift();
    }
  }
  if (pos.qty === 0) delete st.positions[key];
  return { basis, basisQuote, basisFees };
}

export const nextId = (st: CareerState, prefix: string): string => `${prefix}${++st.seq}`;
