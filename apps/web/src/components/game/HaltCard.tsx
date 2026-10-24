'use client';

import { useEffect, useRef } from 'react';
import type { CareerView, Halt } from '@ms/engine';
import { BREAKER_INDEX, STOCKS } from '@ms/content/universe';
import { formatINR, formatPct, tone } from '@ms/ui/format';

interface Props {
  halt: Halt;
  career: CareerView;
  busy: boolean;
  onContinue: () => void;
  onReview: () => void;
}

/** design.md §7: reason, your portfolio today, worst holding, and what you can do next. */
export function HaltCard({ halt, career, busy, onContinue, onReview }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal(); // no close() on cleanup: Strict Mode would fire onClose
  }, []);

  const dayChange = career.netWorthPrevPaise ? (career.netWorthPaise - career.netWorthPrevPaise) / career.netWorthPrevPaise : 0;
  // India holdings only: the breaker halts Indian markets.
  const worst = career.positions
    .filter((p) => career.prices[p.instrumentId]?.date === career.date && !p.quote && !p.unitScale)
    .map((p) => {
      const bar = career.prices[p.instrumentId]!;
      return { symbol: STOCKS.find((s) => s.id === p.instrumentId)?.symbol ?? p.instrumentId, move: (bar.c - bar.prevClose) / bar.prevClose };
    })
    .sort((a, b) => a.move - b.move)[0];

  return (
    // Escape would leave the player behind a modal-less halt; the "Review holdings" button is the way out.
    <dialog ref={dialog} className="halt-card" aria-labelledby="halt-title" onCancel={(e) => e.preventDefault()}>
      <div className="halt-icon" aria-hidden="true">Ⅱ</div>
      <p className="eyebrow">Market-wide circuit breaker</p>
      <h2 id="halt-title">Market halted</h2>
      <p>{BREAKER_INDEX.name} fell <strong>{Math.abs(halt.indexMovePct).toFixed(1)}%</strong> today. The {halt.levelPct}% market-wide circuit breaker has paused trading. Open orders wait until the market reopens.</p>
      <div className="halt-stats">
        <span><small>Your net worth today</small><b className={tone(dayChange)}>{formatPct(dayChange)}</b><em>{formatINR(career.netWorthPaise, 0)}</em></span>
        <span><small>Worst holding</small>{worst ? <><b className={tone(worst.move)}>{worst.symbol} {formatPct(worst.move)}</b></> : <b>No holdings</b>}</span>
      </div>
      <div className="halt-lesson"><span>Why this happens</span>Circuit breakers force a pause when prices fall too far, too fast, so people decide with a clearer head instead of in a panic.</div>
      <div className="halt-actions">
        <button className="secondary-button" onClick={onReview}>Review holdings</button>
        <button className="primary-button" onClick={onContinue} disabled={busy}>Continue when market reopens →</button>
      </div>
    </dialog>
  );
}
