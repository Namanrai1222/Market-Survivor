// Engine-side save upgrades. Schema 2 → 3 (2026-10-18) adds every desk beyond stocks: new instruments
// get their starting prices on the save's current date, the world gains USD/INR, rates and the exchange,
// and the new desk collections start empty. Older schemas are upgraded to 2 by the server first.
import { startingDesks, startingPrices, startingWorld } from './career';
import type { MarketConfig } from './config';
import { addDays } from './calendar';
import type { CareerState, ContentPack } from './types';
import { yieldsFor, zeros } from './world/factors';

type Schema2 = Omit<CareerState, 'schema' | 'world' | 'ipos' | 'ipoQueue' | 'fundOrders' | 'sips' | 'fds' | 'forecasts' | 'transfers' | 'deskFills' | 'baseline'> & {
  schema: 2;
  world: Pick<CareerState['world'], 'regime' | 'factors' | 'cpiIndex' | 'halt'> & { pending: { IN: number[] } };
};

export function upgradeCareer(c: CareerState | Schema2, content: ContentPack, cfg: MarketConfig): CareerState {
  if (c.schema === 3) {
    // Companies added to the content after this save start trading at their start price.
    const missing = Object.keys(startingPrices(content, c.date)).some((id) => !c.prices[id]);
    const prices = missing ? { ...startingPrices(content, c.date), ...c.prices } : c.prices;
    return { ...c, prices, baseline: c.baseline ?? startBaseline(content) };
  }
  const base = startingWorld(cfg);
  const prices = { ...startingPrices(content, c.date), ...c.prices };
  const desks = new Set([...c.unlockedDesks, ...(c.type === 'STORY' ? [] : startingDesks(c.type))]);
  return {
    ...c,
    schema: 3,
    unlockedDesks: [...desks],
    prices,
    world: { ...base, ...c.world, pending: { IN: c.world.pending.IN, US: zeros() }, yields: yieldsFor(base.policyRate, c.world.factors) },
    ipos: {},
    ipoQueue: { next: 0, announceDate: addDays(c.date, cfg.ipo.firstAnnounceDays) },
    fundOrders: [],
    sips: [],
    fds: [],
    forecasts: [],
    transfers: [],
    deskFills: [],
    baseline: startBaseline(content),
  };
}

/** Careers made before history existed started at the content's start prices. */
function startBaseline(content: ContentPack): CareerState['baseline'] {
  return {
    date: '2030-01-01',
    indices: Object.fromEntries(content.indices.map((d) => [d.id, d.startLevel])),
    prices: Object.fromEntries(content.instruments.filter((i) => i.desk !== 'IPO').map((i) => [i.id, i.startPricePaise])),
  };
}
