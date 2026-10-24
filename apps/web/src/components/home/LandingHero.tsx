'use client';

// Landing hero, "The Charge" (DESIGN.md): the Blender-rendered bronze bull charges through a full-width
// SURVIVOR wordmark on a dark studio stage. One idea, one primary action (continue your latest save, or
// start Story Mode). Every number on the page comes from the game's content.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CareerSummary } from '@ms/engine';
import { DESKS, HISTORY_DAYS } from '@ms/engine';
import { STOCKS } from '@ms/content/universe';
import { formatDate, formatINR, formatPct, tone } from '@ms/ui/format';
import { CHAPTERS } from '@/lib/modes';
import { useCountUp } from '../city/Dashboard';

const START_PAISE = 100_000_000;
const WORD = 'SURVIVOR';

interface Props {
  latest: CareerSummary | null;
  loading: boolean;
  onContinue: (id: string) => void;
  onNew: (type: 'STORY' | 'FREEPLAY') => void;
}

export function LandingHero({ latest, loading, onContinue, onNew }: Props) {
  const stage = useRef<HTMLElement>(null);
  const ret = latest ? latest.netWorthPaise / START_PAISE - 1 : 0;

  // Pointer parallax: the bull leans further than the wordmark. Mouse only; nothing under reduced motion.
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const el = stage.current;
    if (!el || e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  return (
    // .stage-pin is the scroll runway for the pinned "charge" beat (CSS scroll-driven animation, globals.css).
    <div className="stage-pin">
    <section className="stage" ref={stage} onPointerMove={move} aria-labelledby="game-title">
      <div className="stage-floor" aria-hidden="true" />
      <p className="stage-corner tl" aria-hidden="true">FIG. 01 — THE CHARGE</p>
      <p className="stage-corner tr" aria-hidden="true">Bronze, 2030 · cast in Blender</p>

      <h1 id="game-title" className="stage-title">
        <span className="stage-kicker">Market</span>
        <span className="stage-word" aria-label="Survivor">
          {WORD.split('').map((ch, i) => (
            <span key={i} style={{ ['--i' as string]: i, ['--dir' as string]: i < WORD.length / 2 ? -1 : 1 }} aria-hidden="true">{ch}</span>
          ))}
        </span>
      </h1>
      <div className="stage-bull">
        <img src="/art/hero/bull-cutout.webp" alt="A bronze bull charging, head down" width={1800} height={1350} fetchPriority="high" decoding="async" />
      </div>

      <div className="stage-foot">
        <div className="stage-pitch">
          <p className="stage-copy">Ten years. Ten market storms. One wallet. Build a portfolio in a fictional market world and learn why everything moves together, with virtual coins and real lessons.</p>
          <div className="stage-actions">
            {latest ? (
              <button className="stage-cta" type="button" onClick={() => onContinue(latest.id)}>
                <span>Continue</span>
                <small>
                  {latest.type === 'STORY' ? (latest.label ?? `Chapter ${latest.chapter}`) : 'Free Play'} · {formatINR(latest.netWorthPaise, 0)} <em className={tone(ret)}>{formatPct(ret, 1)}</em>
                </small>
                <i aria-hidden="true">→</i>
              </button>
            ) : (
              <button className="stage-cta" type="button" disabled={loading} onClick={() => onNew('STORY')}>
                <span>{loading ? 'Loading…' : 'Start the story'}</span>
                <small>Chapter 1 · ₹10,00,000 in virtual coins</small>
                <i aria-hidden="true">→</i>
              </button>
            )}
            <button type="button" className="stage-link" onClick={() => onNew('FREEPLAY')}>New Free Play world</button>
            <Link className="stage-link" href="/games/market-survivor/academy">Learn the basics</Link>
          </div>
          {latest && <p className="stage-meta">World date {formatDate(latest.date)} · slot {latest.slot}</p>}
        </div>
        <dl className="stage-facts">
          <div><dt>Chapters</dt><dd><Count to={CHAPTERS.length} /></dd></div>
          <div><dt>Markets</dt><dd><Count to={DESKS.length} /></dd></div>
          <div><dt>Companies</dt><dd><Count to={STOCKS.length} /></dd></div>
          <div><dt>Years of history on day one</dt><dd><Count to={Math.round(HISTORY_DAYS / 365)} /></dd></div>
        </dl>
      </div>
      <p className="stage-turn" aria-hidden="true">Then the market <em>turns.</em></p>
      <p className="stage-corner br" aria-hidden="true">Scroll ↓</p>
    </section>
    </div>
  );
}

/** Counts up from zero once on mount (reuses the dashboard's expo-out tween; jumps under reduced motion). */
function Count({ to }: { to: number }) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTarget(to));
    return () => cancelAnimationFrame(id);
  }, [to]);
  return <>{Math.round(useCountUp(target, 1400))}</>;
}

/** One span per word, so the headline can light up word by word as it scrolls in (--w orders them). */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <span key={i} className="word" style={{ ['--w' as string]: from + i }}>{w}{' '}</span>
      ))}
    </>
  );
}

/** The second beat: every bull run meets a bear. */
export function BearBeat() {
  return (
    <section className="bear-beat" aria-labelledby="bear-title">
      <div className="bear-text">
        <p className="launch-kicker"><span>02</span> The other animal</p>
        <h2 id="bear-title"><Words text="Bulls make you rich." /><em><Words text="Bears decide if you keep it." from={4} /></em></h2>
        <ul className="bear-tags" aria-label="Some of the storms in Story Mode">
          {['Rate shocks', 'Crypto collapse', 'War weekend', 'Bank runs', 'Circuit-breaker halts'].map((t, i) => (
            <li key={t} style={{ ['--w' as string]: i }}>{t}</li>
          ))}
        </ul>
      </div>
      <img className="bear-img" src="/art/hero/bear-cutout.webp" alt="A bronze bear, head low" width={1800} height={1350} loading="lazy" decoding="async" />
    </section>
  );
}
