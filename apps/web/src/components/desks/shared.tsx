'use client';

// Pieces shared by the desks beyond stocks: the instant-trade ticket, empty states, contract notes.
import { Fragment, useState } from 'react';
import type { CareerView, Desk, Instrument, Side } from '@ms/engine';
import { defaultConfig as cfg, instantFees, isOpen, nextOpenDay, type InstantDesk } from '@ms/engine';
import { formatDate, formatINR, formatQuote, formatSignedINR, formatUnits, parseRupees } from '@ms/ui/format';
import { instrumentById } from '@/lib/portfolio';
import { useGame } from '@/store/game';

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-table"><span>◇</span><p>{children}</p></div>;
}

export const changeOf = (career: CareerView, id: string): number => {
  const b = career.prices[id];
  return b && b.prevClose ? (b.c - b.prevClose) / b.prevClose : 0;
};

/** INR value of `qty` units at `price` in the instrument's quote currency. */
export const inrValue = (career: CareerView, inst: Instrument, qty: number, price: number): number =>
  Math.round((qty / (inst.unitScale ?? 1)) * price * (inst.quote === 'USD' ? career.macro.usdInr : 1));

/** Same rule as the engine: last close ± half the regime-scaled spread. */
export function quotePrice(career: CareerView, inst: Instrument, side: Side): number {
  const last = career.prices[inst.id]?.c ?? inst.startPricePaise;
  const bps = cfg.instant.spreadBps[inst.desk as InstantDesk] * cfg.instant.spreadMult[career.regime];
  const px = last * (1 + ((side === 'BUY' ? 1 : -1) * bps) / 2 / 10_000);
  return inst.quote === 'USD' ? Number(px.toFixed(4)) : Math.max(1, Math.round(px));
}

const MARKET_NAME = { IN: 'Indian', US: 'US', CRYPTO: 'Crypto' } as const;

/** Why this instrument can't trade today (mirrors the engine), or null. */
export function closedNote(career: CareerView, inst: Instrument): string | null {
  if (inst.market === 'CRYPTO') return null;
  if (inst.market === 'IN' && career.halt) return 'Indian markets are paused by the circuit breaker until the next trading day.';
  if (!isOpen(inst.market, career.date, cfg.calendars)) return `The ${MARKET_NAME[inst.market]} market is closed today. It reopens ${formatDate(nextOpenDay(inst.market, career.date, cfg.calendars))}.`;
  return null;
}

/** Buy/sell ticket for ETFs, bonds, US stocks and coins: executes instantly at the shown price. */
export function InstantTicket({ career, inst, held }: { career: CareerView; inst: Instrument; held: number }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const [side, setSide] = useState<Side>('BUY');
  const coins = (inst.unitScale ?? 1) > 1;
  const [mode, setMode] = useState<'AMOUNT' | 'UNITS'>(coins ? 'AMOUNT' : 'UNITS');
  const [text, setText] = useState(coins ? '10000' : '10');
  const [done, setDone] = useState<string | null>(null);
  const scale = inst.unitScale ?? 1;
  const px = quotePrice(career, inst, side);
  const usd = inst.quote === 'USD';
  const unitPaise = inrValue(career, inst, scale, px); // ₹ per whole unit
  const qty = (() => {
    if (mode === 'AMOUNT') {
      const paise = parseRupees(text);
      return paise && unitPaise ? Math.floor((paise * scale) / unitPaise) : 0;
    }
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? Math.floor(n * scale + 1e-9) : 0;
  })();
  const value = inrValue(career, inst, qty, px);
  const fees = value ? instantFees(inst.desk as InstantDesk, side, value, cfg) : [];
  const feeTotal = fees.reduce((a, f) => a + f.paise, 0);
  const total = side === 'BUY' ? value + feeTotal : value - feeTotal;
  const closed = closedNote(career, inst);
  const rugged = career.macro.rugged.includes(inst.id);
  const settle = inst.desk === 'CRYPTO' ? 'Proceeds are available at once.' : `Sale proceeds arrive in Available one ${MARKET_NAME[inst.market]} trading day later.`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(null);
    const r = await act({ kind: 'TRADE', instrumentId: inst.id, side, qty });
    const f = r?.result?.fill;
    if (f) setDone(`${f.side === 'BUY' ? 'Bought' : 'Sold'} ${formatUnits(f.qty, scale)} ${inst.symbol} at ${formatQuote(f.priceQuote, inst.quote)}${f.side === 'SELL' && f.realizedPaise !== null ? ` · realised ${formatSignedINR(f.realizedPaise)}` : ''}.`);
  }

  return (
    <aside className="order-panel panel" data-tour="order-ticket">
      <div className="panel-title-row"><div><p className="eyebrow">Instant trade</p><h2>{inst.symbol}</h2></div><strong>{formatQuote(px, inst.quote)}</strong></div>
      <div className="side-toggle" role="group" aria-label="Side">
        <button className={side === 'BUY' ? 'buy active' : ''} onClick={() => setSide('BUY')} type="button" disabled={rugged}>Buy</button>
        <button className={side === 'SELL' ? 'sell active' : ''} onClick={() => setSide('SELL')} type="button">Sell</button>
      </div>
      <form onSubmit={submit}>
        {coins && (
          <div className="mini-toggle" role="group" aria-label="Enter as">
            <button type="button" className={mode === 'AMOUNT' ? 'active' : ''} onClick={() => { setMode('AMOUNT'); setText('10000'); }}>₹ amount</button>
            <button type="button" className={mode === 'UNITS' ? 'active' : ''} onClick={() => { setMode('UNITS'); setText('0.01'); }}>{inst.desk === 'CRYPTO' ? 'Coins' : 'Units'}</button>
          </div>
        )}
        <label>{mode === 'AMOUNT' ? 'Amount (₹)' : inst.desk === 'CRYPTO' ? 'Coins' : 'Quantity'}
          <input value={text} inputMode="decimal" onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))} />
          <small>Held: {formatUnits(held, scale)} {inst.desk === 'CRYPTO' ? 'on Vaultex' : ''} {side === 'SELL' && held > 0 && <button type="button" className="text-button inline" onClick={() => { setMode('UNITS'); setText(String(held / scale)); }}>Sell all</button>}</small>
        </label>
        <div className="estimate-box">
          {coins && <span>You {side === 'BUY' ? 'get' : 'sell'} <b>{formatUnits(qty, scale)} {inst.symbol}</b></span>}
          <span>Price {usd && <small>(${(px / 100).toFixed(px < 100 ? 4 : 2)} × ₹{career.macro.usdInr.toFixed(2)})</small>} <b>{formatINR(unitPaise)}</b></span>
          <span>Value <b>{formatINR(value)}</b></span>
          {fees.map((f) => <span key={f.label}>{f.label} <b>{formatINR(f.paise)}</b></span>)}
          <span className="estimate-total">{side === 'BUY' ? 'Total debit' : 'You receive'} <b>{formatINR(Math.max(0, total))}</b></span>
          <span className="from-available">Available <b>{formatINR(career.treasury.availablePaise)}</b></span>
          <small>Executes now at this price (last close {side === 'BUY' ? 'plus' : 'minus'} half the spread). {side === 'SELL' ? settle : ''}</small>
        </div>
        <button className={`place-button ${side.toLowerCase()}`} disabled={busy || !qty || Boolean(closed) || (side === 'BUY' && rugged)} type="submit">{busy ? 'Working…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${inst.symbol}`}</button>
        {closed && <p className="halt-note" role="note">{closed}</p>}
        {done && <p className="success-message" role="status">✓ {done}</p>}
      </form>
    </aside>
  );
}

/** Contract notes for instant trades on one desk. */
export function DeskFills({ career, desk }: { career: CareerView; desk: Desk }) {
  const fills = career.deskFills.filter((f) => f.desk === desk).reverse();
  if (!fills.length) return <Empty>Your trades and their contract notes will appear here.</Empty>;
  return (
    <div className="data-table">
      {fills.map((f) => {
        const inst = instrumentById(f.instrumentId);
        const scale = inst?.unitScale ?? 1;
        return (
          <details key={f.id} className="contract-note">
            <summary>
              <span><b>{f.side === 'BUY' ? 'Bought' : 'Sold'} {formatUnits(f.qty, scale)} {inst?.symbol ?? f.instrumentId}</b><small>{formatDate(f.date)} · {formatQuote(f.priceQuote, inst?.quote)} each</small></span>
              <span>{f.side === 'BUY' ? formatSignedINR(-f.netPaise) : formatSignedINR(f.netPaise)}{f.realizedPaise !== null && <small className={f.realizedPaise > 0 ? 'up' : f.realizedPaise < 0 ? 'down' : 'flat'}>Realised {formatSignedINR(f.realizedPaise)}</small>}</span>
            </summary>
            <dl>
              <dt>Trade value</dt><dd>{formatINR(f.valuePaise)}</dd>
              {f.usdInr && <><dt>USD/INR used</dt><dd>₹{f.usdInr.toFixed(2)}</dd></>}
              {f.fees.map((x) => <Fragment key={x.label}><dt>{x.label}</dt><dd>{formatINR(x.paise)}</dd></Fragment>)}
              <dt>{f.side === 'BUY' ? 'Total paid' : 'Net proceeds'}</dt><dd><b>{formatINR(f.netPaise)}</b></dd>
              {f.settleDate && <><dt>Arrives in Available</dt><dd>{formatDate(f.settleDate)}</dd></>}
            </dl>
          </details>
        );
      })}
    </div>
  );
}

/** One holding row: value, P&L, and (US) the split between price and currency. */
export function HoldingRow({ career, p, onSelect, extra }: { career: CareerView; p: CareerView['positions'][number]; onSelect?: () => void; extra?: React.ReactNode }) {
  const inst = instrumentById(p.instrumentId);
  const scale = p.unitScale ?? 1;
  const pnl = p.valuePaise - p.costBasisPaise;
  const frozen = p.frozenValuePaise !== undefined;
  // Dollar assets: profit = the price move (at today's rate) + the rupee's move − fees paid.
  const pricePnl = p.quote === 'USD' && p.costQuote !== undefined && !frozen ? Math.round(((p.qty / scale) * (career.prices[p.instrumentId]?.c ?? 0) - p.costQuote) * career.macro.usdInr) : null;
  const fees = p.feesPaise ?? 0;
  const rupeePnl = pricePnl !== null ? pnl - pricePnl + fees : 0;
  const Tag = onSelect ? 'button' : 'div';
  return (
    <Tag className="holding-row" onClick={onSelect} type={onSelect ? 'button' : undefined}>
      <span>
        <b>{inst?.symbol ?? p.instrumentId}{p.custody === 'SELF' && <em className="tag">own wallet</em>}{frozen && <em className="tag danger">frozen</em>}</b>
        <small>{formatUnits(p.qty, scale)} {scale > 1 ? (inst?.desk === 'CRYPTO' ? 'coins' : 'units') : 'held'}{extra}</small>
      </span>
      <span>
        {formatINR(p.valuePaise)}
        <small className={frozen ? 'down' : pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'flat'}>{frozen ? 'counted at 50% until administrators decide' : `${formatSignedINR(pnl)}${pricePnl !== null ? ` · price ${formatSignedINR(pricePnl)} · rupee ${formatSignedINR(rupeePnl)} · fees ${formatSignedINR(-fees)}` : ''}`}</small>
      </span>
    </Tag>
  );
}
