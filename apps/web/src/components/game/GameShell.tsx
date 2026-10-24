'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CareerView, Desk } from '@ms/engine';
import { listenForCareerChanges, useGame } from '@/store/game';
import { StockTerminal } from '../stocks/StockTerminal';
import { FixedIncomeDesk } from '../desks/FixedIncomeDesk';
import { ForecastDesk } from '../desks/ForecastDesk';
import { FundsDesk } from '../desks/FundsDesk';
import { IpoDesk } from '../desks/IpoDesk';
import { MarketDesk } from '../desks/MarketDesk';
import { WorldDesk } from '../city/WorldDesk';
import { Backdrop, type BackdropMood } from './Backdrop';
import { DeskTabs, deskIcon } from './DeskTabs';
import { DISCLAIMER } from '@/lib/modes';
import { StoryBar, StoryDialogs } from '../story/StoryLayer';
import { HaltCard } from './HaltCard';
import { RunBar, RunComplete } from './RunLayer';
import { Tour, tourDone } from './Tour';
import { TreasuryBar } from './TreasuryBar';

type WorldState = BackdropMood | 'halt';

/** design.md §2.4: the world state that reshapes the whole interface. */
function worldStateOf(career: CareerView): WorldState {
  if (career.halt) return 'halt';
  if (career.regime === 'CRISIS') return 'crash';
  if (career.regime === 'STRESSED') return 'tension';
  if (career.regime === 'RECOVERY') return 'recovery';
  return 'calm';
}

export function GameShell({ careerId, onExit }: { careerId: string; onExit: () => void }) {
  const career = useGame((s) => s.career);
  const alerts = useGame((s) => s.alerts);
  const busy = useGame((s) => s.busy);
  const error = useGame((s) => s.error);
  const load = useGame((s) => s.load);
  const advance = useGame((s) => s.advance);
  const clearError = useGame((s) => s.clearError);
  const setFocus = useGame((s) => s.setFocus);
  const story = useGame((s) => s.story);
  const run = useGame((s) => s.run);
  const reply = useGame((s) => s.reply);
  const answerCheckpoint = useGame((s) => s.answerCheckpoint);
  const clearReply = useGame((s) => s.clearReply);
  const act = useGame((s) => s.act);
  const [desk, setDesk] = useState<Desk | 'DASHBOARD'>('DASHBOARD');
  const [briefing, setBriefing] = useState(false);
  const [touring, setTouring] = useState(false);
  const pickDesk = useCallback((d: Desk | 'DASHBOARD') => setDesk(d), []);
  const [showAlerts, setShowAlerts] = useState(false);
  const [seenAlerts, setSeenAlerts] = useState(0);
  // The halt card can be set aside to review holdings; it returns on the next halt.
  const [haltDismissed, setHaltDismissed] = useState<string | null>(null);
  const openAlerts = () => { setShowAlerts(true); setSeenAlerts(alerts.length); };

  useEffect(() => { void load(careerId); }, [careerId, load]);
  // First visit: the tour starts once the career has loaded and no story briefing is due.
  const ready = career?.id === careerId;
  useEffect(() => {
    if (!ready || tourDone()) return;
    const t = window.setTimeout(() => setTouring(true), 600);
    return () => window.clearTimeout(t);
  }, [ready]);
  useEffect(() => listenForCareerChanges(careerId), [careerId]);
  useEffect(() => {
    if (!career) return;
    document.documentElement.dataset.worldState = worldStateOf(career);
    return () => { delete document.documentElement.dataset.worldState; };
  }, [career]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); if (!story?.checkpoint && !career?.ended) void advance(1); }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 'a') openAlerts();
      if (/^[1-9]$/.test(event.key) && career) {
        const tabs: (Desk | 'DASHBOARD')[] = ['DASHBOARD', 'STOCKS', 'IPO', 'FUNDS', 'FIXED_INCOME', 'COMMODITIES', 'GLOBAL', 'CRYPTO', 'PREDICTION'];
        const next = tabs[Number(event.key) - 1];
        if (next && (next === 'DASHBOARD' || career.unlockedDesks.includes(next))) pickDesk(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!career || career.id !== careerId) return <div className="full-loader"><span className="spinner large"/><p>Opening your market world…</p></div>;

  const latest = alerts[0];
  const haltKey = career.halt ? `${career.halt.date}-${career.halt.levelPct}` : null;
  const crashing = career.halt !== null || career.regime === 'CRISIS';
  const worldState = worldStateOf(career);
  const locked = career.ended || Boolean(story?.checkpoint);
  const storyModalUp = Boolean(story && (story.checkpoint || reply || briefing || (story.debrief && career.ended)));

  return (
    <main className="game-shell">
      <Backdrop mood={worldState === 'halt' ? 'crash' : worldState} variant="game" />
      <TreasuryBar career={career} siren={crashing} busy={busy} locked={locked} alertCount={alerts.length - seenAlerts} onAdvance={(days) => void advance(days)} onExit={onExit} onAlerts={openAlerts} onTour={() => setTouring(true)} />
      <DeskTabs active={desk} unlocked={career.unlockedDesks} onChange={pickDesk} />
      {story && <StoryBar story={story} onBriefing={() => setBriefing(true)} />}
      {run && <RunBar career={career} run={run} />}
      {/* Alerts are announced once as they arrive; HALT/CRITICAL interrupt, the rest wait their turn. */}
      <div className="sr-only" aria-live="polite">{latest && latest.level !== 'HALT' && latest.level !== 'CRITICAL' ? latest.message : ''}</div>
      <div className="sr-only" aria-live="assertive">{latest && (latest.level === 'HALT' || latest.level === 'CRITICAL') ? latest.message : ''}</div>
      {career.halt && haltDismissed === haltKey && (
        <div className="halt-banner" role="status"><span>Trading is paused after the {career.halt.levelPct}% circuit breaker.</span><button className="text-button" disabled={busy} onClick={() => void advance(1)}>Continue when market reopens →</button></div>
      )}
      {error && <div className="floating-error" role="alert"><span>{error}</span><button onClick={clearError}>×</button></div>}
      <div className="game-content">
        {desk === 'DASHBOARD' ? <WorldDesk career={career} onTrade={(id) => { setFocus(id); setDesk('STOCKS'); }} onDesk={setDesk} />
          : !career.unlockedDesks.includes(desk) ? <LockedDesk desk={desk} career={career} />
          : <DeskView desk={desk} career={career} />}
      </div>
      <footer className="game-footer"><span>{DISCLAIMER}</span></footer>
      {career.halt && haltDismissed !== haltKey && <HaltCard halt={career.halt} career={career} busy={busy} onContinue={() => void advance(1)} onReview={() => { setHaltDismissed(haltKey); setDesk('STOCKS'); }} />}
      {showAlerts && <AlertDrawer alerts={alerts} onClose={() => setShowAlerts(false)} />}
      {story && !touring && (
        <StoryDialogs
          key={story.chapter}
          story={story}
          careerId={career.id}
          date={career.date}
          busy={busy}
          reply={reply}
          briefingOpen={briefing}
          onBriefingClose={() => setBriefing(false)}
          onAnswer={(cp, choice) => void answerCheckpoint(cp, choice)}
          onReplyDone={clearReply}
          onExit={onExit}
          onNextChapter={() => void act({ kind: 'NEXT_CHAPTER' })}
        />
      )}
      {run && career.ended && !touring && <RunComplete career={career} run={run} onExit={onExit} />}
      {touring && !storyModalUp && <Tour onDesk={pickDesk} onClose={() => setTouring(false)} />}
    </main>
  );
}

function DeskView({ desk, career }: { desk: Desk; career: CareerView }) {
  switch (desk) {
    case 'STOCKS': return <StockTerminal career={career} />;
    case 'IPO': return <IpoDesk career={career} />;
    case 'FUNDS': return <FundsDesk career={career} />;
    case 'FIXED_INCOME': return <FixedIncomeDesk career={career} />;
    case 'COMMODITIES':
    case 'GLOBAL':
    case 'CRYPTO': return <MarketDesk key={desk} career={career} desk={desk} />;
    case 'PREDICTION': return <ForecastDesk career={career} />;
  }
}

/** Story chapter that opens each desk (prd.md §6.2). */
const UNLOCK_CHAPTER: Record<Desk, number> = { STOCKS: 1, IPO: 2, FUNDS: 2, PREDICTION: 2, FIXED_INCOME: 3, COMMODITIES: 3, CRYPTO: 4, GLOBAL: 5 };
const DESK_NAMES: Record<Desk, string> = { STOCKS: 'Stocks', IPO: 'IPOs', FUNDS: 'Funds & SIP', FIXED_INCOME: 'Fixed income', COMMODITIES: 'Commodities', GLOBAL: 'Global stocks', CRYPTO: 'Crypto', PREDICTION: 'Forecasts' };

/** A desk this career hasn't unlocked: Story says which chapter opens it; side runs say what they include. */
function LockedDesk({ desk, career }: { desk: Desk; career: CareerView }) {
  return <section className="coming-soon panel"><img className="coming-soon-icon" src={deskIcon(desk)} alt="" width={112} height={112} /><p className="eyebrow">Locked desk</p><h1>{DESK_NAMES[desk]}</h1>{career.type === 'STORY'
    ? <><p>This desk opens in Story Chapter {UNLOCK_CHAPTER[desk]}. Your Treasury and world carry into it when it does.</p><span>In Free Play every desk is open from day one.</span></>
    : <><p>This {career.type === 'DAILY' ? 'Daily Challenge is a stocks-only sprint' : 'replay includes stocks, funds, fixed income and commodities'}. Every desk is open in Free Play.</p><span>Start a Free Play career from the menu to use it.</span></>}</section>;
}

function AlertDrawer({ alerts, onClose }: { alerts: ReturnType<typeof useGame.getState>['alerts']; onClose: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="alert-drawer" onMouseDown={(e) => e.stopPropagation()} aria-label="Alert center"><header><div><p className="eyebrow">World signals</p><h2>Alert center</h2></div><button onClick={onClose} aria-label="Close alerts">×</button></header>{alerts.length ? <div className="alert-list">{alerts.map((alert, index) => <article className={`alert-${alert.level.toLowerCase()}`} key={`${alert.date}-${index}`}><span>{alert.level}</span><p>{alert.message}</p><small>{alert.date}</small></article>)}</div> : <div className="empty-alerts"><span>◇</span><h3>All quiet</h3><p>World events and portfolio warnings will appear here.</p></div>}</aside></div>;
}
