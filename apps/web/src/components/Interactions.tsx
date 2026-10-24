'use client';

import { useEffect } from 'react';

// Surfaces that light up under the cursor (spotlight), lean towards it (tilt) or follow it (magnetic): CSS reads the vars.
const TRACK = '.panel, .bento-tile, .choice, .market-tile, .stage-cta, .step-button, .save-row';
const RIPPLE = '.primary-button, .secondary-button, .stage-cta, .step-button, .choice, .bento-tile, .market-tile, .desk-tabs button, .heat-cell';
const HOT = 'a, button:not(:disabled), [role="button"], input, select, label';

/**
 * App-wide pointer feel, one listener each for the whole document (design-library-pro: cursor-follow, hover focus,
 * press feedback). Sets --mx/--my (px) and --rx/--ry (−0.5…0.5) on the hovered surface, drops a ripple where a control
 * is pressed, and trails a champagne halo behind the mouse that opens up over anything clickable. Mouse only; the
 * halo and ripple are skipped under reduced motion.
 */
export function Interactions() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const move = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(TRACK) : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
      el.style.setProperty('--rx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty('--ry', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };

    const down = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(RIPPLE) : null;
      if (!el || still || (el as HTMLButtonElement).disabled) return;
      // A host that isn't positioned and clipping would let the ripple escape as a big stray shape (the "Next day" bug).
      const cs = getComputedStyle(el);
      if (cs.position === 'static' || cs.overflow === 'visible') return;
      const r = el.getBoundingClientRect();
      const size = Math.hypot(r.width, r.height) * 2;
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.setAttribute('aria-hidden', 'true');
      // Layout-critical styles inline: if the stylesheet is stale or missing, the span must still never take up space
      // (as a flex item it would stretch the button to its own size).
      Object.assign(dot.style, {
        position: 'absolute',
        pointerEvents: 'none',
        borderRadius: '50%',
        left: `${e.clientX - r.left}px`,
        top: `${e.clientY - r.top}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: 'translate(-50%, -50%) scale(0)',
      });
      el.append(dot);
      dot.animate(
        [{ transform: 'translate(-50%, -50%) scale(0)', opacity: 0.45 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }],
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      ).onfinish = () => dot.remove();
    };

    // The halo eases after the pointer (lerp) and sleeps when it has caught up.
    let halo: HTMLDivElement | null = null;
    let frame = 0;
    const at = { x: -100, y: -100 };
    const to = { x: -100, y: -100 };
    const step = () => {
      at.x += (to.x - at.x) * 0.2;
      at.y += (to.y - at.y) * 0.2;
      halo!.style.translate = `${at.x}px ${at.y}px`;
      frame = Math.abs(to.x - at.x) + Math.abs(to.y - at.y) > 0.3 ? requestAnimationFrame(step) : 0;
    };
    const trail = (e: PointerEvent) => {
      if (!halo || e.pointerType !== 'mouse') return;
      to.x = e.clientX;
      to.y = e.clientY;
      halo.dataset.hot = e.target instanceof Element && e.target.closest(HOT) ? '1' : '';
      halo.dataset.on = '1';
      if (!frame) frame = requestAnimationFrame(step);
    };
    const hide = () => halo && (halo.dataset.on = '');
    if (fine && !still) {
      halo = document.createElement('div');
      halo.className = 'cursor-halo';
      halo.setAttribute('aria-hidden', 'true');
      document.body.append(halo);
      document.addEventListener('pointermove', trail, { passive: true });
      document.documentElement.addEventListener('pointerleave', hide);
    }

    if (fine) document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', trail);
      document.documentElement.removeEventListener('pointerleave', hide);
      cancelAnimationFrame(frame);
      halo?.remove();
    };
  }, []);
  return null;
}
