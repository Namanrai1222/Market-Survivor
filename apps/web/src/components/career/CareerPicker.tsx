'use client';

import { useEffect, useState } from 'react';
import type { CareerSummary, Difficulty } from '@ms/engine';
import { formatDate, formatINR, formatPct, tone } from '@ms/ui/format';
import { api } from '@/lib/api';

type SlotType = 'STORY' | 'FREEPLAY';

interface Props {
  careers: CareerSummary[] | null;
  error: string | null;
  /** A mode card asked for a new career of this type: open the first empty slot with it picked. */
  preset?: { type: SlotType; nonce: number } | null;
  onOpen: (id: string) => void;
  onChanged: () => Promise<void>;
}

const bySlot = (careers: CareerSummary[], slot: number) => careers.find((career) => career.slot === slot);

export function CareerPicker({ careers, error, preset, onOpen, onChanged }: Props) {
  const [creating, setCreating] = useState<number | null>(null);
  const [type, setType] = useState<SlotType>('STORY');

  useEffect(() => {
    if (!preset || !careers) return;
    const empty = [1, 2, 3].find((slot) => !careers.some((c) => c.slot === slot));
    // Adjusting form state in response to a mode card click (an external event), not derived render state.
    queueMicrotask(() => {
      setType(preset.type);
      setCreating(empty ?? null);
    });
  }, [preset, careers]);
  const [difficulty, setDifficulty] = useState<Difficulty>('REALISTIC');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function create(slot: number) {
    setBusy(true);
    setLocalError(null);
    try {
      const data = await api.createCareer({ slot, type, difficulty });
      onOpen(data.career.id);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not create career.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(career: CareerSummary) {
    if (!window.confirm(`Delete the career in slot ${career.slot}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteCareer(career.id);
      await onChanged();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not delete career.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="saves" aria-labelledby="career-heading">
      <header className="block-head">
        <p className="launch-kicker"><span>04</span> Saves</p>
        <h2 id="career-heading">Your careers</h2>
        <span className="autosave-pill">● Autosaves every move</span>
      </header>
      {(error || localError) && <div className="error-banner" role="alert">{error ?? localError}</div>}
      <ol className="save-ledger">
        {[1, 2, 3].map((slot) => {
          const career = careers && bySlot(careers, slot);
          if (career) {
            const ret = career.netWorthPaise / 100_000_000 - 1;
            return (
              <li className="save-row filled" key={slot}>
                <span className="save-slot">{String(slot).padStart(2, '0')}</span>
                <span className="save-mode"><b>{career.type === 'STORY' ? 'Story' : 'Free Play'}</b><small>{career.type === 'STORY' ? (career.label ?? `Chapter ${career.chapter}`) : `${career.difficulty[0]}${career.difficulty.slice(1).toLowerCase()} difficulty`}</small></span>
                <span className="save-worth"><b>{formatINR(career.netWorthPaise, 0)}</b><small className={tone(ret, 1)}>{formatPct(ret, 1)}</small></span>
                <span className="save-date"><small>World date</small>{formatDate(career.date)}</span>
                <span className="save-actions">
                  <button className="primary-button" onClick={() => onOpen(career.id)}>Continue <span>→</span></button>
                  <button className="icon-button danger" aria-label={`Delete slot ${slot}`} onClick={() => void remove(career)} disabled={busy}>×</button>
                </span>
              </li>
            );
          }
          return (
            <li className="save-row empty" key={slot}>
              <span className="save-slot">{String(slot).padStart(2, '0')}</span>
              {creating === slot ? (
                <div className="new-career-form">
                  <label>Mode
                    <select value={type} onChange={(e) => setType(e.target.value as SlotType)}>
                      <option value="STORY">Story mode</option>
                      <option value="FREEPLAY">Free play</option>
                    </select>
                  </label>
                  <label>Difficulty
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                      <option value="CALM">Calm</option>
                      <option value="REALISTIC">Realistic</option>
                      <option value="CHAOTIC">Chaotic</option>
                    </select>
                  </label>
                  <div className="form-actions">
                    <button className="primary-button" disabled={busy} onClick={() => void create(slot)}>{busy ? 'Building two years of market…' : 'Start career'}</button>
                    <button className="text-button" onClick={() => setCreating(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="save-mode"><b>{careers === null ? 'Loading…' : 'Empty slot'}</b><small>₹10,00,000 in virtual coins</small></span>
                  <span className="save-actions">
                    <button className="secondary-button" disabled={careers === null} onClick={() => { setType('STORY'); setCreating(slot); }}>Story</button>
                    <button className="secondary-button" disabled={careers === null} onClick={() => { setType('FREEPLAY'); setCreating(slot); }}>Free Play</button>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
