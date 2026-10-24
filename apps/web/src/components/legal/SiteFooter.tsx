'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { DISCLAIMER } from '@/lib/modes';

export const LEGAL_LINKS = [
  { href: '/games/market-survivor/terms', label: 'Terms of Use' },
  { href: '/games/market-survivor/privacy', label: 'Privacy Notice' },
  { href: '/games/market-survivor/contact', label: 'Contact & complaints' },
  { href: '/games/market-survivor/licences', label: 'Open-source licences' },
];

/** Disclaimer, legal links and "Delete my data" (legal review L-05, L-06, L-14, L-18). */
export function SiteFooter({ onDeleted }: { onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function deleteData() {
    if (!window.confirm('Delete every career, run, quiz result and consent record we hold for you? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.deleteMyData();
      setMsg('Your data has been deleted.');
      onDeleted?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not delete your data. Please use the complaint form.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="site-footer">
      <p className="disclaimer-line">{DISCLAIMER}</p>
      <nav aria-label="Legal">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
        <button type="button" className="link-button" onClick={() => void deleteData()} disabled={busy}>
          Delete my data
        </button>
      </nav>
      {msg && <p className="footer-msg" role="status">{msg}</p>}
    </footer>
  );
}
