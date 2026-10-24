// Crypto custody (market-engine.md §9). Coins bought sit on the exchange (Vaultex): instant to trade,
// but exposed if the exchange fails. Self-custody is safe from that, but moving coins back to sell costs
// a network fee and takes a day.
import { addDays } from '../calendar';
import type { MarketConfig } from '../config';
import { GameError } from '../errors';
import { inr } from '../money';
import { credit, spend } from '../treasury';
import type { CareerState, ContentPack, CryptoTransfer, GameEvent } from '../types';
import { addUnits, assertDesk, instrumentOf, nextId, positionKey, positionValue, removeUnits } from './common';

export interface CustodyInput {
  instrumentId: string;
  to: 'SELF' | 'EXCHANGE';
  qty: number;
}

const frozenKey = (id: string): string => `${id}@FROZEN`;

export function moveCustody(s: CareerState, input: CustodyInput, content: ContentPack, cfg: MarketConfig): { state: CareerState; transfer: CryptoTransfer | null } {
  const inst = instrumentOf(content, input.instrumentId, ['CRYPTO']);
  assertDesk(s, 'CRYPTO');
  const { qty, to } = input;
  if (!Number.isSafeInteger(qty) || qty < 1) throw new GameError('VALIDATION', 'Enter a quantity greater than zero.');
  const from = positionKey(inst.id, to === 'SELF' ? 'EXCHANGE' : 'SELF');
  const held = s.positions[from]?.qty ?? 0;
  if (qty > held) throw new GameError('INSUFFICIENT_QTY', to === 'SELF' ? `You have no ${inst.symbol} on the exchange to move.` : `You have no ${inst.symbol} in your own wallet to move.`);
  const fee = cfg.fees.cryptoSelfCustodyTransferPaise;
  if (fee > s.treasury.available) throw new GameError('INSUFFICIENT_FUNDS', `Moving coins costs a ${inr(fee)} network fee, and you have ${inr(s.treasury.available)} available.`);

  const st = structuredClone(s);
  const id = nextId(st, 'X');
  spend(st.treasury, fee, 'fee', { date: st.date, desk: 'CRYPTO', ref: id, memo: `Network fee: move ${inst.symbol} to ${to === 'SELF' ? 'your own wallet' : 'the exchange'}` });
  const { basis, basisQuote, basisFees } = removeUnits(st, from, qty);
  if (to === 'SELF') {
    addUnits(st, inst, qty, basis, { costQuote: basisQuote, feesPaise: basisFees, custody: 'SELF' });
    return { state: st, transfer: null };
  }
  const transfer: CryptoTransfer = { id, instrumentId: inst.id, qty, costBasisPaise: basis, costQuote: basisQuote, arriveDate: addDays(st.date, cfg.fees.cryptoSelfCustodyTransferDays) };
  st.transfers.push(transfer);
  return { state: st, transfer };
}

/** Daily: transfers arrive; an exchange failure freezes coins on it; a resolution pays the recovery. */
export function cryptoTick(st: CareerState, prevStatus: CareerState['world']['exchange']['status'], content: ContentPack, events: GameEvent[]): void {
  for (const t of st.transfers.filter((x) => x.arriveDate <= st.date)) {
    const inst = content.instruments.find((i) => i.id === t.instrumentId)!;
    addUnits(st, inst, t.qty, t.costBasisPaise, { costQuote: t.costQuote, custody: 'EXCHANGE' });
    events.push({ kind: 'NOTICE', date: st.date, level: 'INFO', desk: 'CRYPTO', message: `Your ${inst.symbol} arrived on the exchange and can be sold.` });
  }
  st.transfers = st.transfers.filter((x) => x.arriveDate > st.date);

  const ex = st.world.exchange;
  if (prevStatus === 'OK' && ex.status === 'FROZEN') {
    let frozen = 0;
    for (const [key, p] of Object.entries(st.positions)) {
      const inst = content.instruments.find((i) => i.id === p.instrumentId);
      if (inst?.desk !== 'CRYPTO' || p.custody !== 'EXCHANGE' || p.frozenValuePaise !== undefined) continue;
      const value = positionValue(st, p);
      frozen += value;
      delete st.positions[key];
      st.positions[frozenKey(p.instrumentId)] = { ...p, frozenValuePaise: value };
    }
    if (frozen) events.push({ kind: 'NOTICE', date: st.date, level: 'CRITICAL', desk: 'CRYPTO', message: `${inr(frozen)} of your coins are frozen on Vaultex. Coins in your own wallet are safe.` });
  }
  if (prevStatus === 'FROZEN' && ex.status === 'RESOLVED') {
    let paid = 0;
    for (const [key, p] of Object.entries(st.positions)) {
      if (p.frozenValuePaise === undefined) continue;
      const amount = Math.round(p.frozenValuePaise * ex.recoveryPct!);
      credit(st.treasury, amount, 'recovery', { date: st.date, desk: 'CRYPTO', ref: key, memo: `Vaultex recovery for ${p.instrumentId}` });
      paid += amount;
      delete st.positions[key];
    }
    if (paid) events.push({ kind: 'NOTICE', date: st.date, level: 'WARNING', desk: 'CRYPTO', message: `Vaultex paid you ${inr(paid)} for your frozen coins.` });
  }
}
