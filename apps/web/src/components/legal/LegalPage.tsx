import Link from 'next/link';
import { SiteFooter } from './SiteFooter';

/** Shared frame for Terms, Privacy, Licences, Contact and the Academy. */
export function LegalPage({ eyebrow, title, updated, draft = false, children }: { eyebrow: string; title: string; updated?: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <main className="legal-shell">
      <Link className="text-button back-link" href="/games/market-survivor">← Back to the game</Link>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {updated && <p className="muted">Version {updated}</p>}
      {draft && (
        <p className="draft-note" role="note">
          Draft for legal review. Items marked <span className="todo">TODO</span> must be filled in by the operator and the whole page checked by counsel before launch.
        </p>
      )}
      <article className="legal-body">{children}</article>
      <SiteFooter />
    </main>
  );
}

/** A visible placeholder for a fact only the operator can supply (design-library-pro: real content or TODO). */
export const Todo = ({ children }: { children: React.ReactNode }) => <span className="todo">TODO: {children}</span>;
