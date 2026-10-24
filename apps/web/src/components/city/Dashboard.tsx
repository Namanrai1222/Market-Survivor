'use client';

// World desk dashboard pieces (design-library-pro: count-up numbers from real values — Lume DL-024; live
// readout panel — Smooothy DL-001; asset rail with trails — Encrypto DL-043; hover focus with neighbours
// dimmed — Lunoa DL-014; uneven bento — Luma DL-023). Everything is game data; nothing decorative is invented.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { CareerView } from '@ms/engine';
import { defaultConfig as cfg, isOpen } from '@ms/engine';
import { BREAKER_INDEX, SECTORS, STOCKS } from '@ms/content/universe';
import { formatDate, formatINR, formatPct, tone } from '@ms/ui/format';
import { api } from '@/lib/api';
import { useGame } from '@/store/game';

type Series = { time: string; value: number }[];
export interface DashData {
  worth: Series;
  index: Series;
  sparks: Record<string, number[]>;
}

/** Fetch the dashboard series again whenever the world moves. */
export function useDashboard(careerId: string, stateVersion: number): DashData | null {
  const [data, setData] = useState<DashData | null>(null);
  useEffect(() => {
    let live = true;
    api.dashboard(careerId).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [careerId, stateVersion]);
  return data;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tween a number toward `target` (~0.7 s, expo-out); jumps straight there under reduced motion. */
export function useCountUp(target: number, ms = 700): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = target;
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const a = from.current;
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const v = a + (target - a) * e;
      from.current = v;
      setShown(v);
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return shown;
}

export function Spark({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return <svg className={`spark ${className ?? ''}`} viewBox="0 0 100 28" aria-hidden="true" />;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * 100).toFixed(2)},${(26 - ((p - lo) / span) * 24).toFixed(2)}`).join(' ');
  const up = points.at(-1)! >= points[0]!;
  return (
    <svg className={`spark ${up ? 'up' : 'down'} ${className ?? ''}`} viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L100,28 L0,28 Z`} className="spark-fill" />
      <path d={d} className="spark-line" pathLength={1} />
    </svg>
  );
}

const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const RANGES = [
  { label: '1M', days: 31 },
  { label: '3M', days: 92 },
  { label: '6M', days: 183 },
  { label: 'All', days: 100_000 },
] as const;

/** Your net worth since day one against the index, both as % change: the one chart that answers "am I winning?". */
export function WorthPanel({ career, data }: { career: CareerView; data: DashData | null }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<{ api: IChartApi; you: ISeriesApi<'Area'>; idx: ISeriesApi<'Line'> } | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]['label']>('All');
  const [hover, setHover] = useState<{ time: string; you: number; idx: number } | null>(null);
  const worth = useCountUp(career.netWorthPaise);
  const ret = career.netWorthPaise / cfg.startingTreasuryPaise - 1;
  const idxNow = career.indices[BREAKER_INDEX.id]!.level;
  const idxRet = idxNow / (career.baseline.indices[BREAKER_INDEX.id] ?? idxNow) - 1;
  const dayMove = career.netWorthPrevPaise ? career.netWorthPaise / career.netWorthPrevPaise - 1 : 0;

  // % series from day one; the index is rebased to the same start so the lines are comparable.
  const series = useMemo(() => {
    if (!data?.worth.length) return null;
    const base = cfg.startingTreasuryPaise;
    const start = data.worth[0]!.time;
    const idxStart = career.baseline.indices[BREAKER_INDEX.id] ?? data.index.find((p) => p.time >= start)?.value ?? 1;
    return {
      you: data.worth.map((p) => ({ time: p.time, value: (p.value / base - 1) * 100 })),
      idx: data.index.filter((p) => p.time >= start).map((p) => ({ time: p.time, value: (p.value / idxStart - 1) * 100 })),
    };
  }, [data, career.baseline.indices]);

  useEffect(() => {
    let disposed = false;
    void import('lightweight-charts').then(({ createChart, AreaSeries, LineSeries, CrosshairMode }) => {
      if (disposed || !host.current) return;
      const mg = cssVar('--champagne-500');
      const apiChart = createChart(host.current, {
        autoSize: true,
        layout: { background: { color: 'transparent' }, textColor: cssVar('--mist-400'), fontFamily: getComputedStyle(document.body).fontFamily, fontSize: 11 },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42,42,49,.45)' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        crosshair: { mode: CrosshairMode.Magnet },
        localization: { priceFormatter: (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%` },
        handleScroll: false,
        handleScale: false,
      });
      const you = apiChart.addSeries(AreaSeries, { lineColor: mg, topColor: `${mg}55`, bottomColor: `${mg}00`, lineWidth: 2, priceLineVisible: false });
      const idx = apiChart.addSeries(LineSeries, { color: cssVar('--mist-400'), lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      apiChart.subscribeCrosshairMove((p) => {
        const a = p.seriesData.get(you) as { value?: number } | undefined;
        const b = p.seriesData.get(idx) as { value?: number } | undefined;
        setHover(p.time && a?.value !== undefined ? { time: String(p.time), you: a.value, idx: b?.value ?? 0 } : null);
      });
      chart.current = { api: apiChart, you, idx };
      setRange((r) => r); // re-run the data effect now the chart exists
    });
    return () => {
      disposed = true;
      chart.current?.api.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const c = chart.current;
    if (!c || !series) return;
    c.you.setData(series.you.map((p) => ({ time: p.time as Time, value: p.value })));
    c.idx.setData(series.idx.map((p) => ({ time: p.time as Time, value: p.value })));
    const days = RANGES.find((r) => r.label === range)!.days;
    const last = series.you.at(-1)!.time;
    const first = new Date(Date.parse(last) - days * 86_400_000).toISOString().slice(0, 10);
    const frame = () => (range === 'All' || first <= series.you[0]!.time ? c.api.timeScale().fitContent() : c.api.timeScale().setVisibleRange({ from: first as Time, to: last as Time }));
    frame();
    // Keep the chosen range framed when the panel changes width (rotation, sidebar, window resize).
    const ro = new ResizeObserver(() => frame());
    if (host.current) ro.observe(host.current);
    return () => ro.disconnect();
  }, [series, range]);

  const shown = hover ?? { time: career.date, you: ret * 100, idx: idxRet * 100 };
  return (
    <section className="worth-panel panel" aria-labelledby="worth-title">
      <header>
        <div>
          <p className="eyebrow">Net worth · since day one</p>
          {/* keyed by day: the figure flashes the day's direction as it lands */}
          <h2 id="worth-title" key={career.date} className={`worth-figure tick-${tone(dayMove)}`}>{formatINR(Math.round(worth), 0)}</h2>
          <p className="worth-sub">
            <b className={tone(dayMove)}>{formatPct(dayMove)}</b> today · <b className={tone(ret)}>{formatPct(ret, 1)}</b> overall
          </p>
        </div>
        <div className="range-tabs" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.label} type="button" className={range === r.label ? 'active' : ''} aria-pressed={range === r.label} onClick={() => setRange(r.label)}>{r.label}</button>
          ))}
        </div>
      </header>
      <div className="worth-legend" aria-live="off">
        <span><i className="dot you" />You <b className={tone(shown.you / 100)}>{formatPct(shown.you / 100, 1)}</b></span>
        <span><i className="dot idx" />{BREAKER_INDEX.name} <b className={tone(shown.idx / 100)}>{formatPct(shown.idx / 100, 1)}</b></span>
        <span className="muted">{formatDate(shown.time)}</span>
      </div>
      <div className="worth-chart" ref={host} role="img" aria-label={`Your net worth is ${formatPct(ret, 1)} since day one; the ${BREAKER_INDEX.name} is ${formatPct(idxRet, 1)}.`} />
      {series && series.you.length < 3 && <p className="chart-empty">Your line starts today. Advance a few days and it draws itself against the index.</p>}
    </section>
  );
}

/** Live readout of the world: regime, fear (from the index's real 20-day volatility), rates, rupee, which markets are open. */
export function ReadoutPanel({ career, data }: { career: CareerView; data: DashData | null }) {
  const m = career.macro;
  const fear = useMemo(() => {
    const pts = data?.index.slice(-21).map((p) => p.value) ?? [];
    if (pts.length < 6) return null;
    const rets = pts.slice(1).map((v, i) => Math.log(v / pts[i]!));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
    return sd * Math.sqrt(250) * 100;
  }, [data]);
  const fearShown = useCountUp(fear ?? 0);
  // Annualised 20-day index volatility; this world runs a little hotter than a real large-cap index.
  const level = fear === null ? 'quiet' : fear < 18 ? 'calm' : fear < 28 ? 'nervous' : fear < 40 ? 'fearful' : 'panic';
  const open = (mk: 'IN' | 'US') => isOpen(mk, career.date, cfg.calendars) && !(mk === 'IN' && career.halt);
  const inflation = (career.cpiIndex - 1) * 100;
  return (
    <section className={`readout panel fear-${level}`} aria-label="World readout">
      <p className="eyebrow">World readout · {formatDate(career.date)}</p>
      <div className="fear">
        <div className="fear-dial" style={{ ['--fear' as string]: `${Math.min(100, ((fear ?? 0) / 50) * 100)}%` }} aria-hidden="true" />
        <div>
          <small>Fear gauge</small>
          <b>{fear === null ? '—' : fearShown.toFixed(0)}</b>
          <span>{level}</span>
        </div>
      </div>
      <dl className="readout-grid">
        <div><dt>Regime</dt><dd>{career.halt ? 'Halted' : career.regime.toLowerCase()}</dd></div>
        <div><dt>Policy rate</dt><dd>{m.policyRate.toFixed(2)}%</dd></div>
        <div><dt>10-yr yield</dt><dd>{m.yields.y10.toFixed(2)}%</dd></div>
        <div><dt>USD/INR</dt><dd>₹{m.usdInr.toFixed(2)}</dd></div>
        <div><dt>Inflation since start</dt><dd>{inflation.toFixed(1)}%</dd></div>
        <div><dt>Next policy meeting</dt><dd>{formatDate(m.nextPolicyMeeting).replace(/ \d{4}$/, '')}</dd></div>
      </dl>
      <ul className="market-lights" aria-label="Markets open today">
        <li className={open('IN') ? 'on' : ''}><i />India {career.halt ? 'halted' : open('IN') ? 'open' : 'closed'}</li>
        <li className={open('US') ? 'on' : ''}><i />US {open('US') ? 'open' : 'closed'}</li>
        <li className="on"><i />Crypto 24/7</li>
      </ul>
    </section>
  );
}

/** Sectors sized by index weight, coloured by today's move. Hover dims the rest; click trades the sector's leader. */
export function SectorHeatmap({ career, onTrade }: { career: CareerView; onTrade: (id: string) => void }) {
  const cells = useMemo(() => {
    const by = new Map<string, { w: number; m: number; lead: string; leadW: number }>();
    for (const s of STOCKS) {
      const b = career.prices[s.id];
      if (!b) continue;
      const move = b.prevClose ? b.c / b.prevClose - 1 : 0;
      const c = by.get(s.sector) ?? { w: 0, m: 0, lead: s.id, leadW: 0 };
      c.m += move * s.indexWeight;
      c.w += s.indexWeight;
      if (s.indexWeight > c.leadW) [c.lead, c.leadW] = [s.id, s.indexWeight];
      by.set(s.sector, c);
    }
    return [...by.entries()].map(([id, c]) => ({ id, name: SECTORS[id]?.name ?? id, weight: c.w, move: c.w ? c.m / c.w : 0, lead: c.lead })).sort((a, b) => b.weight - a.weight);
  }, [career.prices]);
  return (
    <section className="heatmap panel" aria-labelledby="heat-title">
      <header><p className="eyebrow">Today by sector</p><h2 id="heat-title">Sector heatmap</h2></header>
      <div className="heat-grid">
        {cells.map((c, i) => {
          const strength = Math.min(1, Math.abs(c.move) / 0.03);
          return (
            <button
              key={`${c.id}-${career.date}`} /* remount per day: the cell flashes its new colour in */
              type="button"
              className={`heat-cell ${tone(c.move)}`}
              style={{ flexGrow: c.weight, ['--i' as string]: i, ['--heat' as string]: `${Math.round(18 + strength * 62)}%` }}
              onClick={() => onTrade(c.lead)}
              title={`Trade ${c.lead}`}
            >
              <span>{c.name}</span>
              <b>{formatPct(c.move, 1)}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const LEVEL_LABEL = { INFO: 'Info', WATCH: 'Watch', WARNING: 'Warning', CRITICAL: 'Critical', HALT: 'Halt' } as const;

/** The latest world news and desk notices, newest first. */
export function MarketWire() {
  const alerts = useGame((s) => s.alerts);
  return (
    <section className="wire panel" aria-labelledby="wire-title">
      <header><p className="eyebrow">Market wire</p><h2 id="wire-title">Latest</h2></header>
      {alerts.length ? (
        <ol className="wire-list">
          {alerts.slice(0, 8).map((a) => (
            <li key={`${a.date}-${a.level}-${a.message}`} className={`wire-${a.level.toLowerCase()}`}>
              <span className="wire-meta"><i />{LEVEL_LABEL[a.level]} · {formatDate(a.date).replace(/ \d{4}$/, '')}</span>
              <p>{a.message}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted wire-empty">Quiet so far. Headlines, IPO news and alerts land here as the days pass.</p>
      )}
    </section>
  );
}
