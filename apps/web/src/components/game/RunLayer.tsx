'use client';

import { useEffect, useRef, useState } from 'react';
import { addDays, defaultConfig, isOpen, type CareerView } from '@ms/engine';
import { BREAKER_INDEX } from '@ms/content/universe';
import { formatDate, formatPct, tone } from '@ms/ui/format';
import type { RunInfo } from '@/lib/api';
import { TIME_MACHINE } from '@/lib/modes';

/** India trading days after `from`, up to and including `to`. */
function tradingDays(from: string, to: string): number {
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isOpen('IN', d, defaultConfig.calendars)) n++;
  return n;
}
const indexReturn = (c: CareerView) => c.indices[BREAKER_INDEX.id]!.level / (c.baseline.indices[BREAKER_INDEX.id] ?? BREAKER_INDEX.startLevel) - 1;

/** Banner for Daily Challenge / Time Machine runs: what this is, how far along, how it is going. */
export function RunBar({ career, run }: { career: CareerView; run: RunInfo }) {
  const total = career.endDate ? tradingDays(career.startDate, career.endDate) : 0;
  const done = tradingDays(career.startDate, career.date);
  const tm = run.kind === 'TIMEMACHINE' ? TIME_MACHINE.find((t) => t.id === run.scenarioId) : undefined;
  return (
    <div className="mode-bar run-bar" data-tour="mode-bar">
      <span className="mode-pill static">
        <b>{career.label}</b>
        <span>{tm ? `Shaped like ${tm.shapedLike} · fictional prices` : 'Same market for every player today'}</span>
      </span>
      <span className="run-progress" aria-label={`Trading day ${done} of ${total}`}>
        <i style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }} />
      </span>
      <span className="mode-dates">Trading day {done} of {total} · ends {career.endDate ? formatDate(career.endDate) : ''}</span>
      <em className={tone(run.returnPct)}>{formatPct(run.returnPct)}</em>
    </div>
  );
}

/** Results card when a side run reaches its end date. */
export function RunComplete({ career, run, onExit }: { career: CareerView; run: RunInfo; onExit: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open && !closed) d.showModal();
  }, [closed]);
  if (closed) return null;
  const idx = indexReturn(career);
  const beat = run.returnPct > idx;
  return (
    <dialog ref={ref} className="story-modal run-complete" aria-labelledby="run-title" onClose={() => setClosed(true)}>
      <p className="eyebrow">{run.kind === 'DAILY' ? 'Daily Challenge complete' : 'Replay complete'}</p>
      <h2 id="run-title">{beat ? 'You beat the market' : run.returnPct >= 0 ? 'You finished ahead' : 'A tough run'}</h2>
      <div className="debrief-stats">
        <span><small>Your return</small><b className={tone(run.returnPct)}>{formatPct(run.returnPct, 1)}</b></span>
        <span><small>{BREAKER_INDEX.name} index</small><b className={tone(idx)}>{formatPct(idx, 1)}</b></span>
        <span><small>Deepest fall</small><b>{formatPct(-career.maxDrawdown, 1)}</b></span>
      </div>
      <p className="muted">{run.kind === 'DAILY' ? 'A new market opens tomorrow at midnight (India time). Results are virtual only: no prizes.' : 'Try another scenario, or replay this one with a different plan. Results are virtual only.'}</p>
      <div className="debrief-actions">
        <button className="secondary-button" type="button" onClick={() => ref.current?.close()}>Review the run</button>
        <button className="primary-button" type="button" onClick={onExit}>Back to menu</button>
      </div>
    </dialog>
  );
}
