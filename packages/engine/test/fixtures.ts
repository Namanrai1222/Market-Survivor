// Engine test fixtures: a tiny fixed universe so engine tests never change when real content does.
import {
  addDays,
  applyDay,
  createCareer,
  isOpen,
  testConfig,
  toPaise,
  type Bar,
  type CareerState,
  type ContentPack,
  type DayMarket,
  type Instrument,
  type MarketConfig,
  type NewCareerInput,
} from '../src';

export const R = toPaise;

export const stock = (id: string, sector: string, rupees: number, advRupees = 1e9, bandPct?: number): Instrument => ({
  id,
  symbol: id,
  name: id,
  desk: 'STOCKS',
  market: 'IN',
  sector,
  startPricePaise: R(rupees),
  indexWeight: 1,
  advPaise: R(advRupees),
  bandPct,
  real: false,
});

export const content: ContentPack = {
  sectors: {
    IT: { id: 'IT', name: 'IT', loadings: [0.8, 0.2, -0.3, 0, -0.1, 0.6, -0.2, -0.2, 0, 0.4], alphaPct: 11, idioVolPct: 20 },
    BANK: { id: 'BANK', name: 'Bank', loadings: [1.1, 0.9, -0.2, -0.2, -0.2, -0.3, -0.3, -1.2, 0, 0.7], alphaPct: 12, idioVolPct: 20 },
    AIR: { id: 'AIR', name: 'Aviation', loadings: [1.3, 1.0, -0.3, -0.3, -1.8, -0.8, -0.9, -0.5, 0, 0.8], alphaPct: 10, idioVolPct: 32 },
  },
  instruments: [stock('SOFT', 'IT', 4000), stock('BANK', 'BANK', 1000), stock('AIR', 'AIR', 2000)],
  indices: [{ id: 'IDX', name: 'Index', startLevel: 10000, members: ['SOFT', 'BANK', 'AIR'] }],
  breakerIndexId: 'IDX',
  ipos: [],
};

export function newCareer(over: Partial<NewCareerInput> = {}, cfg: MarketConfig = testConfig, pack: ContentPack = content): CareerState {
  return createCareer({ id: 'c1', slot: 1, type: 'FREEPLAY', difficulty: 'REALISTIC', seed: 'test-seed', ...over }, pack, cfg);
}

/** Advance one calendar day with hand-made bars: flat at the last close unless overridden (paise). */
export function step(s: CareerState, overrides: Record<string, Partial<Bar>> = {}, cfg: MarketConfig = testConfig) {
  const date = addDays(s.date, 1);
  const open = isOpen('IN', date, cfg.calendars);
  const bars = open
    ? Object.fromEntries(
        content.instruments.map((i) => {
          const p = s.prices[i.id]!.c;
          const bar: Bar = { date, o: p, h: p, l: p, c: p, v: 1000, prevClose: p, circuit: null, ...overrides[i.id] };
          return [i.id, bar];
        }),
      )
    : null;
  const day: DayMarket = { date, world: s.world, bars, inOpen: open, listings: {}, events: [], indices: null, indexMovePct: open ? 0 : null, breakerPct: null, shock: [] };
  return applyDay(s, day, content, cfg);
}

/** OHLC in rupees → partial bar in paise. */
export const ohlc = (o: number, h: number, l: number, c: number): Partial<Bar> => ({ o: R(o), h: R(h), l: R(l), c: R(c) });
