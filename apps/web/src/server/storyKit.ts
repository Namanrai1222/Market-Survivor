// Shared building blocks for Story Mode chapters (server-only): types, objective helpers, branch rolls.
import { createHash } from 'node:crypto';
import { BREAKER_INDEX, INDICES, STOCKS, universe } from '@ms/content/universe';
import { netWorth, positionValue, type CareerState, type Desk, type ISODate, type MarketConfig, type ScriptStep } from '@ms/engine';

export interface Choice {
  id: string;
  label: string;
  reply: string;
}
export interface Checkpoint {
  id: string;
  date: ISODate;
  prompt: (s: CareerState) => string;
  choices: Choice[];
}
export interface Objective {
  id: string;
  label: string;
  primary: boolean;
  /** Live status line ("2 of 3 sectors") and whether it is met right now. */
  check: (s: CareerState, cfg: MarketConfig) => { met: boolean; progress: string };
}
/** "Market Hour" headline that lands as an alert when the clock passes its date. Text can depend on your story so far. */
export interface News {
  date: ISODate;
  level: 'INFO' | 'WATCH' | 'WARNING';
  text: string | ((s: CareerState) => string);
}
export interface Chapter {
  n: number;
  start: ISODate;
  end: ISODate;
  /** Regime schedule; a function receives this career's hidden branch roll u ∈ [0, 1) (story.md §2 branch points). */
  script: ScriptStep[] | ((u: number) => ScriptStep[]);
  /** Desks this chapter opens (story.md §4). */
  unlocks: Desk[];
  setup: string[];
  objectives: Objective[];
  checkpoints: Checkpoint[];
  news: News[];
  cliffhanger: string;
}

export const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;
export const bySym = new Map(STOCKS.map((s) => [s.id, s]));

export function holdingsBreakdown(s: CareerState) {
  // Stocks only: the chapter objectives are about owning companies across sectors.
  const values = Object.values(s.positions)
    .filter((p) => bySym.has(p.instrumentId))
    .map((p) => ({ id: p.instrumentId, value: positionValue(s, p) }));
  const invested = values.reduce((a, v) => a + v.value, 0);
  const sectors = new Set(values.map((v) => bySym.get(v.id)?.sector));
  const top = values.sort((a, b) => b.value - a.value)[0];
  return { invested, sectors: sectors.size, stocks: values.length, top, topShare: top && invested ? top.value / invested : 0 };
}

/** The index since the player's first day (the market had two years of history before it). */
export function indexReturn(s: CareerState): number {
  const id = BREAKER_INDEX.id;
  const from = s.story?.start?.index ?? s.baseline.indices[id] ?? INDICES.find((d) => d.id === id)!.startLevel;
  return s.indices[id]!.level / from - 1;
}

/** Your return over this chapter (chapter 1: since the career began). */
export const chapterReturn = (s: CareerState, cfg: MarketConfig): number => netWorth(s) / (s.story?.start?.netWorthPaise ?? cfg.startingTreasuryPaise) - 1;

export const deskOf = new Map(universe.instruments.map((i) => [i.id, i.desk]));
/** Asset classes you hold: stock desks count once; deposits count as fixed income. */
export function assetClasses(s: CareerState): Set<string> {
  const out = new Set<string>();
  for (const p of Object.values(s.positions)) {
    const d = deskOf.get(p.instrumentId);
    if (d) out.add(d === 'IPO' ? 'STOCKS' : d === 'FUNDS' && p.instrumentId === 'INGOTFUND' ? 'COMMODITIES' : d);
  }
  if (s.fds.some((f) => f.status === 'ACTIVE')) out.add('FIXED_INCOME');
  return out;
}

export const beatIndex: Objective = {
  id: 'beat-index',
  label: `Beat the ${BREAKER_INDEX.name} index this chapter`,
  primary: false,
  check: (s, cfg) => {
    const you = chapterReturn(s, cfg);
    const idx = indexReturn(s);
    return { met: you > idx, progress: `You ${pct(you)} · index ${pct(idx)}` };
  },
};


/** Hidden branch roll for a chapter: fixed per career seed, never sent to the client. */
export function branchOf(s: Pick<CareerState, 'seed'>, chapter: number): number {
  return parseInt(createHash('sha256').update(`${s.seed}|branch|${chapter}`).digest('hex').slice(0, 8), 16) / 2 ** 32;
}

export const scriptFor = (ch: Chapter, s: Pick<CareerState, 'seed'>): ScriptStep[] => (typeof ch.script === 'function' ? ch.script(branchOf(s, ch.n)) : ch.script);

/** Stocks, funds and coins held, as a share of net worth, filtered by `pick`. */
export function shareOf(s: CareerState, pick: (instrumentId: string) => boolean): number {
  const v = Object.values(s.positions).filter((p) => pick(p.instrumentId)).reduce((a, p) => a + positionValue(s, p), 0);
  return v / Math.max(1, netWorth(s));
}

/** Your worst fall this chapter vs the index's worst fall (tracked day by day on the server). */
export const smallerFallThanIndex: Objective = {
  id: 'smaller-fall',
  label: `Fall less than the ${BREAKER_INDEX.name} at your worst point`,
  primary: true,
  check: (s) => {
    const you = s.maxDrawdown;
    const idx = s.story?.indexMaxDrawdown ?? 0;
    return { met: idx > 0.02 && you < idx, progress: `You −${(you * 100).toFixed(1)}% · index −${(idx * 100).toFixed(1)}%` };
  },
};

export type { CareerState, ISODate };
