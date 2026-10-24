// Story Mode chapters 4–10, Jake's arc and the endings (story.md §4, §6, §7). Server-only.
// Every country, company, party, exchange and person here is fictional (legal review L-01/L-19). War and
// illness are written with their human cost and never framed as a trading opportunity by sympathetic
// characters; elections are written neutrally, with no real party implied.
import { BREAKER_INDEX } from '@ms/content/universe';
import { netWorth, type ScriptStep } from '@ms/engine';
import { CHAPTERS } from '../lib/modes';
import { assetClasses, beatIndex, branchOf, chapterReturn, deskOf, pct, shareOf, smallerFallThanIndex, type CareerState, type Chapter } from './storyKit';

const answered = (s: CareerState, id: string): string | undefined => s.story?.answered[id];
const isCrypto = (id: string) => deskOf.get(id) === 'CRYPTO';
const hasFrozen = (s: CareerState) => Object.values(s.positions).some((p) => p.frozenValuePaise !== undefined);
const indexFall = (s: CareerState) => `${((s.story?.indexMaxDrawdown ?? 0) * 100).toFixed(1)}%`;
const fromStart = (s: CareerState, id: string) => {
  const start = s.baseline.prices[id];
  const now = s.prices[id]?.c;
  return start && now ? now / start - 1 : 0;
};
const tradesSince = (s: CareerState, date: string) => s.fills.filter((f) => f.date > date).length + s.deskFills.filter((f) => f.date > date).length;

// ---------- Chapter 4: Crypto Summer, Crypto Winter ----------
const CH4: Chapter = {
  n: 4,
  start: '2032-04-01',
  end: '2033-03-31',
  unlocks: ['CRYPTO'],
  // Equities barely notice: the shocks are crypto-only (CRY), in an otherwise calm market.
  script: [
    { from: '2032-04-01', regime: 'CALM', shocks: { CRY: 1.1 } },
    { from: '2032-07-12', regime: 'CALM', shocks: { CRY: 0.6 }, hits: { RKTY: 0.16 } },
    { from: '2032-07-26', regime: 'CALM', shocks: { CRY: 0.4 }, hits: { RKTY: -0.6 } },
    { from: '2032-08-01', regime: 'CALM', shocks: { CRY: 0.7 } },
    { from: '2032-10-12', regime: 'CALM', shocks: { CRY: -3, LIQ: -0.3 } },
    { from: '2032-12-08', regime: 'CALM', shocks: { CRY: -3 }, freezeExchange: true },
    { from: '2033-01-05', regime: 'CALM', shocks: { CRY: -1 } },
    { from: '2033-02-15', regime: 'CALM' },
  ],
  setup: [
    'Coinstone is up 60% in four months and Jake has stopped answering texts about anything else.',
    'The Crypto desk opens today. Coins trade every day, weekends included, with no circuit breakers.',
    'Victor: "Size a position so that if it went to zero, you would be sad, not ruined."',
  ],
  objectives: [
    {
      id: 'crypto-20',
      label: 'Keep crypto at or below 20% of your net worth',
      primary: true,
      check: (s) => {
        const share = shareOf(s, isCrypto);
        return { met: share <= 0.2, progress: `${(share * 100).toFixed(1)}% in crypto` };
      },
    },
    {
      id: 'not-your-keys',
      label: 'Have no coins stuck on Vaultex when it fails',
      primary: false,
      check: (s) => {
        const failed = s.world.exchange.status !== 'OK';
        return { met: failed && !hasFrozen(s), progress: !failed ? 'Vaultex still open' : hasFrozen(s) ? 'Some coins are frozen' : 'Nothing frozen' };
      },
    },
    {
      id: 'tip-ignored-4',
      label: 'Ignore the Tipster',
      primary: false,
      check: (s) => ({ met: answered(s, 'ch4-tipster') === 'ignore', progress: answered(s, 'ch4-tipster') ? (answered(s, 'ch4-tipster') === 'ignore' ? 'Ignored' : 'You took the bait') : 'Not yet' }),
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch4-custody',
      date: '2032-06-14',
      prompt: () => 'Vaultex, the biggest exchange, now pays 18% a year on coins you leave with it. Moving coins to your own wallet means no yield, but no exchange risk. What do you do?',
      choices: [
        { id: 'self', label: 'Move my coins to my own wallet', reply: '"When a bank pays 6% and an exchange pays 18%, the extra 12% is the price of a risk they aren’t telling you about."' },
        { id: 'stay', label: 'Leave them on Vaultex for the yield', reply: '"Then treat that 18% as danger money. Ask what they do with your coins to earn it."' },
        { id: 'split', label: 'Split: some in my wallet, some on the exchange', reply: '"Sensible. Never keep more on an exchange than you could lose without losing sleep."' },
      ],
    },
    {
      id: 'ch4-tipster',
      date: '2032-07-14',
      prompt: () => 'The Tipster is back: "🚀🚀 ROCKETYIELD (RKTY) 50x THIS MONTH 🚀🚀 dev team is doxxed trust me, get in before Binance-level listing!!" RKTY is already up sharply this week.',
      choices: [
        { id: 'ignore', label: 'Ignore it', reply: '"Good. Anonymous team, promised yield, a countdown. That’s the full set of red flags."' },
        { id: 'small', label: 'Buy a little, just for fun', reply: '"Fun money is fine. Just know who’s on the other side: the people who bought last week, waiting for you."' },
        { id: 'ask', label: 'Ask Victor', reply: '"If he knew it would go 50x, why would he tell strangers? He needs buyers, not friends."' },
      ],
    },
    {
      id: 'ch4-jake',
      date: '2032-12-12',
      prompt: (s) => `Jake calls at 2 a.m. His coins are frozen on Vaultex and the rest are down ${Math.round(-fromStart(s, 'CSTN') * 100)}% from the top. "I had it all in there. What do I do?"`,
      choices: [
        { id: 'listen', label: 'Listen, then help him make a budget', reply: '"That’s what friends are for. He won’t remember the advice tonight. He’ll remember you picked up."' },
        { id: 'told', label: '"I told you so"', reply: '"True, and useless at 2 a.m. Nobody learns anything from being right about them."' },
        { id: 'lend', label: 'Offer to lend him money', reply: '"Generous. Make sure it’s money you can lose, and that it pays rent, not another bet."' },
      ],
    },
  ],
  news: [
    { date: '2032-04-04', level: 'INFO', text: 'Market Hour: "Crypto summer is here. Coinstone is up 60% in four months and smaller coins far more."' },
    { date: '2032-06-07', level: 'INFO', text: 'Vaultex founder Marcus Cole on TV: "18% a year on your stablecoins, no risk. We’re the bank of the future."' },
    { date: '2032-09-15', level: 'INFO', text: 'Jake Rivers posts a screenshot: "5x this year. Told you all." He has quit his job.' },
    { date: '2032-10-14', level: 'WARNING', text: 'Market Hour: "LumaUSD, a stablecoin meant to stay at $1, has collapsed to 30 cents. Its sister token is down 99%. Panic spreads across crypto."' },
    { date: '2032-11-16', level: 'WARNING', text: 'Market Hour: "Reports say Vaultex lent customers’ coins to a sister trading firm. Withdrawal queues are growing."' },
    { date: '2033-02-08', level: 'INFO', text: 'Market Hour: "Crypto winter. Coinstone is down by more than half from its peak, while stocks barely noticed."' },
  ],
  cliffhanger: 'Nina Brooks: "Satellite images show troops massing on the Qarath–Solvane border. Oil is up 6% overnight."',
};

// ---------- Chapter 5: Drums of War ----------
const CH5: Chapter = {
  n: 5,
  start: '2033-04-01',
  end: '2034-03-31',
  unlocks: ['GLOBAL', 'COMMODITIES'],
  // Branch (Jul): ceasefire 55% vs a prolonged conflict 45%.
  // Branch (Jul): ceasefire 55% vs a prolonged conflict 45%.
  script: (u): ScriptStep[] => [
    { from: '2033-04-04', regime: 'STRESSED', drift: -0.1, shocks: { OIL: 1.2, GPR: 1.5 } },
    { from: '2033-04-18', regime: 'STRESSED', drift: -0.15, shocks: { OIL: 1.5, GPR: 2 } },
    // Saturday: the strikes. Crypto reacts at once; India and the US take all three days at Monday's open (a halt).
    { from: '2033-05-07', regime: 'CRISIS', drift: -8, shocks: { OIL: 6, GPR: 8, LIQ: -2 } },
    { from: '2033-05-10', regime: 'STRESSED', shocks: { OIL: 1.5, GPR: 1.5 } },
    { from: '2033-06-01', regime: 'STRESSED', drift: -0.1, shocks: { OIL: 0.6, GPR: 0.4, FX: 0.3 }, policy: 2 },
    ...(u < 0.55
      ? [
          { from: '2033-07-11', regime: 'RECOVERY' as const, drift: 0.25, shocks: { OIL: -1.5, GPR: -2 } },
          { from: '2033-09-15', regime: 'CALM' as const },
        ]
      : [
          { from: '2033-07-11', regime: 'STRESSED' as const, drift: -0.1, shocks: { OIL: 0.5, GPR: 0.5 }, policy: 4 },
          { from: '2033-10-15', regime: 'STRESSED' as const },
          { from: '2034-01-10', regime: 'RECOVERY' as const, drift: 0.1, shocks: { OIL: -1 } },
          { from: '2034-03-01', regime: 'CALM' as const },
        ]),
  ],
  setup: [
    'Two oil-exporting neighbours, Qarath and Solvane, are on the edge of war. A fifth of the world’s oil sails through the Strait of Kareem between them.',
    'Global stocks open today: US companies, priced in dollars. Commodities stay open for gold and oil.',
    'Dr. Ward: "India imports most of its oil. When oil jumps, so do petrol prices, inflation and the dollar."',
  ],
  objectives: [
    { ...smallerFallThanIndex },
    {
      id: 'five-classes',
      label: 'Hold 5 or more asset classes',
      primary: false,
      check: (s) => {
        const n = assetClasses(s).size;
        return { met: n >= 5, progress: `${n} of 5` };
      },
    },
    {
      id: 'hedger',
      label: 'Get paid on a forecast this chapter',
      primary: false,
      check: (s) => {
        const paid = s.forecasts.some((f) => f.payoutPaise > 0 && f.resolveDate > (s.story?.start?.date ?? ''));
        return { met: paid, progress: paid ? 'Paid out' : 'Not yet' };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch5-hedge',
      date: '2033-04-20',
      prompt: (s) => {
        const gold = shareOf(s, (id) => id === 'INGOT' || id === 'INGOTFUND');
        return `Talks between Qarath and Solvane have failed. Oil is climbing. ${gold > 0 ? `${Math.round(gold * 100)}% of your money is in gold.` : 'You hold no gold and no oil.'} What do you do?`;
      },
      choices: [
        { id: 'hedge', label: 'Add some gold or oil as insurance', reply: '"Insurance isn’t a bet on disaster. It’s a way to keep your plan alive if disaster comes. A small slice is enough."' },
        { id: 'wait', label: 'Wait and see', reply: '"Fair. Just remember insurance is cheapest before the fire, not during it."' },
        { id: 'reduce', label: 'Sell some stocks and hold cash', reply: '"Reducing risk you can’t sleep with is never wrong. Make sure you have a plan for getting back in."' },
      ],
    },
    {
      id: 'ch5-halt',
      date: '2033-05-10',
      prompt: (s) => `Solvane struck Qarath’s oil terminals on Saturday. Markets opened Monday in free fall and trading was halted. The index has fallen ${indexFall(s)} from its high and your net worth is down ${(s.maxDrawdown * 100).toFixed(1)}% from yours. What now?`,
      choices: [
        { id: 'sell', label: 'Sell everything when trading resumes', reply: '"The worst day to sell is usually the day everyone else is selling. You’d be locking in the fall at the bottom of the panic."' },
        { id: 'hold', label: 'Hold and open the crash playbook', reply: '"Check your sizes, keep your emergency cash, keep your SIPs. Then do nothing. It’s harder than it sounds."' },
        { id: 'buy', label: 'Buy good companies slowly over the next weeks', reply: '"Slowly is the key word. Nobody rings a bell at the bottom."' },
      ],
    },
    {
      id: 'ch5-fx',
      date: '2033-06-20',
      prompt: () => 'US stocks fell about 10% in dollars this quarter, but your US holdings fell less than that in rupees. Why?',
      choices: [
        { id: 'rupee', label: 'The rupee weakened, so each dollar is worth more rupees', reply: '"Right. A falling rupee cushions anything priced in dollars. That’s why owning some global assets is a hedge for an oil importer."' },
        { id: 'luck', label: 'Just luck', reply: '"Not luck: currency. Dollar assets gain in rupees when the rupee falls, which it often does when oil spikes."' },
        { id: 'fees', label: 'Lower fees', reply: '"Fees went the other way, if anything. It was the rupee: weaker rupee, more rupees per dollar."' },
      ],
    },
  ],
  news: [
    { date: '2033-04-05', level: 'WATCH', text: 'Market Hour: "Reports of troops on the Qarath–Solvane border. Families near the frontier are leaving their homes."' },
    { date: '2033-04-19', level: 'WARNING', text: 'Market Hour: "Peace talks collapse. Oil jumps 5% and the fear index rises sharply."' },
    { date: '2033-05-08', level: 'WARNING', text: 'Market Hour, Sunday: "Solvane has struck oil terminals in Qarath. Casualties are reported. Only crypto markets are open, and they are falling."' },
    { date: '2033-06-08', level: 'WATCH', text: 'Market Hour: "Sanctions on Solvane. The central bank says it is watching the rupee closely."' },
    { date: '2033-07-12', level: 'WARNING', text: (s) => (branchOf(s, 5) < 0.55 ? 'Market Hour: "A ceasefire is signed. Aid convoys reach the border towns. Oil falls 12% in a day."' : 'Market Hour: "Ceasefire talks fail. The Strait of Kareem is partly closed and oil stays high. Aid groups warn of a long crisis."') },
    { date: '2033-11-20', level: 'INFO', text: (s) => (branchOf(s, 5) < 0.55 ? 'Market Hour: "Shipping through the strait is back to normal and the index is near its pre-war level."' : 'Market Hour: "Months into the conflict, oil is still elevated and inflation is rising again."') },
  ],
  cliffhanger: 'Priya, from the hospital: "We’ve had eleven patients with a pneumonia we can’t identify."',
};

// ---------- Chapter 6: The Silent Outbreak ----------
const CH6: Chapter = {
  n: 6,
  start: '2034-04-01',
  end: '2035-03-31',
  unlocks: [],
  // Branch (Sep): a vaccine works fast (60%) or is delayed and a second wave comes (40%).
  // Branch (Sep): a vaccine works fast (60%) or is delayed and a second wave comes (40%).
  // Two one-day crashes (lockdown, then the second leg) trip the circuit breaker, as in story.md.
  script: (u): ScriptStep[] => [
    { from: '2034-04-03', regime: 'CALM' },
    { from: '2034-05-01', regime: 'STRESSED', drift: -0.8, shocks: { LIQ: -0.6 } },
    { from: '2034-05-16', regime: 'CRISIS', drift: -22, shocks: { LIQ: -3, CRD: 1 } },
    { from: '2034-05-17', regime: 'CRISIS', drift: -1.2, shocks: { LIQ: -1.5 } },
    { from: '2034-06-01', regime: 'CRISIS', drift: -22, shocks: { LIQ: -2 } },
    { from: '2034-06-02', regime: 'CRISIS', drift: -0.3, policy: -10 },
    { from: '2034-06-15', regime: 'RECOVERY', drift: 1.2, shocks: { LIQ: 1.5 }, policy: -6 },
    { from: '2034-06-22', regime: 'RECOVERY', drift: 0.3, policy: -3 },
    ...(u < 0.6
      ? [
          { from: '2034-09-12', regime: 'RECOVERY' as const, drift: 0.15, hits: { SKYHOP: 0.02, PALMSTAY: 0.02, CEDARHOUSE: 0.02, AIRBRIDGE: 0.02 } },
          { from: '2034-11-01', regime: 'CALM' as const },
        ]
      : [
          { from: '2034-09-12', regime: 'STRESSED' as const },
          { from: '2034-11-01', regime: 'STRESSED' as const, drift: -0.6 },
          { from: '2034-12-01', regime: 'RECOVERY' as const, drift: 0.2 },
          { from: '2035-02-01', regime: 'CALM' as const },
        ]),
  ],
  setup: [
    'A new respiratory illness is spreading. Priya is working double shifts at the hospital.',
    'No new desks this chapter. This one is about holding on to the plan you already have.',
    'Victor: "In a real panic, everything falls together for a while, even the things that are supposed to protect you."',
  ],
  objectives: [
    {
      id: 'keep-sip',
      label: 'Keep a SIP running all chapter',
      primary: true,
      check: (s) => {
        const running = s.sips.some((x) => x.active);
        const stopped = answered(s, 'ch6-priya') === 'stop';
        return { met: running && !stopped, progress: running ? 'SIP running' : 'No SIP running' };
      },
    },
    {
      id: 'back-above',
      label: 'End the chapter above where you started it',
      primary: false,
      check: (s, cfg) => {
        const r = chapterReturn(s, cfg);
        return { met: r > 0, progress: `${pct(r)} this chapter` };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch6-liquidity',
      date: '2034-05-25',
      prompt: () => 'Today gold fell, stocks fell and crypto fell, all at once. Wasn’t gold supposed to protect you?',
      choices: [
        { id: 'cash', label: 'Everyone was selling everything to raise cash', reply: '"Yes. In a panic, people sell what they can, not what they want to. Correlations go to one for a while. It passes."' },
        { id: 'broken', label: 'Gold doesn’t work any more', reply: '"It works over months, not days. In the first rush for cash even gold gets sold. Then it usually recovers first."' },
        { id: 'manip', label: 'Someone is manipulating the market', reply: '"It feels that way. It’s simpler: millions of people needing cash at the same time."' },
      ],
    },
    {
      id: 'ch6-priya',
      date: '2034-06-02',
      prompt: (s) => `Priya, exhausted after another shift, asks: "My SIP is down ${indexFall(s)}. Should I stop it until this is over?"`,
      choices: [
        { id: 'continue', label: 'Keep it going: she’s buying units cheap now', reply: '"Stopping a SIP in a crash means buying only when prices are high again. The bad months are when a SIP does its best work."' },
        { id: 'increase', label: 'Keep it, and add a little if her job is safe', reply: '"Only with money she won’t need. Her emergency fund comes first, especially now."' },
        { id: 'stop', label: 'Stop it until things calm down', reply: '"Understandable, but the calm usually arrives after prices have already recovered. Stopping now locks in the worst part."' },
      ],
    },
    {
      id: 'ch6-cheap',
      date: '2034-07-14',
      prompt: (s) => `Hotel stocks are down ${Math.round(Math.max(0, -fromStart(s, 'PALMSTAY')) * 100)}% from where you started. Your group chat says "they can’t go lower". Cheap?`,
      choices: [
        { id: 'value', label: 'Only if the company can survive a year with no guests', reply: '"That’s the right question. Cheap is a price. Value is a business that will still be there."' },
        { id: 'allin', label: 'Yes, go big: it has to bounce', reply: '"It doesn’t have to do anything. Some companies don’t make it through a crisis like this."' },
        { id: 'avoid', label: 'Stay away from the sector', reply: '"A fair choice. You don’t have to catch every rebound to do well."' },
      ],
    },
  ],
  news: [
    { date: '2034-04-04', level: 'INFO', text: 'Market Hour: "Doctors in two cities report a cluster of an unknown respiratory illness. Markets shrug."' },
    { date: '2034-05-02', level: 'WARNING', text: 'Market Hour: "The World Health Council declares a global health emergency. Travel and hotel stocks tumble."' },
    { date: '2034-05-17', level: 'WARNING', text: 'Market Hour: "A national lockdown begins. Hospitals are under strain. Trading was halted yesterday after a 10% fall."' },
    { date: '2034-06-04', level: 'WARNING', text: 'Market Hour: "The central bank cuts rates in an emergency meeting and promises to keep markets working."' },
    { date: '2034-06-16', level: 'INFO', text: 'Market Hour: "The government announces a large relief package. Stocks jump."' },
    { date: '2034-09-14', level: 'WARNING', text: (s) => (branchOf(s, 6) < 0.6 ? 'Market Hour: "A vaccine trial succeeds. Priya: \'For the first time in months, we have hope.\'"' : 'Market Hour: "The vaccine trial is delayed. Doctors brace for a second wave."') },
  ],
  cliffhanger: 'Nina Brooks: "Northgate Bank shares fall 18% after its auditors flag irregularities."',
};

// ---------- Chapter 7: Cracks in the Banks ----------
const CH7: Chapter = {
  n: 7,
  start: '2035-04-01',
  end: '2036-03-31',
  unlocks: [],
  // Branch (Jul): Northgate is rescued by a bigger bank (65%) or put under a moratorium (35%).
  // Branch (Jul): Northgate is rescued by a bigger bank (65%) or put under a moratorium (35%).
  // Credit shocks (CRD) hit lenders hardest; the wider index falls much less.
  script: (u): ScriptStep[] => [
    { from: '2035-04-02', regime: 'STRESSED', shocks: { CRD: 0.8 }, hits: { NORTHGATE: -0.07 } },
    { from: '2035-04-05', regime: 'CALM', shocks: { CRD: 0.3 } },
    { from: '2035-05-14', regime: 'STRESSED', drift: -0.1, shocks: { CRD: 3, LIQ: -0.5 }, hits: { CRESCENTFIN: -0.35, MANGROVE: -0.04, EASYLOAN: -0.04, HEARTHFIN: -0.05 } },
    { from: '2035-05-21', regime: 'STRESSED', shocks: { CRD: 0.6 }, hits: { CRESCENTFIN: -0.05 } },
    { from: '2035-06-13', regime: 'STRESSED', drift: -0.2, shocks: { CRD: 2.5 }, hits: { NORTHGATE: -0.3 } },
    { from: '2035-06-20', regime: 'STRESSED', shocks: { CRD: 0.8 } },
    ...(u < 0.65
      ? [
          { from: '2035-07-15', regime: 'RECOVERY' as const, drift: 0.15, shocks: { CRD: -1.5 }, hits: { NORTHGATE: 0.04 } },
          { from: '2035-07-25', regime: 'CALM' as const },
        ]
      : [
          { from: '2035-07-15', regime: 'STRESSED' as const, drift: -0.3, shocks: { CRD: 1.5 }, hits: { NORTHGATE: -0.1 } },
          { from: '2035-08-01', regime: 'STRESSED' as const },
          { from: '2035-10-01', regime: 'RECOVERY' as const, drift: 0.1, shocks: { CRD: -1 } },
          { from: '2036-01-01', regime: 'CALM' as const },
        ]),
  ],
  setup: [
    'Northgate Bank, a mid-sized private lender, has had a bad audit. Crescent Finance, a big non-bank lender, is struggling to refinance its debts.',
    'No new desks. This chapter is about the risk inside things that feel safe: banks, lenders and debt funds.',
    'Victor: "Never own so much of one company that its worst day becomes yours."',
  ],
  objectives: [
    {
      id: 'max-15',
      label: 'End with no single stock above 15% of your net worth',
      primary: true,
      check: (s) => {
        const nw = Math.max(1, netWorth(s));
        let top = 0;
        let name = '';
        for (const p of Object.values(s.positions)) {
          const d = deskOf.get(p.instrumentId);
          if (d !== 'STOCKS' && d !== 'IPO') continue;
          const v = (p.qty * (s.prices[p.instrumentId]?.c ?? 0)) / nw;
          if (v > top) [top, name] = [v, p.instrumentId];
        }
        return { met: top <= 0.15, progress: top ? `Largest: ${name} ${(top * 100).toFixed(1)}%` : 'No stocks held' };
      },
    },
    {
      id: 'no-crescent',
      label: 'Hold no Crescent Finance shares at the end',
      primary: false,
      check: (s) => ({ met: !s.positions.CRESCENTFIN, progress: s.positions.CRESCENTFIN ? 'Still holding' : 'None held' }),
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch7-debt',
      date: '2035-05-16',
      prompt: () => 'Crescent Finance just missed a bond payment. Debt funds that lent to it fell 6% in a day. Isn’t debt supposed to be safe?',
      choices: [
        { id: 'credit', label: 'Lending only is safe if the borrower can pay you back', reply: '"Exactly. Government debt carries rate risk. Company debt carries rate risk and the risk the company can’t pay. That second one is credit risk."' },
        { id: 'scam', label: 'Debt funds are a scam', reply: '"Not a scam: a different risk. A short government debt fund and a high-yield corporate one are very different animals."' },
        { id: 'nothing', label: 'It will bounce back tomorrow', reply: '"Maybe, maybe not. When a borrower defaults, part of that money may never come back."' },
      ],
    },
    {
      id: 'ch7-northgate',
      date: '2035-06-25',
      prompt: (s) => `Northgate Bank is down ${Math.round(Math.max(0, -fromStart(s, 'NORTHGATE')) * 100)}% since you started. Rumours say a bigger bank might rescue it, and that it could double if that happens. Buy?`,
      choices: [
        { id: 'small', label: 'A small amount I can afford to lose entirely', reply: '"That’s the only honest way to bet on a rescue. Shareholders are often the last people a rescue saves."' },
        { id: 'big', label: 'A big position: it has to be rescued', reply: '"Banks get rescued for their depositors, not their shareholders. You could be right about the rescue and still lose most of it."' },
        { id: 'avoid', label: 'Stay away', reply: '"Missing a rebound costs you nothing. Being wrong on a big position can cost you years."' },
      ],
    },
  ],
  news: [
    { date: '2035-04-03', level: 'WARNING', text: 'Market Hour: "Northgate Bank falls 18% after auditors flag hidden bad loans."' },
    { date: '2035-05-15', level: 'WARNING', text: 'Market Hour: "Crescent Finance misses a bond payment. Lenders like it are sold off and debt funds take a hit."' },
    { date: '2035-06-14', level: 'WARNING', text: 'Market Hour: "Queues outside Northgate branches after a rumour spreads online. The regulator reminds savers that deposits are insured up to a limit."' },
    { date: '2035-07-16', level: 'WARNING', text: (s) => (branchOf(s, 7) < 0.65 ? 'Market Hour: "Northgate will merge into a larger bank. Depositors are safe; shareholders get one new share for every twelve."' : 'Market Hour: "The regulator puts Northgate under a moratorium. Withdrawals are capped and shareholders face heavy losses."') },
    { date: '2035-11-03', level: 'INFO', text: 'Market Hour: "The panic fades. Strong banks have recovered most of their losses."' },
  ],
  cliffhanger: 'Nina Brooks: "Six months to the general election. The exit polls already disagree."',
};

// ---------- Chapter 8: The Election ----------
const CH8: Chapter = {
  n: 8,
  start: '2036-04-01',
  end: '2037-03-31',
  unlocks: [],
  // Branch (results day): Unity Front majority 45%, People's Alliance majority 35%, hung parliament 20%.
  // Branch (results day): Unity Front majority 45%, People's Alliance majority 35%, hung parliament 20%.
  script: (u): ScriptStep[] => [
    { from: '2036-04-01', regime: 'STRESSED' },
    { from: '2036-06-04', regime: 'CALM', drift: 0.5 },
    ...(u < 0.45
      ? [
          { from: '2036-06-10', regime: 'EUPHORIA' as const, drift: 1.2, hits: { GRANITEW: 0.03, CASCADE: 0.03, NCBANK: 0.03, CROWNBK: 0.03 } },
          { from: '2036-06-17', regime: 'CALM' as const },
        ]
      : u < 0.8
        ? [
            { from: '2036-06-10', regime: 'CRISIS' as const, drift: -14, hits: { SAFFRON: 0.03, EVERYDAY: 0.03, RIDGEWAY: 0.03, VERDANT: 0.03 } },
            { from: '2036-06-11', regime: 'STRESSED' as const, drift: 0.2 },
            { from: '2036-07-15', regime: 'CALM' as const },
          ]
        : [
            { from: '2036-06-10', regime: 'CRISIS' as const, drift: -18 },
            { from: '2036-06-11', regime: 'STRESSED' as const, drift: -0.3 },
            { from: '2036-07-01', regime: 'RECOVERY' as const, drift: 0.2 },
            { from: '2036-08-01', regime: 'CALM' as const },
          ]),
  ],
  setup: [
    'A general election is coming. Unity Front promises big infrastructure spending; People’s Alliance promises rural income support. Each plan helps some industries and hurts others.',
    'No new desks. The Forecasts desk will carry questions about the result.',
    'Victor: "Elections change which sectors lead. They rarely change where a whole economy goes over ten years."',
  ],
  objectives: [
    { ...smallerFallThanIndex },
    {
      id: 'hedged',
      label: 'Make a forecast on this chapter’s markets',
      primary: false,
      check: (s) => {
        const done = s.forecasts.some((f) => f.openedDate > (s.story?.start?.date ?? '') && (f.costPaise > 0 || f.payoutPaise > 0));
        return { met: done, progress: done ? 'Done' : 'Not yet' };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch8-allin',
      date: '2036-06-05',
      prompt: () => 'Exit polls say Unity Front will win comfortably. Infrastructure stocks are already rising. Go all-in on infra before the results?',
      choices: [
        { id: 'allin', label: 'All-in on infrastructure', reply: '"Polls are not results. If they’re wrong, you’ve bet your whole portfolio on a coin toss you thought was rigged."' },
        { id: 'tilt', label: 'Tilt a little towards infra, keep the rest balanced', reply: '"Sensible: a view, not a bet. You’ll be fine either way."' },
        { id: 'balanced', label: 'Stay balanced and wait for the result', reply: '"Nothing wrong with sitting this one out. The market will still be there next week."' },
      ],
    },
    {
      id: 'ch8-results',
      date: '2036-06-11',
      prompt: (s) => {
        const q = s.indices[BREAKER_INDEX.id]!;
        const move = q.level / q.prevLevel - 1;
        return `Results day: ${branchOf(s, 8) < 0.45 ? 'Unity Front wins a majority' : branchOf(s, 8) < 0.8 ? 'People’s Alliance wins a surprise majority' : 'no party has a majority'}. The index moved ${pct(move)} today. What do you do?`;
      },
      choices: [
        { id: 'sell', label: 'Sell before it gets worse', reply: '"One day’s reaction to a result is rarely the long-term story. You’d be selling to the people who think it through."' },
        { id: 'hold', label: 'Hold', reply: '"Good. Let the dust settle and see which policies actually pass."' },
        { id: 'rebalance', label: 'Rebalance back to my plan', reply: '"That’s what plans are for. Trim what jumped, add to what fell, move on."' },
      ],
    },
  ],
  news: [
    { date: '2036-04-08', level: 'WATCH', text: 'Market Hour: "Campaigning begins. The fear index is up a third as polls swing week to week."' },
    { date: '2036-06-04', level: 'INFO', text: 'Market Hour: "Exit polls give Unity Front a clear lead. Pollsters warn their margin of error is wide."' },
    { date: '2036-06-10', level: 'WARNING', text: (s) => (branchOf(s, 8) < 0.45 ? 'Market Hour: "Unity Front wins a majority. Construction and cement stocks jump."' : branchOf(s, 8) < 0.8 ? 'Market Hour: "A surprise: People’s Alliance wins. The exit polls were wrong. Consumer and rural stocks rise while the index slides."' : 'Market Hour: "A hung parliament. Coalition talks begin and markets fall sharply."') },
    { date: '2036-07-20', level: 'INFO', text: 'Market Hour: "The new government’s first budget is out. Sector rotation is in full swing."' },
  ],
  cliffhanger: 'Jake Rivers, humbled: "I lost almost everything in the crypto crash. What did you do differently?"',
};

// ---------- Chapter 9: The Long Climb ----------
const CH9: Chapter = {
  n: 9,
  start: '2037-04-01',
  end: '2038-12-31',
  unlocks: [],
  script: [
    { from: '2037-04-01', regime: 'CALM', drift: 0.05 },
    { from: '2038-01-10', regime: 'EUPHORIA', hits: { BRIGHTLINE: 0.006, SOLARIS: 0.003, APEXAGRO: 0.004 } },
    { from: '2038-06-06', regime: 'EUPHORIA', hits: { SOLARIS: 0.08 } },
    { from: '2038-06-20', regime: 'EUPHORIA', hits: { SOLARIS: -0.25 } },
    { from: '2038-07-06', regime: 'EUPHORIA' },
    { from: '2038-09-06', regime: 'STRESSED', drift: -0.15, hits: { BRIGHTLINE: -0.4 } },
    { from: '2038-09-20', regime: 'STRESSED', drift: -0.2, hits: { BRIGHTLINE: -0.05, SOLARIS: -0.02, APEXAGRO: -0.02 } },
    { from: '2038-11-01', regime: 'CALM' },
  ],
  setup: [
    'Twenty-one quiet months. The index climbs steadily and nothing much happens, which is exactly when people start doing too much.',
    'Small companies are the talk of every group chat. Brightline Infra has quadrupled.',
    'Victor: "Compounding is boring. That’s why so few people stick with it."',
  ],
  objectives: [
    {
      id: 'few-trades',
      label: 'Make fewer than 40 trades this chapter',
      primary: true,
      check: (s) => {
        const n = tradesSince(s, s.story?.start?.date ?? '');
        return { met: n < 40, progress: `${n} trades` };
      },
    },
    {
      id: 'smallcap-20',
      label: 'Keep small companies under 20% of your net worth',
      primary: false,
      check: (s) => {
        const small = new Set(['SPARROW', 'BRIGHTLINE', 'SOLARIS', 'APEXAGRO', 'LOOMCRAFT', 'AIRBRIDGE']);
        const share = shareOf(s, (id) => small.has(id));
        return { met: share < 0.2, progress: `${(share * 100).toFixed(1)}% in small caps` };
      },
    },
    {
      id: 'tip-ignored-9',
      label: 'Ignore the Tipster',
      primary: false,
      check: (s) => ({ met: answered(s, 'ch9-tipster') === 'ignore', progress: answered(s, 'ch9-tipster') ? (answered(s, 'ch9-tipster') === 'ignore' ? 'Ignored' : 'You took the bait') : 'Not yet' }),
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch9-trading',
      date: '2037-11-15',
      prompt: (s) => {
        const since = s.story?.start?.date ?? '';
        const n = tradesSince(s, since);
        const charges = s.fills.filter((f) => f.date > since).reduce((a, f) => a + f.charges.total, 0) + s.deskFills.filter((f) => f.date > since).reduce((a, f) => a + f.fees.reduce((x, y) => x + y.paise, 0), 0);
        return `You’ve made ${n} trades since April and paid ₹${Math.round(charges / 100).toLocaleString('en-US')} in charges. The index is up ${pct(s.indices[BREAKER_INDEX.id]!.level / (s.story?.start?.index ?? 1) - 1)}. Victor asks what all the trading is for.`;
      },
      choices: [
        { id: 'slow', label: 'Fair point: trade less, let it compound', reply: '"Every trade has to beat its own costs before it earns you anything. Most don’t."' },
        { id: 'skill', label: 'I’m getting better at timing', reply: '"Maybe. Check it honestly at the end of the year: you against doing nothing."' },
        { id: 'bored', label: 'Honestly? I’m bored', reply: '"That’s the most honest answer I’ve heard. Find another hobby. Your portfolio doesn’t need entertainment."' },
      ],
    },
    {
      id: 'ch9-tipster',
      date: '2038-06-08',
      prompt: () => 'The Tipster, again: "SOLARIS GREEN 10X GUARANTEED 💯 government contract coming, insiders loading up, LAST CHANCE!!" Solaris is up 40% in a week.',
      choices: [
        { id: 'ignore', label: 'Ignore it', reply: '"Guaranteed returns and insider talk: illegal, and almost always a pump-and-dump. Walking away is the win."' },
        { id: 'small', label: 'Buy a little', reply: '"You’re still the buyer they need. Watch what happens to the price after the promoters sell."' },
        { id: 'report', label: 'Report the group', reply: '"Even better. Fewer people get burned."' },
      ],
    },
    {
      id: 'ch9-circuit',
      date: '2038-09-08',
      prompt: (s) => `Brightline Infra’s founder resigned and admitted the accounts were inflated. The stock has hit its lower circuit every day since${s.positions.BRIGHTLINE ? ', and your sell order isn’t filling' : ''}. Why can’t sellers get out?`,
      choices: [
        { id: 'buyers', label: 'At the lower limit there are almost no buyers', reply: '"Right. A price band stops the fall for the day, but it can’t create buyers. Liquidity disappears exactly when you need it."' },
        { id: 'broken', label: 'The exchange is broken', reply: '"It’s working as designed. The band limits the daily move; it doesn’t guarantee anyone will buy."' },
        { id: 'wait', label: 'It will bounce tomorrow', reply: '"After a fraud, there’s often no floor until the truth is fully out. That’s why position size matters more than timing."' },
      ],
    },
    {
      id: 'ch9-jake',
      date: '2038-10-20',
      prompt: () => 'Jake wants to start again, properly this time. "Can you help me make a plan? A real one?"',
      choices: [
        { id: 'help', label: 'Help him set up a SIP and an emergency fund', reply: '"That might be the best investment you make this year."' },
        { id: 'busy', label: 'Tell him you’re busy', reply: '"Everyone’s busy. He asked you because you’re the one who stayed calm."' },
        { id: 'tips', label: 'Give him a few stock tips instead', reply: '"Tips are what got him here. A plan is what gets him out."' },
      ],
    },
  ],
  news: [
    { date: '2037-04-02', level: 'INFO', text: 'Market Hour: "A calm, steady market. Trading volumes are low and nobody can remember the last scare."' },
    { date: '2038-01-15', level: 'WARNING', text: 'Market Hour: "Small-cap stocks are up 60% in a year. Valuations are extreme by any historical measure."' },
    { date: '2038-06-22', level: 'WATCH', text: 'Market Hour: "Solaris Green collapses after a week-long surge. Regulators are looking at a social-media promotion ring."' },
    { date: '2038-09-07', level: 'WARNING', text: 'Market Hour: "Brightline Infra’s founder resigns, admitting years of inflated accounts. The stock is locked at its lower limit."' },
    { date: '2038-11-12', level: 'INFO', text: 'Market Hour: "Small caps are down sharply from their peak. Large, profitable companies held up best."' },
  ],
  cliffhanger: 'Dr. Ward: "Global growth indicators just turned negative. Oil is rising again. Something big is coming."',
};

// ---------- Chapter 10: The Perfect Storm ----------
const VICTOR_SILENT = '(Victor just nods. You don’t need him any more.) ';
const CH10: Chapter = {
  n: 10,
  start: '2039-01-01',
  end: '2039-12-31',
  unlocks: [],
  // Final branch (Jul): coordinated global stimulus works (60%) or comes late (40%).
  // Final branch (Jul): coordinated global stimulus works (60%) or comes late (40%).
  script: (u): ScriptStep[] => [
    { from: '2039-01-03', regime: 'STRESSED', drift: -0.3 },
    { from: '2039-03-07', regime: 'STRESSED', drift: -0.4, shocks: { OIL: 2, GPR: 1.5, FX: 0.6 } },
    { from: '2039-04-12', regime: 'CRISIS', drift: -22, shocks: { CRD: 3, LIQ: -3 } },
    { from: '2039-04-13', regime: 'CRISIS', drift: -1, shocks: { CRD: 1.5, LIQ: -1 } },
    { from: '2039-05-10', regime: 'CRISIS', drift: -0.5, shocks: { CRY: -4 } },
    { from: '2039-06-07', regime: 'STRESSED', drift: -0.4, shocks: { FX: 0.8 }, policy: 8 },
    ...(u < 0.6
      ? [
          { from: '2039-07-05', regime: 'RECOVERY' as const, drift: 0.8, policy: -8 },
          { from: '2039-09-01', regime: 'RECOVERY' as const, drift: 0.2 },
          { from: '2039-11-01', regime: 'CALM' as const },
        ]
      : [
          { from: '2039-07-05', regime: 'STRESSED' as const, drift: -0.2 },
          { from: '2039-09-06', regime: 'CRISIS' as const, drift: -1.2 },
          { from: '2039-09-20', regime: 'STRESSED' as const },
          { from: '2039-11-01', regime: 'RECOVERY' as const, drift: 0.5, policy: -8 },
        ]),
  ],
  setup: [
    'A global recession, an oil shock and a banking scare are arriving at once. This is the final chapter.',
    'Victor won’t stop the clock to advise you this time. Five moments will test what every chapter taught you.',
    'Victor: "You don’t need me any more. Trust the plan you built."',
  ],
  objectives: [
    {
      id: 'survive-50',
      label: 'Never fall more than 50% from your peak this chapter',
      primary: true,
      check: (s) => ({ met: s.maxDrawdown < 0.5, progress: `Worst fall −${(s.maxDrawdown * 100).toFixed(1)}%` }),
    },
    {
      id: 'real-return',
      label: 'Finish the year with a return above inflation',
      primary: false,
      check: (s, cfg) => {
        const r = chapterReturn(s, cfg);
        const inf = s.world.cpiIndex / (s.story?.start?.cpi ?? s.world.cpiIndex) - 1;
        return { met: r > inf, progress: `You ${pct(r)} · inflation ${pct(inf)}` };
      },
    },
    {
      id: 'hedge-held',
      label: 'Hold a hedge: gold, bonds, a deposit or a forecast',
      primary: false,
      check: (s) => {
        const held = Object.keys(s.positions).some((id) => id.startsWith('INGOT') || deskOf.get(id.split('@')[0]!) === 'FIXED_INCOME') || s.fds.some((f) => f.status === 'ACTIVE') || s.forecasts.some((f) => f.yes > 0 || f.no > 0);
        return { met: held, progress: held ? 'Hedged' : 'No hedge' };
      },
    },
    beatIndex,
  ],
  checkpoints: [
    {
      id: 'ch10-recession',
      date: '2039-01-20',
      prompt: (s) => `Recession signals everywhere. You hold ${assetClasses(s).size} asset class${assetClasses(s).size === 1 ? '' : 'es'}. Do you change anything?`,
      choices: [
        { id: 'diversify', label: 'Check my mix and rebalance to my plan', reply: `${VICTOR_SILENT}Chapter 1: spread across sectors so one bad industry can’t sink you.` },
        { id: 'cash', label: 'Sell everything and wait', reply: `${VICTOR_SILENT}Chapter 1: selling on fear usually means buying back higher.` },
        { id: 'nothing', label: 'Do nothing', reply: `${VICTOR_SILENT}Doing nothing is a plan, if your plan was right to begin with.` },
      ],
    },
    {
      id: 'ch10-oil',
      date: '2039-03-10',
      prompt: () => 'Solvane tensions are back and oil is up 35%. Your move?',
      choices: [
        { id: 'hedge', label: 'Keep or add a small slice of gold', reply: `${VICTOR_SILENT}Chapter 5: insurance is cheapest before the fire.` },
        { id: 'oil', label: 'Pile into oil to ride the spike', reply: `${VICTOR_SILENT}Chapter 5: spikes reverse fast when the news turns.` },
        { id: 'ignore', label: 'Ignore it', reply: `${VICTOR_SILENT}Fine, if you already own some protection.` },
      ],
    },
    {
      id: 'ch10-halt',
      date: '2039-04-14',
      prompt: (s) => `Atlantic Meridian Bank, one of the world’s largest, has collapsed. Trading was halted. The index is down ${indexFall(s)} from its high. What do you do?`,
      choices: [
        { id: 'sell', label: 'Sell when trading resumes', reply: `${VICTOR_SILENT}Chapter 5: the worst day to sell is the day everyone else is selling.` },
        { id: 'hold', label: 'Hold and follow the crash playbook', reply: `${VICTOR_SILENT}Chapter 6: panics pass. Plans that survive them win.` },
        { id: 'buy', label: 'Buy quality slowly', reply: `${VICTOR_SILENT}Chapter 6: slowly, with money you won’t need for years.` },
      ],
    },
    {
      id: 'ch10-currency',
      date: '2039-06-10',
      prompt: () => 'The rupee has fallen 10% this year. Your global stocks fell less than you expected in rupees. Why?',
      choices: [
        { id: 'rupee', label: 'A weaker rupee lifts dollar assets in rupees', reply: `${VICTOR_SILENT}Chapter 5: currency is a hedge for an oil importer.` },
        { id: 'luck', label: 'Luck', reply: `${VICTOR_SILENT}Chapter 5: not luck, currency.` },
        { id: 'fees', label: 'Lower fees', reply: `${VICTOR_SILENT}Chapter 5: it was the rupee.` },
      ],
    },
    {
      id: 'ch10-final',
      date: '2039-08-11',
      prompt: (s) => `${branchOf(s, 10) < 0.6 ? 'Governments around the world announced a joint rescue and markets are climbing.' : 'The promised global rescue is late and markets are falling again.'} Your SIPs are still running${s.sips.some((x) => x.active) ? '' : ' (if you had one)'}. Last decision of the story?`,
      choices: [
        { id: 'stay', label: 'Stay the course', reply: `${VICTOR_SILENT}Chapter 6: the bad months are when a SIP does its best work.` },
        { id: 'rebalance', label: 'Rebalance back to my plan', reply: `${VICTOR_SILENT}Chapter 8: trim what jumped, add to what fell, move on.` },
        { id: 'allin', label: 'Go all-in on the rebound', reply: `${VICTOR_SILENT}Chapter 4: size every bet so the worst case is survivable.` },
      ],
    },
  ],
  news: [
    { date: '2039-01-04', level: 'WARNING', text: 'Market Hour: "Global recession signals are flashing. Factory orders are falling worldwide."' },
    { date: '2039-03-08', level: 'WARNING', text: 'Market Hour: "Tension returns around the Strait of Kareem. Oil is up 35% and the rupee slides."' },
    { date: '2039-04-13', level: 'WARNING', text: 'Market Hour: "Atlantic Meridian Bank has collapsed. Banks around the world are under pressure."' },
    { date: '2039-05-11', level: 'WARNING', text: 'Market Hour: "The largest remaining crypto exchange reports a hack. Coins fall 40%."' },
    { date: '2039-06-08', level: 'WARNING', text: 'Market Hour: "The central bank raises rates to defend the rupee. Gold hits a record in rupees."' },
    { date: '2039-07-06', level: 'WARNING', text: (s) => (branchOf(s, 10) < 0.6 ? 'Market Hour: "A coordinated global rescue is announced. Markets surge."' : 'Market Hour: "Talks on a global rescue stall. Investors brace for more."') },
  ],
  cliffhanger: 'Ten years. Ten storms. You’re still standing.',
};

export const LATE_CHAPTERS: Chapter[] = [CH4, CH5, CH6, CH7, CH8, CH9, CH10];

// ---------- Jake's ghost line (story.md §6) ----------

/** Jake's designed return since the start of the story: a boom to +400%, a −92% crash, a rebuild if you help him. */
export function jakeReturn(s: CareerState): number {
  const ch = s.story?.chapter ?? 1;
  const start = s.story?.start?.date ?? s.startDate;
  const end = s.endDate ?? s.date;
  const t = Math.min(1, Math.max(0, (Date.parse(s.date) - Date.parse(start)) / Math.max(1, Date.parse(end) - Date.parse(start))));
  const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
  const helped = s.story?.answered['ch9-jake'] === 'help';
  switch (ch) {
    case 1: return lerp(0, 0.3, t);
    case 2: return lerp(0.3, 1.2, t);
    case 3: return lerp(1.2, 0.6, t);
    case 4: return t < 0.45 ? lerp(0.6, 4, t / 0.45) : t < 0.75 ? lerp(4, -0.92, (t - 0.45) / 0.3) : -0.92;
    case 9: return lerp(-0.9, helped ? -0.6 : -0.93, t);
    case 10: return helped ? lerp(-0.6, -0.55, t) : lerp(-0.93, -0.95, t);
    default: return -0.9;
  }
}

// ---------- Endings (story.md §7) ----------

const GRADE_POINTS: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, E: 0 };

export function endingFor(s: CareerState, grades: Record<string, string>) {
  const pts = Object.values(grades).map((g) => GRADE_POINTS[g] ?? 0);
  const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0;
  const a = s.story?.answered ?? {};
  const tipChases = ['ch2-tipster', 'ch4-tipster', 'ch9-tipster'].filter((id) => a[id] === 'small').length;
  const panics = [a['ch1-pullback'] === 'sell-all', a['ch5-halt'] === 'sell', a['ch8-results'] === 'sell', a['ch10-halt'] === 'sell'].filter(Boolean).length;
  const cash = s.treasury.available / Math.max(1, netWorth(s));
  const id = tipChases + panics >= 3 && avg < 2.5 ? 'GAMBLER' : cash > 0.6 ? 'SAT_OUT' : avg >= 3.3 && panics === 0 ? 'LEGEND' : avg >= 2.5 ? 'BUILDER' : 'SURVIVOR';
  const title = { LEGEND: 'Market Legend', BUILDER: 'Steady Builder', SURVIVOR: 'Survivor', GAMBLER: 'Gambler’s Ruin', SAT_OUT: 'Sat It Out' }[id];
  const lead = {
    LEGEND: 'Victor hands you his old trading journal. "You never sold in a panic. That’s rarer than any stock pick."',
    BUILDER: 'A calm, compounding life. No heroics, no disasters, and the numbers quietly add up.',
    SURVIVOR: 'You made it through ten years of storms. Not every chapter went your way, and you learned from the ones that didn’t.',
    GAMBLER: 'Tips and panic cost you more than any crash did. Victor: "Every expert was once a beginner who stopped gambling."',
    SAT_OUT: `Most of your money sat in cash. Safe, but inflation took ${pct(s.world.cpiIndex - 1)} of its value. Victor: "Not losing isn’t the same as winning."`,
  }[id];
  const epilogue = [
    lead,
    a['ch2-sam'] === 'diversify' ? 'Sam kept his emergency fund through every crash and credits you for it.' : a['ch2-sam'] === 'go' ? 'Sam’s all-in small-cap bet took years to recover. He still brings it up.' : 'Sam learned the hard way, from someone else’s advice.',
    a['ch6-priya'] === 'stop' ? 'Priya stopped her SIP in the crash and restarted it a year later, at higher prices.' : 'Priya never stopped her SIP. It has grown several times over.',
    a['ch9-jake'] === 'help' ? `Jake rebuilt slowly with the plan you made together. He’s ${pct(jakeReturn(s))} from where he started, and finally sleeping at night.` : 'Jake is still chasing the next big thing.',
  ];
  return { id, title, epilogue, chapters: CHAPTERS.length };
}
