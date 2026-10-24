'use client';

import { useEffect, useState } from 'react';

/** World-state moods with a rendered backdrop (art/blender/trading_desk.py). Halt reuses crash. */
export type BackdropMood = 'calm' | 'tension' | 'crash' | 'recovery';

const src = (mood: BackdropMood, frame: 'wide' | 'tall') => `/art/backdrop/desk-${mood}-${frame}.webp`;

interface Layer {
  mood: BackdropMood;
  key: number;
}

/**
 * Full-bleed night trading desk behind the UI. Decorative only (empty alt, aria-hidden).
 * A mood change stacks the new image on top and fades it in over --t-world; the old one is dropped after.
 */
export function Backdrop({ mood, variant }: { mood: BackdropMood; variant: 'landing' | 'game' }) {
  const [layers, setLayers] = useState<Layer[]>([{ mood, key: 0 }]);
  const top = layers[layers.length - 1]!;

  // Adjusting state during render (not in an effect) when the mood prop changes.
  if (top.mood !== mood) setLayers([top, { mood, key: top.key + 1 }]);

  useEffect(() => {
    if (layers.length < 2) return;
    const t = window.setTimeout(() => setLayers((l) => l.slice(-1)), 700);
    return () => window.clearTimeout(t);
  }, [layers]);

  return (
    <div className={`backdrop backdrop-${variant}`} aria-hidden="true">
      {layers.map((layer, i) => (
        <picture key={layer.key} className={i > 0 ? 'backdrop-layer entering' : 'backdrop-layer'}>
          <source media="(max-width: 640px)" srcSet={src(layer.mood, 'tall')} />
          <img src={src(layer.mood, 'wide')} alt="" decoding="async" fetchPriority={variant === 'landing' ? 'high' : 'auto'} />
        </picture>
      ))}
      <div className="backdrop-scrim" />
    </div>
  );
}
