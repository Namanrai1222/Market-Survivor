'use client';

import { useEffect, useRef } from 'react';
import { formatPct } from '@ms/ui/format';
import type { SideRun } from '@/lib/api';
import { TIME_MACHINE } from '@/lib/modes';

interface Props {
  current: SideRun | null;
  best: Record<string, number>;
  busy: boolean;
  onStart: (scenarioId: string) => void;
  onContinue: (id: string) => void;
  onClose: () => void;
}

/** Pick a fictional replay. One runs at a time; starting another replaces it. */
export function TimeMachinePicker({ current, best, busy, onStart, onContinue, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal(); // no close() on cleanup: Strict Mode would fire onClose
  }, []);
  const running = current && !current.ended ? TIME_MACHINE.find((t) => t.id === current.run?.scenarioId) : undefined;

  return (
    <dialog ref={dialog} className="tm-picker" aria-labelledby="tm-title" onClose={onClose}>
      <header>
        <div>
          <p className="eyebrow">Time Machine</p>
          <h2 id="tm-title">Survive a famous kind of crash</h2>
          <p className="muted">Each replay borrows the shape of a past market episode. The companies and prices are fictional; this is not real historical data.</p>
        </div>
        <button className="icon-button" type="button" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
      </header>
      {running && current && (
        <div className="tm-current">
          <span>In progress: <b>{running.title}</b> · {current.date}</span>
          <button className="primary-button" type="button" onClick={() => onContinue(current.id)}>Continue replay →</button>
        </div>
      )}
      <ul className="tm-list">
        {TIME_MACHINE.map((t) => (
          <li key={t.id}>
            <div>
              <strong>{t.title}</strong>
              <span className="tm-shape">Shaped like {t.shapedLike} · {t.days} days</span>
              <p>{t.blurb}</p>
            </div>
            <div className="tm-actions">
              {best[t.id] !== undefined && <em className={best[t.id]! >= 0 ? 'up' : 'down'}>Best {formatPct(best[t.id]!)}</em>}
              <button className="secondary-button" type="button" disabled={busy} onClick={() => onStart(t.id)}>
                {running?.id === t.id ? 'Restart' : 'Start'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="consent-note">Starting a replay replaces the one in progress. Results are virtual only.</p>
    </dialog>
  );
}
