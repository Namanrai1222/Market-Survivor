'use client';

// IPO desk: fictional companies coming to market. Bid during the 3-day window (money blocked), the
// retail lottery decides allotment, then the shares list and trade like stocks.
import { useState } from 'react';
import type { CareerView, IpoState } from '@ms/engine';
import { defaultConfig as cfg } from '@ms/engine';
import { IPO_COMPANIES } from '@ms/content/desks';
import { universe } from '@ms/content/universe';
import { formatDate, formatINR, formatPct, formatSignedINR, tone } from '@ms/ui/format';
import { useGame } from '@/store/game';
import { PriceChart } from '../stocks/PriceChart';
import { DeskHero, Fact } from './DeskHero';
import { Empty, changeOf } from './shared';

const STEPS: { key: keyof IpoState; label: string }[] = [
  { key: 'announceDate', label: 'Announced' },
  { key: 'openDate', label: 'Bidding opens' },
  { key: 'closeDate', label: 'Bidding closes' },
  { key: 'allotDate', label: 'Allotment' },
  { key: 'listDate', label: 'Listing' },
];

export function IpoDesk({ career }: { career: CareerView }) {
  const ipos = [...career.ipos].sort((a, b) => order(a) - order(b) || b.announceDate.localeCompare(a.announceDate));
  const [focus, setFocus] = useState<string | null>(null);
  const listed = ipos.filter((i) => i.status === 'LISTED');
  const selected = listed.find((i) => i.id === focus) ?? listed[0];
  return (
    <>
      <DeskHero desk="IPO" eyebrow="New listings" title="IPOs" lead="Companies selling shares to the public for the first time. Bid for whole lots; your money is blocked, not spent, until the allotment lottery.">
        <Fact label="Open now" value={ipos.filter((i) => i.status === 'OPEN').length} />
        <Fact label="Coming" value={ipos.filter((i) => i.status === 'UPCOMING').length} />
        <Fact label="Listed so far" value={listed.length} />
      </DeskHero>
      <section className="desk-intro panel">
        <ul className="explainer-list">
          <li><b>Oversubscribed?</b> When more people bid than there are shares, a lottery picks who gets one lot. 20× subscribed ≈ a 1-in-20 chance.</li>
          <li><b>Listing day</b> can pop or flop. Hype and the market’s mood matter more than the business on day one.</li>
          <li><b>Retail limit:</b> bids up to {formatINR(cfg.ipo.retailMaxPaise, 0)} per IPO.</li>
        </ul>
      </section>

      {ipos.filter((i) => i.status !== 'LISTED').length ? (
        <section className="ipo-grid">{ipos.filter((i) => i.status !== 'LISTED').map((i) => <IpoCard key={i.id} career={career} ipo={i} />)}</section>
      ) : (
        <section className="panel"><Empty>No IPO is open right now. New issues are announced every few weeks (never in a crash). Keep advancing the clock.</Empty></section>
      )}

      {selected && (
        <div className="desk-two-col">
          <section className="quote-panel panel">
            <div className="quote-heading">
              <div><p className="eyebrow">Listed {formatDate(selected.listDate)}</p><h1>{nameOf(selected.id)}</h1><span>Issue price {formatINR(selected.bandHiPaise)} · listed at {formatINR(selected.listingOpenPaise ?? 0)} ({formatPct((selected.listingOpenPaise ?? 0) / selected.bandHiPaise - 1, 1)})</span></div>
              <div className="hero-price"><strong>{formatINR(career.prices[selected.id]?.c ?? 0)}</strong><span className={tone(changeOf(career, selected.id))}>{formatPct(changeOf(career, selected.id))}</span></div>
            </div>
            <PriceChart careerId={career.id} instrumentId={selected.id} symbol={selected.id} stateVersion={career.stateVersion} />
          </section>
          <ListedTicket career={career} ipo={selected} />
        </div>
      )}

      {listed.length > 0 && (
        <section className="panel desk-list">
          <div className="panel-title-row"><div><p className="eyebrow">After listing</p><h2>Listed IPOs</h2></div></div>
          <div className="data-table">
            {listed.map((i) => {
              const px = career.prices[i.id]?.c ?? i.bandHiPaise;
              const held = career.positions.find((p) => p.instrumentId === i.id);
              return (
                <button key={i.id} type="button" className="holding-row" onClick={() => setFocus(i.id)}>
                  <span><b>{nameOf(i.id)}</b><small>Subscribed {i.subscription.toFixed(1)}× · {i.allottedLots ? `you got ${i.allottedLots * i.lotSize} shares` : i.application ? 'not allotted' : 'you didn’t bid'}</small></span>
                  <span>{formatINR(px)}<small className={tone(px / i.bandHiPaise - 1)}>{formatPct(px / i.bandHiPaise - 1, 1)} vs issue{held ? ` · you hold ${formatINR(held.valuePaise, 0)}` : ''}</small></span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

const order = (i: IpoState) => ({ OPEN: 0, UPCOMING: 1, CLOSED: 2, LISTED: 3 })[i.status];
const nameOf = (id: string) => IPO_COMPANIES.find((c) => c.id === id)?.name ?? id;

function IpoCard({ career, ipo }: { career: CareerView; ipo: IpoState }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const inst = IPO_COMPANIES.find((c) => c.id === ipo.id)!;
  const maxLots = Math.max(1, Math.floor(cfg.ipo.retailMaxPaise / (ipo.bandHiPaise * ipo.lotSize)));
  const [lots, setLots] = useState(ipo.application?.lots ?? 1);
  const lotCost = ipo.bandHiPaise * ipo.lotSize;
  const reached = STEPS.filter((s) => (ipo[s.key] as string) <= career.date).length;
  const chance = ipo.subscription > 1 ? 1 / ipo.subscription : 1;
  return (
    <article className={`ipo-card panel status-${ipo.status.toLowerCase()}`}>
      <header>
        <div><p className="eyebrow">{universe.sectors[inst.sector]?.name} · {ipo.status === 'OPEN' ? 'Bidding open' : ipo.status === 'UPCOMING' ? 'Coming soon' : 'Bidding closed'}</p><h2>{inst.name}</h2></div>
        <strong>{formatINR(ipo.bandLoPaise, 0)}–{formatINR(ipo.bandHiPaise, 0)}</strong>
      </header>
      <p className="muted">{inst.blurb}</p>
      <ol className="ipo-timeline">
        {STEPS.map((s, i) => <li key={s.key} className={i < reached ? 'done' : ''}><i /><span>{s.label}</span><small>{formatDate(ipo[s.key] as string).replace(/ \d{4}$/, '')}</small></li>)}
      </ol>
      <div className="sub-meter" aria-label={`Subscribed ${ipo.subscription.toFixed(1)} times`}>
        <span>Retail subscription</span>
        <b>{ipo.subscription.toFixed(2)}×</b>
        <i><i style={{ width: `${Math.min(100, (Math.log10(1 + ipo.subscription) / Math.log10(51)) * 100)}%` }} /></i>
        <small>{ipo.subscription > 1 ? `Lottery odds for one lot ≈ ${Math.max(1, Math.round(chance * 100))}%` : ipo.status === 'UPCOMING' ? 'Opens soon' : 'Everyone who bids gets what they asked for'}</small>
      </div>
      <dl className="ipo-facts"><dt>Lot</dt><dd>{ipo.lotSize} shares = {formatINR(lotCost, 0)}</dd><dt>Max retail</dt><dd>{maxLots} lots</dd></dl>
      {ipo.status === 'OPEN' && (
        <div className="ipo-bid">
          <label>Lots
            <span className="stepper">
              <button type="button" onClick={() => setLots(Math.max(1, lots - 1))} aria-label="Fewer lots">−</button>
              <input value={lots} inputMode="numeric" onChange={(e) => setLots(Math.min(maxLots, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
              <button type="button" onClick={() => setLots(Math.min(maxLots, lots + 1))} aria-label="More lots">+</button>
            </span>
          </label>
          <span>Blocks <b>{formatINR(lotCost * lots, 0)}</b></span>
          <button className="place-button buy" type="button" disabled={busy} onClick={() => void act({ kind: 'IPO_APPLY', ipoId: ipo.id, lots })}>{ipo.application ? 'Change bid' : 'Bid'}</button>
          {ipo.application && <button className="text-button" type="button" disabled={busy} onClick={() => void act({ kind: 'IPO_WITHDRAW', ipoId: ipo.id })}>Withdraw</button>}
        </div>
      )}
      {ipo.application && <p className="bid-note">Your bid: {ipo.application.lots} lot{ipo.application.lots > 1 ? 's' : ''}, {formatINR(ipo.application.reservedPaise, 0)} blocked{ipo.allottedLots !== null ? ` · allotted ${ipo.allottedLots ? `${ipo.allottedLots * ipo.lotSize} shares` : 'nothing (refunded)'}` : ''}.</p>}
    </article>
  );
}

/** Listed IPO shares trade on the stock order book (next-day fills, T+1). */
function ListedTicket({ career, ipo }: { career: CareerView; ipo: IpoState }) {
  const placeOrder = useGame((s) => s.placeOrder);
  const busy = useGame((s) => s.busy);
  const held = career.positions.find((p) => p.instrumentId === ipo.id);
  const [qty, setQty] = useState(String(held?.qty ?? ipo.lotSize));
  const [done, setDone] = useState<string | null>(null);
  const pnl = held ? held.valuePaise - held.costBasisPaise : 0;
  async function go(side: 'BUY' | 'SELL') {
    setDone(null);
    try {
      await placeOrder({ desk: 'STOCKS', instrumentId: ipo.id, side, type: 'MARKET', qty: Number(qty) });
      setDone(`Market ${side.toLowerCase()} order placed. It fills at the next trading day’s open.`);
    } catch {
      /* shown in the error banner */
    }
  }
  return (
    <aside className="order-panel panel">
      <div className="panel-title-row"><div><p className="eyebrow">Trade after listing</p><h2>{ipo.id}</h2></div></div>
      {held ? <p>You hold <b>{held.qty}</b> shares worth <b>{formatINR(held.valuePaise, 0)}</b> <span className={pnl >= 0 ? 'up' : 'down'}>({formatSignedINR(pnl, 0)})</span>.</p> : <p className="muted">You don’t hold any. You can still buy on the market.</p>}
      <label>Quantity<input value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></label>
      <div className="form-row">
        <button className="place-button buy" type="button" disabled={busy || !Number(qty) || Boolean(career.halt)} onClick={() => void go('BUY')}>Buy</button>
        <button className="place-button sell" type="button" disabled={busy || !held || !Number(qty) || Boolean(career.halt)} onClick={() => void go('SELL')}>Sell</button>
      </div>
      <small className="muted">Orders fill at the next trading day’s open, like any stock. Sale money arrives T+1.</small>
      {done && <p className="success-message" role="status">✓ {done}</p>}
    </aside>
  );
}
