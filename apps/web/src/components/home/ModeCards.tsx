'use client';

// Modes as an uneven grid: the two ways to live in the world (Story, Free Play) get the big tiles; the
// short formats (Daily, Time Machine, Academy) sit in a row beneath. Metadata always sits in the same
// place on every tile: index + tag top-left, title + line + status bottom-left, art on the right.
import type { SideRun } from '@/lib/api';
import { MODES, type ModeId } from '@/lib/modes';
import { formatPct } from '@ms/ui/format';

interface Props {
  daily: SideRun | null;
  timeMachine: SideRun | null;
  bestToday: number | null;
  xp: number;
  disabled: boolean;
  onPick: (mode: ModeId) => void;
}

const TAG: Record<ModeId, string> = { STORY: 'Campaign', FREEPLAY: 'Open world', DAILY: '15 days', TIMEMACHINE: 'Scenarios', ACADEMY: 'Lessons' };
const ART: Partial<Record<ModeId, string>> = { FREEPLAY: '/art/bull-bear.webp' };

export function ModeCards({ daily, timeMachine, bestToday, xp, disabled, onPick }: Props) {
  const status = (id: ModeId): string | null => {
    if (id === 'STORY') return 'Chapter 1 playable · 9 coming';
    if (id === 'FREEPLAY') return 'Every desk open · 2 years of history';
    if (id === 'DAILY') return daily ? (daily.ended ? `Done today · ${formatPct(daily.run?.returnPct ?? 0)}` : 'In progress') : bestToday !== null ? `Best today ${formatPct(bestToday)}` : 'New market today';
    if (id === 'TIMEMACHINE') return timeMachine ? (timeMachine.ended ? 'Replay finished' : 'Replay in progress') : '5 crash-shaped replays';
    return xp ? `${xp} XP earned` : '9 lessons';
  };
  return (
    <section className="modes" aria-labelledby="modes-heading">
      <header className="block-head">
        <p className="launch-kicker"><span>03</span> Modes</p>
        <h2 id="modes-heading">Pick how you play</h2>
      </header>
      <div className="mode-bento">
        {MODES.map((m, i) => {
          const big = m.id === 'STORY' || m.id === 'FREEPLAY';
          const photo = ART[m.id];
          return (
            <button key={m.id} type="button" className={`bento-tile tile-${m.id.toLowerCase()} ${big ? 'big' : 'small'} ${photo ? 'photo' : ''}`} onClick={() => onPick(m.id)} disabled={disabled}>
              <img className="bento-art" src={photo ?? m.art} alt="" loading="lazy" decoding="async" />
              <span className="bento-top"><b>{String(i + 1).padStart(2, '0')}</b>{TAG[m.id]}</span>
              <span className="bento-text">
                <strong>{m.title}</strong>
                <span>{m.line}</span>
                <em>{status(m.id)}</em>
              </span>
              <span className="bento-go" aria-hidden="true">→</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
