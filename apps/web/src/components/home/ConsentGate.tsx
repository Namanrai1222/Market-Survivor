'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * First-run gate (legal review L-04/L-05): confirm 18+, accept Terms and Privacy Notice, read the disclaimer.
 * Recorded on the server with the terms version; the API refuses play without it.
 */
export function ConsentGate({ onAccepted }: { onAccepted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal(); // no close() on cleanup: Strict Mode would fire onClose
  }, []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await api.consent();
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="consent-gate" aria-labelledby="consent-title" onCancel={(e) => e.preventDefault()}>
      <p className="eyebrow">Before you play</p>
      <h2 id="consent-title">A game about markets, not a market</h2>
      <ul className="consent-facts">
        <li><b>Virtual coins only.</b> You can't buy them, cash them out or win anything real.</li>
        <li><b>Everything is fictional.</b> The companies, indices and prices are made up for the game and are not affiliated with any exchange or listed company.</li>
        <li><b>Not advice.</b> Market Survivor is an educational game. It is not investment advice and is not registered with SEBI.</li>
      </ul>
      <label className="check-row">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>I am 18 or older.</span>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          I accept the <Link href="/games/market-survivor/terms" target="_blank">Terms of Use</Link> and have read the{' '}
          <Link href="/games/market-survivor/privacy" target="_blank">Privacy Notice</Link>.
        </span>
      </label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="primary-button" type="button" disabled={!adult || !terms || busy} onClick={() => void accept()}>
        {busy ? 'Saving…' : 'Start playing'}
      </button>
      <p className="consent-note">Under 18? This version of the game is for adults only.</p>
    </dialog>
  );
}
