# Test Cases — Market Survivor

Engine tests use a **fixed test config** and fixed seeds so results never change when real-world rates or content change. Production config and content are tested separately for schema validity and calibration.

Priority: **C** = critical (blocks release), **H** = high, **M** = medium.

## 0. Test config (`test-market-config`)

| Key | Value |
|---|---|
| Starting Treasury | ₹1,000,000 |
| Brokerage | ₹20 flat per executed order |
| STT (delivery) | 0.1% on buy and sell value |
| Exchange txn charge | 0.003% of turnover |
| Regulator fee | 0.0001% of turnover |
| Stamp duty | 0.015% on buy value |
| GST | 18% on (brokerage + exchange + regulator fee) |
| Stock price band | 10% default |
| Market-wide breakers | 10% / 15% / 20% |
| Equity settlement | T+1 |
| Fund NAV / redemption | Next-day NAV / T+2 |
| FX conversion fee | 0.5% each way |
| FD early-break penalty | 1% off the rate |
| Crypto self-custody transfer | 1 day, fee ₹50 |
| Prediction share payout | ₹100 per share, LMSR b = 100 shares |
| Time Machine | Stake ≤ 10% net worth, gain cap +50%, 1 paid run / scenario / 7 days |
| Max days per advance | 30 |
| STCG / LTCG | 20% / 12.5%, exemption ₹125,000, LTCG after 365 days |

---

## 1. Central Treasury (Phase 1)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-TRS-01 | C | New career | available = ₹1,000,000; blocked = unsettled = 0; ledger has one `grant` entry |
| TC-TRS-02 | C | Invariant: `sum(ledger) == available + blocked + unsettled` | Holds after 10,000 random actions across all desks (property test) |
| TC-TRS-03 | C | Invariant: all buckets ≥ 0, all quantities ≥ 0 | Never violated (property test) |
| TC-TRS-04 | C | Invariant: `blocked == sum(open reservations)` | Holds after random place/cancel/fill sequences |
| TC-TRS-05 | C | Reserve → capture | Limit buy ₹40,071.06 reserved; on fill, blocked → 0 and position created |
| TC-TRS-06 | C | Reserve → release | Cancel open order → full amount back to available |
| TC-TRS-07 | C | Shared cash across desks | Available ₹100,000: buy crypto ₹70,000 → IPO apply ₹50,000 rejected ("Not enough available cash") |
| TC-TRS-08 | C | Settlement tick | Stock sale Monday → unsettled; Tuesday tick → available |
| TC-TRS-09 | H | Every response carries treasury + stateVersion | All mutation endpoints return them |
| TC-TRS-10 | H | Net worth | Cash buckets + marks of every desk equals `netWorth` returned (tolerance 0 paise) |
| TC-TRS-11 | H | Real net worth | CPI +10% since start, net worth unchanged → real net worth shown −9.09% |
| TC-TRS-12 | H | Unified ledger | Actions on 8 desks appear in one chronological feed with correct desk tags |

## 2. Stocks desk (Phase 1)

| ID | Pri | Scenario | Input | Expected |
|---|---|---|---|---|
| TC-ORD-01 | C | Market buy fills next open | Buy 10 TCS on D; D+1 O=4000 | Filled 10 @ ₹4,000 |
| TC-ORD-02 | C | Limit touches range | Limit ₹3,990; next L=3,980 | Filled @ ₹3,990 (or open if open ≤ limit) |
| TC-ORD-03 | C | Limit not reached | Limit ₹3,970; L=3,980 | Remains open, still blocked |
| TC-ORD-04 | C | Gap-down below limit | Limit ₹3,990; O=3,950 | Filled @ ₹3,950 |
| TC-ORD-05 | C | SL-M gap-down | Trigger ₹3,900; O=3,700 | Filled @ ₹3,700 |
| TC-ORD-06 | C | Sell more than held | Hold 5, sell 10 | Rejected |
| TC-ORD-07 | H | Qty validation | 0, −1, 1.5, 10,001 | Rejected |
| TC-ORD-08 | H | Order before holiday | Place Friday, Monday holiday | Fills Tuesday |
| TC-ORD-09 | H | Slippage | Order = 20% ADV in CRISIS | Worse fill than CALM by configured multiplier |
| TC-CHG-01 | C | Buy charges | 10 @ ₹4,000 | Brokerage 20.00, STT 40.00, Exch 1.20, Reg 0.04, Stamp 6.00, GST 3.82 → **₹71.06** |
| TC-CHG-02 | C | Sell charges | 10 @ ₹4,200 | Brokerage 20.00, STT 42.00, Exch 1.26, Reg 0.04, GST 3.83 → **₹67.13**; credit ₹41,932.87 (unsettled) |
| TC-CIR-01 | C | Upper band | Prev close ₹1,000 | Limit ₹1,101 rejected; ₹1,100 accepted |
| TC-CIR-02 | C | Lower circuit queue | Stock locked at lower band | Sell fills 0–20% of requested per day; rest stays open |
| TC-CIR-03 | C | Market-wide halt 10% | Index −10% intraday | Halt event, world state Halt, trading disabled, clock paused |
| TC-CIR-04 | H | 15% / 20% levels | Index −15% / −20% | Correct halt rule; 20% closes market for day |

## 3. World engine (Phase 2)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-WLD-01 | C | Determinism | Same seed + content → identical factors and prices for 10 years |
| TC-WLD-02 | C | Player independence | Two runs, same seed, different trades → identical prices, events, branch outcomes |
| TC-WLD-03 | C | No negative prices | 1,000 runs × 10 years: min > 0 |
| TC-WLD-04 | C | OHLC validity | L ≤ O, C ≤ H every bar |
| TC-WLD-05 | H | Regime vol | Realized index vol in CRISIS ≈ 3× CALM (±25%) |
| TC-WLD-06 | H | Correlation boost | Avg pairwise stock correlation CRISIS > STRESSED > CALM |
| TC-WLD-07 | H | Fat tails | Daily index return kurtosis > 3 over 50-year Free Play run |
| TC-WLD-08 | H | Calendars | Weekend: only crypto has new bars; US holidays: no US bars; India holidays: no India bars |
| TC-WLD-09 | M | Fear Index | Rises on Critical events and in CRISIS regime |

## 4. Contagion and events (Phase 2–3)

Direction tests run 1,000 seeds; pass if direction correct in ≥ 90% of runs over the event's first 10 trading days.

| ID | Pri | Event | Expected direction |
|---|---|---|---|
| TC-EVT-01 | C | Oil-nation war (`GPR`+, `OIL`+, `GR`−, `FX`+) | Oil ↑, gold (INR) ↑, index ↓, airlines ↓, paints ↓, OMCs ↓, upstream oil ↑, defence ↑, USD/INR ↑, US stocks fall less in INR than USD |
| TC-EVT-02 | C | Pandemic lockdown | Index ↓, hotels ↓ more than index, aviation ↓ more than index, pharma ↓ less than index (or ↑), Fear Index ↑ |
| TC-EVT-03 | C | Liquidity crunch (`LIQ`−) | Stocks ↓, gold ↓ on day 1–2, crypto ↓ (correlation spike) |
| TC-EVT-04 | C | Rate hike +0.50% (`PR` step) | Long bond ↓ (≈ duration × 0.5%), NBFC ↓, auto ↓, FD booking rate ↑, BTC ↓ |
| TC-EVT-05 | C | Bank failure (fictional Northgate) | Northgate ↓↓, Bank Nifty ↓, credit-risk debt fund NAV ↓, gold ↑ |
| TC-EVT-06 | C | Stablecoin depeg | LumaUSD < $0.90, LUMA ↓ ≥ 95%, BTC ↓, equities move < 2% |
| TC-EVT-07 | H | Rupee weakness (`FX`+) | IT ↑ relative to index, US stocks in INR ↑, gold in INR ↑ |
| TC-EVT-08 | H | Oil → inflation → rates chain | `INF` rises within 20–40 days of oil shock; next central bank meeting more likely to hike |
| TC-EVT-09 | H | Weekend event | Saturday strike: crypto moves Saturday; India gaps Monday open; US reacts Monday session |
| TC-EVT-10 | H | Shock profiles | `spike_decay` half-life, `ramp`, `step`, `pulse` produce expected factor paths |
| TC-EVT-11 | C | Real-company rule | Content lint rejects negative corporate `directHits` on real instruments |
| TC-EVT-12 | H | "Why markets moved" | Generated explanation names the event and top 3 affected sectors correctly |

## 5. Funds & SIP (Phase 3)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-FND-01 | C | Next-day NAV | Buy ₹10,000 on D → units at D+1 NAV; cash blocked on D, captured on D+1 |
| TC-FND-02 | C | NAV from constituents | Index fund NAV change = weighted constituent change (±0.01%) |
| TC-FND-03 | H | Exit load | Redeem within exit period → load deducted |
| TC-FND-04 | H | Redemption T+2 | Proceeds unsettled → available after 2 trading days |
| TC-SIP-01 | C | SIP buy | ₹5,000 on 5th; NAV ₹50 → 100 units |
| TC-SIP-02 | H | SIP on holiday | Next trading day |
| TC-SIP-03 | H | Step-up 10% | Month 13 amount ₹5,500 |
| TC-SIP-04 | C | SIP with insufficient cash | SIP skipped, alert "SIP missed: not enough available cash" |
| TC-SIP-05 | C | XIRR | Known cashflow set matches spreadsheet XIRR within 0.01% |
| TC-SIP-06 | H | Crash buying | More units bought in crash months (lower NAV) |
| TC-SIP-07 | H | Debt fund credit shock | Crescent default → credit-risk fund NAV −5 to −8% on event day |

## 6. IPO desk (Phase 3)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-IPO-01 | C | Apply blocks funds | 2 lots blocked from available |
| TC-IPO-02 | C | Undersubscribed | Full allotment |
| TC-IPO-03 | C | Oversubscribed lottery | 50x, 10,000 simulated applicants → max 1 lot each; allottees ≈ available lots; chi-square fairness passes |
| TC-IPO-04 | C | Refund | Non-allotted funds released on allotment date |
| TC-IPO-05 | H | Limits | Above retail max / below 1 lot rejected |
| TC-IPO-06 | H | Regime link | Mean listing gain in CRISIS < CALM < EUPHORIA (10k runs) |
| TC-IPO-07 | H | Designed outcomes | Story IPO listing gains fall within `story.md` ranges in ≥ 80% of runs |
| TC-IPO-08 | C | Lottery secrecy | No allotment seed or result before allotment date in any response |

## 7. Fixed income (Phase 3)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-FIX-01 | C | FD booking rate | Rate = policy rate + configured spread at booking; locked afterward |
| TC-FIX-02 | C | FD maturity | ₹100,000 at 7% simple for 1 year → ₹107,000 credited on maturity |
| TC-FIX-03 | C | FD early break | Break at 6 months → interest at 6% for 0.5 year = ₹3,000; principal + ₹3,000 credited |
| TC-FIX-04 | C | Bond duration | D = 7, convexity 60, yield +1% → price ≈ −6.7% |
| TC-FIX-05 | H | Bond carry | Unchanged yield 7% → price accrues ≈ 7%/365 per day |
| TC-FIX-06 | H | Rate hike event | Long bond falls more than short bond |

## 8. Commodities & Global (Phase 3)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-GLB-01 | C | FX conversion on buy | $1,000 of stock at USD/INR 85 → ₹85,000 + 0.5% fee ₹425 = ₹85,425 captured |
| TC-GLB-02 | C | Currency P&L split | USD price unchanged, USD/INR 85 → 88 → price P&L 0, currency P&L +₹3,000 |
| TC-GLB-03 | H | US calendar | US holiday → no US fills; orders fill next US session |
| TC-GLB-04 | H | Sell and settle | USD → INR with fee, T+1 to available |
| TC-COM-01 | C | Gold in INR | Gold USD +2%, USD/INR +1% → gold INR ≈ +3.02% |
| TC-COM-02 | H | Oil fund | Tracks `OIL` factor in INR |

## 9. Crypto (Phase 3)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-CRY-01 | C | 24/7 | Trades fill on Saturday and Sunday |
| TC-CRY-02 | C | Fractional | 0.001 BTC allowed; stored in base units exactly |
| TC-CRY-03 | C | Exchange freeze | Vaultex freeze event → positions with custody EXCHANGE on Vaultex marked frozen; sells rejected |
| TC-CRY-04 | C | Self-custody safe | Positions in SELF custody unaffected by freeze |
| TC-CRY-05 | H | Custody transfer | SELF → EXCHANGE takes 1 day, fee ₹50; sell blocked until arrived |
| TC-CRY-06 | H | Recovery branch | Rescue branch → unfreeze at 60–80%; bankruptcy branch → 10–25% credited later |
| TC-CRY-07 | H | Rug pull | Meme coin −90% or more within configured bars |
| TC-CRY-08 | H | No circuits | 40% daily move allowed |

## 10. Prediction markets (Phase 3)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-PM-01 | C | Initial price | q_yes = q_no = 0, b = 100 → price YES = 0.500 |
| TC-PM-02 | C | LMSR cost | Buy 10 YES from 0/0 → cost = 100·ln(e^0.1 + 1) − 100·ln 2 = **5.125 shares' worth** → ₹512.53 at ₹100/share (rounded against player); new YES price ≈ 0.525 |
| TC-PM-03 | C | Sell back | Buy then immediately sell 10 YES → refund ≤ cost (never profit from round trip) |
| TC-PM-04 | C | Resolution YES | 100 YES shares → ₹10,000 credited to available; NO pays 0 |
| TC-PM-05 | C | Server-only resolution | Client resolve attempt → 403/404 |
| TC-PM-06 | H | Linked event required | Market without `linkedEventId` cannot be created |
| TC-PM-07 | H | Bot convergence | Over 30 days with pre-signals, price moves toward true probability in ≥ 70% of runs, never reaches certainty before resolution |
| TC-PM-08 | H | Hedge accounting | Debrief attributes prediction payout as hedge contribution when linked to portfolio loss |
| TC-PM-09 | H | Market closed | Trades after close time rejected |

## 11. Alerts (Phase 4)

| ID | Pri | Trigger | Expected |
|---|---|---|---|
| TC-ALR-01 | C | Index −4% day | Warning alert |
| TC-ALR-02 | C | Index −10% from peak | Warning "correction"; −20% Critical "bear market" |
| TC-ALR-03 | C | Circuit breaker | Market Halt alert + halt state |
| TC-ALR-04 | C | Critical world event | Breaking News + auto-pause (setting on) |
| TC-ALR-05 | H | Portfolio drawdown −20% | Warning with net worth figure |
| TC-ALR-06 | H | Concentration > 25% single asset | Watch alert |
| TC-ALR-07 | H | Idle cash > 40% for 90 days | Watch alert |
| TC-ALR-08 | H | Custody risk | > 20% net worth on at-risk exchange → Warning |
| TC-ALR-09 | H | Dedupe | Same trigger within 5 sim days suppressed |
| TC-ALR-10 | H | Escalation | Warning replaced by Critical banner |
| TC-ALR-11 | M | Auto-pause off | Critical does not pause when setting off |
| TC-ALR-12 | H | Stablecoin < 0.98 / < 0.90 | Warning / Critical |

## 12. Story Mode (Phase 5–7)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-STY-01 | C | Chapter loads | Ch 1 starts 1 Jan 2030 with ₹1,000,000, only Stocks desk unlocked |
| TC-STY-02 | C | Desk unlocks | Desks unlock at chapters listed in `prd.md` §6.2 |
| TC-STY-03 | C | Checkpoint pauses | `advance` blocked until choice submitted |
| TC-STY-04 | C | Checkpoint trade | Pre-filled order confirmed → placed through normal order flow and Treasury |
| TC-STY-05 | C | Branch determinism | Same seed → same branch outcome; different seeds hit each branch at roughly its probability (±5% over 10k seeds) |
| TC-STY-06 | C | Branch secrecy | Outcome absent from all responses before resolve date |
| TC-STY-07 | C | Chapter calibration | Each chapter's peak drawdown within `story.md` target in ≥ 80% of 1,000 runs |
| TC-STY-08 | H | Objectives | Primary/optional objectives evaluate correctly at chapter end |
| TC-STY-09 | H | Debrief strategies | Calm investor, panic seller, SIP investor computed from same world data; player line equals net worth snapshots |
| TC-STY-10 | H | Resume | Close browser mid-chapter → resume at same beat, same state |
| TC-STY-11 | H | Endings | Each of 5 endings reachable via scripted bot strategies |
| TC-STY-12 | H | Jake ghost line | Follows designed arc within tolerance |
| TC-STY-13 | H | Tipster | Every tip instrument is fictional and pumps then dumps |
| TC-STY-14 | M | New Game+ | New seed; branch probabilities shifted within ±15% |
| TC-STY-15 | C | Content audit | No real instrument receives a fictional scandal/default/fraud event |

## 13. Scoring (Phase 7)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-SCR-01 | C | Weights | Final score = 40% real return + 25% risk + 25% behaviour + 10% objectives |
| TC-SCR-02 | H | Max drawdown | Computed from net worth snapshots correctly |
| TC-SCR-03 | H | Panic sell flag | Selling > 30% of equity within 5 days of a Halt → flag |
| TC-SCR-04 | H | Sat It Out | > 60% cash for most of story → ending selected |

## 14. Free Play, Time Machine, Daily, Academy (Phase 8)

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-FRP-01 | H | 10-year run | No errors; event frequency matches difficulty setting |
| TC-TM-01 | C | Stake limit | Stake > 10% of career net worth rejected |
| TC-TM-02 | C | Gain cap | Stake ₹50,000, return +80% → ₹75,000 returned (cap +50%) |
| TC-TM-03 | C | Loss | Stake ₹50,000, return −30% → ₹35,000 returned |
| TC-TM-04 | C | Cooldown | Second paid run of same scenario within 7 days → allowed only unstaked |
| TC-TM-05 | C | No future leakage | Prices beyond replay date never served |
| TC-TM-06 | H | Corporate actions | Splits/bonuses/dividends applied from dataset |
| TC-TM-07 | H | Sources | Every scenario has non-empty sources |
| TC-DLY-01 | C | Same seed | Two players same day → identical challenge |
| TC-DLY-02 | H | Reward cap | Rewards credited once per day to chosen career |
| TC-ACD-01 | H | Quiz reward once | Repeat completion gives no second reward |

## 15. Security

| ID | Pri | Scenario | Expected |
|---|---|---|---|
| TC-SEC-01 | C | IDOR read | Other player's career → 404 |
| TC-SEC-02 | C | IDOR write | Order on other player's career → 404/403 |
| TC-SEC-03 | C | Unauthenticated | 401 on all `/api/ms/*` |
| TC-SEC-04 | C | Replay | Same idempotency key twice → single effect |
| TC-SEC-05 | C | Cross-desk race | 20 parallel requests across crypto, stocks, IPO, prediction totalling 3× available → none push available < 0 |
| TC-SEC-06 | C | Parallel sells | 20 parallel sells of a 10-share holding → total sold ≤ 10 |
| TC-SEC-07 | C | Stale version | Mutation with old `expectedVersion` → 409 with fresh state |
| TC-SEC-08 | C | Body tampering | Extra fields (`price`, `available`, `outcome`) → 400 |
| TC-SEC-09 | C | Future data | Price/world queries beyond sim date clamped |
| TC-SEC-10 | C | Branch leak | Branch outcomes absent from all responses and client bundle |
| TC-SEC-11 | C | Story leak | Future chapter/beat content absent from client bundle and responses |
| TC-SEC-12 | C | No rewind | No endpoint decreases sim date; world/ledger rows immutable |
| TC-SEC-13 | C | Prediction resolution | Client cannot resolve |
| TC-SEC-14 | C | Frozen assets | Sell of frozen position rejected at API and DB level |
| TC-SEC-15 | H | LMSR rounding | 1,000 buy/sell round trips never increase Treasury |
| TC-SEC-16 | C | Time Machine settle twice | Second settle → no effect |
| TC-SEC-17 | C | Time Machine stake from other player's career | 403 |
| TC-SEC-18 | C | XSS | Script in display name rejected/escaped everywhere |
| TC-SEC-19 | C | SQLi | Malicious instrument id → validation error |
| TC-SEC-20 | C | Secrets | Bundle scan finds no secrets |
| TC-SEC-21 | C | No coin purchase path | No API/UI credits coins against payment |
| TC-SEC-22 | H | Rate limits | 31st order/min → 429 |

## 16. End-to-end (Playwright, desktop + mobile)

| ID | Pri | Flow | Expected |
|---|---|---|---|
| TC-E2E-01 | C | New Story career → Ch 1 → first buy → advance → sell | Treasury bar updates on every step |
| TC-E2E-02 | C | Ch 5 war: strike (weekend) → Monday halt → checkpoint → ceasefire/escalation → debrief | Breaking News, Halt card, crash theme, debrief |
| TC-E2E-03 | C | Multi-desk: buy stock, crypto, apply IPO, buy prediction YES in same session | Available decreases correctly each step; allocation shows 4 classes |
| TC-E2E-04 | C | Two tabs: spend cash in tab A | Tab B shows new balance within 1 s; stale action in B gets fresh state |
| TC-E2E-05 | H | Ch 4 custody: move to self-custody → Vaultex freeze | Self-custody coins unaffected; achievement unlocked |
| TC-E2E-06 | H | SIP → pandemic chapter → continue SIP | Debrief shows SIP outcome comparison |
| TC-E2E-07 | H | Time Machine stake → play → settle | Career Treasury credited correctly |
| TC-E2E-08 | H | Keyboard-only play | Trade, switch desks (1–9), open alerts (A) |
| TC-E2E-09 | M | Colour-blind + reduced motion | Colours switch; no pulses |

## 17. Non-functional

| ID | Pri | Area | Expected |
|---|---|---|---|
| TC-NFR-01 | H | Tick performance | 120 instruments × 1 day < 30 ms engine time |
| TC-NFR-02 | H | Advance latency | 7-day advance < 250 ms p95 |
| TC-NFR-03 | H | Web vitals | LCP < 2.5 s on 4G mid-range Android |
| TC-NFR-04 | H | Chart FPS | ≥ 55 fps pan/zoom |
| TC-NFR-05 | H | Load | 500 concurrent careers auto-playing; no ledger drift after reconciliation |
| TC-NFR-06 | H | Accessibility | axe-core 0 serious/critical in every world state |
| TC-NFR-07 | H | Disclaimer | Present on every trading screen |

## 18. QA tasks by phase

| ID | Phase | Scope | Done when |
|---|---|---|---|
| QA0-T01 | P0 | Test infra: Vitest, fast-check, test DB, Playwright in CI | Green |
| QA1-T01 | P1 | TC-TRS, TC-ORD, TC-CHG, TC-CIR, TC-SEC-01..08 | All C/H pass |
| QA2-T01 | P2 | TC-WLD, TC-EVT-01..10, TC-SEC-09 | Pass, calibration smoke green |
| QA3-T01 | P3 | TC-FND, TC-SIP, TC-IPO, TC-FIX, TC-GLB, TC-COM, TC-CRY, TC-PM, TC-SEC-13..15 | Pass |
| QA4-T01 | P4 | TC-ALR | Pass |
| QA5-T01 | P5 | TC-STY (Ch 1–3), TC-SEC-10..12, TC-EVT-11 | Pass |
| QA6-T01 | P6 | TC-STY (Ch 4–7), TC-E2E-02/05/06 | Pass |
| QA7-T01 | P7 | TC-STY (Ch 8–10, endings), TC-SCR | Pass |
| QA8-T01 | P8 | TC-FRP, TC-TM, TC-DLY, TC-ACD, TC-SEC-16/17 | Pass |
| QA9-T01 | P9 | TC-E2E, TC-NFR, TC-SEC-18..22 | All C pass, H ≥ 95% |
| QA9-T02 | P9 | Regression suite required on every PR to main | Enforced |
