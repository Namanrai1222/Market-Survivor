// Academy lessons (prd.md §7.5). General education about how markets and this game work: no tips,
// no real securities. Client-safe; scoring happens on the server against the same answer keys.

export interface Question {
  q: string;
  choices: string[];
  answer: number;
  why: string;
}
export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  body: string[];
  quiz: Question[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'what-is-a-share',
    title: 'What a share really is',
    minutes: 1,
    body: [
      'A share is a small piece of ownership in a company. If a company is split into 1,00,00,000 shares and you own 100, you own one hundred-thousandth of the business.',
      'The share price moves because buyers and sellers keep changing their minds about what that business is worth, based on profits, interest rates, news and mood.',
      'In this game every company is fictional, but the way prices react to the economy follows the same logic as a real market.',
    ],
    quiz: [
      { q: 'Owning a share means you own…', choices: ['A loan to the company', 'A small part of the company', 'A promise of fixed returns'], answer: 1, why: 'A share is ownership. A loan would be a bond, and nothing about shares is fixed.' },
      { q: 'Why does a share price change during the day?', choices: ['The company sets it each morning', 'The exchange picks a random number', 'Buyers and sellers disagree about its value'], answer: 2, why: 'Prices are where buyers and sellers meet; their views change with news and mood.' },
      { q: 'Are the companies in Market Survivor real?', choices: ['No, they are fictional', 'Yes, all of them', 'Only the banks'], answer: 0, why: 'Every company and index in the game is fictional, with simulated prices.' },
    ],
  },
  {
    id: 'order-types',
    title: 'Market, limit and stop orders',
    minutes: 2,
    body: [
      'A market order buys or sells at the best price available. It is certain to fill, but you do not choose the price, and in a fast market it can fill worse than you expected (slippage).',
      'A limit order sets the worst price you accept: a buy fills at your limit or lower, a sell at your limit or higher. It may never fill.',
      'A stop-loss order waits until the price crosses a trigger, then becomes a market order (SL-M) or a limit order (SL). It is a pre-made decision for when things go wrong.',
      'In this game, orders placed today fill on the next trading day.',
    ],
    quiz: [
      { q: 'You want to buy, but never above ₹500. Which order?', choices: ['Market', 'Limit at ₹500', 'Stop-market at ₹500'], answer: 1, why: 'A limit buy at ₹500 fills at ₹500 or better, or not at all.' },
      { q: 'What is slippage?', choices: ['A fee charged by the exchange', 'A cancelled order', 'Filling at a worse price than you saw'], answer: 2, why: 'Slippage is the gap between the price you expected and the price you got.' },
      { q: 'What does a stop-loss do?', choices: ['Acts automatically once a trigger price is crossed', 'Guarantees no loss', 'Locks your shares so they cannot fall'], answer: 0, why: 'It acts at a trigger. Prices can gap past it, so it limits losses but cannot guarantee a price.' },
    ],
  },
  {
    id: 'charges',
    title: 'Charges and the contract note',
    minutes: 1,
    body: [
      'Every trade costs more than the share price: brokerage, a securities transaction tax, exchange and regulator fees, stamp duty on purchases, and GST on some of those.',
      'The contract note is the receipt for a trade. It lists the price, every charge and the net amount. Reading it is how you notice when frequent trading quietly eats your returns.',
      'In this game, open any filled order under Fills to see its contract note.',
    ],
    quiz: [
      { q: 'Which of these is not a trading charge?', choices: ['Stamp duty', 'Dividend', 'Brokerage'], answer: 1, why: 'A dividend is a payment a company makes to shareholders, not a cost of trading.' },
      { q: 'What does a contract note show?', choices: ['Your tax return', 'Next week’s prices', 'The price, charges and net amount of a trade'], answer: 2, why: 'It is the full receipt for one trade.' },
      { q: 'Why can frequent trading hurt returns?', choices: ['Charges are paid on every trade', 'Exchanges ban frequent traders', 'Prices always fall after you buy'], answer: 0, why: 'Small charges on every trade add up.' },
    ],
  },
  {
    id: 'circuit-breakers',
    title: 'Price bands and circuit breakers',
    minutes: 1,
    body: [
      'A price band limits how far one stock can move in a day. Hit the top and it is "upper circuit"; hit the bottom and it is "lower circuit", where sellers may queue with few buyers.',
      'A market-wide circuit breaker pauses the whole market when the main index falls too far in one day. In this game the levels are 10%, 15% and 20% falls in the Survivor 50 index.',
      'The pause exists so people decide with a clear head instead of in a panic.',
    ],
    quiz: [
      { q: 'What is a lower circuit?', choices: ['A cheap stock', 'A stock that hit its daily floor', 'A broker with low fees'], answer: 1, why: 'It means the price fell to the bottom of its allowed band for the day.' },
      { q: 'What triggers a market-wide circuit breaker?', choices: ['One stock rising fast', 'The end of the month', 'The main index falling a set percentage in a day'], answer: 2, why: 'It reacts to the whole market’s fall, measured by the main index.' },
      { q: 'Why do markets pause trading?', choices: ['To give everyone time to think', 'To punish sellers', 'To change prices'], answer: 0, why: 'A pause cools panic so decisions are calmer.' },
    ],
  },
  {
    id: 'settlement',
    title: 'T+1: when your money arrives',
    minutes: 1,
    body: [
      'When you sell shares, the money does not arrive instantly. It settles one trading day later (T+1), skipping weekends and holidays.',
      'Until then it sits as "Unsettled" in your Treasury. You cannot spend it yet, which is why the Treasury bar shows Available, Blocked and Unsettled separately.',
      'Blocked money is cash reserved for buy orders that have not filled yet.',
    ],
    quiz: [
      { q: 'You sell on Friday. When is the money available (no holidays)?', choices: ['Friday', 'Monday', 'Saturday'], answer: 1, why: 'T+1 counts trading days, so Friday + 1 = Monday.' },
      { q: 'What is "Blocked" cash?', choices: ['Money lost to charges', 'Money the bank froze', 'Money reserved for open buy orders'], answer: 2, why: 'It is reserved so an open order can always be paid for.' },
      { q: 'Can you spend unsettled money?', choices: ['No, not until it settles', 'Yes, right away', 'Only on weekends'], answer: 0, why: 'Unsettled cash becomes available on the settlement date.' },
    ],
  },
  {
    id: 'diversification',
    title: 'Diversification',
    minutes: 1,
    body: [
      'Diversifying means owning different kinds of businesses so one bad event cannot sink your whole portfolio.',
      'Different sectors react to the economy differently: oil prices that hurt airlines and paint makers can help oil producers. Owning both softens the blow.',
      'Diversification does not stop losses in a crash, when most things fall together, but it reduces the damage one mistake can do.',
    ],
    quiz: [
      { q: 'What does diversification protect you from?', choices: ['All losses', 'One company or sector sinking your portfolio', 'Paying charges'], answer: 1, why: 'It spreads risk; it does not remove it.' },
      { q: 'Oil prices jump. Which pair is better balanced?', choices: ['An airline and a paint maker', 'Two airlines', 'An airline and an oil producer'], answer: 2, why: 'The oil producer tends to benefit when the airline is hurt.' },
      { q: 'In a market-wide crash, diversified portfolios…', choices: ['Usually still fall, but often less', 'Never fall', 'Always rise'], answer: 0, why: 'In a crash most things fall together; spreading out reduces, not removes, the damage.' },
    ],
  },
  {
    id: 'connected-markets',
    title: 'Why markets move together',
    minutes: 2,
    body: [
      'Big forces push on every company at once: economic growth, interest rates, inflation, oil prices, the currency, war risk and how easily credit flows.',
      'Each sector feels them differently. Banks care about credit and growth; IT services earn in dollars, so a weaker rupee helps; airlines suffer when oil rises.',
      'In the Market City, each district is a sector. When a shock hits, watch which blocks light up and which go dark.',
    ],
    quiz: [
      { q: 'Interest rates rise sharply. What usually happens to share prices?', choices: ['They always rise', 'They tend to fall', 'Nothing'], answer: 1, why: 'Higher rates make borrowing dearer and future profits worth less today.' },
      { q: 'The rupee weakens. Which sector often benefits?', choices: ['Airlines that buy fuel in dollars', 'Importers', 'IT services that earn in dollars'], answer: 2, why: 'Dollar earnings are worth more rupees.' },
      { q: 'What does a dark district in the Market City mean?', choices: ['The sector is having a bad day', 'The game is loading', 'The sector is closed forever'], answer: 0, why: 'Roof colours and lights follow the day’s moves and volume.' },
    ],
  },
  {
    id: 'in-a-crash',
    title: 'What to do in a crash',
    minutes: 2,
    body: [
      'Crashes feel permanent while they happen. Historically, broad markets have recovered from every crash, though some recoveries took years.',
      'Before acting, ask: has my reason for owning this changed, or only its price? Selling everything after a fall turns paper losses into real ones.',
      'Keep emergency cash outside your investments, never invest money you need soon, and size positions so that no single fall can knock you out.',
    ],
    quiz: [
      { q: 'Prices fell 15% but nothing about the businesses changed. A calm response is…', choices: ['Sell everything now', 'Review your plan before acting', 'Borrow to buy more'], answer: 1, why: 'Decide from your plan, not from the price alone.' },
      { q: 'Why keep emergency cash outside investments?', choices: ['Because cash always grows', 'To pay higher charges', 'So a crash never forces you to sell at the bottom'], answer: 2, why: 'Needing the money during a crash forces bad sales.' },
      { q: 'Have broad markets always recovered quickly?', choices: ['Recoveries happened, but some took years', 'Yes, within weeks', 'Never'], answer: 0, why: 'Recovery is the long-run pattern, but timing varies a lot.' },
    ],
  },
  {
    id: 'pump-and-dump',
    title: 'Spotting a pump-and-dump',
    minutes: 1,
    body: [
      'A pump-and-dump is a scam: someone buys a tiny, cheap stock, then floods chat groups with urgent tips so others buy and push the price up. Then they sell to the latecomers.',
      'Warning signs: guaranteed returns, "buy before tomorrow" urgency, unknown companies, and tips from people who will not say who they are.',
      'In India, only SEBI-registered advisers may give stock advice. Anyone else offering tips for money is a red flag.',
    ],
    quiz: [
      { q: 'A stranger promises a "guaranteed 300% in a week". This is…', choices: ['A rare opportunity', 'A classic scam warning sign', 'Normal market advice'], answer: 1, why: 'No honest investment guarantees returns, let alone 300% in a week.' },
      { q: 'Who profits in a pump-and-dump?', choices: ['Everyone who buys', 'The company', 'The people who bought early and sold to latecomers'], answer: 2, why: 'The organisers sell to the people their tips pulled in.' },
      { q: 'Who may legally give stock advice in India?', choices: ['SEBI-registered advisers', 'Anyone with a big following', 'Any chat group admin'], answer: 0, why: 'Investment advice needs SEBI registration.' },
    ],
  },
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
export const XP_PER_CORRECT = 10;
