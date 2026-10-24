'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { GrievanceBody } from '@/lib/schemas';

const CATEGORIES: { id: GrievanceBody['category']; label: string }[] = [
  { id: 'bug', label: 'Something is broken' },
  { id: 'account', label: 'My careers or progress' },
  { id: 'privacy', label: 'Privacy or my data' },
  { id: 'content', label: 'Something in the game is wrong or offensive' },
  { id: 'other', label: 'Something else' },
];

/** Complaint / request form (Online Gaming Rules 2026 grievance mechanism, DPDP grievance redressal). */
export function GrievanceForm() {
  const [category, setCategory] = useState<GrievanceBody['category']>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.grievance({ category, message, email: email || undefined });
      setRef(r.ref);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (ref)
    return (
      <div className="grievance-done" role="status">
        <h2>Message received</h2>
        <p>Your reference is <b>{ref}</b>. Keep it to follow up.</p>
        <button className="text-button" type="button" onClick={() => setRef(null)}>Send another message</button>
      </div>
    );

  return (
    <form className="grievance-form" onSubmit={submit}>
      <label>
        What is it about?
        <select value={category} onChange={(e) => setCategory(e.target.value as GrievanceBody['category'])}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label>
        Your message
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} minLength={10} maxLength={2000} required placeholder="Tell us what happened and, if it is about a game, roughly when." />
        <small>{message.length} / 2000</small>
      </label>
      <label>
        Email for a reply (optional)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" />
        <small>Only used to answer this message.</small>
      </label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy || message.trim().length < 10}>{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
