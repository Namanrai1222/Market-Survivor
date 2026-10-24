# Story Mode Bible — Market Survivor

Ten chapters, ten in-game years (1 Jan 2030 – 31 Dec 2039, fictional future calendar mapped to real weekdays). The player is a 22-year-old who just got their first paycheck and ₹1,000,000 of starting capital. By the end they have lived through every kind of market crisis.

All market moves are produced by the World Engine (`market-engine.md`). Story content only schedules **events**, **branch points**, **checkpoints**, **dialogue** and **objectives**. Magnitudes below are **calibration targets** taken from historical analogs; the engine hits them within a range, and every run differs slightly.

Content rules (from `prd.md` §4.1): real companies only move on sector/macro factors; scandals and failures happen to fictional companies; wars happen between fictional countries; institutions are generic ("the central bank"); no real people.

---

## 1. Characters

| Name | Role | Voice | Function in game |
|---|---|---|---|
| **Victor Hale** | Retired fund manager, mentor, 64 | Calm, dry humour, has seen every crash | Explains lessons, appears at checkpoints, never gives stock tips, only principles |
| **Jake Rivers** | Rival, 24, hype trader with a big social following | Loud, overconfident, "trust me bro" | His portfolio appears as a ghost line on charts. Chases every hype. Blows up in Ch 4, returns humbled in Ch 9 |
| **Nina Brooks** | News anchor, "Market Hour" | Crisp, neutral | Delivers Breaking News takeovers and chapter recaps |
| **Dr. Elena Ward** | Economist | Clear, uses simple analogies | Explains macro: rates, inflation, oil, currency |
| **Sam Carter** | Player's college friend | Friendly, impatient | Asks the player for tips; forwards pump-and-dump messages. Player learns to say no |
| **Priya Nair** | Player's sister, doctor | Practical | Ch 6 pandemic perspective; asks for help setting up her SIP |
| **"The Tipster"** | Anonymous chat group admin | Urgent, emoji-heavy | Sends fake tips on fictional microcaps. Every tip is a pump-and-dump |
| **Marcus Cole** | Founder of Vaultex crypto exchange (fictional) | Charismatic | Ch 4 antagonist; exchange collapses |

## 2. Story structure per chapter

```
Opening cutscene → Briefing (objectives, new desk) → Play (clock runs)
   → Events fire (news, alerts) → Checkpoints (pause + decision)
   → Branch point(s) resolved by world probability
   → Chapter climax (crisis peak or payoff) → Resolution period
   → Debrief (you vs calm investor vs panic seller vs SIP investor)
   → Rewards, achievements, cliffhanger teaser
```

- **Checkpoints** pause the clock and ask a question with 3–4 choices. Choices can place real trades (pre-filled order tickets the player confirms) or just record intent. Victor responds after.
- **Branch points** are world outcomes (ceasefire vs escalation, bailout vs collapse). Their probabilities are shown indirectly through prediction markets and news. The outcome is rolled server-side at the scheduled date from the career seed. The player cannot influence them, only prepare.
- **Objectives**: 1 primary (required to finish chapter), 2–3 optional (bonus coins/achievements). Failing the primary doesn't end the story; the chapter completes with a lower grade.

## 3. Alert levels (used throughout)

| Level | Colour | Behaviour |
|---|---|---|
| Info | Blue | Feed item |
| Watch | Yellow | Banner, 5 s |
| Warning | Orange | Sticky banner until dismissed |
| Critical | Red | Breaking News takeover, auto-pause (setting) |
| Market Halt | Siren | Full-screen halt card, clock paused, crash visual state |

---

## 4. Chapters

### Chapter 1 — First Paycheck
**In-game time:** Jan 2030 – Jun 2030 · **Regime:** Calm bull · **New desk:** Stocks

**Opening:** The player's first salary lands. Victor, a neighbour, notices them watching Jake's trading videos. "Before you try to get rich, learn how not to get poor."

**Timeline**
| Month | Event | Alert | Market effect (target) |
|---|---|---|---|
| Jan | Tutorial: first buy, contract note, charges | — | Calm, index drifts up |
| Feb | Government budget: infra spending boost | Info | Infra/capital goods +3–6% over 2 weeks |
| Mar | Stock hits upper band intraday | Watch | Band mechanics taught |
| Apr | Quarterly results season | Info | Sector dispersion, IT mixed, banks up |
| May | Jake posts 40% gain on a single stock | Info | Ghost line appears |
| Jun | Mild 5% pullback | Watch | First taste of red |

**Checkpoints**
1. *Feb:* "Your portfolio is 100% in one stock." → Options: diversify into 3+ sectors / keep / add more. Victor explains concentration.
2. *Jun pullback:* "Index down 5% in a week." → Sell everything / hold / buy more slowly. Victor: "5% is weather, not climate."

**Objectives:** Primary: hold at least 3 stocks from 3 sectors at chapter end. Optional: keep total charges under 1% of traded value; beat Jake's risk-adjusted return.

**Lessons unlocked:** What is a share, order types, charges, price bands, diversification.

**Cliffhanger:** Nina: "Next week, six companies open their IPOs. Grey market premiums are going wild."

---

### Chapter 2 — Everyone's Getting Rich
**Time:** Jul 2030 – Mar 2031 · **Regime:** Euphoric bull → late-cycle · **New desks:** IPOs, Funds & SIP, Prediction (tutorial)

**Opening:** Everyone at the office talks about IPO listing gains. Sam asks the player to "just tell him which IPO to apply to".

**Fictional IPOs**
| Company | Sector | Hype | Designed outcome range |
|---|---|---|---|
| NovaPay | Fintech | Very high (subscribed ~80–150x) | Lists +40–90% |
| ZipCart | Quick commerce, loss-making | Very high | Lists +10–30%, falls below issue within 3 months |
| GreenVolt EV | EV maker | High | Lists flat to +15% |
| Harbor Logistics | Logistics, profitable | Low (~3x) | Lists +5–15%, steady |
| Skyline Realty | Real estate | Medium | Lists −10 to −20% |
| Quantum Chips India | Semiconductor | Extreme GMP | Lists +20%, then −45% in the Ch 3 rate shock |

**Timeline**
| Month | Event | Alert | Effect |
|---|---|---|---|
| Jul | IPO wave begins, GMP hype meter live | Info | Small/midcap +8–12% |
| Aug | NovaPay IPO, retail 120x oversubscribed | Watch | Most players get 0 lots (lottery) |
| Sep | SIP tutorial with Priya | — | — |
| Oct | First prediction market: "Will ZipCart list above issue price?" | Info | Teaches probability pricing |
| Dec | Midcap index +35% YoY, valuations stretched | Warning ("Valuations above historical range") | — |
| Feb | Skyline Realty lists −15% | Watch | Lesson: hype ≠ profit |
| Mar | Inflation print surprises up | Watch | Bond yields tick up; cliffhanger |

**Checkpoints**
1. *Aug:* "You didn't get NovaPay allotment. It's up 70% on listing. Buy now?" → Buy at listing / wait / skip. (Designed: NovaPay drifts down 20–30% over next 2 months.)
2. *Dec:* "Sam wants to put his whole savings into small caps." → Advise diversification / tell him to go ahead / change subject. Affects Sam's later arc.

**Objectives:** Primary: start a SIP. Optional: apply to 3 IPOs; place your first prediction market trade; don't buy any IPO on listing day above 50% gain.

**Lessons:** IPO process and lottery, GMP is unofficial, SIP and rupee-cost averaging, prediction markets as probabilities.

**Cliffhanger:** Dr. Ward: "Inflation is at a six-year high. The central bank meets in three weeks."

---

### Chapter 3 — The Rate Shock
**Time:** Apr 2031 – Mar 2032 · **Regime:** Tightening, stressed · **New desks:** Fixed Income, Gold
**Historical analog:** 2022 global rate hikes (growth stocks and crypto fell hard, bonds fell, value/energy held up).

**Timeline**
| Month | Event | Alert | Effect (targets) |
|---|---|---|---|
| Apr | Central bank hike #1 (+0.50%) | Warning | Bonds −2–4% (long duration), banks mixed, NBFCs −5–8% |
| Jun | Hike #2 (+0.50%) | Warning | Midcaps −10%, Quantum Chips −30% |
| Aug | Hike #3 (+0.25%), FD rates rise | Watch | FD desk becomes attractive |
| Oct | Hike #4 (+0.25%), "Is this the peak?" | Warning | Crypto weak (sets up Ch 4 contrast) |
| Dec | Inflation cools slightly | Info | Bonds stabilize |
| Feb | Central bank pauses | Info | Rally in rate-sensitives +8–12% |

Chapter drawdown target: index −12 to −18% peak-to-trough; midcaps −20 to −30%; long bonds −6 to −10%.

**Prediction markets:** "Will the central bank hike in June?" (odds move with inflation prints), "Will rates peak by December?"

**Checkpoints**
1. *Apr:* "Your long-duration bond fund fell 3% after one meeting. Why?" → quiz-style, explains duration.
2. *Aug:* "FDs now pay more than inflation. Move some cash?" → Yes / no / split.

**Branch point:** *Oct* — "Hike #4 size": +0.25% (70%) vs +0.50% (30%). Bigger hike → deeper midcap fall and stronger INR.

**Objectives:** Primary: finish with at least 2 asset classes. Optional: earn interest from FD/bonds above in-game inflation; hold gold ≥ 5% at chapter end.

**Lessons:** Interest rates and valuations, bonds and duration, FD vs inflation, gold's role.

**Cliffhanger:** Jake: "Stocks are boring. Crypto just did 3x. I'm all in."

---

### Chapter 4 — Crypto Summer, Crypto Winter
**Time:** Apr 2032 – Mar 2033 · **Regime:** Crypto euphoria → crypto crisis; equities recovering · **New desk:** Crypto
**Historical analogs:** 2021 crypto boom, May 2022 Terra/LUNA collapse, Nov 2022 FTX collapse.

**Fictional entities:** Vaultex (exchange, founder Marcus Cole), LumaUSD (algorithmic stablecoin paying 18% "yield"), LUMA (its sister token), fictional meme coins MOONCAT and ROCKETDOG.

**Timeline**
| Month | Event | Alert | Effect (targets) |
|---|---|---|---|
| Apr | Crypto rally, BTC +60% in 4 months | Info | ETH/SOL higher beta |
| Jun | Vaultex offers 18% on LumaUSD deposits | Info | Custody choice explained: "on exchange" vs "self-custody" |
| Jul | The Tipster pushes MOONCAT | Watch ("Unverified tip") | MOONCAT +300% then rug pull −95% |
| Sep | BTC all-time high; Jake up 5x | Info | Peak euphoria |
| Oct | LumaUSD loses peg: $1.00 → $0.90 → $0.30 in 5 days | Critical | LUMA −99%; BTC −20–30%; crypto contagion |
| Nov | Rumours Vaultex used customer funds | Warning | Withdrawal queue grows |
| Dec | **Vaultex freezes withdrawals** | Critical | Assets on Vaultex frozen; BTC −20–25% in a week |
| Jan–Mar | Crypto winter; BTC ~−65–75% from peak | Watch | Equities barely affected (small spillover) |

**Branch point (Dec–Feb):** Vaultex outcome — Rescue by a rival exchange (20%): frozen assets returned at 60–80% value after 3 months. Bankruptcy (80%): 10–25% recovered after 9 months (paid in Ch 5).

**Prediction markets:** "Will LumaUSD regain $1 by month end?", "Will Vaultex resume withdrawals by January?"

**Checkpoints**
1. *Jun:* "Move your crypto to self-custody? You'll lose the 18% yield." → Self-custody / stay for yield / split.
2. *Oct depeg:* "LumaUSD at $0.60. Buy the dip?" → Buy / sell everything / hold. Victor: "When something promises 18% with no risk, the risk is you."
3. *Dec:* Jake calls the player, panicking. Dialogue only (character arc).

**Objectives:** Primary: keep crypto ≤ 20% of net worth at chapter end. Optional: move crypto to self-custody before the freeze (Not Your Keys); ignore all Tipster tips (Tip Ignored).

**Lessons:** Volatility, stablecoins, custody and exchange risk, rug pulls and pump-and-dumps, position sizing.

**Cliffhanger:** Nina: "Satellite images show troops massing on the Qarath–Solvane border. Oil up 6% overnight."

---

### Chapter 5 — Drums of War
**Time:** Apr 2033 – Mar 2034 · **Regime:** Stressed → Crisis → Recovery · **New desks:** Oil (Commodities), Global Stocks, Prediction (full)
**Historical analogs:** 1990 Gulf War oil shock, Feb–Mar 2022 Russia–Ukraine invasion (oil spike, equity drop, gold and defence up).

**Setting:** Qarath and Solvane are fictional neighbouring oil-exporting nations controlling the fictional Strait of Kareem, through which ~20% of world oil passes. The home country (India) imports most of its oil, so oil price and currency matter directly. The human cost is acknowledged in news copy; war is never framed as a trading "opportunity" by sympathetic characters.

**Timeline (escalation chain)**
| Date | Event | Alert | Effect (targets) |
|---|---|---|---|
| Apr W1 | Border tension reports | Watch | Oil +4–8%, gold +1–2% |
| Apr W3 | Diplomatic talks fail | Warning | Oil +5%, Fear Index +30% |
| May W1 (Saturday) | **Solvane launches strikes on Qarath oil facilities** | Critical | Crypto −8–12% over weekend (only market open) |
| May W2 Mon | Markets open after weekend | Critical → **Market Halt** | Index gaps −6%, falls to −10% intraday → circuit breaker; oil +25%; gold +5%; INR −3% |
| May W2–W4 | Strait of Kareem closure threatened | Warning | Oil peaks +45–60% from April; OMCs −20–30%; airlines −25–35%; paints −15–20%; ONGC +15–25%; defence +20–35%; IT +/− (INR weakness helps) |
| Jun | Sanctions on Solvane | Warning | Global stocks −8–12%; US stocks in INR terms fall less (INR weakness offsets) |
| Jun | Central bank emergency statement on currency | Watch | Bond yields +0.3–0.5% |
| Jul | **Branch point: ceasefire talks** | Critical | See branches |
| Aug–Mar | Resolution path | — | — |

Peak index drawdown target: −15 to −22% (Branch A) or −25 to −30% (Branch B).

**Branch point (Jul):**
| Branch | Probability | Path |
|---|---|---|
| A — Ceasefire | 55% | Oil falls back to +10–15% over April levels within 2 months; index recovers to pre-war level within 5–7 months; defence gives back half of gains |
| B — Prolonged conflict | 45% | Strait partially closed 3 months; oil stays +40%; inflation +2% in-world → central bank hikes once (links to Ch 3 lessons); index recovery takes 10–12 months |

**Prediction markets**
- "Will Solvane strike Qarath before June?" (opens April; resolves when strike happens)
- "Ceasefire signed by 31 August?" — the key hedge
- "Oil above $150 by 30 June?"
- "Will the circuit breaker trigger again this quarter?"

**Checkpoints**
1. *Apr W3:* "Tensions rising. Your portfolio has 0% gold and 0% oil exposure." → Add hedge (gold/oil/prediction "Yes strike") / wait / reduce equity.
2. *Market Halt:* "Market halted. Your portfolio is down 11% today." → Sell all at reopen / hold / buy quality stocks gradually / open crash playbook. Victor: "The worst day to sell is usually the day everyone else is selling."
3. *Jun:* "Global stocks in rupee terms are down less than US index. Why?" → quiz on currency effect.

**Objectives:** Primary: net worth drawdown at worst point smaller than the index drawdown. Optional: profit from a prediction market hedge (Hedger); hold 5+ asset classes (Diversifier); don't sell more than 30% of equity during the halt week.

**Lessons:** Geopolitical risk, oil and inflation, currency effects, hedging, circuit breakers, crash playbook.

**Cliffhanger (Mar 2034):** Priya messages from the hospital: "We've had eleven patients with a pneumonia we can't identify."

---

### Chapter 6 — The Silent Outbreak
**Time:** Apr 2034 – Mar 2035 · **Regime:** Crisis (fastest crash) → V-recovery
**Historical analog:** Feb–Mar 2020 COVID crash (Nifty roughly −38% peak to trough in about five weeks, two market-wide halts in March 2020), then stimulus-driven recovery within months.

**Timeline**
| Date | Event | Alert | Effect (targets) |
|---|---|---|---|
| Apr | Unknown respiratory illness in two cities | Watch | Pharma +3%, markets shrug |
| May W1 | WHO-style global body declares emergency (fictional "World Health Council") | Warning | Index −8% in a week; travel/hotels −20% |
| May W3 | National lockdown announced | Critical → **Market Halt #1** | Index −10% → halt |
| May W4 | Global panic, crypto and gold both fall briefly (liquidity crunch) | Critical | Everything falls together — correlation spike lesson |
| Jun W1 | **Market Halt #2** | Market Halt | Index trough −35 to −40% from peak |
| Jun W2 | Central bank emergency rate cut −0.75%, liquidity support | Critical | Bonds +4–6%, gold +8% |
| Jun W3 | Government stimulus package | Warning | Index +12% in a week |
| Jul–Dec | Recovery: IT, pharma, telecom lead; hotels, airlines lag | Info | Index back to pre-crash within 7–10 months |
| **Branch** Sep | Vaccine trial result | Critical | See branches |

**Branch point (Sep):** Fast vaccine success (60%) → rotation into hotels/airlines/auto, index new high by Mar 2035. Delayed vaccine (40%) → second wave, index −12% dip in Nov, recovery by mid-2035 (spills into Ch 7).

**Prediction markets:** "Will a vaccine be approved by 31 December?", "Will a second lockdown be announced?", "Index back above pre-crash level by March?"

**Checkpoints**
1. *May W4:* "Gold AND stocks AND crypto fell today. Why?" → quiz on liquidity crunch / margin selling.
2. *Jun trough:* "Priya asks if she should stop her SIP." → Stop / continue / increase. (Debrief shows 5-year outcomes of each.)
3. *Jul:* "Hotels are down 55%. Cheap?" → Victor on "cheap vs value", survival risk.

**Objectives:** Primary: don't stop your SIP during the chapter. Optional: buy during the trough week; net worth back above pre-crash level by chapter end.

**Lessons:** Correlations go to 1 in panics, liquidity, central bank response, SIP through crashes, cheap vs value.

**Cliffhanger:** Nina: "Northgate Bank shares fall 18% after auditors flag irregularities."

---

### Chapter 7 — Cracks in the Banks
**Time:** Apr 2035 – Mar 2036 · **Regime:** Credit stress
**Historical analogs:** IL&FS default (2018), Yes Bank moratorium (Mar 2020), US regional bank failures (Mar 2023).

**Fictional entities:** Northgate Bank (mid-size private bank), Crescent Finance (NBFC), Meridian Housing Finance (NBFC).

**Timeline**
| Date | Event | Alert | Effect (targets) |
|---|---|---|---|
| Apr | Northgate auditor flags bad loans | Warning | Northgate −18%, Bank Nifty −4% |
| May | Crescent Finance misses a bond payment | Critical | Crescent −60%; NBFCs −15–25%; corporate bond spreads widen; debt funds holding Crescent paper fall 5–8% (NAV shock) |
| Jun | Deposit run on Northgate (social media panic) | Critical | Northgate −50%; Bank Nifty −12–15%; gold +4% |
| Jul | **Branch point: regulator action on Northgate** | Critical | See branches |
| Aug–Mar | Contagion fades, strong banks recover | Info | Large private banks and SBI recover within 6–9 months |

**Branch point (Jul):** Rescue merger with a larger bank (65%) — Northgate shareholders get 1 share per 12 (−70% vs pre-crisis); depositors safe. Moratorium and write-down (35%) — trading suspended 30 days, shareholders −90%, certain bonds written off; broader Bank Nifty extra −5%.

**Prediction markets:** "Will Northgate be rescued by 31 July?", "Will Meridian Housing also default?" (outcome: No, 75%).

**Checkpoints**
1. *May:* "Your debt fund dropped 6% in a day. Isn't debt safe?" → quiz on credit risk.
2. *Jun:* "Northgate is down 70%. It could double if rescued." → Buy small / buy big / avoid. Victor on survivorship risk and position sizing.

**Objectives:** Primary: have no single stock above 15% of net worth at chapter end. Optional: avoid the credit-risk debt fund; profit on "rescue" prediction market.

**Lessons:** Credit risk, bank runs, contagion, deposit insurance basics, debt fund risk, position sizing.

**Cliffhanger:** Nina: "Six months to the general election. Exit polls disagree."

---

### Chapter 8 — The Election
**Time:** Apr 2036 – Mar 2037 · **Regime:** Uncertainty → policy-driven rotation
**Historical analog:** Election results days with large swings (e.g. 4 Jun 2024, Nifty fell about 6% on the day before recovering over following weeks).

**Fictional parties:** Unity Front and People's Alliance. Both written neutrally: each has policies that help some sectors and hurt others. No real-world party is referenced or implied.

| Party | Platform (in-game) | Sector winners | Sector losers |
|---|---|---|---|
| Unity Front | Infrastructure spending, disinvestment, lower corporate tax | Infra, capital goods, PSU banks, cement | Bonds (higher deficit), FMCG flat |
| People's Alliance | Rural income support, welfare, fiscal caution on capex | FMCG, two-wheelers, rural lenders | Capital goods, some PSU stocks |

**Timeline**
| Date | Event | Alert | Effect |
|---|---|---|---|
| Apr–May | Campaign; Fear Index rises 20–40% | Watch | Range-bound market |
| Jun W1 | Exit polls: Unity Front leads | Info | Index +3% |
| Jun W2 | **Results day** (branch resolves) | Critical (possibly Halt) | See branches |
| Jul | Post-election budget | Warning | Sector rotation |

**Branch point (results day):**
| Branch | Probability | Path |
|---|---|---|
| A — Unity Front majority | 45% | Index +2–4%; infra +8–12% |
| B — People's Alliance majority | 35% | Index −5–8% intraday (surprise vs exit polls), recovers in 3–6 weeks; FMCG/rural +6–10% |
| C — Hung parliament | 20% | Index −6–9%, possible halt; 3 weeks of volatility; coalition forms, recovery |

**Prediction markets (core of chapter):** "Unity Front majority?", "Hung parliament?", "Index closes results day above previous close?". Prices driven by fictional polls with noise; exit polls deliberately slightly biased, teaching that polls aren't outcomes.

**Checkpoints**
1. *Pre-results:* "Exit polls show Unity Front winning. Go all-in on infra stocks?" → All-in / tilt slightly / stay balanced / hedge with prediction market.
2. *Results day crash (B or C):* "Index down 7%. Sell?" → Victor: "Elections change sectors. They rarely change the long-term direction of a whole economy."

**Objectives:** Primary: finish chapter with drawdown on results day smaller than index. Optional: correctly hedge using a prediction market.

**Lessons:** Event risk, polls vs outcomes, sector rotation, not betting the portfolio on one outcome.

**Cliffhanger:** Jake, humbled, returns: "I lost almost everything in the crypto crash. What did you do differently?"

---

### Chapter 9 — The Long Climb
**Time:** Apr 2037 – Dec 2038 · **Regime:** Long calm bull, late small-cap bubble
**Historical analogs:** 2003–2007 and 2014–2017 Indian bull runs; small-cap frauds (Satyam-type governance failures).

**Fictional entities:** Brightline Infra (smallcap darling), Apex Agro, Solaris Green (fictional smallcaps), The Tipster returns.

**Timeline**
| Date | Event | Alert | Effect |
|---|---|---|---|
| 2037 | Steady growth, index +15–20% per year, low volatility | Info | Boredom: over-trading temptation (charges eat returns) |
| Early 2038 | Smallcap index +60% in 12 months | Warning ("Smallcap valuations extreme") | Brightline +400% since 2036 |
| Mid 2038 | The Tipster: "Solaris Green 10x guaranteed" | Watch | Pump-and-dump: +150% then −85% |
| Sep 2038 | **Brightline founder resigns, admits accounts were inflated** | Critical | Brightline −80% in a week (lower circuits daily, can't sell) — lower-circuit lesson |
| Oct–Dec | Smallcap index −25–30%; large caps −5% | Warning | Quality outperforms |

**Checkpoints**
1. *2037:* "You've made 60 trades this year. Charges cost you 3.1% of returns." → Victor on patience.
2. *Brightline day 1:* "Lower circuit hit. Sell order not filled." → Explains lower circuit, no buyers.
3. Jake asks for help rebuilding. → Help him plan a SIP + diversification (dialogue; affects ending epilogue).

**Objectives:** Primary: trades fewer than 40 in the chapter. Optional: smallcap exposure under 20% by Sep 2038; ignore the Tipster.

**Lessons:** Compounding, over-trading, valuations, governance red flags, lower circuits, pump-and-dump.

**Cliffhanger:** Dr. Ward: "Global growth indicators just turned negative. Oil is rising again. Something big is coming."

---

### Chapter 10 — The Perfect Storm
**Time:** Jan 2039 – Dec 2039 · **Regime:** Crisis (multi-shock) → early recovery
**Historical analogs:** 2008 Global Financial Crisis (Sensex fell about 60% from Jan to Oct 2008), combined with oil and currency stress.

**Timeline**
| Date | Event | Alert | Effect (targets) |
|---|---|---|---|
| Jan | Global recession signals | Warning | Global stocks −8% |
| Mar | Solvane tensions return, oil +35% | Critical | INR −5% |
| Apr | Major global bank collapses (fictional "Atlantic Meridian Bank") | Critical → Market Halt | Global −15%, India −12% in 2 weeks |
| May | Crypto: largest remaining exchange hacked (fictional) | Critical | BTC −40% |
| Jun | Currency crisis: INR −10% YTD, central bank hikes to defend | Critical | Bonds −5%, gold +20% in INR |
| Jul | **Final branch: coordinated global stimulus** | Critical | See branches |
| Aug–Dec | Recovery path | — | — |

Peak drawdown target: index −40 to −50%; global stocks −35–45% in USD (less in INR); gold +25–35% in INR.

**Final branch (Jul):** Coordinated stimulus works (60%): sharp rally, index recovers half of losses by Dec. Stimulus delayed (40%): second leg down in Sep (−10%), recovery begins in Nov.

**Prediction markets:** "Coordinated stimulus announced by July?", "Oil above $180?", "INR weaker than 110 per USD by June?" (fictional levels).

**Checkpoints:** The final exam: five checkpoints, one per shock, each testing a lesson from an earlier chapter. Victor stays silent this chapter: "You don't need me anymore."

**Objectives:** Primary: survive with net worth above 50% of peak. Optional: finish year with positive real return; use at least one hedge.

---

## 5. Fictional entities index

| Name | Type | Chapter |
|---|---|---|
| NovaPay, ZipCart, GreenVolt EV, Harbor Logistics, Skyline Realty, Quantum Chips India | IPO companies | 2 |
| Vaultex, Marcus Cole | Crypto exchange, founder | 4 |
| LumaUSD, LUMA, MOONCAT, ROCKETDOG | Crypto assets | 4 |
| Qarath, Solvane, Strait of Kareem | Countries, strait | 5, 10 |
| World Health Council | Global health body | 6 |
| Northgate Bank, Crescent Finance, Meridian Housing Finance | Bank, NBFCs | 7 |
| Unity Front, People's Alliance | Political parties | 8 |
| Brightline Infra, Apex Agro, Solaris Green | Smallcaps | 9 |
| Atlantic Meridian Bank | Global bank | 10 |
| Fictional funds: Survivor Index 50 Fund, Bluechip Fund, Midcap Opportunities, Smallcap Growth, Short Duration Debt, Credit Risk Debt, Gold Fund | Mutual funds | 2+ |

## 6. Recurring mechanics

- **Jake's ghost line:** his net worth plotted beside the player's. Designed arc: +400% by Ch 4 peak, −92% by end of Ch 4, rebuilds from Ch 9 if helped.
- **The Tipster:** 1–2 tips per chapter from Ch 2. Every tip is a pump-and-dump on a fictional microcap. Ignoring all tips unlocks "Tip Ignored".
- **Sam's arc:** advice given in Ch 2 checkpoint determines whether Sam is wiped out in Ch 9 smallcap crash or is fine. Epilogue mentions him.
- **Crash Playbook:** unlocked in Ch 1, referenced at every halt: check position sizes, don't sell in panic, rebalance, continue SIPs, keep emergency cash, never use money you need soon.

## 7. Endings

Based on final score (`prd.md` §12) and behaviour flags.

| Ending | Condition | Epilogue |
|---|---|---|
| Market Legend | Score ≥ 85 and survived every chapter without panic-selling at a trough | Victor hands over his old trading journal; Jake and Sam credit the player |
| Steady Builder | Score 70–84 | Calm, compounding life; Priya's SIP worth 4x |
| Survivor | Score 50–69 | Made it through; lessons listed |
| Gambler's Ruin | Behaviour score very low (tip-chasing, concentration, panic sells) | Jake-style ending; "Fresh Start" New Game+ offered |
| Sat It Out | > 60% cash for most of the story | Money safe but inflation cost X%; Victor: "Not losing isn't the same as winning" |

New Game+: new seed, reshuffled branch probabilities (±15%), harder difficulty option, epilogues remember previous ending.

## 8. Content production tasks

| ID | Phase | Task | Done when |
|---|---|---|---|
| ST-T01 | P5 | Story content schema (chapters, beats, events, checkpoints, branches, dialogue) | Validated by Zod |
| ST-T02 | P5 | Character sheets + portrait art briefs | Approved |
| ST-T03 | P5 | Ch 1–3 scripts + dialogue | Proofread, engine calibrated |
| ST-T04 | P6 | Ch 4–7 scripts + dialogue | Proofread, calibrated |
| ST-T05 | P6 | Sensitivity review (war, pandemic, bank failures) | Signed off |
| ST-T06 | P7 | Ch 8–10 scripts + dialogue | Proofread, calibrated |
| ST-T07 | P7 | Political neutrality review (Ch 8) | Signed off |
| ST-T08 | P7 | Endings + epilogues | All 5 reachable in test runs |
| ST-T09 | P7 | Real-vs-fictional audit: no real company given a fictional scandal | Checklist complete |
| ST-T10 | P7 | Calibration pass: each chapter's targets met in 100 seeded runs | Report attached |
