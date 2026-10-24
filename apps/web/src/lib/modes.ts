// Client-safe metadata for the game's modes and legal copy. Nothing here reveals outcomes:
// regime scripts, story checkpoints and grading live server-side (src/server/scenarios.ts, src/server/story.ts).

/** Bump when the Terms or Privacy Notice change: every player is asked to accept again. */
export const TERMS_VERSION = '2026-10-17';

/** Shown on every trading screen (design.md §11, legal review L-06). */
export const DISCLAIMER =
  'Virtual coins only. Fictional companies and simulated prices — not affiliated with any exchange or listed company. Educational game, not investment advice. Not registered with SEBI.';

export type ModeId = 'STORY' | 'FREEPLAY' | 'DAILY' | 'TIMEMACHINE' | 'ACADEMY';

export const MODES: { id: ModeId; title: string; line: string; art: string }[] = [
  { id: 'STORY', title: 'Story Mode', line: 'Ten years, ten crises. Learn with Victor, starting with your first paycheck.', art: '/art/modes/story.webp' },
  { id: 'FREEPLAY', title: 'Free Play', line: 'An endless world that turns calm, tense or wild on its own. Every desk open.', art: '/art/modes/freeplay.webp' },
  { id: 'DAILY', title: 'Daily Challenge', line: 'Fifteen trading days, the same market for everyone, one try per day.', art: '/art/modes/daily.webp' },
  { id: 'TIMEMACHINE', title: 'Time Machine', line: 'Fictional replays shaped like famous crashes. Can you survive them?', art: '/art/modes/timemachine.webp' },
  { id: 'ACADEMY', title: 'Academy', line: 'Short lessons and quizzes: orders, charges, circuit breakers, crashes.', art: '/art/modes/academy.webp' },
];

export interface TimeMachineMeta {
  id: string;
  title: string;
  /** The past episode whose shape the replay borrows. Prices and companies are fictional. */
  shapedLike: string;
  blurb: string;
  days: number;
}

export const TIME_MACHINE: TimeMachineMeta[] = [
  { id: 'TM-SUDDEN-STOP', title: 'The Sudden Stop', shapedLike: 'the 2020 pandemic crash', blurb: 'A calm market, then the fastest fall in years, then an equally fast rebound.', days: 90 },
  { id: 'TM-BOOM-BUST', title: 'Boom and Bust', shapedLike: 'the 2000–01 tech bust', blurb: 'Euphoria lifts everything. Then the air comes out, slowly and then all at once.', days: 120 },
  { id: 'TM-CREDIT-FREEZE', title: 'The Credit Freeze', shapedLike: 'the 2008 financial crisis', blurb: 'Banks wobble, then lenders stop lending. A long, grinding fall before any relief.', days: 150 },
  { id: 'TM-RATE-SHOCK', title: 'Rate Shock Year', shapedLike: 'the 2022 rate hikes', blurb: 'Hike after hike. Nothing crashes in a day, but almost everything drifts lower.', days: 120 },
  { id: 'TM-WAR-WEEKEND', title: 'War Weekend', shapedLike: 'the 2022 war and oil spike', blurb: 'News breaks over a weekend. Monday opens with a gap down and oil on the move.', days: 60 },
];

/** Story chapter titles (prd.md §7.1). Only Chapter 1 is playable so far. */
export const CHAPTERS: { n: number; title: string; years: string }[] = [
  { n: 1, title: 'First Paycheck', years: 'Jan–Jun 2030' },
  { n: 2, title: "Everyone's Getting Rich", years: '2030–31' },
  { n: 3, title: 'The Rate Shock', years: '2031–32' },
  { n: 4, title: 'Crypto Summer, Crypto Winter', years: '2032–33' },
  { n: 5, title: 'Drums of War', years: '2033' },
  { n: 6, title: 'The Silent Outbreak', years: '2034' },
  { n: 7, title: 'Cracks in the Banks', years: '2035' },
  { n: 8, title: 'The Election', years: '2036' },
  { n: 9, title: 'The Long Climb', years: '2037–38' },
  { n: 10, title: 'The Perfect Storm', years: '2039' },
];
export const PLAYABLE_CHAPTERS = 10;

/** Daily challenge length in calendar days (15 trading days). */
export const DAILY_DAYS = 21;
