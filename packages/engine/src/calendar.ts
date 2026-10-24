// World clock calendars. One tick = one calendar day.
// India and US trade Mon–Fri minus their holidays; crypto trades every day.
import type { HolidayRules, MarketConfig } from './config';
import type { ISODate, Market } from './types';

const DAY_MS = 86_400_000;

const toDate = (iso: ISODate): Date => new Date(`${iso}T00:00:00Z`);

export const addDays = (iso: ISODate, n: number): ISODate =>
  new Date(toDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (iso: ISODate): number => toDate(iso).getUTCDay();

function isNthWeekday(d: Date, r: HolidayRules['nthWeekday'][number]): boolean {
  if (d.getUTCMonth() + 1 !== r.month || d.getUTCDay() !== r.weekday) return false;
  if (r.n > 0) return Math.ceil(d.getUTCDate() / 7) === r.n;
  return new Date(d.getTime() + 7 * DAY_MS).getUTCMonth() !== d.getUTCMonth(); // n = -1: last
}

export function isHoliday(iso: ISODate, rules: HolidayRules): boolean {
  const d = toDate(iso);
  return rules.fixed.includes(iso.slice(5)) || rules.dates.includes(iso) || rules.nthWeekday.some((r) => isNthWeekday(d, r));
}

export function isOpen(market: Market, iso: ISODate, cal: MarketConfig['calendars']): boolean {
  if (market === 'CRYPTO') return true;
  const wd = weekday(iso);
  return wd !== 0 && wd !== 6 && !isHoliday(iso, cal[market]);
}

/** First trading day strictly after `iso`. */
export function nextOpenDay(market: Market, iso: ISODate, cal: MarketConfig['calendars']): ISODate {
  let d = addDays(iso, 1);
  while (!isOpen(market, d, cal)) d = addDays(d, 1);
  return d;
}

export function addTradingDays(market: Market, iso: ISODate, n: number, cal: MarketConfig['calendars']): ISODate {
  let d = iso;
  for (let i = 0; i < n; i++) d = nextOpenDay(market, d, cal);
  return d;
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2030-01-06' → 'Mon 6 Jan 2030' (for player-facing engine messages). */
export const prettyDate = (iso: ISODate): string => `${WD[weekday(iso)]} ${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
