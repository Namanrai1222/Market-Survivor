// Story Mode content and rules (story.md). Server-only: checkpoint prompts, Victor's replies, grading and
// later chapters never ship to the client (TC-SEC-10/11). The client gets `storyView()` for the current
// chapter only.
import { BREAKER_INDEX, universe } from '@ms/content/universe';
import { netWorth, positionValue, type CareerState, type DayRecord, type GameEvent, type ISODate, type MarketConfig, type ScriptStep, type StoryProgress } from '@ms/engine';
import { CHAPTERS, PLAYABLE_CHAPTERS } from '../lib/modes';
import { LATE_CHAPTERS, endingFor, jakeReturn } from './storyChapters';
import { assetClasses, beatIndex, chapterReturn, deskOf, holdingsBreakdown, indexReturn, pct, scriptFor, type Chapter, type Checkpoint } from './storyKit';

const CH1: Chapter = {
  n: 1,
  start: '2030-01-01',
  end: '2030-06-30',
  unlocks: ['STOCKS'],
  // Calm bull, a short wobble in June (story.md: "Mild 5% pullback").
  script: [
    { from: '2030-01-01', regime: 'CALM' },
    { from: '2030-03-20', regime: 'EUPHORIA' },
    { from: '2030-05-01', regime: 'CALM' },
    { from: '2030-06-03', regime: 'STRESSED', drift: -0.6 },
    { from: '2030-06-08', regime: 'CRISIS', drift: -1.0 },
    { from: '2030-06-15', regime: 'RECOVERY', drift: 0.3 },
  ],
  setup: [
    'Your first salary has landed, and so has ₹1,000,000 of starting capital.',
    'Your neighbour Victor, a retired fund manager, catches you watching a hype trader’s videos. "Before you try to get rich," he says, "learn how not to get poor."',
    'You have six months of a calm market to learn the basics. Every stock here is a fictional company.',
  ],
  objectives: [
    {
      id: 'three-sectors',
      label: 'Hold at least 3 stocks from 3 different sectors at the end of June',
      primary: true,
      check: (s) => {
        const h = holdingsBreakdown(s);
        return { met: h.stocks >= 3 && h.sectors >= 3, progress: `${Math.min(h.stocks, 3)} of 3 stocks · ${Math.min(h.sectors, 3)} of 3 sectors` };
      },
    },
    {
      id: 'low-charges',
      label: 'Keep total charges under 1% of what you traded',
      primary: false,
      check: (s) => {
        const traded = s.fills.reduce((a, f) => a + f.valuePaise, 0);
        const charges = s.fills.reduce((a, f) => a + f.charges.total, 0);
        if (!traded) return { met: false, progress: 'No trades yet' };
        const r = charges / traded;
        return { met: r < 0.01, progress: `${(r * 100).toFixed(2)}% so far` };
      },
    },
    {
      id: 'stay-ahead',
      label: 'Finish with more than you started with',
      primary: false,
      check: (s, cfg) => {
        const r = netWorth(s) / cfg.startingTreasuryPaise - 1;
        return { met: r > 0, progress: `${pct(r)} so far` };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch1-concentration',
      date: '2030-02-04',
      prompt: (s) => {
        const h = holdingsBreakdown(s);
        if (!h.stocks) return 'A month in, and all your money is still cash. Victor asks what your plan is.';
        if (h.topShare >= 0.6) return `${Math.round(h.topShare * 100)}% of your invested money sits in one stock, ${h.top!.id}. Victor raises an eyebrow. What do you do?`;
        return `You hold ${h.stocks} stock${h.stocks > 1 ? 's' : ''} across ${h.sectors} sector${h.sectors > 1 ? 's' : ''}. Victor asks how you decided.`;
      },
      choices: [
        { id: 'diversify', label: 'Spread out across at least three sectors', reply: '"Good. Owning different kinds of businesses means one bad week in one industry can’t sink you. That’s not timid, that’s how you stay in the game."' },
        { id: 'keep', label: 'Keep things as they are', reply: '"Your call. Just know what you own: when everything sits in one place, one surprise decides your whole year."' },
        { id: 'concentrate', label: 'Put more into my best idea', reply: '"Conviction is fine. Concentration is a bet that you’re right about one thing. Ask yourself how you’d feel if it fell 20% tomorrow."' },
      ],
    },
    {
      id: 'ch1-pullback',
      date: '2030-06-17',
      prompt: (s) => {
        const lvl = Math.round(s.indices[BREAKER_INDEX.id]!.level).toLocaleString('en-US');
        const fromHigh = netWorth(s) / s.netWorthPeakPaise - 1;
        // Describe what actually happened in this run: the wobble is scripted, its size is not.
        return fromHigh <= -0.02
          ? `A rough fortnight. The ${BREAKER_INDEX.name} is at ${lvl} and your net worth is ${pct(fromHigh)} below its high. What do you do?`
          : `Markets got jumpy this fortnight and the news is gloomy, though your net worth is still close to its high. The ${BREAKER_INDEX.name} is at ${lvl}. What do you do?`;
      },
      choices: [
        { id: 'sell-all', label: 'Sell everything before it gets worse', reply: '"Selling after the fall turns a paper loss into a real one. Five percent is weather, not climate. Most of the time, the people who sell in a wobble buy back higher."' },
        { id: 'hold', label: 'Hold and stick to the plan', reply: '"That’s the hardest skill there is: doing nothing on purpose. If your reasons for owning something haven’t changed, a bad fortnight isn’t one of them."' },
        { id: 'buy-slowly', label: 'Buy a little more, slowly', reply: '"Adding slowly into weakness is how patient money is made. Just keep some cash: the next fall is never the last one."' },
      ],
    },
  ],
  news: [
    { date: '2030-01-06', level: 'INFO', text: 'Market Hour, Nina Brooks: "A quiet start to the decade. Analysts expect a calm year for the Survivor 50."' },
    { date: '2030-02-20', level: 'INFO', text: 'Jake Rivers posts: "Just made 30% on one stock in a week. Diversification is for people who are scared." Victor rolls his eyes.' },
    { date: '2030-03-24', level: 'WATCH', text: 'Market Hour: "Euphoria spreads. Small companies are up sharply this month and retail volumes are at a record."' },
    { date: '2030-05-05', level: 'INFO', text: 'Dr. Elena Ward: "Booms feel permanent from the inside. They never are."' },
    { date: '2030-06-04', level: 'WATCH', text: 'Market Hour: "Stocks slip as traders lock in gains. Is the party over?"' },
    { date: '2030-06-24', level: 'INFO', text: 'Market Hour: "The wobble fades. Six months in, the index is near where the year began."' },
  ],
  cliffhanger: 'Nina Brooks, on Market Hour: "Next week, six companies open their IPOs. The grey market is going wild."',
};

// Chapter 2 — Everyone's Getting Rich (story.md §4). Euphoric IPO wave, then stretched valuations.
const CH2: Chapter = {
  n: 2,
  start: '2030-07-01',
  end: '2031-03-31',
  unlocks: ['IPO', 'FUNDS', 'PREDICTION'],
  script: [
    { from: '2030-07-01', regime: 'EUPHORIA', drift: 0.12 },
    { from: '2030-11-15', regime: 'EUPHORIA' },
    { from: '2031-01-10', regime: 'CALM' },
    { from: '2031-02-10', regime: 'STRESSED', drift: -0.35, policy: 3 },
    { from: '2031-03-10', regime: 'CALM', policy: 3 },
  ],
  setup: [
    'Everyone at the office is talking about IPO listing gains. Your friend Sam asks you to "just tell him which IPO to apply to."',
    'Three desks open today: IPOs, Funds & SIP, and Forecasts.',
    'Victor’s advice for a boom: "Build the habits that will save you in the bust. Start investing every month, whatever the headlines say."',
  ],
  objectives: [
    {
      id: 'start-sip',
      label: 'Start a monthly SIP and keep it running',
      primary: true,
      check: (s) => {
        const running = s.sips.filter((x) => x.active);
        const paid = running.reduce((a, x) => a + x.installments, 0);
        return { met: running.length > 0 && paid > 0, progress: running.length ? `${running.length} SIP${running.length > 1 ? 's' : ''} · ${paid} instalment${paid === 1 ? '' : 's'} paid` : 'No SIP yet' };
      },
    },
    {
      id: 'three-ipos',
      label: 'Apply to 3 IPOs',
      primary: false,
      check: (s) => {
        const n = Object.values(s.ipos).filter((i) => i.application).length;
        return { met: n >= 3, progress: `${Math.min(n, 3)} of 3` };
      },
    },
    {
      id: 'first-forecast',
      label: 'Make your first forecast',
      primary: false,
      check: (s) => {
        const done = s.forecasts.some((f) => f.costPaise > 0 || f.payoutPaise > 0 || f.yes > 0 || f.no > 0);
        return { met: done, progress: done ? 'Done' : 'Not yet' };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch2-listing-hype',
      date: '2030-09-16',
      prompt: (s) => {
        const listed = Object.values(s.ipos).filter((i) => i.status === 'LISTED' && i.listingOpenPaise);
        const best = listed.sort((a, b) => b.listingOpenPaise! / b.bandHiPaise - a.listingOpenPaise! / a.bandHiPaise)[0];
        const name = best && universe.instruments.find((i) => i.id === best.id)?.name;
        return best
          ? `${name} listed ${pct(best.listingOpenPaise! / best.bandHiPaise - 1)} above its issue price and everyone is talking about it. You didn't get shares. Buy it now?`
          : 'The IPO everyone wanted is still in its bidding window, and your group chat says "buy on listing day, guaranteed pop". What’s your plan?';
      },
      choices: [
        { id: 'chase', label: 'Buy on listing day, before it runs further', reply: '"Listing-day buyers are paying for everyone else’s excitement. The people who got allotted at the issue price are often the ones selling to you."' },
        { id: 'wait', label: 'Wait a few months and look at the business', reply: '"Good. Once the hype fades, a listed company is just a company. Read what it earns and decide then."' },
        { id: 'skip', label: 'Skip it: I didn’t want it before the hype', reply: '"If you only want it because others made money, you don’t want it. You want their luck."' },
      ],
    },
    {
      id: 'ch2-tipster',
      date: '2030-10-21',
      prompt: () => 'A stranger adds you to a chat group called "100x Calls 🚀". The admin posts: "🔥 BUY BEFORE MONDAY 🔥 insider news on a tiny company, target 5x!! Don’t tell anyone!!" What do you do?',
      choices: [
        { id: 'ignore', label: 'Leave the group and report it', reply: '"That’s a pump-and-dump. They buy first, hype it to strangers, and sell into your buying. Promising sure returns on a tip is illegal for a reason."' },
        { id: 'small', label: 'Put in a small amount, just to see', reply: '"Small or large, you’d be the exit for someone who bought earlier. The amount you lose is the only part that’s up to you."' },
        { id: 'ask', label: 'Ask Victor what he thinks', reply: '"Anyone selling certainty is selling something else. Real information doesn’t arrive in a group with rocket emojis."' },
      ],
    },
    {
      id: 'ch2-sam',
      date: '2030-12-15',
      prompt: () => 'Sam calls. Small companies are up 35% this year and he wants to put his entire savings into a small-cap fund. "It only goes up, right?"',
      choices: [
        { id: 'diversify', label: 'Tell him to spread it out and keep an emergency fund', reply: '"You may have just saved your friend a very bad year. The best returns of a cycle are often followed by the worst."' },
        { id: 'go', label: 'Tell him to go for it', reply: '"Then make sure he knows small caps can halve in a bad year. If he can’t live with that, it’s not his money to risk."' },
        { id: 'dodge', label: 'Change the subject', reply: '"Sometimes saying nothing is a choice too. He’ll ask someone else, and they may be Jake."' },
      ],
    },
  ],
  news: [
    { date: '2030-07-03', level: 'INFO', text: 'Market Hour: "An IPO wave is coming. Grey-market premiums, an unofficial and unregulated price, are at a record."' },
    { date: '2030-08-12', level: 'WATCH', text: 'Market Hour: "Retail investors piled into this week’s IPOs. Most applicants got nothing in the lottery."' },
    { date: '2030-09-02', level: 'INFO', text: 'Your sister Priya: "I want to invest a fixed amount every month. Is a SIP like a savings account?" You explain rupee-cost averaging.' },
    { date: '2030-11-04', level: 'INFO', text: 'Jake Rivers: "Up 120% this year. Index funds are for boomers."' },
    { date: '2030-12-08', level: 'WARNING', text: 'Market Hour: "Valuations are above their historical range. Mid-caps are up 35% in a year."' },
    { date: '2031-02-11', level: 'WATCH', text: 'Market Hour: "An inflation surprise rattles markets. Bond yields tick up."' },
  ],
  cliffhanger: 'Dr. Elena Ward: "Inflation is at a six-year high. The central bank meets in three weeks."',
};

// Chapter 3 — The Rate Shock (story.md §4). A hiking cycle: bonds, growth stocks and mid-caps fall.
const CH3: Chapter = {
  n: 3,
  start: '2031-04-01',
  end: '2032-03-31',
  unlocks: ['FIXED_INCOME', 'COMMODITIES'],
  script: [
    { from: '2031-04-01', regime: 'STRESSED', drift: -0.12, policy: 6 },
    { from: '2031-06-09', regime: 'STRESSED', drift: -0.6, policy: 8 },
    { from: '2031-06-23', regime: 'STRESSED', policy: 5 },
    { from: '2031-11-01', regime: 'CALM', policy: 2 },
    { from: '2032-02-01', regime: 'RECOVERY', drift: 0.15, policy: -4 },
  ],
  setup: [
    'Inflation is the highest in six years and the central bank is done waiting.',
    'Two desks open today: Fixed income (deposits and government bonds) and Commodities (gold, silver, oil).',
    'Dr. Ward: "When rates rise, money gets more expensive. Everything priced on the far future, growth stocks, long bonds, falls first."',
  ],
  objectives: [
    {
      id: 'two-classes',
      label: 'End the chapter holding at least 2 asset classes',
      primary: true,
      check: (s) => {
        const n = assetClasses(s).size;
        return { met: n >= 2, progress: `${n} asset class${n === 1 ? '' : 'es'}` };
      },
    },
    {
      id: 'earn-interest',
      label: 'Earn interest from a deposit or hold a bond',
      primary: false,
      check: (s) => {
        const fd = s.fds.some((f) => f.status !== 'BROKEN');
        const bond = Object.values(s.positions).some((p) => deskOf.get(p.instrumentId) === 'FIXED_INCOME');
        return { met: fd || bond, progress: fd ? 'Deposit booked' : bond ? 'Bond held' : 'Not yet' };
      },
    },
    {
      id: 'gold-5',
      label: 'Hold gold worth at least 5% of your net worth',
      primary: false,
      check: (s) => {
        const gold = Object.values(s.positions).filter((p) => p.instrumentId === 'INGOT' || p.instrumentId === 'INGOTFUND').reduce((a, p) => a + positionValue(s, p), 0);
        const share = gold / Math.max(1, netWorth(s));
        return { met: share >= 0.05, progress: `${(share * 100).toFixed(1)}% in gold` };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch3-duration',
      date: '2031-04-21',
      prompt: (s) => `The central bank has started raising rates (now ${s.world.policyRate.toFixed(2)}%). Long government bonds fell this month. Why do bond prices fall when rates rise?`,
      choices: [
        { id: 'rates', label: 'New bonds pay more, so old low-paying bonds are worth less', reply: '"Exactly. And the longer a bond has left to run, the longer it’s stuck paying the old rate, so the bigger the fall. That’s duration."' },
        { id: 'default', label: 'The government might not pay back', reply: '"Not this time. The government pays every rupee. The price fell because new bonds pay more, not because anyone doubts the payment."' },
        { id: 'random', label: 'Bond prices are just random', reply: '"They move for one main reason: interest rates. Long bonds move most, which is why they hurt most in a hiking cycle."' },
      ],
    },
    {
      id: 'ch3-fd',
      date: '2031-08-18',
      prompt: (s) => `Banks now offer fixed deposits around ${(s.world.policyRate + 0.5).toFixed(2)}% for a year. That beats inflation for the first time in years. Move some cash into a deposit?`,
      choices: [
        { id: 'yes', label: 'Yes, lock in a good rate for a year', reply: '"Locking a high rate before cuts come is one of the few free lunches in a hiking cycle. Just keep enough cash for emergencies."' },
        { id: 'split', label: 'Split it: some in a deposit, some kept ready to invest', reply: '"Balanced. You earn a real return on the safe part and keep dry powder for when the selling stops."' },
        { id: 'no', label: 'No, I’ll keep it in stocks', reply: '"Your call. Remember stocks have to beat a safe deposit by enough to pay you for the risk. When deposits pay this much, that bar is higher."' },
      ],
    },
  ],
  news: [
    { date: '2031-04-03', level: 'WARNING', text: 'Market Hour: "The central bank signals a series of rate hikes to fight inflation."' },
    { date: '2031-05-12', level: 'WATCH', text: 'Dr. Elena Ward: "A deposit paying 6% is worth more when the market is falling 10%. That’s what higher rates do to stocks."' },
    { date: '2031-06-11', level: 'WARNING', text: 'Market Hour: "A brutal week. Growth stocks and freshly listed companies are down sharply from their highs."' },
    { date: '2031-07-05', level: 'INFO', text: (s) => (s.story?.answered['ch2-sam'] === 'go' ? 'Sam texts: "My small-cap fund is down 30%. You said go for it…" He’s staying invested, for now.' : s.story?.answered['ch2-sam'] === 'diversify' ? 'Sam texts: "Glad I kept my emergency fund. The small-cap part hurts, but I’m fine."' : 'Sam texts: "Everything I bought is down. Should I sell?" He wishes someone had warned him.') },
    { date: '2031-10-06', level: 'WATCH', text: 'Market Hour: "Is this the peak? Economists split on whether the hiking cycle is over."' },
    { date: '2032-02-03', level: 'INFO', text: 'Market Hour: "The central bank pauses. Rate-sensitive stocks rally."' },
  ],
  cliffhanger: 'Jake Rivers: "Stocks are boring. Crypto just did 3x. I’m all in."',
};

const CHAPTER_CONTENT: Chapter[] = [CH1, CH2, CH3, ...LATE_CHAPTERS];
const chapterDef = (n: number): Chapter | undefined => CHAPTER_CONTENT.find((c) => c.n === n);

export function storySetup(): { script: ScriptStep[]; endDate: ISODate; label: string; story: StoryProgress } {
  return { script: CH1.script as ScriptStep[], endDate: CH1.end, label: `Chapter 1 · ${CHAPTERS[0]!.title}`, story: { chapter: 1, answered: {}, pending: null } };
}

/**
 * Move a finished chapter's career into the next chapter: new script and end date, the chapter's desks
 * unlocked, grading restarted from today. Null if there is no next playable chapter.
 */
export function startNextChapter(s: CareerState, cfg: MarketConfig): CareerState | null {
  const cur = s.story && chapterDef(s.story.chapter);
  const next = s.story && chapterDef(s.story.chapter + 1);
  if (!cur || !next || !s.ended || next.n > PLAYABLE_CHAPTERS) return null;
  const view = storyView(s, cfg);
  const nw = netWorth(s);
  return {
    ...s,
    chapter: next.n,
    label: `Chapter ${next.n} · ${CHAPTERS[next.n - 1]!.title}`,
    script: scriptFor(next, s),
    endDate: next.end,
    ended: false,
    unlockedDesks: [...new Set([...s.unlockedDesks, ...next.unlocks])],
    netWorthPeakPaise: nw,
    maxDrawdown: 0,
    story: {
      ...s.story!,
      chapter: next.n,
      pending: null,
      start: { date: s.date, netWorthPaise: nw, index: s.indices[BREAKER_INDEX.id]!.level, cpi: s.world.cpiIndex },
      indexPeak: s.indices[BREAKER_INDEX.id]!.level,
      indexMaxDrawdown: 0,
      grades: { ...s.story!.grades, [cur.n]: view?.debrief?.grade ?? 'C' },
    },
  };
}

/** After an advance: keep the index's own peak and worst fall this chapter, for "fall less than the index". */
export function trackIndex(s: CareerState, records: DayRecord[]): CareerState {
  if (!s.story) return s;
  let peak = s.story.indexPeak ?? s.story.start?.index ?? s.baseline.indices[BREAKER_INDEX.id] ?? 0;
  let dd = s.story.indexMaxDrawdown ?? 0;
  for (const r of records) {
    const lvl = r.indices?.[BREAKER_INDEX.id];
    if (!lvl) continue;
    peak = Math.max(peak, lvl);
    dd = Math.max(dd, 1 - lvl / peak);
  }
  return { ...s, story: { ...s.story, indexPeak: peak, indexMaxDrawdown: dd } };
}

/** Story headlines whose date fell in (from, to], as alerts. */
export function storyNews(s: CareerState, from: ISODate): GameEvent[] {
  const ch = s.story && chapterDef(s.story.chapter);
  if (!ch) return [];
  return ch.news
    .filter((n) => n.date > from && n.date <= s.date)
    .map((n) => ({ kind: 'NOTICE', date: n.date, level: n.level, desk: null, message: typeof n.text === 'function' ? n.text(s) : n.text }));
}

/** The next unanswered checkpoint after today, for the advance to stop at. */
export function nextCheckpoint(s: CareerState): Checkpoint | null {
  const ch = s.story && chapterDef(s.story.chapter);
  if (!ch) return null;
  return ch.checkpoints.find((c) => !s.story!.answered[c.id] && c.date > s.date) ?? null;
}

/** Called after an advance: a checkpoint whose date has arrived becomes pending (the clock pauses). */
export function arriveAtCheckpoint(s: CareerState): CareerState {
  const ch = s.story && chapterDef(s.story.chapter);
  if (!ch || s.story!.pending || s.ended) return s;
  const due = ch.checkpoints.find((c) => !s.story!.answered[c.id] && c.date <= s.date);
  return due ? { ...s, story: { ...s.story!, pending: due.id } } : s;
}

export function answerCheckpoint(s: CareerState, checkpointId: string, choiceId: string): { state: CareerState; reply: string } | null {
  const ch = s.story && chapterDef(s.story.chapter);
  const cp = ch?.checkpoints.find((c) => c.id === checkpointId);
  const choice = cp?.choices.find((c) => c.id === choiceId);
  if (!cp || !choice || s.story!.pending !== checkpointId) return null;
  return { state: { ...s, story: { ...s.story!, pending: null, answered: { ...s.story!.answered, [checkpointId]: choiceId } } }, reply: choice.reply };
}

function grade(primary: boolean, optional: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (primary) return optional >= 3 ? 'A' : optional === 2 ? 'B' : 'C';
  return optional >= 1 ? 'D' : 'E';
}

/** What the client may see about the story: the current chapter only. */
export function storyView(s: CareerState, cfg: MarketConfig) {
  if (!s.story) return null;
  const ch = chapterDef(s.story.chapter);
  if (!ch) return null;
  const objectives = ch.objectives.map((o) => ({ id: o.id, label: o.label, primary: o.primary, ...o.check(s, cfg) }));
  const pending = s.story.pending ? ch.checkpoints.find((c) => c.id === s.story!.pending) : undefined;
  const primaryMet = objectives.filter((o) => o.primary).every((o) => o.met);
  const optionalMet = objectives.filter((o) => !o.primary && o.met).length;
  const g = grade(primaryMet, optionalMet);
  const you = chapterReturn(s, cfg);
  return {
    chapter: ch.n,
    title: CHAPTERS[ch.n - 1]!.title,
    months: CHAPTERS[ch.n - 1]!.years,
    start: s.story.start?.date ?? ch.start,
    end: ch.end,
    checkpointCount: ch.checkpoints.length,
    setup: ch.setup,
    objectives,
    checkpoint: pending ? { id: pending.id, prompt: pending.prompt(s), choices: pending.choices.map(({ id, label }) => ({ id, label })) } : null,
    debrief: s.ended
      ? {
          grade: g,
          headline: { A: `You played Chapter ${ch.n} like a pro`, B: 'A strong chapter', C: 'You learned the basics', D: 'A shaky chapter, but you’re still here', E: `Chapter ${ch.n} got away from you` }[g],
          youReturn: you,
          indexReturn: indexReturn(s),
          maxDrawdown: s.maxDrawdown,
          wentWell: objectives.filter((o) => o.met).map((o) => o.label),
          toLearn: objectives.filter((o) => !o.met).map((o) => o.label),
          cliffhanger: ch.cliffhanger,
          nextAvailable: ch.n < PLAYABLE_CHAPTERS,
          // The last chapter ends the story (story.md §7).
          ending: ch.n === CHAPTERS.length ? endingFor(s, { ...(s.story.grades ?? {}), [ch.n]: g }) : null,
        }
      : null,
    /** Jake's designed arc, beside yours (story.md §6 "ghost line"). */
    rival: { name: 'Jake Rivers', returnPct: jakeReturn(s), youPct: netWorth(s) / cfg.startingTreasuryPaise - 1 },
    chapters: CHAPTERS.map((c) => ({
      n: c.n,
      title: c.title,
      years: c.years,
      grade: c.n === ch.n && s.ended ? g : (s.story!.grades?.[c.n] ?? null),
      status: c.n < ch.n ? 'done' : c.n === ch.n ? (s.ended ? 'done' : 'current') : c.n <= PLAYABLE_CHAPTERS ? 'open' : 'soon',
    })),
  };
}
export type StoryView = NonNullable<ReturnType<typeof storyView>>;
