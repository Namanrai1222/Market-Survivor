import { flushSync } from 'react-dom';

/**
 * Run a React state update inside a View Transition (CSS in globals.css); a plain update where the API is missing or
 * motion is reduced. `kind` lands on <html data-vt> for the transition's lifetime so CSS can pick the choreography
 * ('world' opens a lens into a career).
 */
export function withViewTransition(update: () => void, kind: 'world'): void {
  if (typeof document === 'undefined' || !('startViewTransition' in document) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  const root = document.documentElement;
  root.dataset.vt = kind;
  void document.startViewTransition(() => flushSync(update)).finished.finally(() => delete root.dataset.vt);
}
