'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CareerView } from '@ms/engine';
import { FACTORS } from '@ms/engine';
import { BREAKER_INDEX, SECTORS, STOCKS } from '@ms/content/universe';
import { arrow, formatDate, formatINR, formatNumber, formatPct, formatSignedINR, tone } from '@ms/ui/format';
import { useGame } from '@/store/game';
import { DeskHero, Fact } from '../desks/DeskHero';
import { OrderPanel } from './OrderPanel';
import { PriceChart } from './PriceChart';

const factorNames: Record<string, string> = { GR: 'Global growth', DG: 'India growth', PR: 'Rates', INF: 'Inflation', OIL: 'Oil', FX: 'USD/INR', GPR: 'War risk', CRD: 'Credit', CRY: 'Crypto', LIQ: 'Liquidity' };

export function StockTerminal({ career }: { career: CareerView }) {
  const selectedId = useGame((s) => s.focusId);
  const setSelectedId = useGame((s) => s.setFocus);
  const [query, setQuery] = useState('');
  const [activity, setActivity] = useState<'HOLDINGS' | 'ORDERS' | 'FILLS' | 'LEDGER'>('HOLDINGS');
  const cancelOrder = useGame((s) => s.cancelOrder);
  const busy = useGame((s) => s.busy);
  const instrument = STOCKS.find((s) => s.id === selectedId) ?? STOCKS[0]!;
  const bar = career.prices[instrument.id]!;
  const change = bar.prevClose ? (bar.c - bar.prevClose) / bar.prevClose : 0;
  const list = STOCKS.filter((s) => `${s.symbol} ${s.name}`.toLowerCase().includes(query.toLowerCase()));
  const exposures = useMemo(() => {
    const sector = SECTORS[instrument.sector]!;
    return FACTORS.map((factor, index) => ({ factor, value: sector.loadings[index] ?? 0 })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 4);
  }, [instrument]);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const nifty = career.indices[BREAKER_INDEX.id];
  const niftyChange = nifty ? (nifty.level - nifty.prevLevel) / nifty.prevLevel : 0;


  const stockValue = career.positions.filter((p) => STOCKS.some((s) => s.id === p.instrumentId)).reduce((a, p) => a + p.valuePaise, 0);
  return (
    <>
      <DeskHero desk="STOCKS" eyebrow="India desk" title="Stocks" lead={`Own a slice of ${STOCKS.length} fictional companies across ${new Set(STOCKS.map((s) => s.sector)).size} sectors. Orders fill at the next trading day’s prices; sale money arrives a day later.`}>
        <Fact label={BREAKER_INDEX.name} value={nifty ? formatNumber(nifty.level, 0) : '—'} />
        <Fact label="Index today" value={formatPct(niftyChange)} tone={tone(niftyChange)} />
        <Fact label="Your stocks" value={formatINR(stockValue, 0)} />
      </DeskHero>
      <div className="terminal-grid">
        <aside className="watchlist panel">
          <div className="watchlist-heading"><div><p className="eyebrow">India desk</p><h2>Stocks</h2></div><span>{STOCKS.length}</span></div>
          <label className="search-box">⌕<input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stocks  ( / )" aria-label="Search stocks" /></label>
          <div className="watchlist-columns"><span>Company</span><span>Price</span></div>
          <div className="stock-list">
            {list.map((stock) => {
              const quote = career.prices[stock.id]!;
              const delta = quote.prevClose ? (quote.c - quote.prevClose) / quote.prevClose : 0;
              return <button className={selectedId === stock.id ? 'selected' : ''} onClick={() => setSelectedId(stock.id)} key={stock.id}>
                <span><strong>{stock.symbol}</strong><small>{stock.name}</small></span>
                <span><b>{formatINR(quote.c)}</b><small className={tone(delta)}>{formatPct(delta)}</small></span>
              </button>;
            })}
          </div>
        </aside>

        <main className="stock-detail">
          <section className="quote-panel panel">
            <div className="quote-heading">
              <div><p className="eyebrow">{SECTORS[instrument.sector]?.name}</p><h1>{instrument.name}</h1><span>{instrument.symbol} · India</span></div>
              <div className="hero-price"><strong>{formatINR(bar.c)}</strong><span className={tone(change)}>{arrow(change)}{formatPct(change)}</span></div>
            </div>
            <PriceChart careerId={career.id} instrumentId={instrument.id} symbol={instrument.symbol} stateVersion={career.stateVersion} />
            <div className="ohlc-strip"><span>Open <b>{formatINR(bar.o)}</b></span><span>High <b>{formatINR(bar.h)}</b></span><span>Low <b>{formatINR(bar.l)}</b></span><span>Prev close <b>{formatINR(bar.prevClose)}</b></span><span>Volume <b>{formatNumber(bar.v)}</b></span></div>
          </section>
          <section className="market-context panel">
            <div><p className="eyebrow">Market pulse</p><strong>{BREAKER_INDEX.name} {nifty ? formatNumber(nifty.level, 0) : '—'}</strong><span className={tone(niftyChange)}>{formatPct(niftyChange)}</span></div>
            <div className="factor-strip" aria-label="Main factor sensitivities">
              {exposures.map(({ factor, value }) => <span key={factor} className={value >= 0 ? 'positive' : 'negative'}><small>{factorNames[factor]}</small><b>{value > 0 ? '+' : ''}{value.toFixed(1)}×</b></span>)}
            </div>
          </section>
        </main>

        <OrderPanel career={career} instrument={instrument} />
      </div>

      <section className="activity-panel panel">
        <div className="activity-tabs">
          {(['HOLDINGS', 'ORDERS', 'FILLS', 'LEDGER'] as const).map((tab) => <button key={tab} className={activity === tab ? 'active' : ''} onClick={() => setActivity(tab)}>{tab[0]}{tab.slice(1).toLowerCase()} <small>{tab === 'HOLDINGS' ? career.positions.filter((p) => STOCKS.some((s) => s.id === p.instrumentId)).length : tab === 'ORDERS' ? career.orders.filter((o) => o.status === 'OPEN').length : tab === 'FILLS' ? career.fills.length : career.ledger.length}</small></button>)}
        </div>
        <div className="activity-content">
          {activity === 'HOLDINGS' && <Holdings career={career} onSelect={setSelectedId} />}
          {activity === 'ORDERS' && <Orders career={career} busy={busy} onCancel={(id) => void cancelOrder(id)} />}
          {activity === 'FILLS' && <Fills career={career} />}
          {activity === 'LEDGER' && <Ledger career={career} />}
        </div>
      </section>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <div className="empty-table"><span>◇</span><p>{children}</p></div>; }

function Holdings({ career, onSelect }: { career: CareerView; onSelect: (id: string) => void }) {
  const held = career.positions.filter((p) => STOCKS.some((s) => s.id === p.instrumentId));
  if (!held.length) return <Empty>No stock holdings yet. Place a buy order, then advance to the next trading day. Other desks show their own holdings.</Empty>;
  return <div className="data-table">{held.map((p) => { const stock = STOCKS.find((s) => s.id === p.instrumentId)!; const value = p.qty * career.prices[p.instrumentId]!.c; const pnl = value - p.costBasisPaise; return <button key={p.instrumentId} onClick={() => onSelect(p.instrumentId)}><span><b>{stock.symbol}</b><small>{p.qty} shares</small></span><span>{formatINR(value)}<small className={pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'flat'}>{pnl >= 0 ? '+' : ''}{formatINR(pnl)}</small></span></button>; })}</div>;
}

function Orders({ career, busy, onCancel }: { career: CareerView; busy: boolean; onCancel: (id: string) => void }) {
  const orders = [...career.orders].reverse();
  if (!orders.length) return <Empty>No orders yet. Pick a stock and place a buy.</Empty>;
  const price = (o: CareerView['orders'][number]) =>
    [o.limitPaise !== null && `limit ${formatINR(o.limitPaise)}`, o.triggerPaise !== null && `trigger ${formatINR(o.triggerPaise)}`].filter(Boolean).join(' · ');
  return <div className="data-table">{orders.map((o) => <div key={o.id}>
    <span><b>{o.side === 'BUY' ? 'Buy' : 'Sell'} {o.qty} {symbolOf(o.instrumentId)}</b><small>{TYPE_LABEL[o.type]}{price(o) && ` · ${price(o)}`} · placed {formatDate(o.placedDate)}{o.cancelReason && ` · ${o.cancelReason}`}</small></span>
    <span><em className={`status status-${o.status.toLowerCase()}`}>{STATUS_LABEL[o.status]}</em>{o.status === 'OPEN' && <button className="text-button" disabled={busy} onClick={() => onCancel(o.id)}>Cancel</button>}</span>
  </div>)}</div>;
}

/** Each fill is a contract note (prd.md P1-T05): value, every charge, net amount and settlement. */
function Fills({ career }: { career: CareerView }) {
  if (!career.fills.length) return <Empty>Filled orders and contract notes will appear here.</Empty>;
  return <div className="data-table">{[...career.fills].reverse().map((f) => (
    <details key={f.id} className="contract-note">
      <summary>
        <span><b>{f.side === 'BUY' ? 'Bought' : 'Sold'} {f.qty} {symbolOf(f.instrumentId)}</b><small>{formatDate(f.date)} · {formatINR(f.pricePaise)} each</small></span>
        <span>{f.side === 'BUY' ? formatSignedINR(-f.netPaise) : formatSignedINR(f.netPaise)}{f.realizedPaise !== null ? <small className={f.realizedPaise > 0 ? 'up' : f.realizedPaise < 0 ? 'down' : 'flat'}>Realised {formatSignedINR(f.realizedPaise)}</small> : <small>Charges {formatINR(f.charges.total)}</small>}</span>
      </summary>
      <dl>
        <dt>Trade value</dt><dd>{formatINR(f.valuePaise)}</dd>
        <dt>Brokerage</dt><dd>{formatINR(f.charges.brokerage)}</dd>
        <dt>Securities transaction tax</dt><dd>{formatINR(f.charges.stt)}</dd>
        <dt>Exchange fee</dt><dd>{formatINR(f.charges.exchange)}</dd>
        <dt>Regulator fee</dt><dd>{formatINR(f.charges.regulator)}</dd>
        {f.side === 'BUY' && <><dt>Stamp duty</dt><dd>{formatINR(f.charges.stamp)}</dd></>}
        <dt>GST</dt><dd>{formatINR(f.charges.gst)}</dd>
        <dt>{f.side === 'BUY' ? 'Total paid' : 'Net proceeds'}</dt><dd><b>{formatINR(f.netPaise)}</b></dd>
        {f.settleDate && <><dt>Arrives in Available</dt><dd>{formatDate(f.settleDate)}</dd></>}
      </dl>
    </details>
  ))}</div>;
}

function Ledger({ career }: { career: CareerView }) {
  const items = career.treasury.unsettledItems;
  return <>
    {items.length > 0 && <div className="unsettled-list">{items.map((i) => <span key={i.ref}>{formatINR(i.amountPaise)} from {i.memo.replace(/^Sell /, 'selling ')} · arrives {formatDate(i.settleDate)}</span>)}</div>}
    <div className="data-table">{[...career.ledger].reverse().map((e) => <div key={e.id}><span><b>{e.memo}</b><small>{formatDate(e.date)} · {LEDGER_FLOW[e.type]}</small></span><span>{formatINR(e.amountPaise)}</span></div>)}</div>
  </>;
}

const symbolOf = (id: string): string => STOCKS.find((s) => s.id === id)?.symbol ?? id;
const TYPE_LABEL = { MARKET: 'Market', LIMIT: 'Limit', SL: 'Stop-limit', 'SL-M': 'Stop-market' } as const;
const STATUS_LABEL = { OPEN: 'Open', FILLED: 'Filled', CANCELLED: 'Cancelled' } as const;
const LEDGER_FLOW = {
  grant: 'Into Available',
  reserve: 'Available → Blocked',
  release: 'Blocked → Available',
  buy: 'Paid from Blocked',
  sell: 'Into Unsettled',
  charge: 'Charges',
  settle: 'Unsettled → Available',
  fee: 'Fees',
  interest: 'Interest into Available',
  maturity: 'Deposit returned',
  payout: 'Forecast payout',
  recovery: 'Exchange recovery',
} as const;
