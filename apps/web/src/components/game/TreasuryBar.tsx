import type { CareerView } from '@ms/engine';
import { arrow, formatDate, formatINR, formatPct, tone } from '@ms/ui/format';

interface Props {
  career: CareerView;
  /** Crash / halt: 4px critical band on the bar's bottom edge (design.md §7 SirenBand). */
  siren: boolean;
  busy: boolean;
  /** Clock can't move: a story checkpoint is waiting or the run has ended. */
  locked: boolean;
  alertCount: number;
  onTour: () => void;
  onAdvance: (days?: number) => void;
  onExit: () => void;
  onAlerts: () => void;
}

const SLOT_LABEL: Record<CareerView['type'], string> = { STORY: 'Story', FREEPLAY: 'Free Play', DAILY: 'Daily Challenge', TIMEMACHINE: 'Time Machine' };

export function TreasuryBar({ career, siren, busy, locked, alertCount, onAdvance, onExit, onAlerts, onTour }: Props) {
  const change = career.netWorthPrevPaise ? (career.netWorthPaise - career.netWorthPrevPaise) / career.netWorthPrevPaise : 0;
  return (
    <header className="treasury-bar" data-tour="treasury">
      <div className="treasury-brand">
        <button className="back-button" onClick={onExit} aria-label="Back to careers">←</button>
        <div><strong>Market Survivor</strong><span>{career.slot <= 3 ? `${SLOT_LABEL[career.type]} · slot ${career.slot}` : SLOT_LABEL[career.type]}</span></div>
      </div>
      <div className="world-meta">
        {/* keyed so the date and the worth flip over when the clock moves */}
        <span key={career.date} className="flip">{formatDate(career.date)}</span>
        <span className={`regime regime-${career.regime.toLowerCase()}`}>● {career.regime.toLowerCase()}</span>
      </div>
      <button className="worth-block" type="button" title="Net worth across cash and positions">
        <span>Net worth</span>
        <strong key={career.netWorthPaise} className="flip">{formatINR(career.netWorthPaise, 0)}</strong>
        <em className={tone(change)}>{arrow(change)}{formatPct(change)}</em>
      </button>
      <div className="cash-buckets">
        <span><small>Available</small>{formatINR(career.treasury.availablePaise, 0)}</span>
        <span><small>Blocked</small>{formatINR(career.treasury.blockedPaise, 0)}</span>
        <span><small>Unsettled</small>{formatINR(career.treasury.unsettledPaise, 0)}</span>
      </div>
      <div className="clock-controls">
        <button className="step-button" data-tour="next-day" onClick={() => onAdvance(1)} disabled={busy || locked} title={locked ? (career.ended ? 'This run has finished' : 'Answer the checkpoint first') : 'Step one day (→)'} aria-label="Advance to the next day">
          {busy ? <span className="spinner" /> : <span className="step-label">Next day</span>} <b aria-hidden="true">→</b>
        </button>
        <button className="help-button" type="button" onClick={onTour} aria-label="Take the tour" title="Take the tour">?</button>
        <button className="bell-button" data-tour="alerts" onClick={onAlerts} aria-label={`${alertCount} alerts`}>♢{alertCount > 0 && <span>{alertCount}</span>}</button>
      </div>
      {siren && <div className="siren-band" aria-hidden="true" />}
    </header>
  );
}
