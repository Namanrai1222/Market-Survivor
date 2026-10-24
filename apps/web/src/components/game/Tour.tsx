'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Desk } from '@ms/engine';

export interface TourStep {
  target: string;
  title: string;
  body: string;
  /** Desk to show before spotlighting the target. */
  desk?: Desk | 'DASHBOARD';
}

/** The first-visit tour (also on the "?" button). Every target is a `data-tour` attribute in the game. */
export const TOUR_STEPS: TourStep[] = [
  { target: 'treasury', title: 'Your Treasury', body: 'One wallet for every market. Net worth counts cash and holdings. Available is spendable, Blocked is held for open buy orders, Unsettled is sale money that arrives one trading day later.' },
  { target: 'next-day', title: 'The world clock', body: 'The market moves one day each time you press this (or →). Orders you place today fill on the next trading day.' },
  { target: 'desks', title: 'Desks', body: 'Each tab is a market. Stocks is open now; the others unlock as the game grows. Press 1–9 to switch.' },
  { target: 'mode-bar', title: 'Your goal', body: 'Story chapters list their objectives here; Daily Challenge and Time Machine runs show how many days are left.' },
  { target: 'city', desk: 'DASHBOARD', title: 'The Market City', body: 'Every tower is a fictional company and every block a sector. Height is company size, the roof is today’s move, lit windows are trading volume. Click a tower to trade it.' },
  { target: 'chart', desk: 'STOCKS', title: 'Price chart', body: 'Daily candles build up as days pass. Hover a candle for its open, high, low, close and volume.' },
  { target: 'order-ticket', desk: 'STOCKS', title: 'Order ticket', body: 'Choose buy or sell, an order type and a quantity. Charges are estimated before you place anything. Press B or S to jump here.' },
  { target: 'alerts', title: 'Alerts', body: 'Market halts and world events land here (or press A). Replay this tour any time from the ? button.' },
];

const DONE_KEY = 'ms-tour-done';
export function tourDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}

interface Props {
  onDesk: (desk: Desk | 'DASHBOARD') => void;
  onClose: () => void;
}

export function Tour({ onDesk, onClose }: Props) {
  const steps = TOUR_STEPS;
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const iRef = useRef(0);
  const step = steps[i]!;
  useEffect(() => {
    iRef.current = i;
  }, [i]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* ignore */
    }
    onClose();
  }, [onClose]);

  // Switch desk if the step needs it, then measure the target (skipping steps whose target isn't on screen).
  useLayoutEffect(() => {
    if (step.desk) onDesk(step.desk);
    let frame = 0;
    let tries = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        setRect(el.getBoundingClientRect());
      } else if (tries++ < 20) frame = requestAnimationFrame(measure);
      else setI((n) => (n < steps.length - 1 ? n + 1 : n)); // target absent in this mode: skip it
    };
    frame = requestAnimationFrame(measure);
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [step, onDesk, steps.length]);

  useEffect(() => {
    card.current?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Read the step from a ref: closing the tour updates the parent, which must not happen inside a state updater.
      const n = iRef.current;
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (n < steps.length - 1) setI(n + 1);
        else finish();
      } else if (e.key === 'ArrowLeft') setI(Math.max(0, n - 1));
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish, steps.length]);

  const pad = 8;
  const below = rect ? rect.bottom + 220 < window.innerHeight : true;
  const cardTop = rect ? (below ? rect.bottom + pad + 12 : Math.max(12, rect.top - pad - 12 - 200)) : 120;
  const cardLeft = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 352) : 12;

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect && <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />}
      <div ref={card} className="tour-card" tabIndex={-1} style={{ top: cardTop, left: cardLeft }}>
        <p className="eyebrow">Tour · {i + 1} of {steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="text-button" onClick={finish}>Skip tour</button>
          <span>
            {i > 0 && <button type="button" className="secondary-button" onClick={() => setI(i - 1)}>Back</button>}
            <button type="button" className="primary-button" onClick={() => (i < steps.length - 1 ? setI(i + 1) : finish())}>{i < steps.length - 1 ? 'Next' : 'Start playing'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
