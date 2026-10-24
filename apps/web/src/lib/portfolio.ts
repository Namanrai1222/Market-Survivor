// Unified portfolio (prd.md P3-T08): where the money sits across desks, from the public career view.
import type { CareerView, Desk, Instrument } from '@ms/engine';
import { universe } from '@ms/content/universe';

export const INSTRUMENTS = new Map<string, Instrument>(universe.instruments.map((i) => [i.id, i]));
export const instrumentById = (id: string): Instrument | undefined => INSTRUMENTS.get(id);

export const DESK_LABEL: Record<Desk, string> = {
  STOCKS: 'Stocks',
  IPO: 'IPO shares',
  FUNDS: 'Funds',
  FIXED_INCOME: 'Fixed income',
  COMMODITIES: 'Commodities',
  GLOBAL: 'Global',
  CRYPTO: 'Crypto',
  PREDICTION: 'Forecasts',
};

export type CareerPosition = CareerView['positions'][number];

/** Positions held on one desk (frozen and self-custody coins included). */
export const positionsOn = (career: CareerView, desk: Desk): CareerPosition[] => career.positions.filter((p) => INSTRUMENTS.get(p.instrumentId)?.desk === desk);

export function allocation(career: CareerView): { desk: Desk; label: string; paise: number }[] {
  const by = new Map<Desk, number>();
  const add = (d: Desk, v: number) => by.set(d, (by.get(d) ?? 0) + v);
  for (const p of career.positions) {
    const desk = INSTRUMENTS.get(p.instrumentId)?.desk;
    if (desk) add(desk, p.valuePaise);
  }
  for (const fd of career.fds) if (fd.status === 'ACTIVE') add('FIXED_INCOME', fd.valuePaise ?? 0);
  for (const f of career.forecasts) add('PREDICTION', f.valuePaise);
  for (const t of career.transfers) add('CRYPTO', Math.round((t.qty / 1_000_000) * (career.prices[t.instrumentId]?.c ?? 0) * career.macro.usdInr));
  return [...by.entries()].filter(([, v]) => v > 0).map(([desk, paise]) => ({ desk, label: DESK_LABEL[desk], paise })).sort((a, b) => b.paise - a.paise);
}
