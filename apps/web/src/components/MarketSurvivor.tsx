'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CareerSummary } from '@ms/engine';
import { api, type MeInfo, type SideRun } from '@/lib/api';
import type { ModeId } from '@/lib/modes';
import { CareerPicker } from './career/CareerPicker';
import { GameShell } from './game/GameShell';
import { ConsentGate } from './home/ConsentGate';
import { BearBeat, LandingHero } from './home/LandingHero';
import { withViewTransition } from '@/lib/viewTransition';
import Link from 'next/link';
import { ModeCards } from './home/ModeCards';
import { TimeMachinePicker } from './home/TimeMachinePicker';
import { SiteFooter } from './legal/SiteFooter';

interface Lists {
  careers: CareerSummary[];
  daily: SideRun | null;
  timeMachine: SideRun | null;
}

export function MarketSurvivor() {
  const router = useRouter();
  const [lists, setLists] = useState<Lists | null>(null);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [activeId, setActive] = useState<string | null>(null);
  // Entering and leaving a world crossfades (View Transition) instead of cutting.
  const setActiveId = useCallback((id: string | null) => withViewTransition(() => setActive(id), 'world'), []);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<{ type: 'STORY' | 'FREEPLAY'; nonce: number } | null>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    () =>
      Promise.all([api.listCareers(), api.me()]).then(
        ([l, m]) => {
          setLists(l);
          setMe(m);
          setError(null);
        },
        (e: unknown) => {
          setError(e instanceof Error ? e.message : 'Could not load your careers.');
          setLists({ careers: [], daily: null, timeMachine: null });
        },
      ),
    [],
  );

  // Initial load: state is set in the request callbacks, not synchronously in the effect.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startSide(body: { type: 'DAILY' } | { type: 'TIMEMACHINE'; scenarioId: string }) {
    setBusy(true);
    setError(null);
    try {
      const data = await api.createCareer(body);
      setPicker(false);
      setActiveId(data.career.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start that mode.');
    } finally {
      setBusy(false);
    }
  }

  function pick(mode: ModeId) {
    if (mode === 'ACADEMY') return router.push('/games/market-survivor/academy');
    if (mode === 'TIMEMACHINE') return setPicker(true);
    if (mode === 'DAILY') {
      if (lists?.daily && !lists.daily.ended) return setActiveId(lists.daily.id);
      return void startSide({ type: 'DAILY' });
    }
    setPreset({ type: mode, nonce: Date.now() });
    slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (activeId)
    return (
      <GameShell
        careerId={activeId}
        onExit={() => {
          setActiveId(null);
          void refresh();
        }}
      />
    );

  const today = lists?.daily?.run?.dailyDate ?? null;
  const bestToday = today && me ? (me.progress.dailyBest[today] ?? null) : null;
  const needsConsent = me !== null && me.consent === null;

  // The save you were last in: the one furthest along in world time.
  const latest = lists?.careers.length ? [...lists.careers].sort((a, b) => b.date.localeCompare(a.date))[0]! : null;

  return (
    <main className="landing-shell">
      <header className="launch-rail">
        <span className="launch-wordmark">Market Survivor</span>
        <span className="launch-tag">Fictional markets · virtual coins</span>
        <nav aria-label="Main">
          <a href="#modes-heading">Modes</a>
          <a href="#career-heading">Saves</a>
          <Link href="/games/market-survivor/academy">Academy</Link>
        </nav>
      </header>
      <LandingHero latest={latest} loading={lists === null} onContinue={setActiveId} onNew={(t) => pick(t)} />
      <BearBeat />

      {error && <div className="error-banner" role="alert">{error}</div>}

      <ModeCards daily={lists?.daily ?? null} timeMachine={lists?.timeMachine ?? null} bestToday={bestToday} xp={me?.xp ?? 0} disabled={busy || lists === null} onPick={pick} />

      <div ref={slotsRef} className="slots-anchor">
        <CareerPicker careers={lists?.careers ?? null} error={null} preset={preset} onOpen={setActiveId} onChanged={refresh} />
      </div>

      <SiteFooter onDeleted={() => void refresh()} />

      {picker && (
        <TimeMachinePicker
          current={lists?.timeMachine ?? null}
          best={me?.progress.timeMachineBest ?? {}}
          busy={busy}
          onStart={(scenarioId) => void startSide({ type: 'TIMEMACHINE', scenarioId })}
          onContinue={(id) => {
            setPicker(false);
            setActiveId(id);
          }}
          onClose={() => setPicker(false)}
        />
      )}
      {needsConsent && <ConsentGate onAccepted={() => void refresh()} />}
    </main>
  );
}
