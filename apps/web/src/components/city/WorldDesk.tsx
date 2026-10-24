'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { CareerView, Desk } from '@ms/engine';
import { INDICES, SECTORS, STOCKS } from '@ms/content/universe';
import { arrow, formatINR, formatNumber, formatPct, tone } from '@ms/ui/format';
import { allocation } from '@/lib/portfolio';
import { useGame } from '@/store/game';
import { layoutCity, towerState } from './cityModel';
import { MarketWire, ReadoutPanel, SectorHeatmap, Spark, WorthPanel, useCountUp, useDashboard, type DashData } from './Dashboard';

const MarketCity = dynamic(() => import('./MarketCity'), { ssr: false, loading: () => <CityPoster label="Building the city…" /> });

const LAYOUT = layoutCity(STOCKS, SECTORS);
const MAX_W = Math.max(...STOCKS.map((s) => s.indexWeight));
const PREF = 'ms-city-3d';

const HEADLINE: Record<CareerView['regime'], string> = {
  CALM: 'The city is calm tonight',
  EUPHORIA: 'Every window is lit',
  STRESSED: 'Tension is building across the districts',
  CRISIS: 'The lights are going out',
  RECOVERY: 'The city is waking up',
};

function CityPoster({ label }: { label: string }) {
  return (
    <div className="city-poster">
      <span>{label}</span>
    </div>
  );
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** World desk: the Market City (3D), an HTML inspector that carries every number, and the portfolio cards. */
export function WorldDesk({ career, onTrade, onDesk }: { career: CareerView; onTrade: (id: string) => void; onDesk: (desk: Desk) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [plazaKey, setPlazaKey] = useState(0);
  const [threeD, setThreeD] = useState<boolean | null>(null);
  const advance = useGame((s) => s.advance);
  const busy = useGame((s) => s.busy);
  const dash = useDashboard(career.id, career.stateVersion);

  // Client-only preference (localStorage) + capability check; resolved after mount to keep SSR stable.
  useEffect(() => {
    let pref: string | null = null;
    try {
      pref = localStorage.getItem(PREF);
    } catch {
      /* storage blocked: default on */
    }
    const ok = webglAvailable();
    queueMicrotask(() => setThreeD(ok && pref !== 'off'));
  }, []);
  const toggle3D = () => {
    const next = !threeD;
    setThreeD(next);
    try {
      localStorage.setItem(PREF, next ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  };

  const [mainDef, bankDef] = INDICES as [(typeof INDICES)[number], (typeof INDICES)[number]];
  const nifty = career.indices[mainDef.id]!;
  const bank = career.indices[bankDef.id]!;
  const niftyMove = (nifty.level - nifty.prevLevel) / nifty.prevLevel;
  const bankMove = (bank.level - bank.prevLevel) / bank.prevLevel;

  return (
    <div className="world-desk">
      <div className="dash-top">
        <WorthPanel career={career} data={dash} />
        <ReadoutPanel career={career} data={dash} />
      </div>
      <section className="city-card panel" aria-labelledby="city-title" data-tour="city">
        <header className="city-head">
          <div>
            <p className="eyebrow">Market City · {career.regime.toLowerCase()}</p>
            <h1 id="city-title">{career.halt ? 'Trading is halted' : HEADLINE[career.regime]}</h1>
          </div>
          <div className="city-indices">
            <span>{mainDef.name} <b>{formatNumber(nifty.level)}</b> <em className={tone(niftyMove)}>{arrow(niftyMove)}{formatPct(niftyMove)}</em></span>
            <span>{bankDef.name} <b>{formatNumber(bank.level)}</b> <em className={tone(bankMove)}>{arrow(bankMove)}{formatPct(bankMove)}</em></span>
          </div>
          <div className="city-actions">
            {threeD && <button className="text-button" type="button" onClick={() => { setSelected(null); setPlazaKey((k) => k + 1); }}>Exchange Square</button>}
            {threeD && <button className="text-button" type="button" onClick={() => { setSelected(null); setResetKey((k) => k + 1); }}>Reset view</button>}
            <button className="toggle-3d" type="button" aria-pressed={!!threeD} onClick={toggle3D}>3D {threeD ? 'on' : 'off'}</button>
            <button className="primary-button" type="button" disabled={busy || !!career.halt} onClick={() => void advance(1)}>Next day →</button>
          </div>
        </header>

        <div className={`city-stage ${threeD ? '' : 'flat'}`}>
          {threeD === null ? (
            <CityPoster label="" />
          ) : threeD ? (
            <MarketCity career={career} selectedId={selected} onSelect={setSelected} resetKey={resetKey} plazaKey={plazaKey} />
          ) : (
            <DistrictList career={career} selected={selected} onSelect={setSelected} />
          )}
          <Inspector career={career} selectedId={selected} onSelect={setSelected} onTrade={onTrade} threeD={!!threeD} />
        </div>

        <p className="city-legend">
          <span><i className="lg-height" />Height = company size</span>
          <span><i className="lg-roof" />Roof = today’s move</span>
          <span><i className="lg-windows" />Lit windows = trading volume</span>
          <span><i className="lg-district" />Blocks = sectors</span>
        </p>
      </section>

      <MarketsStrip career={career} onDesk={onDesk} sparks={dash?.sparks ?? {}} />
      <div className="dash-mid">
        <SectorHeatmap career={career} onTrade={onTrade} />
        <MarketWire />
      </div>
      <PortfolioCards career={career} onTrade={onTrade} />
    </div>
  );
}

function Inspector({ career, selectedId, onSelect, onTrade, threeD }: { career: CareerView; selectedId: string | null; onSelect: (id: string | null) => void; onTrade: (id: string) => void; threeD: boolean }) {
  const inst = selectedId ? STOCKS.find((s) => s.id === selectedId) : undefined;
  const groups = useMemo(() => LAYOUT.districts.map((d) => ({ name: d.name, ids: d.members })), []);
  const jump = (
    <label className="city-jump">
      Jump to a stock
      <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value || null)}>
        <option value="">Choose…</option>
        {groups.map((g) => (
          <optgroup key={g.name} label={g.name}>
            {g.ids.map((id) => <option key={id} value={id}>{STOCKS.find((s) => s.id === id)!.symbol}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );

  if (!inst) {
    return (
      <aside className="city-inspector" aria-live="polite">
        <p className="eyebrow">Read the skyline</p>
        <h2>{threeD ? 'Tap a tower' : 'Pick a stock'}</h2>
        <p>Every tower is a company. Districts are sectors, so a shock that hits one industry lights up — or switches off — a whole block.</p>
        {threeD && <p className="muted">Drag to orbit · scroll or pinch to zoom.</p>}
        {jump}
      </aside>
    );
  }

  const bar = career.prices[inst.id]!;
  const st = towerState(inst, bar, MAX_W);
  const held = career.positions.find((p) => p.instrumentId === inst.id);
  const vol = st.volRatio > 0 ? `${st.volRatio.toFixed(1)}× a normal day` : 'No trading yet';
  return (
    <aside className="city-inspector" aria-live="polite">
      <p className="eyebrow">{SECTORS[inst.sector]?.name}</p>
      <h2>{inst.name}</h2>
      <p className="inspector-price">
        <strong>{formatINR(bar.c)}</strong>
        <em className={tone(st.move)}>{arrow(st.move)}{formatPct(st.move)}</em>
      </p>
      <dl>
        <dt>Today</dt><dd>{formatINR(bar.l)} – {formatINR(bar.h)}</dd>
        <dt>Volume</dt><dd>{vol}</dd>
        <dt>Since you started</dt><dd className={tone(bar.c / (career.baseline.prices[inst.id] ?? inst.startPricePaise) - 1)}>{formatPct(bar.c / (career.baseline.prices[inst.id] ?? inst.startPricePaise) - 1)}</dd>
        <dt>You hold</dt><dd>{held ? `${held.qty} shares` : 'None'}</dd>
      </dl>
      <div className="inspector-actions">
        <button className="primary-button" type="button" onClick={() => onTrade(inst.id)}>Trade {inst.symbol} →</button>
        <button className="text-button" type="button" onClick={() => onSelect(null)}>Close</button>
      </div>
      {jump}
    </aside>
  );
}

/** 3D OFF / no WebGL: the same city as a plain list of districts. */
function DistrictList({ career, selected, onSelect }: { career: CareerView; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="district-list">
      {LAYOUT.districts.map((d) => (
        <section key={d.id} aria-label={d.name}>
          <h3>{d.name}</h3>
          {d.members.map((id) => {
            const b = career.prices[id]!;
            const move = b.prevClose ? (b.c - b.prevClose) / b.prevClose : 0;
            return (
              <button key={id} type="button" className={selected === id ? 'selected' : ''} onClick={() => onSelect(id)}>
                <span>{STOCKS.find((s) => s.id === id)!.symbol}</span>
                <em className={tone(move)}>{formatPct(move)}</em>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function PortfolioCards({ career, onTrade }: { career: CareerView; onTrade: (id: string) => void }) {
  const parts = allocation(career);
  const invested = parts.reduce((sum, p) => sum + p.paise, 0);
  const cash = career.netWorthPaise - invested;
  const movers = STOCKS.map((stock) => {
    const bar = career.prices[stock.id]!;
    return { stock, move: bar.prevClose ? (bar.c - bar.prevClose) / bar.prevClose : 0, price: bar.c };
  })
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
    .slice(0, 5);
  return (
    <div className="world-cards">
      <section className="allocation-card panel">
        <div><p className="eyebrow">Your money across desks</p><h2>{parts.length ? `${Math.round((invested / Math.max(1, career.netWorthPaise)) * 100)}% invested` : 'All cash'}</h2></div>
        <div className="allocation-bar stacked" role="img" aria-label={[...parts.map((p) => `${p.label} ${formatINR(p.paise, 0)}`), `Cash ${formatINR(cash, 0)}`].join(', ')}>
          {parts.map((p) => <i key={p.desk} className={`seg-${p.desk.toLowerCase()}`} style={{ width: `${(p.paise / Math.max(1, career.netWorthPaise)) * 100}%` }} />)}
        </div>
        <ul className="allocation-legend">
          {parts.map((p) => <li key={p.desk}><i className={`seg-${p.desk.toLowerCase()}`} />{p.label}<b>{formatINR(p.paise, 0)}</b></li>)}
          <li><i className="seg-cash" />Cash<b>{formatINR(cash, 0)}</b></li>
        </ul>
      </section>
      <section className="movers-card panel">
        <div><p className="eyebrow">Largest moves today</p><h2>Market movers</h2></div>
        {movers.map(({ stock, move, price }) => (
          <button key={stock.id} type="button" onClick={() => onTrade(stock.id)}>
            <span><b>{stock.symbol}</b><small>{stock.name}</small></span>
            <span>{formatINR(price)} <b className={tone(move)}>{formatPct(move)}</b></span>
          </button>
        ))}
      </section>
    </div>
  );
}

/** One live quote per desk, so the World desk is a dashboard for the whole wallet. Click to open the desk. */
function MarketsStrip({ career, onDesk, sparks }: { career: CareerView; onDesk: (desk: Desk) => void; sparks: DashData['sparks'] }) {
  const q = (id: string) => {
    const b = career.prices[id];
    return b ? { c: b.c, move: b.prevClose ? (b.c - b.prevClose) / b.prevClose : 0 } : { c: 0, move: 0 };
  };
  const openIpo = career.ipos.find((i) => i.status === 'OPEN' || i.status === 'UPCOMING');
  const live = career.forecasts.filter((f) => f.status === 'OPEN').length;
  const tiles: { desk: Desk; label: string; value: string; move?: number; note?: string; spark?: number[]; num?: { v: number; fmt: (n: number) => string } }[] = [
    { desk: 'COMMODITIES', label: 'Gold ETF', value: '', num: { v: q('INGOT').c, fmt: (n) => formatINR(Math.round(n)) }, move: q('INGOT').move, spark: sparks.INGOT },
    { desk: 'COMMODITIES', label: 'Crude oil fund', value: '', num: { v: q('BARREL').c, fmt: (n) => formatINR(Math.round(n)) }, move: q('BARREL').move, spark: sparks.BARREL },
    { desk: 'GLOBAL', label: 'Frontier 500 (US)', value: '', num: { v: q('FRONT500').c, fmt: (n) => `$${(n / 100).toFixed(2)}` }, move: q('FRONT500').move, note: `₹${career.macro.usdInr.toFixed(2)}/$`, spark: sparks.FRONT500 },
    { desk: 'CRYPTO', label: 'Coinstone', value: '', num: { v: q('CSTN').c, fmt: (n) => `$${Math.round(n / 100).toLocaleString('en-US')}` }, move: q('CSTN').move, spark: sparks.CSTN },
    { desk: 'FIXED_INCOME', label: 'Policy rate', value: `${career.macro.policyRate.toFixed(2)}%`, note: `10-yr ${career.macro.yields.y10.toFixed(2)}%` },
    { desk: 'FUNDS', label: 'Index fund NAV', value: '', num: { v: q('SURV50IDX').c, fmt: (n) => formatINR(Math.round(n)) }, move: q('SURV50IDX').move, spark: sparks.SURV50IDX },
    { desk: 'IPO', label: 'IPOs', value: openIpo ? openIpo.id : 'None open', note: openIpo ? (openIpo.status === 'OPEN' ? `${openIpo.subscription.toFixed(1)}× subscribed` : 'opens soon') : 'next one soon' },
    { desk: 'PREDICTION', label: 'Forecasts', value: `${live} open`, note: 'coins only' },
  ];
  return (
    <section className="markets-strip" aria-label="Markets across desks">
      {tiles.map((t) => {
        const locked = !career.unlockedDesks.includes(t.desk);
        return (
          <button key={t.label} type="button" className={`market-tile tile-${t.desk.toLowerCase()} ${locked ? 'locked' : ''}`} onClick={() => onDesk(t.desk)}>
            <small>{t.label}</small>
            <b>{t.num ? <CountUp v={t.num.v} fmt={t.num.fmt} /> : t.value}</b>
            {t.spark && <Spark points={t.spark} />}
            {t.move !== undefined ? <em className={tone(t.move)}>{arrow(t.move)}{formatPct(t.move)}</em> : <em className="muted">{t.note}</em>}
            {t.move !== undefined && t.note && <i className="muted">{t.note}</i>}
          </button>
        );
      })}
    </section>
  );
}

function CountUp({ v, fmt }: { v: number; fmt: (n: number) => string }) {
  return <>{fmt(useCountUp(v))}</>;
}
