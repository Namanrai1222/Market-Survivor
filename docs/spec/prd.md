# PRD — Market Survivor

> A single-player market life simulator inside the main games website. The player gets one central wallet of virtual coins and lives through a connected world economy: stocks, IPOs, mutual funds, fixed income, gold, oil, global stocks, crypto and prediction markets. A war, a pandemic, a rate hike or a bank failure moves every market at once. A full Story Mode takes the player through ten in-game years of booms, bubbles, crashes and recoveries.

| Field | Value |
|---|---|
| Product | Market Survivor (module of the main games website) |
| Owner | Naman |
| Version | v2.0 (adds Story Mode, connected world economy, central treasury, prediction markets) |
| Platform | Web, desktop + mobile responsive |
| Players | Single player |
| Currency | Virtual coins only. No purchase, no cash-out, no real prizes, no transfer between players |

### Document map
| File | What it covers |
|---|---|
| `prd.md` | Product scope, modes, markets, economy, phases and tasks (this file) |
| `story.md` | Story Mode bible: chapters, characters, events, branches, endings |
| `market-engine.md` | How the connected world economy works: factors, contagion, events, alerts, central treasury, prediction market math |
| `techstack.md` | Architecture, stack, schema, APIs |
| `design.md` | Dark theme, screens, components, crisis states |
| `security.md` | Threat model and controls |
| `testcases.md` | Test cases by module and phase |

---

## 1. Problem

New investors enter stocks, IPOs and crypto without understanding that markets are connected. They don't know why a war far away makes their paint stock fall, why a rate hike crushes crypto, or why gold rises when everything else falls. They learn by losing real money, usually in their first crash.

## 2. Solution

A game world where:

1. The player has **one central wallet** (the Treasury). Every market draws from and pays into it.
2. All markets live on **one world clock** and react to the **same world events** through a factor model (see `market-engine.md`).
3. **Story Mode** scripts ten in-game years of real-feeling economic history: bull runs, IPO mania, rate shocks, crypto collapse, war, pandemic, bank failures, elections, a small-cap fraud and a final "perfect storm".
4. **Alerts** escalate from Info to Watch, Warning, Critical and Market Halt as crises develop.
5. **Prediction markets** let players trade on the odds of world events (ceasefire, rate hike, election result) and use them as hedges.
6. After every chapter the player gets a debrief showing what they did vs what a calm investor, a panic seller and a SIP investor would have done.

## 3. Goals and non-goals

### Goals
- G1: Teach how markets connect: events → macro factors → every asset class.
- G2: Teach crisis behaviour: position sizing, diversification, hedging, staying invested, not chasing tips.
- G3: Deliver a story people want to finish (chapter cliffhangers, characters, branching outcomes, multiple endings).
- G4: Keep players coming back (Free Play world, daily challenge, streaks, achievements).
- G5: Drive session time and traffic for the main games website.

### Non-goals
- No real money, coin purchase, cash-out or prizes (legal requirement, see 4).
- No investment advice or tips on live real-world stocks.
- No prediction markets on real-world live events. Only on in-game world events.
- No real-time exchange data. Story and Free Play use the synthetic world engine. Time Machine uses licensed historical daily data.
- No multiplayer in v2.
- No leverage, margin, futures or options in v2 (backlog).

## 4. Legal and compliance guardrails

Product requirements. Confirm with a lawyer before launch.

| Area | Rule |
|---|---|
| Online gaming law (India) | Must stay an online social game. Coins are earned in-game only (starting grant, story rewards, quizzes, optional rewarded ads). Coins cannot be bought, sold, transferred or cashed out. Any paid feature (ad-free subscription, cosmetics) must not add coins or affect outcomes. |
| Prediction markets | Only on fictional in-game events. Never on real elections, wars, sports or prices. Positions use virtual coins only. |
| SEBI / advice | No tips, signals or recommendations on real stocks. Educational disclaimer on every trading screen. Real companies move only with sector and macro factors in Story/Free Play (see 4.1). |
| Market data | Time Machine uses licensed historical data only. Keep `DATA_SOURCES.md`. |
| Trademarks | Real company and index names used factually. No logos. Footer: "Not affiliated with any company, exchange or index provider." If legal advises, index names can be swapped for aliases ("Index 50"). |
| Data protection (DPDP Act) | Minimal data. Under-18 consent handled per current rules. No targeted ads to minors. |
| Sensitive themes | War and pandemic are fictional, set in fictional countries, written respectfully (human cost acknowledged, never celebrated). |

### 4.1 Real vs fictional content rule
| Content | Real or fictional |
|---|---|
| Listed companies (Reliance, TCS, HDFC Bank...) | Real names. Move only with sector/macro factors and generic events ("strong quarter across IT"). **Never** given fictional frauds, defaults, bankruptcies or scandals. |
| Company-specific scandals, frauds, defaults, IPOs | Fictional companies (Northgate Bank, Crescent Finance, Brightline Infra, NovaPay...). |
| Countries in wars/conflicts | Fictional (Qarath, Solvane). Home market is India. |
| Central bank, regulator, government | Referred to generically ("the central bank", "the market regulator"). No fictional quotes attributed to real institutions or people. |
| Real people | None. All characters fictional. |
| Historical crashes (Time Machine mode) | Real, fact-checked, sourced. |

## 5. Target users

| Persona | Description | Wants |
|---|---|---|
| Aarav, 17 | Student, sees trading content on Instagram | Understand markets before he turns 18 |
| Priya, 22 | First job | SIP, emergency fund, how not to lose money |
| Rohit, 26 | Lost money on a hyped IPO and a crypto coin | Understand what went wrong |
| Casual gamer | Plays other games on the site | Story, drama, "can I survive the war chapter?" |

---

## 6. Core concept: one world, one wallet, many markets

```
                           ┌──────────────────────────┐
     World events  ───────►│   World Engine            │
 (war, pandemic, rate      │   factors + regimes       │
  hike, bank failure,      │   (market-engine.md)      │
  election, fraud...)      └────────────┬─────────────┘
                                        │ moves every market together
   ┌──────────┬──────────┬──────────┬───┴──────┬──────────┬──────────┬──────────┐
   ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
 Stocks     IPOs     Funds/SIP  Fixed Inc.  Commodities Global    Crypto   Prediction
 (India)                        (FD, bonds) (gold, oil) stocks (US)          markets
   │          │          │          │          │          │          │          │
   └──────────┴──────────┴──────────┴────┬─────┴──────────┴──────────┴──────────┘
                                         ▼
                              ┌──────────────────────┐
                              │  Central Treasury     │  one cash balance
                              │  (single ledger)      │  one net worth
                              └──────────────────────┘
```

### 6.1 Save slots (Careers)
- A **Career** = one world (seed + clock + event timeline) + one Treasury + one portfolio across all markets.
- Up to 3 Career slots: e.g. one Story career and two Free Play careers.
- Autosave only. No manual save/load (prevents save-scumming).

### 6.2 Markets (desks) inside a Career
| Desk | Instruments | Key mechanics | Unlocked in Story |
|---|---|---|---|
| Stocks (India) | ~35 real Nifty-50-type names + fictional small caps | Market/limit/SL/SL-M, delivery, T+1, price bands, market-wide circuit breakers, charges, taxes | Ch 1 |
| IPOs | Fictional companies | Price band, lots, 3-day subscription, retail lottery, blocked funds, listing day | Ch 2 |
| Funds & SIP | Fictional index, large-cap, mid-cap, small-cap, debt, gold funds (NAV from world engine) | Lumpsum, SIP, step-up, next-day NAV, exit load, XIRR | Ch 2 |
| Fixed Income | Fixed deposits, government bonds (short/long duration) | Rates from central bank factor, bond prices move with yields (duration), FD break penalty | Ch 3 |
| Commodities | Gold, silver, crude oil (as ETFs/funds) | Driven by real rates, war risk, supply shocks, INR | Ch 3 (gold), Ch 5 (oil) |
| Global Stocks | Real US names (Apple, Microsoft, Nvidia, Amazon, Alphabet, Tesla) + US index | INR/USD conversion, conversion fee, US hours, FX gains/losses | Ch 5 |
| Crypto | BTC, ETH, SOL, BNB, XRP, DOGE + fictional coins | 24/7, no circuits, custody choice (exchange vs self-custody), exchange failure risk, rug pulls | Ch 4 |
| Prediction Markets | Yes/No markets on in-game events | LMSR pricing, odds move with news, resolve on event outcome, usable as hedges | Ch 2 (tutorial), Ch 5 (full) |

All desks are unlocked from the start in Free Play.

### 6.3 Central Treasury (summary; full spec in `market-engine.md` §7)
- One cash balance per Career with three states: **Available**, **Unsettled** (sale proceeds waiting T+1 etc.), **Blocked** (open orders, IPO applications, pending fund orders).
- Every desk reads and writes through one ledger service in one DB transaction. Buying crypto instantly reduces the cash available for stocks, IPOs and prediction markets.
- Net worth = cash (all states) + mark-to-market of every position on every desk, recalculated on every trade and every clock tick.
- The Treasury bar is visible on every screen and updates immediately everywhere, including other open tabs.
- Unified transaction feed across all desks.
- Allocation view: by asset class, by sector, by currency (INR vs USD exposure), by risk level.

### 6.4 One world clock
- Each tick = one calendar day. Weekdays: equity, funds, bonds, commodities, US stocks trade (US on its own calendar). Weekends and holidays: only crypto moves. This creates realistic "weekend gap" behaviour: crypto reacts to Saturday war news first, stocks gap on Monday.
- Speeds: step 1 day, 1 day/sec, 1 week/sec, pause. Story beats and Critical alerts auto-pause (configurable).

---

## 7. Game modes

### 7.1 Story Mode (flagship)
Ten chapters over ten in-game years (starting 1 Jan 2030, fictional future calendar). Full bible in `story.md`.

| Ch | Title | Crisis / theme | Desks unlocked |
|---|---|---|---|
| 1 | First Paycheck | Calm bull market, basics | Stocks |
| 2 | Everyone's Getting Rich | IPO mania, hype, first prediction market | IPOs, Funds & SIP, Prediction (tutorial) |
| 3 | The Rate Shock | Inflation, four rate hikes, bonds fall | Fixed Income, Gold |
| 4 | Crypto Summer, Crypto Winter | Crypto boom, stablecoin collapse, exchange freeze | Crypto |
| 5 | Drums of War | War between two oil nations, oil spike, crash, circuit breaker | Oil, Global Stocks, Prediction (full) |
| 6 | The Silent Outbreak | Pandemic, fastest crash, two halts, V-shaped recovery | — |
| 7 | Cracks in the Banks | Bank failure, NBFC default, contagion | — |
| 8 | The Election | National election, results-day swing, policy branches | — |
| 9 | The Long Climb | Long bull run, small-cap bubble, fraud | — |
| 10 | The Perfect Storm | Recession + oil + crypto + currency shock at once | — |

Each chapter has: opening cutscene, objectives, timed events, alert cascades, decision checkpoints, 1–2 branch points resolved by world probability, prediction markets tied to the chapter's events, a chapter debrief, and rewards.

Five endings based on final score: Market Legend, Steady Builder, Survivor, Gambler's Ruin, Sat It Out (see `story.md` §7).

### 7.2 Free Play (Open World)
- Procedural world with the same engine. Random events from the event library (wars, pandemics, rate cycles, frauds, crypto crashes, elections) with realistic frequencies.
- All desks unlocked. Difficulty settings: Calm, Realistic, Chaotic (event frequency and severity).
- Endless. Scored by real (inflation-adjusted) return, max drawdown and behaviour score.

### 7.3 Time Machine (real history)
Replay real historical periods with real daily data (licensed, adjusted for splits/bonuses). Real headlines paraphrased and dated.

| ID | Period | Theme |
|---|---|---|
| TM-01 | 1992 | Harshad Mehta securities scam |
| TM-02 | 2000–2001 | Dot-com bust (Indian IT) |
| TM-03 | 2008–2009 | Global Financial Crisis |
| TM-04 | Jan 2009 | Satyam fraud |
| TM-05 | Nov 2016 | Demonetisation |
| TM-06 | 2018 | IL&FS / NBFC crisis |
| TM-07 | Feb–Dec 2020 | COVID crash and recovery |
| TM-08 | Mar 2020 | Yes Bank moratorium |
| TM-09 | Feb–Mar 2022 | Russia–Ukraine war, oil spike |
| TM-10 | May 2022 | Terra LUNA collapse |
| TM-11 | Nov 2022 | FTX collapse |
| TM-12 | Jan–Feb 2023 | Adani–Hindenburg |
| TM-13 | Mar 2023 | US regional bank failures (SVB) |
| TM-14 | Jun 2024 | Indian election results day |

**Connection to the Treasury:** the player stakes coins from a Career's Treasury (max 10% of net worth per run). At the end, the stake returns multiplied by the player's return, with gains capped at +50% per run and one paid run per scenario per 7 real days. Because history is known, a **Blind mode** hides dates and names for bonus XP. All dates and numbers are pulled from the dataset and fact-checked, never hardcoded from memory.

### 7.4 Daily Challenge
- Short seeded world (10–20 in-game days), same for every player. Separate challenge wallet for fairness.
- Rewards (coins, XP) credit the player's chosen Career Treasury, capped per day.

### 7.5 Academy
- 20 short interactive lessons (60–90 sec) + quizzes. Topics: shares, orders, candlesticks, circuits, charges, T+1, IPO process, SIP and XIRR, bonds and rates, gold, oil, currency, crypto custody, prediction markets and probability, hedging, diversification, what to do in a crash, pump-and-dump scams, inflation, taxes.
- Unlocked by story progress. Rewards credit the chosen Career Treasury (capped).

---

## 8. World events and alerts (summary)

Full model in `market-engine.md`. Event families:

| Family | Examples | Typical cross-market effect |
|---|---|---|
| Geopolitical | Border tension, war, sanctions, ceasefire | Oil ↑, gold ↑, stocks ↓, INR ↓, defence ↑, airlines ↓ |
| Pandemic | Outbreak, lockdown, vaccine | Stocks ↓↓ then recovery, pharma ↑, travel ↓↓, rates ↓ |
| Monetary | Rate hike/cut, surprise move | Bonds, banks, crypto, growth stocks, INR |
| Inflation | Hot/cold inflation print | Rates expectations, gold, bonds |
| Banking/credit | Bank failure, NBFC default | Financials ↓↓, bonds spread ↑, gold ↑ |
| Crypto | Stablecoin depeg, exchange freeze, rug pull, ETF approval | Crypto ↓↓/↑↑, small spillover to risk assets |
| Political | Election, budget, policy reform | Sector rotation, bonds, INR |
| Corporate | Earnings season, fictional fraud, IPO wave | Sector/stock specific |
| Commodity | Supply cut, pipeline attack | Oil/gold, OMCs, paints, airlines |
| Natural | Monsoon failure, cyclone | FMCG, agri, inflation |

Alert levels: **Info → Watch → Warning → Critical → Market Halt**. Alerts cover world events, market moves, and the player's own portfolio (drawdown, concentration, idle cash vs inflation, custody risk).

## 9. Realism spec (summary)

All values live in `market-config` and are reviewed before release.

- Market calendar, holidays, IST; separate US calendar; crypto 24/7.
- Orders: market, limit, SL, SL-M. Daily fill rules (next open for market orders; range-touch for limits).
- T+1 equity settlement; fund NAV applied next trading day; fund redemption settles per config.
- Stock price bands and market-wide circuit breakers at 10/15/20% index moves with time-of-day halt rules (config).
- Charges: brokerage, STT, exchange, regulator fee, stamp duty, GST; contract note on every fill.
- Taxes (simplified, configurable): equity STCG/LTCG, debt taxation, crypto flat tax, annual tax report.
- Corporate actions in Time Machine: dividends, splits, bonuses.
- Liquidity: spreads and slippage widen in stressed regimes.
- Inflation in the world erodes cash; FD/bonds pay interest; idle-cash alert.

## 10. Stock universe

Real names, factual use, verified against current exchange data before release (task P2-T04).

| Sector | Companies | Key factor sensitivities |
|---|---|---|
| Oil & gas upstream | ONGC, Oil India | Oil ↑ good |
| Refining / conglomerate | Reliance Industries | Mixed oil, growth |
| Oil marketing | BPCL, IOC, HPCL | Oil ↑ bad |
| Power | NTPC, Power Grid | Rates, defensive |
| IT services | TCS, Infosys, HCLTech, Wipro, Tech Mahindra | USD ↑ (INR ↓) good, global growth |
| Private banks | HDFC Bank, ICICI Bank, Kotak Mahindra Bank, Axis Bank | Growth, credit stress |
| PSU bank | SBI | Growth, credit stress, policy |
| NBFC | Bajaj Finance | Rates ↑ bad, credit stress |
| FMCG | Hindustan Unilever, ITC, Nestle India | Defensive, inflation, monsoon |
| Auto | Maruti Suzuki, Mahindra & Mahindra, Bajaj Auto | Rates, fuel prices, growth |
| Aviation | InterGlobe Aviation | Oil ↑ bad, pandemic very bad |
| Paints | Asian Paints | Crude-linked input costs ↑ bad |
| Telecom | Bharti Airtel | Defensive, pandemic resilient |
| Infra / capital goods | Larsen & Toubro | Growth, government capex |
| Defence | HAL, Bharat Electronics | Geopolitical risk ↑ good |
| Pharma | Sun Pharma, Dr. Reddy's, Cipla | Defensive, pandemic good, USD ↑ good |
| Metals | Tata Steel, JSW Steel, Hindalco | Global growth, commodity cycle |
| Consumer | Titan | Growth, gold price |
| Hotels | Indian Hotels | Pandemic very bad, growth |
| Indices | Nifty 50, Sensex, Bank Nifty, Midcap, Smallcap, Fear Index (VIX-style) | Benchmarks |

Fictional companies (small caps, IPOs, scandal targets) are listed in `story.md` §5.

Global: Apple, Microsoft, Nvidia, Amazon, Alphabet, Tesla, US 500 index. Crypto: BTC, ETH, SOL, BNB, XRP, DOGE + fictional coins.

## 11. Progression and economy

- Starting Treasury per Career: ₹1,000,000 virtual.
- Story chapter rewards: fixed coin grant + bonus for objectives (credited to Story career).
- XP levels (account-wide): Intern → Trainee → Analyst → Trader → Portfolio Manager → Fund Manager → Market Legend.
- Achievements: Diamond Hands, Panic Button (learning card, no shame), IPO Lucky, SIP Soldier, Hedger (profited from a prediction-market hedge during a crash), Diversifier (5+ asset classes), Not Your Keys (moved crypto to self-custody before the exchange freeze), Tip Ignored (declined every pump tip), Inflation Beater.
- Bankruptcy: no leverage, so cash can't go negative. If net worth falls below 5% of starting value, player can take a one-time "Fresh Start" (story continues, score penalty).

## 12. Scoring

| Component | Weight | Measure |
|---|---|---|
| Real return | 40% | Net worth growth adjusted for in-game inflation |
| Risk | 25% | Max drawdown and volatility of net worth (Sharpe-style ratio) |
| Behaviour | 25% | Panic sells, diversification, tip-chasing, over-trading, custody choices, hedging |
| Objectives | 10% | Chapter objectives completed |

## 13. Key screens
World Dashboard, Treasury bar, desk terminals (Stocks, IPO, Funds, Fixed Income, Commodities, Global, Crypto, Prediction), Alert Center, Breaking News takeover, Market Halt card, Story chapter map, cutscene player, checkpoint modal, chapter debrief, Time Machine, Academy, Profile. Details in `design.md`.

## 14. Success metrics (first 3 months)

| Metric | Target |
|---|---|
| D1 / D7 / D30 retention | ≥ 35% / ≥ 15% / ≥ 6% |
| Story Chapter 1 completion | ≥ 60% of starters |
| Story Chapter 5 (war) completion | ≥ 30% of starters |
| Story completion | ≥ 12% of starters |
| Players using 3+ desks | ≥ 50% of Chapter 5 reachers |
| Prediction market used as hedge in Ch 5 | ≥ 20% |
| Avg session length | ≥ 12 min |
| Quiz accuracy improvement (lesson 1 vs 10) | +20% |

## 15. Risks

| Risk | Mitigation |
|---|---|
| Treated as money game | No coin purchase/cash-out/prizes; legal review; code rule in PR template |
| Treated as investment advice | Real companies only move on sector/macro; no tips; disclaimers |
| Defamation of real companies | Real-vs-fictional rule (§4.1), content review checklist |
| Insensitive war/pandemic content | Fictional countries, respectful writing, sensitivity review |
| Engine produces unrealistic markets | Calibration against historical analogs (`market-engine.md` §5), automated realism tests |
| Players exploit known history in Time Machine | Stake caps, gain caps, cooldowns, Blind mode |
| Complexity overwhelms beginners | Story unlocks desks gradually; Academy; tooltips |
| Scope too big for one developer | Strict phase gates; Story chapters shipped incrementally (Ch 1–3 first) |

---

## 16. Phases and tasks

Legend: **P** = phase, **T** = task. One developer estimates. Each phase ends with its QA tasks from `testcases.md` passing.

### Phase 0 — Foundation (Week 1–2)
| ID | Task | Done when |
|---|---|---|
| P0-T01 | Create `market-survivor` route group in main website | Placeholder page renders inside site layout |
| P0-T02 | Monorepo packages: `engine`, `ui`, `content`; TS, lint, test runner, CI | CI green |
| P0-T03 | `market-config` schema (charges, bands, breakers, tax, calendars, fees, caps) | Zod-validated; test config fixture |
| P0-T04 | DB schema v2 core: players, careers, treasury, ledger, positions, orders | Migrations run on fresh DB |
| P0-T05 | Dark theme tokens in design system | Tokens as CSS variables |
| P0-T06 | Legal checklist + content rules (§4, §4.1) in repo | Reviewed |

### Phase 1 — Central Treasury + Stocks desk (Week 3–5)
| ID | Task | Done when |
|---|---|---|
| P1-T01 | Treasury service: available/unsettled/blocked, single-row lock, double-entry ledger | Property tests: invariants hold across 10k random actions |
| P1-T02 | Career creation (seed, clock, Treasury) and 3 save slots | Create/list/delete career works |
| P1-T03 | World clock: calendar days, IST, holidays, equity/US/crypto calendars | Advances correctly incl. weekends |
| P1-T04 | Order engine (market, limit, SL, SL-M), daily fill rules, slippage | Unit tests pass |
| P1-T05 | Charges calculator + contract note | Matches hand calculations |
| P1-T06 | T+1 settlement through Treasury (unsettled → available) | Tests across weekends/holidays |
| P1-T07 | Price bands + market-wide circuit breaker rules | Out-of-band rejected; halt event fires |
| P1-T08 | Server-authoritative trade + advance APIs with idempotency and state version | Client cannot alter balances |
| P1-T09 | Treasury bar + Stocks terminal UI (watchlist, order panel, holdings) | Buy/sell updates Treasury instantly |
| P1-T10 | Cross-tab sync (BroadcastChannel + state version) | Two tabs always show same balance |

### Phase 2 — World Engine v1 + charts (Week 6–8)
| ID | Task | Done when |
|---|---|---|
| P2-T01 | Factor model: 10 macro factors, regime switching (calm/stressed/crisis) | Factor paths pass realism tests |
| P2-T02 | Asset model: factor loadings per sector/asset, idiosyncratic noise, jumps | Sector correlations within target ranges |
| P2-T03 | Event system v1: event definitions, factor shocks, lag and decay profiles | Scripted test event moves correct assets in correct direction |
| P2-T04 | Finalize stock universe + loadings table | Reviewed against sector logic |
| P2-T05 | Daily candlestick chart + indicators + timeframes | Smooth on mid-range phone |
| P2-T06 | News feed tied to events | Items appear on correct sim dates |
| P2-T07 | Fear Index (VIX-style) derived from realized/implied vol | Rises in crisis regime |
| P2-T08 | World Dashboard (all markets heat map, factor gauges) | Shows every desk at a glance |

### Phase 3 — All desks connected (Week 9–12)
| ID | Task | Done when |
|---|---|---|
| P3-T01 | Funds & SIP desk: fictional funds, NAV from constituents/factors, SIP, step-up, exit load, XIRR | XIRR matches spreadsheet |
| P3-T02 | IPO desk: subscription curve, lottery, blocked funds, listing model linked to regime | Listing gains fall in stressed regime |
| P3-T03 | Fixed Income desk: FD (rate from policy factor), bonds (duration pricing) | Bond price move ≈ −duration × Δyield |
| P3-T04 | Commodities desk: gold, silver, oil funds | Gold ↑ on geopolitical/crisis shocks |
| P3-T05 | Global desk: US stocks, USD/INR conversion, conversion fee, US calendar | FX P&L shown separately |
| P3-T06 | Crypto desk: 24/7, custody toggle, exchange risk, rug pulls | Frozen funds on exchange failure |
| P3-T07 | Prediction desk: LMSR markets, bot traders, resolution, payout to Treasury | Payout tests pass |
| P3-T08 | Unified portfolio: net worth across desks, allocation by class/sector/currency/risk | Net worth equals ledger + marks |
| P3-T09 | Unified transaction feed | All desks appear chronologically |

### Phase 4 — Alerts + crisis experience (Week 13–14)
| ID | Task | Done when |
|---|---|---|
| P4-T01 | Alert engine: levels, triggers (world, market, portfolio), dedupe, cooldowns | Trigger tests pass |
| P4-T02 | Alert Center + banners + full-screen Critical/Halt | Auto-pause setting works |
| P4-T03 | Breaking News takeover | Shows on Critical events |
| P4-T04 | Crisis visual states (tension, crash, halt, recovery) | Theme shifts per state, reduced-motion safe |
| P4-T05 | Portfolio alerts: drawdown, concentration, idle cash, custody risk | Fire correctly |

### Phase 5 — Story Mode Act I: Chapters 1–3 (Week 15–18)
| ID | Task | Done when |
|---|---|---|
| P5-T01 | Story runtime: chapter scripts, beats, objectives, checkpoints, branches | Chapter 1 runs from content JSON |
| P5-T02 | Cutscene player (panels, portraits, dialogue) | Skippable, keyboard accessible |
| P5-T03 | Characters and dialogue for Ch 1–3 | Content reviewed |
| P5-T04 | Chapter 1: First Paycheck | Playable end to end |
| P5-T05 | Chapter 2: Everyone's Getting Rich (IPO wave, SIP, prediction tutorial) | Playable |
| P5-T06 | Chapter 3: The Rate Shock | Playable |
| P5-T07 | Chapter debrief (you vs calm investor vs panic seller vs SIP) | Correct from same world data |
| P5-T08 | Story save/continue, chapter map | Resume mid-chapter works |

### Phase 6 — Story Mode Act II: Chapters 4–7 (Week 19–23)
| ID | Task | Done when |
|---|---|---|
| P6-T01 | Chapter 4: Crypto Summer, Crypto Winter (depeg, exchange freeze branch) | Playable, both branches |
| P6-T02 | Chapter 5: Drums of War (alert cascade, halt, oil spike, ceasefire branch) | Playable, both branches |
| P6-T03 | Chapter 6: The Silent Outbreak (two halts, vaccine branch) | Playable |
| P6-T04 | Chapter 7: Cracks in the Banks (bank failure, rescue branch) | Playable |
| P6-T05 | Sensitivity review of war/pandemic content | Signed off |
| P6-T06 | Balance pass: difficulty, reward sizes | Playtest target completion rates met |

### Phase 7 — Story Mode Act III: Chapters 8–10 + endings (Week 24–27)
| ID | Task | Done when |
|---|---|---|
| P7-T01 | Chapter 8: The Election (policy branches, neutral writing) | Playable, neutrality review done |
| P7-T02 | Chapter 9: The Long Climb (small-cap bubble, fraud) | Playable |
| P7-T03 | Chapter 10: The Perfect Storm | Playable |
| P7-T04 | Final scoring + 5 endings + ending cutscenes | Correct ending per score band |
| P7-T05 | New Game+ (story replay with different seed and branch odds) | Different branches reachable |

### Phase 8 — Side modes (Week 28–30)
| ID | Task | Done when |
|---|---|---|
| P8-T01 | Free Play: procedural event scheduler, difficulty levels | 10 simulated years run without errors |
| P8-T02 | Time Machine: licensed data pipeline, replay engine, no future leakage | TM-07 playable |
| P8-T03 | Time Machine stakes, caps, cooldown, Blind mode | Settlement tests pass |
| P8-T04 | Remaining Time Machine scenarios + fact-check with sources | All playable, sources listed |
| P8-T05 | Daily Challenge (seeded) + reward caps | Same seed for all players |
| P8-T06 | Academy: 20 lessons + quizzes | Unlocked by story progress |

### Phase 9 — Polish, security, launch (Week 31–33)
| ID | Task | Done when |
|---|---|---|
| P9-T01 | Security review per `security.md` | All P0/P1 closed |
| P9-T02 | Full test suite per `testcases.md` | All critical pass |
| P9-T03 | Performance on low-end Android | LCP < 2.5s, 55+ fps charts |
| P9-T04 | Accessibility + colour-blind audit | WCAG AA |
| P9-T05 | Analytics funnel for §14 | Dashboard live |
| P9-T06 | Legal sign-off (gaming law, content, privacy, trademarks) | Done |
| P9-T07 | Soft launch, fix, public launch | Crash-free ≥ 99.5% |

### Backlog
Intraday mode, futures and options with heavy risk education, AI coach (post-trade explanations only), achievements sharing, multi-language UI, optional Daily Challenge leaderboard.
