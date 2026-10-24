// Stocks desk order engine: market / limit / SL / SL-M on daily bars.
// Orders placed on day D fill against the next India trading day's bar:
//   market → open (+ slippage); limit → open if better, else the limit if the range touches it;
//   stops trigger when the open or range crosses the trigger, then act as market (SL-M) or limit (SL).
import { addTradingDays } from '../../calendar';
import type { MarketConfig } from '../../config';
import { GameError, InvariantError } from '../../errors';
import { clamp, floorToTick, inr, roundToTick } from '../../money';
import { stream } from '../../rng';
import { capture, chargeUnsettled, creditUnsettled, release, reserve } from '../../treasury';
import type { Bar, CareerState, ContentPack, Fill, GameEvent, Instrument, Order, OrderType, Regime, Side } from '../../types';
import { priceBand, tradesAsStock } from '../../world/prices';
import { equityCharges } from './charges';

export interface PlaceOrderInput {
  desk: 'STOCKS';
  instrumentId: string;
  side: Side;
  type: OrderType;
  qty: number;
  limitPaise?: number | null;
  triggerPaise?: number | null;
}

const invalid = (msg: string): GameError => new GameError('VALIDATION', msg);

/** Shares held minus shares already committed to open sell orders. */
export function sellableQty(s: CareerState, instrumentId: string): number {
  const held = s.positions[instrumentId]?.qty ?? 0;
  const committed = s.orders
    .filter((o) => o.status === 'OPEN' && o.side === 'SELL' && o.instrumentId === instrumentId)
    .reduce((n, o) => n + o.qty - o.filledQty, 0);
  return held - committed;
}

export function placeOrder(s: CareerState, input: PlaceOrderInput, content: ContentPack, cfg: MarketConfig): { state: CareerState; order: Order } {
  if (s.ended) throw new GameError('ENDED', 'This run has finished.');
  // Listed IPO companies trade here too, gated by the IPO desk.
  const inst = content.instruments.find((i) => i.id === input.instrumentId && tradesAsStock(i, s));
  if (!inst) throw new GameError('NOT_FOUND', 'Unknown instrument.');
  const desk = inst.desk === 'IPO' ? 'IPO' : 'STOCKS';
  if (!s.unlockedDesks.includes(desk)) throw new GameError('DESK_LOCKED', `The ${desk === 'IPO' ? 'IPO' : 'Stocks'} desk is locked.`);
  if (s.world.halt) throw new GameError('MARKET_HALTED', 'Trading is paused after the market-wide circuit breaker. Continue to the next trading day to place orders.');

  const { side, type, qty } = input;
  const limit = input.limitPaise ?? null;
  const trigger = input.triggerPaise ?? null;
  const max = cfg.stocks.maxOrderQty;
  const tick = cfg.stocks.tickPaise;
  if (!Number.isInteger(qty) || qty < 1 || qty > max) throw invalid(`Quantity must be a whole number from 1 to ${max.toLocaleString('en-US')}.`);
  const needsLimit = type === 'LIMIT' || type === 'SL';
  const needsTrigger = type === 'SL' || type === 'SL-M';
  if (needsLimit !== (limit !== null)) throw invalid(needsLimit ? 'Enter a limit price.' : `${type} orders don't take a limit price.`);
  if (needsTrigger !== (trigger !== null)) throw invalid(needsTrigger ? 'Enter a trigger price.' : `${type} orders don't take a trigger price.`);

  const band = priceBand(s.prices[inst.id]!.c, inst, cfg);
  for (const [label, p] of [['Limit', limit], ['Trigger', trigger]] as const) {
    if (p === null) continue;
    if (!Number.isInteger(p) || p % tick !== 0) throw invalid(`${label} price must be a multiple of ${inr(tick)}.`);
    if (p < band.lo || p > band.hi) throw invalid(`${label} price must be within today's price band: ${inr(band.lo)} to ${inr(band.hi)}.`);
  }
  if (type === 'SL' && side === 'BUY' && limit! < trigger!) throw invalid('For a stop-loss buy, the limit price must be at or above the trigger price.');
  if (type === 'SL' && side === 'SELL' && limit! > trigger!) throw invalid('For a stop-loss sell, the limit price must be at or below the trigger price.');

  const st = structuredClone(s);
  const id = `O${++st.seq}`;
  if (side === 'SELL') {
    const free = sellableQty(st, inst.id);
    if (qty > free)
      throw new GameError(
        'INSUFFICIENT_QTY',
        free === 0 ? `You have no ${inst.symbol} shares free to sell.` : `You can sell up to ${free} ${inst.symbol} shares (the rest are already in open sell orders).`,
      );
  } else {
    // Reserve enough to cover the worst fill: market orders can't fill above tomorrow's upper band.
    const bandPct = (inst.bandPct ?? cfg.stocks.defaultBandPct) / 100;
    const refPrice = type === 'MARKET' ? band.hi : type === 'SL-M' ? floorToTick(trigger! * (1 + bandPct), tick) : limit!;
    const value = refPrice * qty;
    const need = value + equityCharges('BUY', value, cfg.charges).total;
    if (need > st.treasury.available)
      throw new GameError(
        'INSUFFICIENT_FUNDS',
        `Not enough available cash. You have ${inr(st.treasury.available)} available; this order needs ${inr(need)}. Cancel an open order or sell something first.`,
      );
    reserve(st.treasury, need, { date: st.date, desk: 'STOCKS', ref: id, memo: `Buy ${qty} ${inst.symbol} (${type.toLowerCase()} order)` });
  }

  const order: Order = {
    id,
    desk: 'STOCKS',
    instrumentId: inst.id,
    side,
    type,
    qty,
    filledQty: 0,
    limitPaise: limit,
    triggerPaise: trigger,
    triggered: false,
    status: 'OPEN',
    placedDate: st.date,
    closedDate: null,
    cancelReason: null,
  };
  st.orders.push(order);
  return { state: st, order };
}

function closeOrder(st: CareerState, o: Order, reason: string): void {
  if (st.treasury.reservations[o.id]) release(st.treasury, { date: st.date, desk: 'STOCKS', ref: o.id, memo: `Released: ${reason}` });
  o.status = 'CANCELLED';
  o.closedDate = st.date;
  o.cancelReason = reason;
}

export function cancelOrder(s: CareerState, orderId: string): { state: CareerState; order: Order } {
  if (!s.orders.some((o) => o.id === orderId && o.status === 'OPEN')) throw new GameError('NOT_FOUND', 'Order not found or already closed.');
  const st = structuredClone(s);
  const order = st.orders.find((o) => o.id === orderId)!;
  closeOrder(st, order, 'Cancelled by you');
  return { state: st, order };
}

/** Market-order fill price: spread + size-based slippage (worse in stressed regimes), inside the day's band. */
export function slippagePrice(base: number, side: Side, qty: number, inst: Instrument, prevClose: number, regime: Regime, cfg: MarketConfig): number {
  const L = cfg.liquidity;
  const advPct = ((base * qty) / inst.advPaise) * 100;
  const bps = Math.min(L.slippageCapBps, L.slippageBpsPerAdvPct * advPct) * L.slippageMult[regime] + L.spreadBps[regime] / 2;
  const { lo, hi } = priceBand(prevClose, inst, cfg);
  return clamp(roundToTick(base * (1 + ((side === 'BUY' ? 1 : -1) * bps) / 10_000), cfg.stocks.tickPaise), lo, hi);
}

/** Price this order executes at on `bar`, or null if it doesn't execute today. Marks stops as triggered. */
function matchPrice(o: Order, bar: Bar, inst: Instrument, regime: Regime, cfg: MarketConfig): number | null {
  const buy = o.side === 'BUY';
  const qty = o.qty - o.filledQty;
  const slip = (base: number): number => slippagePrice(base, o.side, qty, inst, bar.prevClose, regime, cfg);
  if (o.type === 'MARKET') return slip(bar.o);

  let act = bar.o;
  if ((o.type === 'SL' || o.type === 'SL-M') && !o.triggered) {
    const t = o.triggerPaise!;
    if (buy ? bar.o >= t : bar.o <= t) act = bar.o; // gapped through the trigger
    else if (buy ? bar.h >= t : bar.l <= t) act = t;
    else return null;
    o.triggered = true;
  }
  if (o.type === 'SL-M') return slip(act);

  const lim = o.limitPaise!;
  if (buy ? act <= lim : act >= lim) return act;
  if (buy ? bar.l <= lim : bar.h >= lim) return lim;
  return null;
}

function fillBuy(st: CareerState, o: Order, inst: Instrument, px: number, qty: number, cfg: MarketConfig): Fill | null {
  const t = st.treasury;
  const c = { date: st.date, desk: 'STOCKS' as const, ref: o.id, memo: `Buy ${qty} ${inst.symbol} @ ${inr(px)}` };
  const value = px * qty;
  const charges = equityCharges('BUY', value, cfg.charges);
  const cost = value + charges.total;
  const reserved = t.reservations[o.id] ?? 0;
  if (cost > reserved) {
    // Only stop-market buys can exceed their reserve (trigger gapped far up).
    if (t.available < cost - reserved) {
      closeOrder(st, o, 'Not enough available cash when the order executed');
      return null;
    }
    reserve(t, cost - reserved, c);
  }
  capture(t, value, 'buy', c);
  capture(t, charges.total, 'charge', { ...c, memo: `Charges on buy ${inst.symbol}` });
  if (t.reservations[o.id]) release(t, { ...c, memo: `Unused reserve returned (${inst.symbol})` });

  const pos = (st.positions[inst.id] ??= { instrumentId: inst.id, qty: 0, costBasisPaise: 0 });
  pos.qty += qty;
  pos.costBasisPaise += cost;
  o.filledQty += qty;
  o.status = 'FILLED';
  o.closedDate = st.date;
  const fill: Fill = { id: `F${++st.seq}`, orderId: o.id, date: st.date, instrumentId: inst.id, side: 'BUY', qty, pricePaise: px, valuePaise: value, charges, netPaise: cost, realizedPaise: null, settleDate: null };
  st.fills.push(fill);
  return fill;
}

function fillSell(st: CareerState, o: Order, inst: Instrument, px: number, qty: number, cfg: MarketConfig): Fill {
  const pos = st.positions[inst.id];
  if (!pos || pos.qty < qty) throw new InvariantError(`sell ${o.id} exceeds holding`);
  const id = `F${++st.seq}`;
  const value = px * qty;
  const full = equityCharges('SELL', value, cfg.charges);
  const charges = full.total > value ? { ...full, total: value } : full; // tiny sells: charges capped at trade value
  const settleDate = addTradingDays('IN', st.date, cfg.stocks.settlementDays, cfg.calendars);
  const c = { date: st.date, desk: 'STOCKS' as const, ref: id, memo: `Sell ${qty} ${inst.symbol} @ ${inr(px)}` };
  creditUnsettled(st.treasury, value, settleDate, c);
  chargeUnsettled(st.treasury, charges.total, { ...c, memo: `Charges on sell ${inst.symbol}` });

  const basis = Math.round((pos.costBasisPaise * qty) / pos.qty);
  pos.qty -= qty;
  pos.costBasisPaise -= basis;
  if (pos.qty === 0) delete st.positions[inst.id];
  o.filledQty += qty;
  if (o.filledQty === o.qty) {
    o.status = 'FILLED';
    o.closedDate = st.date;
  }
  const net = value - charges.total;
  const fill: Fill = { id, orderId: o.id, date: st.date, instrumentId: inst.id, side: 'SELL', qty, pricePaise: px, valuePaise: value, charges, netPaise: net, realizedPaise: net - basis, settleDate };
  st.fills.push(fill);
  return fill;
}

/** Execute open stock orders against today's bars. Mutates `st` (a clone owned by the tick). */
export function processStockFills(st: CareerState, bars: Record<string, Bar>, content: ContentPack, cfg: MarketConfig): { fills: Fill[]; events: GameEvent[] } {
  const byId = new Map(content.instruments.map((i) => [i.id, i]));
  const fills: Fill[] = [];
  const events: GameEvent[] = [];
  for (const o of st.orders) {
    if (o.status !== 'OPEN' || o.desk !== 'STOCKS' || o.placedDate >= st.date) continue;
    const bar = bars[o.instrumentId];
    const inst = byId.get(o.instrumentId);
    if (!bar || !inst) continue;
    const px = matchPrice(o, bar, inst, st.world.regime, cfg);
    if (px === null) continue;

    let qty = o.qty - o.filledQty;
    if (o.side === 'SELL' && bar.circuit === 'LOWER') {
      // Locked at lower circuit: few buyers, so only a random 0–20% of the sell queue clears.
      const u = stream(st.seed, 'fills.slippage', `${o.id}|${st.date}`).next();
      qty = Math.floor((qty * u * cfg.stocks.lowerCircuitMaxFillPct) / 100);
      if (qty === 0) continue;
    }
    if (o.side === 'BUY') {
      const f = fillBuy(st, o, inst, px, qty, cfg);
      if (f) fills.push(f);
      else events.push({ kind: 'ORDER_CANCELLED', date: st.date, orderId: o.id, reason: o.cancelReason! });
    } else fills.push(fillSell(st, o, inst, px, qty, cfg));
  }
  return { fills, events };
}
