'use client';

// Forecasts (the Prediction desk, renamed per legal review L-09): YES/NO questions about in-game data
// only, priced by LMSR, paid in virtual coins. Never real-world events, never prizes.
import { useState } from 'react';
import type { CareerView } from '@ms/engine';
import { tradeCost } from '@ms/engine';
import { formatDate, formatINR, formatSignedINR } from '@ms/ui/format';
import { useGame } from '@/store/game';
import { DeskHero, Fact } from './DeskHero';
import { Empty } from './shared';

type F = CareerView['forecasts'][number];

export function ForecastDesk({ career }: { career: CareerView }) {
  const live = career.forecasts.filter((f) => f.status !== 'RESOLVED');
  const done = career.forecasts.filter((f) => f.status === 'RESOLVED').reverse();
  return (
    <>
      <DeskHero desk="PREDICTION" eyebrow="Forecast challenge" title="Forecasts" lead={`Test your read of the game world. Each share pays ${formatINR(10_000, 0)} in coins if you’re right and nothing if you’re wrong, so the price is the crowd’s probability.`}>
        <Fact label="Open questions" value={live.length} />
        <Fact label="Your shares are worth" value={formatINR(career.forecasts.reduce((a, f) => a + f.valuePaise, 0), 0)} />
      </DeskHero>
      <section className="desk-intro panel">
        <div className="desk-warning" role="note"><b>Coins only, game events only.</b> Every question is about this simulated world (its index, its central bank, its gold and coins). No real-world events, no real money, no prizes.</div>
      </section>
      {live.length ? <section className="forecast-grid">{live.map((f) => <ForecastCard key={f.id} f={f} />)}</section> : <section className="panel"><Empty>New questions open as the clock moves. Advance a day.</Empty></section>}
      {done.length > 0 && (
        <section className="panel desk-list">
          <div className="panel-title-row"><div><p className="eyebrow">Settled</p><h2>Resolved questions</h2></div></div>
          <div className="data-table">
            {done.map((f) => (
              <div key={f.id} className="holding-row">
                <span><b>{f.question}</b><small>Resolved {formatDate(f.resolveDate)}: <em className={`outcome ${f.outcome === 'YES' ? 'up' : 'down'}`}>{f.outcome}</em></small></span>
                <span>{f.payoutPaise ? <b className="up">+{formatINR(f.payoutPaise, 0)}</b> : <small className="muted">{f.costPaise ? 'Shares expired' : 'You didn’t trade'}</small>}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 32;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - p * h).toFixed(1)}`).join(' ');
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true"><line x1="0" x2={w} y1={h / 2} y2={h / 2} /><path d={d} /></svg>;
}

function ForecastCard({ f }: { f: F }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const [shares, setShares] = useState('10');
  const n = Math.max(0, Math.min(1000, Math.floor(Number(shares) || 0)));
  const yesPct = Math.round(f.priceYes * 100);
  const open = f.status === 'OPEN';
  const costYes = n ? tradeCost(f, 'YES', n) : 0;
  const costNo = n ? tradeCost(f, 'NO', n) : 0;
  const pnl = f.valuePaise - f.costPaise;
  return (
    <article className="forecast-card panel">
      <p className="eyebrow">{open ? `Trading until ${formatDate(f.closeDate)}` : `Closed · resolves ${formatDate(f.resolveDate)}`}</p>
      <h2>{f.question}</h2>
      <div className="odds">
        <div className="odds-bar" role="img" aria-label={`${yesPct}% chance of YES`}><i style={{ width: `${yesPct}%` }} /></div>
        <span><b className="up">YES {yesPct}%</b><b className="down">NO {100 - yesPct}%</b></span>
        <Spark points={f.history} />
      </div>
      {(f.yes > 0 || f.no > 0) && (
        <p className="bid-note">You hold {f.yes ? `${f.yes} YES` : ''}{f.yes && f.no ? ' and ' : ''}{f.no ? `${f.no} NO` : ''} · worth {formatINR(f.valuePaise, 0)} at today’s odds <span className={pnl >= 0 ? 'up' : 'down'}>({formatSignedINR(pnl, 0)})</span></p>
      )}
      {open && (
        <div className="forecast-trade">
          <label>Shares<input value={shares} inputMode="numeric" onChange={(e) => setShares(e.target.value.replace(/\D/g, ''))} /></label>
          <button type="button" className="place-button buy" disabled={busy || !n} onClick={() => void act({ kind: 'FORECAST', forecastId: f.id, outcome: 'YES', side: 'BUY', shares: n })}>Buy YES · {formatINR(costYes, 0)}</button>
          <button type="button" className="place-button sell" disabled={busy || !n} onClick={() => void act({ kind: 'FORECAST', forecastId: f.id, outcome: 'NO', side: 'BUY', shares: n })}>Buy NO · {formatINR(costNo, 0)}</button>
          {f.yes > 0 && <button type="button" className="text-button" disabled={busy} onClick={() => void act({ kind: 'FORECAST', forecastId: f.id, outcome: 'YES', side: 'SELL', shares: f.yes })}>Sell my YES</button>}
          {f.no > 0 && <button type="button" className="text-button" disabled={busy} onClick={() => void act({ kind: 'FORECAST', forecastId: f.id, outcome: 'NO', side: 'SELL', shares: f.no })}>Sell my NO</button>}
          <small className="muted">Win: {formatINR(n * 10_000, 0)} back. The more you buy, the higher the price goes (that’s how the market maker prices).</small>
        </div>
      )}
    </article>
  );
}
