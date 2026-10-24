// Save migrations. Schema 1 (before 2026-10) used real company and index ids; schema 2 uses the fictional
// universe and adds the mode fields; schema 3 (engine `upgradeCareer`) adds every desk beyond stocks.
// Pure functions: old document in, current document out.
import { LEGACY_IDS, LEGACY_SYMBOLS, universe } from '@ms/content/universe';
import { defaultConfig, upgradeCareer, type CareerState, type DayRecord } from '@ms/engine';

const mapId = (id: string): string => LEGACY_IDS[id] ?? id;
const mapKeys = <T>(o: Record<string, T> | null): Record<string, T> | null => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [mapId(k), v])) : o);

// Old symbols appear inside ledger and settlement memos ("Buy 10 RELIANCE @ ₹3,200").
const OLD_SYMBOLS = [...Object.keys(LEGACY_IDS), ...Object.keys(LEGACY_SYMBOLS)].sort((a, b) => b.length - a.length);
const SYMBOL_RE = new RegExp(`(?<![A-Z0-9&-])(${OLD_SYMBOLS.map((s) => s.replace(/[&-]/g, '\\$&')).join('|')})(?![A-Z0-9&-])`, 'g');
const mapMemo = (memo: string): string => memo.replace(SYMBOL_RE, (m) => mapId(LEGACY_SYMBOLS[m] ?? m));

type AnyCareer = Omit<CareerState, 'schema'> & { schema: number } & Partial<Pick<CareerState, 'maxDrawdown' | 'script' | 'endDate' | 'ended' | 'label' | 'story'>>;

export function migrateCareer(c: AnyCareer): CareerState {
  return upgradeCareer(toSchema2(c) as Parameters<typeof upgradeCareer>[0], universe, defaultConfig);
}

function toSchema2(c: AnyCareer): AnyCareer {
  if (c.schema >= 2) return c;
  const positions = Object.fromEntries(Object.values(c.positions).map((p) => [mapId(p.instrumentId), { ...p, instrumentId: mapId(p.instrumentId) }]));
  return {
    ...c,
    schema: 2 as const,
    prices: mapKeys(c.prices)!,
    indices: mapKeys(c.indices)!,
    positions,
    orders: c.orders.map((o) => ({ ...o, instrumentId: mapId(o.instrumentId) })),
    fills: c.fills.map((f) => ({ ...f, instrumentId: mapId(f.instrumentId) })),
    treasury: {
      ...c.treasury,
      ledger: c.treasury.ledger.map((e) => ({ ...e, memo: mapMemo(e.memo) })),
      unsettledItems: c.treasury.unsettledItems.map((i) => ({ ...i, memo: mapMemo(i.memo) })),
    },
    maxDrawdown: c.maxDrawdown ?? 0,
    script: c.script ?? null,
    endDate: c.endDate ?? null,
    ended: c.ended ?? false,
    label: c.label ?? null,
    story: c.story ?? (c.type === 'STORY' ? { chapter: 1, answered: {}, pending: null } : null),
  };
}

/** Day-log rows written before the rename carry old ids in their bar and index keys. */
export const migrateDay = (r: DayRecord): DayRecord => ({ ...r, bars: mapKeys(r.bars), indices: mapKeys(r.indices) });
