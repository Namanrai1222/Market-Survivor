'use client';

// The banner at the top of each desk: a Blender-rendered set (art/blender/desk_scenes.py) with the desk's
// title and live facts over its dark left side. The image drifts a few pixels with the pointer for depth;
// reduced motion keeps it still.
import { useRef } from 'react';
import type { Desk } from '@ms/engine';

const SCENE: Record<Desk, string> = {
  STOCKS: 'stocks',
  IPO: 'ipo',
  FUNDS: 'funds',
  FIXED_INCOME: 'fixed_income',
  COMMODITIES: 'commodities',
  GLOBAL: 'global',
  CRYPTO: 'crypto',
  PREDICTION: 'prediction',
};

export function DeskHero({ desk, eyebrow, title, lead, children }: { desk: Desk; eyebrow: string; title: string; lead: string; children?: React.ReactNode }) {
  const art = useRef<HTMLImageElement>(null);
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const el = art.current;
    if (!el || e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `scale(1.04) translate3d(${(-x * 14).toFixed(1)}px, ${(-y * 8).toFixed(1)}px, 0)`;
  };
  const leave = () => {
    if (art.current) art.current.style.transform = '';
  };
  return (
    <header className={`desk-hero hero-${desk.toLowerCase()}`} onPointerMove={move} onPointerLeave={leave}>
      <img ref={art} className="desk-hero-art" src={`/art/scenes/${SCENE[desk]}.webp`} alt="" width={1800} height={560} decoding="async" />
      <div className="desk-hero-text">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{lead}</p>
        {children && <div className="desk-hero-facts">{children}</div>}
      </div>
    </header>
  );
}

/** A small fact chip for the hero ("Policy rate 6.25%"). */
export const Fact = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <span className="hero-fact"><small>{label}</small><b className={tone}>{value}</b></span>
);
