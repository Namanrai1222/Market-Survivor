// Instant-trade desks: commodity ETFs, government bonds, US stocks and crypto (market-engine.md §7.3).
// Trades execute at the last price ± half the spread while that market is open. India and US sale
// proceeds settle T+1; crypto proceeds are available at once.
import { addTradingDays, isOpen, nextOpenDay, prettyDate } from '../calendar';
import type { MarketConfig } from '../config';
import { GameError } from '../errors';
import { applyRate, inr, pctToE7 } from '../money';
import { chargeUnsettled, credit, creditUnsettled, spend } from '../treasury';
import type { CareerState, ContentPack, DeskFill, Instrument, Market, Side } from '../types';
import { addUnits, assertDesk, instrumentOf, nextId, positionKey, removeUnits, scaleOf, valuePaise } from './common';

export const INSTANT_DESKS = ['COMMODITIES', 'FIXED_INCOME', 'GLOBAL', 'CRYPTO'] as const;
export type InstantDesk = (typeof INSTANT_DESKS)[number];

export interface InstantTradeInput {
  instrumentId: string;
  side: Side;
  /** In 1/unitScale units (crypto: millionths of a coin). */
  qty: number;
}

const MARKET_NAME: Record<Market, string> = { IN: 'Indian', US: 'US', CRYPTO: 'crypto' };

/** Why this instrument can't trade right now, or null. Exported for the desk UI. */
export function closedReason(s: CareerState, inst: Instrument, cfg: MarketConfig): string | null {
  if (inst.market === 'CRYPTO') return null;
  if (inst.market === 'IN' && s.world.halt) return 'Indian markets are paused after the circuit breaker. They reopen on the next trading day.';
  if (!isOpen(inst.market, s.date, cfg.calendars)) {
    const next = nextOpenDay(inst.market, s.date, cfg.calendars);
    return `The ${MARKET_NAME[inst.market]} market is closed today. It reopens on ${prettyDate(next)}.`;
  }
  return null;
}

/** Execution price in the quote currency: last close ± half the (regime-scaled) spread. */
export function instantPrice(s: CareerState, inst: Instrument & { desk: InstantDesk }, side: Side, cfg: MarketConfig): number {
  const last = s.prices[inst.id]!.c;
  const bps = cfg.instant.spreadBps[inst.desk] * cfg.instant.spreadMult[s.world.regime];
  const px = last * (1 + ((side === 'BUY' ? 1 : -1) * bps) / 2 / 10_000);
  return inst.quote === 'USD' ? Number(px.toFixed(4)) : Math.max(1, Math.round(px));
}

/** Fee lines for a trade of `valuePaise` (shown before the trade and on the contract note). */
export function instantFees(desk: InstantDesk, side: Side, value: number, cfg: MarketConfig): { label: string; paise: number }[] {
  const c = cfg.instant;
  if (desk === 'GLOBAL') return [{ label: 'Currency conversion', paise: applyRate(value, pctToE7(cfg.fees.fxConversionPct)) }];
  if (desk === 'CRYPTO') {
    const fees = [{ label: 'Exchange fee', paise: applyRate(value, pctToE7(c.cryptoFeePct)) }];
    if (side === 'SELL') fees.push({ label: 'TDS (tax deducted at source)', paise: applyRate(value, pctToE7(c.cryptoTdsPct)) });
    return fees;
  }
  return [
    { label: 'Brokerage', paise: c.brokeragePaise },
    { label: 'GST on brokerage', paise: applyRate(c.brokeragePaise, pctToE7(cfg.charges.gstPct)) },
  ];
}

export function instantTrade(s: CareerState, input: InstantTradeInput, content: ContentPack, cfg: MarketConfig): { state: CareerState; fill: DeskFill } {
  const inst = instrumentOf(content, input.instrumentId, [...INSTANT_DESKS]) as Instrument & { desk: InstantDesk };
  assertDesk(s, inst.desk);
  const { side, qty } = input;
  if (!Number.isSafeInteger(qty) || qty < 1) throw new GameError('VALIDATION', 'Enter a quantity greater than zero.');
  const closed = closedReason(s, inst, cfg);
  if (closed) throw new GameError('MARKET_HALTED', closed);
  if (side === 'BUY' && s.world.rugged.includes(inst.id)) throw new GameError('VALIDATION', `${inst.symbol} is no longer listed for buying after the rug pull. You can still sell what you hold.`);

  const scale = scaleOf(inst);
  const px = instantPrice(s, inst, side, cfg);
  const usdInr = s.world.usdInr;
  const value = valuePaise(qty, scale, px, inst.quote, usdInr);
  if (value < 100) throw new GameError('VALIDATION', 'That trade is worth less than ₹1. Increase the quantity.');
  if (value > cfg.instant.maxOrderValuePaise) throw new GameError('VALIDATION', `One trade can be worth at most ${inr(cfg.instant.maxOrderValuePaise)}.`);
  const fees = instantFees(inst.desk, side, value, cfg);
  const feeTotal = fees.reduce((a, f) => a + f.paise, 0);

  const st = structuredClone(s);
  const id = nextId(st, 'D');
  const label = `${inst.symbol}`;
  const c = { date: st.date, desk: inst.desk, ref: id, memo: '' };
  let fill: DeskFill;
  if (side === 'BUY') {
    const need = value + feeTotal;
    if (need > st.treasury.available)
      throw new GameError('INSUFFICIENT_FUNDS', `Not enough available cash. You have ${inr(st.treasury.available)} available; this trade needs ${inr(need)}.`);
    spend(st.treasury, value, 'buy', { ...c, memo: `Buy ${label}` });
    spend(st.treasury, feeTotal, 'fee', { ...c, memo: `Fees on buy ${label}` });
    addUnits(st, inst, qty, need, { costQuote: inst.quote === 'USD' ? (qty / scale) * px : undefined, feesPaise: feeTotal, custody: inst.desk === 'CRYPTO' ? 'EXCHANGE' : undefined });
    fill = { id, date: st.date, desk: inst.desk, instrumentId: inst.id, side, qty, priceQuote: px, usdInr: inst.quote === 'USD' ? usdInr : null, valuePaise: value, fees, netPaise: need, realizedPaise: null, settleDate: null };
  } else {
    const key = positionKey(inst.id);
    const held = st.positions[key]?.qty ?? 0;
    if (qty > held) throw new GameError('INSUFFICIENT_QTY', held ? `You can sell up to what you hold on the ${inst.desk === 'CRYPTO' ? 'exchange' : 'desk'}.` : `You have no ${inst.symbol} to sell${inst.desk === 'CRYPTO' ? ' on the exchange' : ''}.`);
    const net = Math.max(0, value - feeTotal);
    const { basis } = removeUnits(st, key, qty);
    let settleDate: string | null = null;
    if (inst.desk === 'CRYPTO') {
      credit(st.treasury, value, 'sell', { ...c, memo: `Sell ${label}` });
      spend(st.treasury, Math.min(value, feeTotal), 'fee', { ...c, memo: `Fees and TDS on sell ${label}` });
    } else {
      settleDate = addTradingDays(inst.market, st.date, 1, cfg.calendars);
      creditUnsettled(st.treasury, value, settleDate, { ...c, desk: inst.desk, memo: `Sell ${label}` });
      chargeUnsettled(st.treasury, Math.min(value, feeTotal), { ...c, memo: `Fees on sell ${label}` });
    }
    fill = { id, date: st.date, desk: inst.desk, instrumentId: inst.id, side, qty, priceQuote: px, usdInr: inst.quote === 'USD' ? usdInr : null, valuePaise: value, fees, netPaise: net, realizedPaise: net - basis, settleDate };
  }
  st.deskFills = [...st.deskFills, fill].slice(-100);
  return { state: st, fill };
}
