'use client';

// Commodities, Global (US) and Crypto desks: a watchlist, a chart, an instant ticket and your holdings.
import { useState } from 'react';
import type { CareerView } from '@ms/engine';
import { universe } from '@ms/content/universe';
import { EXCHANGE_NAME } from '@ms/content/desks';
import { arrow, formatDate, formatINR, formatPct, formatQuote, formatUnits, tone } from '@ms/ui/format';
import { positionsOn } from '@/lib/portfolio';
import { useGame } from '@/store/game';
import { PriceChart } from '../stocks/PriceChart';
import { DeskHero, Fact } from './DeskHero';
import { DeskFills, Empty, HoldingRow, InstantTicket, changeOf, closedNote, inrValue } from './shared';

type MarketDeskId = 'COMMODITIES' | 'GLOBAL' | 'CRYPTO';

const COPY: Record<MarketDeskId, { eyebrow: string; title: string; lead: string }> = {
  COMMODITIES: { eyebrow: 'Hard assets', title: 'Commodities', lead: 'Gold, silver and crude oil funds, priced in rupees. They often zig when stocks zag.' },
  GLOBAL: { eyebrow: 'United States', title: 'Global stocks', lead: 'US companies priced in dollars. Your rupee return = the stock’s move + the dollar’s move.' },
  CRYPTO: { eyebrow: 'Open 24/7', title: 'Crypto', lead: 'Fictional coins that trade every day, weekends included. No circuit breakers, no safety net.' },
};

export function MarketDesk({ career, desk }: { career: CareerView; desk: MarketDeskId }) {
  const list = universe.instruments.filter((i) => i.desk === desk);
  const [selectedId, setSelectedId] = useState(list[0]!.id);
  const [tab, setTab] = useState<'HOLDINGS' | 'NOTES'>('HOLDINGS');
  const inst = list.find((i) => i.id === selectedId) ?? list[0]!;
  const bar = career.prices[inst.id]!;
  const change = changeOf(career, inst.id);
  const held = career.positions.find((p) => p.key === inst.id)?.qty ?? 0;
  const holdings = positionsOn(career, desk);
  const closed = closedNote(career, inst);
  const copy = COPY[desk];

  const deskValue = holdings.reduce((a, p) => a + p.valuePaise, 0);
  return (
    <>
      <DeskHero desk={desk} eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead}>
        <Fact label="You hold" value={formatINR(deskValue, 0)} />
        {desk === 'GLOBAL' && <Fact label="USD/INR" value={`₹${career.macro.usdInr.toFixed(2)}`} />}
        {desk === 'CRYPTO' && <Fact label="Exchange" value={career.macro.exchange.status === 'OK' ? `${EXCHANGE_NAME} open` : `${EXCHANGE_NAME} ${career.macro.exchange.status.toLowerCase()}`} tone={career.macro.exchange.status === 'FROZEN' ? 'down' : undefined} />}
        {desk === 'COMMODITIES' && <Fact label="Gold today" value={formatPct(changeOf(career, 'INGOT'))} tone={tone(changeOf(career, 'INGOT'))} />}
        <Fact label={inst.market === 'CRYPTO' ? 'Market' : 'Today'} value={inst.market === 'CRYPTO' ? 'Open 24/7' : closed ? 'Closed' : 'Open'} />
      </DeskHero>
      {desk === 'CRYPTO' && <CryptoWarning career={career} />}
      <div className="terminal-grid">
        <aside className="watchlist panel">
          <div className="watchlist-heading"><div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2></div><span>{list.length}</span></div>
          <div className="watchlist-columns"><span>Name</span><span>Price</span></div>
          <div className="stock-list">
            {list.map((i) => {
              const b = career.prices[i.id]!;
              const d = changeOf(career, i.id);
              return (
                <button key={i.id} className={selectedId === i.id ? 'selected' : ''} onClick={() => setSelectedId(i.id)}>
                  <span><strong>{i.symbol}{career.macro.rugged.includes(i.id) && <em className="tag danger">rug pull</em>}</strong><small>{i.name}</small></span>
                  <span><b>{formatQuote(b.c, i.quote)}</b><small className={tone(d)}>{formatPct(d)}</small></span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="stock-detail">
          <section className="quote-panel panel">
            <div className="quote-heading">
              <div><p className="eyebrow">{universe.sectors[inst.sector]?.name}</p><h1>{inst.name}</h1><span>{inst.symbol} · {inst.market === 'US' ? 'US market, in dollars' : inst.market === 'CRYPTO' ? 'Crypto, in dollars, 24/7' : 'India, in rupees'}</span></div>
              <div className="hero-price">
                <strong>{formatQuote(bar.c, inst.quote)}</strong>
                <span className={tone(change)}>{arrow(change)}{formatPct(change)}</span>
                {inst.quote === 'USD' && <small className="muted">{formatINR(inrValue(career, inst, inst.unitScale ?? 1, bar.c))} per {inst.desk === 'CRYPTO' ? 'coin' : 'share'}</small>}
              </div>
            </div>
            {inst.blurb && <p className="instrument-blurb">{inst.blurb}</p>}
            {career.macro.rugged.includes(inst.id) && <p className="error-banner" role="note">The team behind {inst.name} disappeared with investors’ money. Nobody is buying any more; you can only sell what you hold, for almost nothing.</p>}
            <PriceChart careerId={career.id} instrumentId={inst.id} symbol={inst.symbol} stateVersion={career.stateVersion} quote={inst.quote ?? 'INR'} />
            <div className="ohlc-strip">
              <span>Open <b>{formatQuote(bar.o, inst.quote)}</b></span><span>High <b>{formatQuote(bar.h, inst.quote)}</b></span><span>Low <b>{formatQuote(bar.l, inst.quote)}</b></span>
              {inst.quote === 'USD' && <span>USD/INR <b>₹{career.macro.usdInr.toFixed(2)}</b></span>}
              {inst.expensePct !== undefined && <span>Expense ratio <b>{inst.expensePct}% a year</b></span>}
              <span>{closed ? 'Market closed' : 'Market open'} <b>{formatDate(career.date)}</b></span>
            </div>
          </section>
          {desk === 'GLOBAL' && <FxExplainer career={career} />}
        </main>

        <InstantTicket key={inst.id} career={career} inst={inst} held={held} />
      </div>

      <section className="activity-panel panel">
        <div className="activity-tabs">
          <button className={tab === 'HOLDINGS' ? 'active' : ''} onClick={() => setTab('HOLDINGS')}>Holdings <small>{holdings.length}</small></button>
          <button className={tab === 'NOTES' ? 'active' : ''} onClick={() => setTab('NOTES')}>Contract notes <small>{career.deskFills.filter((f) => f.desk === desk).length}</small></button>
        </div>
        <div className="activity-content">
          {tab === 'HOLDINGS' && (desk === 'CRYPTO' ? <CryptoHoldings career={career} onSelect={setSelectedId} /> : holdings.length ? <div className="data-table">{holdings.map((p) => <HoldingRow key={p.key} career={career} p={p} onSelect={() => setSelectedId(p.instrumentId)} />)}</div> : <Empty>Nothing held on this desk yet.</Empty>)}
          {tab === 'NOTES' && <DeskFills career={career} desk={desk} />}
        </div>
      </section>
    </>
  );
}

/** ASCI-style risk warning, inside the desk (legal review L-12). */
function CryptoWarning({ career }: { career: CareerView }) {
  const ex = career.macro.exchange;
  return (
    <div className="desk-warning" role="note">
      <b>Crypto is unregulated and can be extremely risky.</b> In real life there may be no regulatory recourse for any loss. Every coin in this game is fictional, and the coins are virtual.
      {ex.status === 'FROZEN' && <span className="danger"> {EXCHANGE_NAME} froze withdrawals on {formatDate(ex.since!)}. Coins that were on it are stuck until administrators finish.</span>}
      {ex.status === 'RESOLVED' && <span> {EXCHANGE_NAME}’s administrators paid out {Math.round((ex.recoveryPct ?? 0) * 100)}% of frozen coins’ value.</span>}
    </div>
  );
}

function FxExplainer({ career }: { career: CareerView }) {
  return (
    <section className="market-context panel">
      <div><p className="eyebrow">Two moves in one</p><strong>₹{career.macro.usdInr.toFixed(2)} per dollar</strong><span className="muted">A weaker rupee lifts your US holdings in rupees even if the stock is flat.</span></div>
      <p className="muted small">Every buy and sell converts rupees ↔ dollars for a 0.5% fee. Holdings show the price part and the rupee part of your profit separately.</p>
    </section>
  );
}

/** Exchange vs own-wallet coins, moves between them, coins in transit and frozen coins. */
function CryptoHoldings({ career, onSelect }: { career: CareerView; onSelect: (id: string) => void }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const coins = positionsOn(career, 'CRYPTO');
  const fee = 50; // ₹ network fee (config: fees.cryptoSelfCustodyTransferPaise)
  if (!coins.length && !career.transfers.length) return <Empty>No coins yet. Coins you buy sit on the {EXCHANGE_NAME} exchange; you can move them to your own wallet for safety.</Empty>;
  return (
    <>
      <p className="muted small custody-note">On the exchange: instant to sell, but at risk if {EXCHANGE_NAME} fails. In your own wallet: safe from that, but moving coins back to sell costs ₹{fee} and takes a day.</p>
      <div className="data-table">
        {coins.map((p) => (
          <div key={p.key} className="holding-with-actions">
            <HoldingRow career={career} p={p} onSelect={() => onSelect(p.instrumentId)} />
            {p.frozenValuePaise === undefined && (
              <button className="secondary-button small" type="button" disabled={busy} onClick={() => void act({ kind: 'CUSTODY', instrumentId: p.instrumentId, to: p.custody === 'SELF' ? 'EXCHANGE' : 'SELF', qty: p.qty })}>
                {p.custody === 'SELF' ? 'Move to exchange' : 'Move to own wallet'}
              </button>
            )}
          </div>
        ))}
        {career.transfers.map((t) => <div key={t.id} className="holding-row"><span><b>{t.instrumentId}<em className="tag">in transit</em></b><small>{formatUnits(t.qty, 1_000_000)} coins · arrives {formatDate(t.arriveDate)}</small></span><span /></div>)}
      </div>
    </>
  );
}

