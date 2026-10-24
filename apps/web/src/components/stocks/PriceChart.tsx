'use client';

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { formatNumber, formatPct, formatQuote, tone } from '@ms/ui/format';
import { api } from '@/lib/api';

type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number };

const RANGES = [
  { label: '1M', bars: 22 },
  { label: '3M', bars: 66 },
  { label: '6M', bars: 130 },
  { label: '1Y', bars: 250 },
  { label: '2Y', bars: 520 },
] as const;

const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Daily candles + volume from the career's own history (lightweight-charts, Apache-2.0; attribution logo kept).
 * Reloads when the world clock moves (stateVersion). Colours come from the live tokens, so colour-blind mode applies.
 */
export function PriceChart({ careerId, instrumentId, symbol, stateVersion, quote = 'INR' }: { careerId: string; instrumentId: string; symbol: string; stateVersion: number; quote?: 'INR' | 'USD' }) {
  const formatINR = (p: number) => formatQuote(p, quote);
  const quoteRef = useRef(quote);
  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<{ api: IChartApi; candles: ISeriesApi<'Candlestick'>; volume: ISeriesApi<'Histogram'> } | null>(null);
  const [data, setData] = useState<Candle[] | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]['label']>('3M');
  /** Index into `data` of the candle under the crosshair (null = show the latest). */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Build the chart once.
  useEffect(() => {
    let disposed = false;
    void import('lightweight-charts').then(({ createChart, CandlestickSeries, HistogramSeries, CrosshairMode }) => {
      if (disposed || !host.current) return;
      const up = cssVar('--up');
      const down = cssVar('--down');
      const api = createChart(host.current, {
        autoSize: true,
        layout: { background: { color: 'transparent' }, textColor: cssVar('--mist-400'), fontFamily: getComputedStyle(document.body).fontFamily, fontSize: 12 },
        grid: { vertLines: { color: 'rgba(42,42,49,.35)' }, horzLines: { color: 'rgba(42,42,49,.55)' } },
        rightPriceScale: { borderColor: cssVar('--ink-600') },
        timeScale: { borderColor: cssVar('--ink-600'), rightOffset: 3, barSpacing: 9 },
        crosshair: { mode: CrosshairMode.Normal },
        localization: { priceFormatter: (p: number) => formatQuote(p * 100, quoteRef.current) },
      });
      const candles = api.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
      const volume = api.addSeries(HistogramSeries, { priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } });
      // The chart's own bar copy has rupee prices and no volume, so look our candle up by index instead.
      api.subscribeCrosshairMove((param) => {
        setHoverIdx(param.time !== undefined && param.logical !== undefined ? Math.round(param.logical) : null);
      });
      chart.current = { api, candles, volume };
      setData((d) => d && [...d]); // re-apply anything that arrived before the chart was ready
    });
    return () => {
      disposed = true;
      chart.current?.api.remove();
      chart.current = null;
    };
  }, []);

  // (Re)load history whenever the stock or the world clock changes.
  useEffect(() => {
    let live = true;
    api.history(careerId, instrumentId, 800).then(
      (r) => live && setData(r.candles),
      () => live && setData([]),
    );
    return () => {
      live = false;
    };
  }, [careerId, instrumentId, stateVersion]);

  // Push data and range into the chart.
  useEffect(() => {
    const c = chart.current;
    if (!c || !data) return;
    const up = cssVar('--up');
    const down = cssVar('--down');
    // Coins under a dollar need more than two decimals on the price scale.
    const lastClose = data.at(-1)?.close ?? 0;
    const precision = lastClose >= 100 ? 2 : lastClose >= 1 ? 4 : 6;
    c.candles.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } });
    c.candles.setData(data.map((k) => ({ time: k.time as Time, open: k.open / 100, high: k.high / 100, low: k.low / 100, close: k.close / 100 })));
    c.volume.setData(data.map((k) => ({ time: k.time as Time, value: k.volume, color: k.close >= k.open ? `${up}55` : `${down}55` })));
    const bars = RANGES.find((r) => r.label === range)!.bars;
    if (data.length) c.api.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - bars) - 0.5, to: data.length - 0.5 + 3 });
  }, [data, range]);

  const last = data?.at(-1);
  const shown = (hoverIdx !== null ? data?.[hoverIdx] : undefined) ?? last ?? null;
  const first = data && data.length ? data[Math.max(0, data.length - RANGES.find((r) => r.label === range)!.bars)] : null;
  const rangeMove = first && last ? (last.close - first.open) / first.open : 0;
  const summary = data && data.length > 1 && first && last
    ? `${symbol} daily candles, ${range}: from ${formatINR(first.open)} to ${formatINR(last.close)}, ${formatPct(rangeMove)}.`
    : `${symbol} price chart. Not enough history yet.`;

  return (
    <div className="price-chart" data-tour="chart">
      <div className="chart-toolbar">
        <div className="chart-legend" aria-live="off">
          {shown ? (
            <>
              <span>{shown.time}</span>
              <span>O <b>{formatINR(shown.open)}</b></span>
              <span>H <b>{formatINR(shown.high)}</b></span>
              <span>L <b>{formatINR(shown.low)}</b></span>
              <span>C <b className={tone((shown.close - shown.open) / shown.open)}>{formatINR(shown.close)}</b></span>
              <span>Vol <b>{formatNumber(shown.volume)}</b></span>
            </>
          ) : (
            <span>Loading history…</span>
          )}
        </div>
        <div className="range-tabs" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.label} type="button" className={range === r.label ? 'active' : ''} aria-pressed={range === r.label} onClick={() => setRange(r.label)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-host" ref={host} role="img" aria-label={summary} />
      {data && data.length < 2 && (
        <p className="chart-empty">Advance a few trading days and the candles build up here. Each candle is one day: open, high, low, close.</p>
      )}
      {data && data.length > 1 && <p className="chart-caption"><span className={tone(rangeMove)}>{formatPct(rangeMove)}</span> over {range} · drag to scroll, scroll to zoom</p>}
    </div>
  );
}
