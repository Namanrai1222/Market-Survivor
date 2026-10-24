# Market Engine — Market Survivor

How one world moves every market together, how alerts fire, how the central Treasury keeps one balance across all desks, and how prediction markets price event odds. This is the core of the game. It lives in `packages/engine` as pure, deterministic TypeScript.

---

## 1. Design goals

1. **Connected:** one event moves many assets through shared macro factors, in the right direction and roughly the right size.
2. **Realistic:** calibrated against historical analogs (§5). Volatility and correlations rise in crises. Crypto reacts on weekends first. Currency changes what global assets are worth in rupees.
3. **Deterministic:** same career seed + same content = same world, regardless of what the player trades. Player actions never change prices, event outcomes or branch results.
4. **Explainable:** every big move can be traced to an event and factor so the debrief can say *why*.

## 2. World state

```
WorldState {
  date                // current sim date (calendar day)
  regime              // CALM | STRESSED | CRISIS | RECOVERY | EUPHORIA
  factors[10]         // current factor levels
  factorShocks[10]    // today's shocks
  cpiIndex            // in-world inflation index
  policyRate          // central bank rate
  yieldCurve          // 1y, 3y, 10y
  usdInr              // exchange rate
  fearIndex           // VIX-style
  activeEvents[]      // events with remaining decay
  pendingBranches[]   // scheduled world outcomes (hidden)
  marketStatus        // per market: OPEN | CLOSED | HALTED
}
```

## 3. Macro factors

| # | Factor | Code | Meaning | Main drivers |
|---|---|---|---|---|
| 1 | Global risk appetite | `GR` | World investors' willingness to take risk | Recessions, wars, bank failures, stimulus |
| 2 | Domestic growth | `DG` | Home economy momentum | Budget, elections, monsoon, rates |
| 3 | Policy rate | `PR` | Central bank rate changes (drives yields) | Inflation, currency defence, crises |
| 4 | Inflation | `INF` | In-world CPI surprises | Oil, food, demand |
| 5 | Crude oil | `OIL` | Oil price shocks | Wars, supply cuts, demand |
| 6 | USD/INR | `FX` | Rupee weakness (+) / strength (−) | Oil, global risk, rate differential |
| 7 | Geopolitical risk | `GPR` | War/conflict intensity | Conflict events |
| 8 | Credit stress | `CRD` | Default risk, bank stress | Bank/NBFC events, recession |
| 9 | Crypto sentiment | `CRY` | Crypto-specific mood | Crypto events, liquidity |
| 10 | Liquidity | `LIQ` | Ease of funding; negative = everything gets sold | Panics, central bank support |

Each factor follows a mean-reverting process between events:

```
f(t+1) = f(t) + κ · (μ − f(t)) + σ_regime · ε + eventShock(t)
```

Factor shocks are correlated (e.g. `OIL` ↑ tends to push `INF` ↑ and `FX` ↑) via a factor covariance matrix, applied with Cholesky decomposition.

## 4. Regimes

| Regime | Vol multiplier | Correlation boost | Typical duration | Entered by |
|---|---|---|---|---|
| CALM | 1.0× | +0.00 | Months–years | Default |
| EUPHORIA | 1.2× | +0.05 | 3–12 months | Long rally, IPO waves, crypto boom |
| STRESSED | 1.6× | +0.15 | Weeks–months | Warning-level events, rate hikes |
| CRISIS | 3.0× | +0.35 | Days–weeks | Critical events, halts |
| RECOVERY | 1.4× | +0.10 | Months | Stimulus, ceasefire, vaccine |

- Transitions follow a Markov matrix in Free Play; Story content can force a regime at a beat.
- **Correlation boost** increases every asset's loading on `GR` and `LIQ` during stress, reproducing the real pattern that "everything falls together" in panics (Ch 6 lesson).

## 5. Asset model

Daily log return for asset *i*:

```
r(i,t) = α(i) + Σ_k β(i,k) · shock(k,t)        // macro factors
       + sectorShock(s,t)                       // sector common move
       + eventDirect(i,t)                       // event hits specific asset (fictional companies)
       + σ_idio(i) · regimeMult · ε(i,t)        // idiosyncratic noise
       + J(i,t)                                 // jump (Poisson) for surprises
```

Then:
- Clamp to price band for stocks with bands; if clamped, mark "upper/lower circuit" and apply **queue logic** (at lower circuit, player sell orders fill only a random fraction of volume; Ch 9 lesson).
- Derive OHLC: open = prev close × (1 + overnight gap component), close from return, high/low via Brownian bridge scaled by regime volatility.
- Volume = base ADV × (1 + |r| × k) × regime multiplier.

### 5.1 Factor loadings (indicative, tuned in calibration)

Positive = asset rises when the factor shock is positive. `FX` positive = rupee weakens.

| Asset / sector | GR | DG | PR | INF | OIL | FX | GPR | CRD | CRY | LIQ |
|---|---|---|---|---|---|---|---|---|---|---|
| Index (broad) | +1.0 | +0.8 | −0.4 | −0.3 | −0.3 | −0.3 | −0.4 | −0.4 | 0 | +0.6 |
| Private banks | +1.1 | +0.9 | −0.2 | −0.2 | −0.2 | −0.3 | −0.3 | −1.2 | 0 | +0.7 |
| PSU bank | +1.2 | +1.0 | −0.2 | −0.2 | −0.2 | −0.3 | −0.3 | −1.3 | 0 | +0.8 |
| NBFC | +1.1 | +0.9 | −0.9 | −0.3 | −0.2 | −0.2 | −0.3 | −1.6 | 0 | +0.9 |
| IT services | +0.8 | +0.2 | −0.3 | 0 | −0.1 | +0.6 | −0.2 | −0.2 | 0 | +0.4 |
| Pharma | +0.5 | +0.3 | −0.1 | 0 | −0.1 | +0.4 | −0.1 | −0.1 | 0 | +0.3 |
| FMCG | +0.5 | +0.5 | −0.2 | −0.5 | −0.3 | −0.1 | −0.1 | −0.1 | 0 | +0.3 |
| Auto | +1.0 | +1.1 | −0.6 | −0.4 | −0.6 | −0.2 | −0.3 | −0.4 | 0 | +0.6 |
| Aviation | +1.3 | +1.0 | −0.3 | −0.3 | −1.8 | −0.8 | −0.9 | −0.5 | 0 | +0.8 |
| Paints | +0.8 | +0.8 | −0.3 | −0.4 | −1.2 | −0.4 | −0.3 | −0.2 | 0 | +0.5 |
| Oil marketing (OMCs) | +0.8 | +0.6 | −0.2 | −0.2 | −1.5 | −0.5 | −0.4 | −0.2 | 0 | +0.5 |
| Upstream oil | +0.7 | +0.4 | −0.1 | +0.1 | +1.3 | +0.3 | +0.3 | −0.2 | 0 | +0.4 |
| Defence | +0.6 | +0.6 | −0.2 | 0 | 0 | 0 | +1.4 | −0.1 | 0 | +0.4 |
| Metals | +1.3 | +0.7 | −0.3 | +0.3 | +0.2 | +0.2 | −0.2 | −0.3 | 0 | +0.8 |
| Infra / capital goods | +1.0 | +1.2 | −0.5 | −0.2 | −0.3 | −0.2 | −0.3 | −0.4 | 0 | +0.6 |
| Hotels | +1.2 | +1.1 | −0.4 | −0.2 | −0.4 | −0.2 | −0.6 | −0.4 | 0 | +0.7 |
| Power / utilities | +0.5 | +0.5 | −0.6 | −0.2 | −0.2 | −0.1 | −0.1 | −0.2 | 0 | +0.3 |
| Gold (INR) | −0.3 | −0.1 | −0.6 | +0.5 | +0.2 | +1.0 | +0.9 | +0.6 | 0 | −0.2 |
| Crude oil fund (INR) | +0.4 | +0.2 | −0.1 | +0.3 | +1.0 | +1.0 | +0.5 | −0.1 | 0 | +0.3 |
| US stocks (INR) | +1.1 | 0 | −0.2 | 0 | −0.2 | +1.0 | −0.3 | −0.3 | 0 | +0.7 |
| Long govt bond | −0.1 | −0.2 | −1.0 (via duration) | −0.6 | −0.2 | −0.3 | 0 | +0.3 | 0 | +0.2 |
| BTC | +1.4 | 0 | −0.8 | 0 | 0 | +1.0 (INR) | −0.2 | −0.3 | +1.2 | +1.3 |
| ETH / SOL / alts | +1.8 | 0 | −1.0 | 0 | 0 | +1.0 (INR) | −0.3 | −0.3 | +1.6 | +1.6 |
| Stablecoins | 0 | 0 | 0 | 0 | 0 | +1.0 (INR) | 0 | 0 | 0 (unless depeg event) | 0 |

### 5.2 Special pricing rules

| Instrument | Rule |
|---|---|
| Mutual funds | NAV = weighted constituents' close (equity funds) or carry + duration + credit (debt funds). Orders use **next trading day's NAV**. Exit load if redeemed within config period. |
| Bonds / debt funds | Daily: `ΔP/P ≈ −D · Δy + ½ · C · (Δy)² + y/365`. Yields move with `PR`, `INF` and `CRD` (spreads). |
| Fixed deposits | Rate locked at booking = policy rate + spread. Interest accrues daily, paid at maturity. Early break = interest rate − 1% penalty (config). |
| Gold / silver (INR) | USD price × USD/INR. |
| US stocks (INR) | USD price × USD/INR. P&L split into "price" and "currency" parts. Conversion fee on buy and sell (config). |
| Crypto (INR) | USD price × USD/INR. 24/7. Fractional quantities. |
| IPO listing price | `listingGain = a + b · ln(subscriptionMultiple) + c · regimeSentiment + d · sectorMomentum + noise`, clamped by listing-day band. |
| Indices | Market-cap weighted from constituents (real names) plus a residual for non-modelled constituents. |
| Fear Index | Function of 20-day realized index volatility + regime + event severity (forward-looking bump on Critical events). |

### 5.3 Liquidity and slippage
- Spread (bps) by asset class × regime multiplier (e.g. large cap 3 bps calm → 15 bps crisis; smallcap 20 → 150 bps; alt crypto 10 → 200 bps).
- Slippage = `k · (orderValue / ADV)`, capped; large orders in crisis cost more.
- At lower circuit, fill ratio for sells = random 0–20% of requested quantity per day.

## 6. Events and contagion

### 6.1 Event definition (content JSON)

```json
{
  "id": "ch5_solvane_strikes",
  "family": "GEOPOLITICAL",
  "time": "2033-05-07T10:00:00+05:30",
  "severity": "CRITICAL",
  "headline": "Solvane launches strikes on Qarath oil facilities",
  "factorShocks": [
    { "factor": "GPR", "size": 3.0, "profile": "spike_decay", "halfLifeDays": 20 },
    { "factor": "OIL", "size": 2.5, "profile": "ramp", "rampDays": 10, "halfLifeDays": 45 },
    { "factor": "GR",  "size": -2.0, "profile": "spike_decay", "halfLifeDays": 15 },
    { "factor": "FX",  "size": 1.2, "profile": "ramp", "rampDays": 5, "halfLifeDays": 60 },
    { "factor": "LIQ", "size": -1.0, "profile": "spike_decay", "halfLifeDays": 5 }
  ],
  "forceRegime": "CRISIS",
  "directHits": [],
  "alerts": ["WORLD_CRITICAL"],
  "newsCopy": "ref:news/ch5/strikes",
  "predictionMarketsResolved": [{ "id": "pm_strike_before_june", "outcome": "YES" }],
  "sources": ["Analog: 1990 Gulf War; Feb 2022 Russia–Ukraine"]
}
```

**Shock profiles:** `spike_decay` (instant, exponential decay), `ramp` (builds over N days then decays), `step` (permanent level change, e.g. rate hike), `pulse` (one day).

### 6.2 Event chains and branches
- Events can schedule follow-ups (`onFire: [eventIds]`) with delays and probabilities (Free Play) or fixed dates (Story).
- **Branch points**: `{ id, date, options: [{ outcome, probability, events[] }] }`. Outcome rolled from the career's **branch RNG stream** at the date. Hidden until resolved; never sent to client.
- **Pre-signals:** before a branch, news and "insider leak" items shift the prediction market's informed-trader belief toward the true outcome with noise, so good readers of news have a small edge (never certainty).

### 6.3 Contagion channels (how one shock spreads)

| Channel | Example |
|---|---|
| Factor loadings | `OIL` spike hits airlines, paints, OMCs negatively and upstream oil positively in the same tick |
| Factor cross-links | `OIL` ↑ → `INF` ↑ (lag 20–40 days) → `PR` ↑ (central bank reacts at next meeting) → bonds ↓, NBFCs ↓ |
| Currency | `FX` ↑ (rupee weaker) → US stocks, gold, crypto rise in INR; IT/pharma exporters benefit; importers hurt |
| Regime | Critical events force CRISIS → vol ×3, correlations up, spreads widen, IPO listings weaker, IPO pipeline paused |
| Liquidity | `LIQ` crash → even gold and crypto drop briefly (forced selling), then gold recovers |
| Credit | `CRD` ↑ → financials ↓, debt fund NAVs ↓ (spreads widen), fictional credit-risk fund NAV shock |
| Sentiment spillover | Crypto crash → small `GR` dip (β small), unless crypto share of world wealth is set large |
| Time zones | Weekend events: crypto moves first; Monday India open gaps; US reacts in its session; next India day absorbs US close |

### 6.4 Calibration targets (historical analogs)

Approximate, for tuning only. Final targets are validated against licensed historical data in the pipeline before release.

| Event archetype | Analog | Target moves (range) |
|---|---|---|
| Oil-nation war | Gulf War 1990; Feb–Mar 2022 | Oil +40–100% over weeks; Indian index −10–20%; gold +5–12%; INR −2–5%; airlines, paints, OMCs underperform; upstream, defence outperform |
| Pandemic crash | Feb–Mar 2020 | Index about −35–40% peak to trough in ~5 weeks; two market-wide halts; recovery to prior high in ~8–10 months with stimulus; pharma/IT/telecom outperform; hotels/aviation −50%+ |
| Rate-hike cycle | 2022 | Long bonds −6–12%; growth/midcap −20–30%; crypto −60–75%; banks mixed; FD rates rise |
| Global financial crisis | 2008 | Index about −55–60% over ~10 months; FII outflows; INR −20%; gold up in INR |
| Bank failure | Yes Bank 2020; SVB 2023 | Failing bank −70–95%; bank index −10–25%; contagion 1–3 months |
| NBFC default | IL&FS 2018 | NBFCs −20–50%; debt fund NAV shocks for exposed funds |
| Stablecoin collapse | LUNA May 2022 | Stablecoin → near 0 in days; sister token −99%+; BTC −20–30% in weeks |
| Exchange collapse | FTX Nov 2022 | BTC −20–25% in a week; funds on exchange frozen; partial recovery much later |
| Election surprise | Jun 2024 | Index about −6% on the day, recovery within weeks |
| Smallcap fraud | Satyam Jan 2009 | Stock −75–85% in days, daily lower circuits |

### 6.5 Realism checks (automated, 1,000 seeded runs per chapter)
- Direction check: every event moves its tagged assets in the intended direction ≥ 90% of runs.
- Magnitude check: chapter peak drawdown within target range ≥ 80% of runs.
- Correlation check: average pairwise stock correlation higher in CRISIS than CALM.
- Fat tails: daily index return kurtosis > 3 over long Free Play runs.
- No price ≤ 0; OHLC valid; bands respected.

## 7. Central Treasury

One Treasury per Career. Every desk uses it through the same service. No desk has its own cash.

### 7.1 Balances

| Bucket | Meaning | Examples |
|---|---|---|
| `available` | Can be spent right now on any desk | After deposits, settled sales, resolved prediction payouts |
| `blocked` | Reserved for pending actions | Open limit orders, IPO applications, pending fund purchases, open prediction orders |
| `unsettled` | Money owed to the player, arriving later | Stock sale proceeds (T+1), fund redemptions, FD maturing, Vaultex recovery |
| `frozen` | Positions/cash stuck due to world events | Crypto on a failed exchange |

`cash_total = available + blocked + unsettled` (frozen tracked separately as positions at recovery-estimate value).

### 7.2 Operations (all double-entry, all in one DB transaction)

| Operation | Effect |
|---|---|
| `reserve(amount, ref)` | available → blocked (placing an order, applying to IPO) |
| `capture(amount, ref)` | blocked → spent; position created (order filled, IPO allotted) |
| `release(amount, ref)` | blocked → available (order cancelled, IPO refund) |
| `credit_unsettled(amount, settleDate, ref)` | proceeds → unsettled |
| `settle(ref)` | unsettled → available on settle date (runs on clock tick) |
| `debit(amount, type, ref)` | available → out (charges, taxes, conversion fees) |
| `credit(amount, type, ref)` | in → available (dividends, interest, prediction payouts, rewards, Time Machine settlement) |
| `freeze(positionIds, ref)` / `unfreeze(recoveryPct, ref)` | exchange failure mechanics |

### 7.3 Settlement rules by desk (config)

| Desk | Buy | Sell / exit |
|---|---|---|
| Stocks (India) | Cash captured on fill | Proceeds unsettled → available T+1 |
| IPO | Blocked at apply | Refund released on allotment date; listing-day sell = stock rules |
| Funds | Blocked, captured at next NAV | Redemption proceeds unsettled → available per config (e.g. T+2) |
| Fixed deposit | Captured at booking | Principal + interest credited on maturity; early break with penalty |
| Bonds | Captured on fill | T+1 |
| Commodities funds | Like funds/ETFs | Like funds/ETFs |
| Global stocks | INR → USD conversion fee, captured | USD → INR, T+1 then available |
| Crypto | Captured instantly | Available instantly (if on exchange); self-custody → must transfer back to exchange first (1-day delay + fee) |
| Prediction markets | Captured instantly (LMSR cost) | Sell-back instant; resolution payout instant on resolution tick |

### 7.4 Concurrency and integrity
- Every Treasury write locks the Treasury row (`SELECT ... FOR UPDATE`). All desks serialize through it, so buying crypto and stocks at the same moment can never overspend.
- `state_version` increments on every change. Clients send `expectedVersion`; a stale version returns the fresh state (the UI re-renders; no silent overwrite).
- Invariants checked in tests and nightly job:
  - `available, blocked, unsettled ≥ 0`
  - `sum(ledger) == cash_total`
  - `blocked == sum(open reservations)`
  - Positions quantity ≥ 0 on every desk

### 7.5 Net worth
```
netWorth = available + blocked + unsettled
         + Σ stocks (qty × close)
         + Σ funds (units × NAV)
         + Σ FDs (principal + accrued interest)
         + Σ bonds (clean price × qty + accrued)
         + Σ commodities, global (in INR), crypto (in INR)
         + Σ prediction positions (shares × current LMSR price)
         + Σ frozen (estimated recovery value, flagged)
```
- Snapshot saved per tick → net worth chart, drawdown and scoring.
- Real net worth = net worth / (cpiIndex / cpiIndex₀).

### 7.6 Keeping every screen in sync
- Every API response includes `{ treasury, netWorth, stateVersion }`.
- The client store (single source) updates the Treasury bar on all desks at once.
- Other open tabs: `BroadcastChannel('market-survivor')` publishes the new version; tabs refetch if behind.
- Auto-play: client requests `advance` at the chosen speed; server returns world delta + Treasury. Server caps advance rate.

## 8. Prediction markets

### 8.1 Pricing: LMSR (Logarithmic Market Scoring Rule)
Binary market with outstanding shares `q_yes`, `q_no` and liquidity parameter `b`:

```
Cost(q_yes, q_no) = b · ln( e^(q_yes/b) + e^(q_no/b) )
Price_yes         = e^(q_yes/b) / ( e^(q_yes/b) + e^(q_no/b) )
Price_no          = 1 − Price_yes
Cost to buy Δ YES = Cost(q_yes + Δ, q_no) − Cost(q_yes, q_no)
```
- Each share pays 1 coin-unit (e.g. ₹100) if correct, 0 otherwise.
- Market maker's max loss = `b · ln 2` (house-funded, virtual).
- Price shown as a probability ("62% chance").

### 8.2 Bot traders (make odds move realistically)
- **Informed bots** trade toward a belief `p̂ = trueProbability + noise`, where noise shrinks as pre-signal news arrives.
- **Noise bots** trade randomly (small size).
- **Herd bots** follow the last move (creates overreaction).
- Bots act once per tick; volumes scale with market attention (headline severity).

### 8.3 Market lifecycle
`OPEN → (trading) → CLOSED (at close time) → RESOLVED (YES/NO) → PAID`
- Resolution is triggered only by the server when the linked event/branch resolves.
- Payout credited to Treasury `available` in the same transaction.
- Markets are created only from in-game events/branches (`linkedEventId` required).

### 8.4 Hedging
Because branch outcomes also fire market events, a prediction position can offset portfolio losses (e.g. buying "Prolonged conflict: YES" in Ch 5). The debrief shows the hedge's contribution.

## 9. Crypto custody model
- Positions have `custody: EXCHANGE | SELF`.
- `EXCHANGE`: instant trading, may earn yield (story-specific), exposed to exchange failure events (frozen).
- `SELF`: safe from exchange failure, transfer fee + 1-day delay to move back to exchange before selling; exposed to a small "lost key" chance only in Chaotic difficulty (off by default).

## 10. Alert engine

### 10.1 Alert levels
Info → Watch → Warning → Critical → Market Halt (see `story.md` §3 for UI behaviour).

### 10.2 Triggers

| Category | Trigger | Level |
|---|---|---|
| World event | Event severity field | As defined |
| Index move (1 day) | −2% / −4% / −7% | Watch / Warning / Critical |
| Index drawdown from peak | −10% (correction) / −20% (bear market) / −30% | Warning / Critical / Critical |
| Circuit breaker | 10% / 15% / 20% index fall | Market Halt |
| Fear Index | +30% in a day / above crisis threshold | Warning / Critical |
| Oil (1 week) | +10% / +25% | Watch / Warning |
| Rupee (1 week) | −2% / −4% | Watch / Warning |
| Crypto (24h) | BTC −10% / −20% | Warning / Critical |
| Stablecoin | Price < 0.98 / < 0.90 | Warning / Critical |
| Stock | Hits upper/lower band; −20% in a day | Watch / Warning |
| Portfolio drawdown | −10% / −20% / −30% from peak | Watch / Warning / Critical |
| Concentration | Single asset > 25% / asset class > 60% | Watch / Warning |
| Idle cash | > 40% cash for 90+ days while inflation > 0 | Watch |
| Custody | > 20% of net worth on an exchange with rising risk | Warning |
| Unverified tip | Tipster message | Watch ("Unverified tip — see pump-and-dump lesson") |
| Prediction market | Linked market moves > 20 points in a day | Info |

### 10.3 Rules
- Dedupe: same trigger + same asset suppressed for a cooldown (e.g. 5 sim days).
- Escalation: a new higher level replaces the lower banner.
- Auto-pause on Critical and Halt (setting, default on in Story).
- Every alert links to: the event, the affected assets, and a relevant lesson.

## 11. Determinism and RNG streams
Separate seeded streams so player behaviour never changes the world:

| Stream | Used for |
|---|---|
| `world.factors` | Factor noise |
| `world.assets` | Idiosyncratic noise, jumps |
| `world.events` | Free Play event scheduling |
| `world.branches` | Branch outcomes |
| `ipo.lottery` | Allotment (keyed by IPO id + player id) |
| `pm.bots` | Prediction bot behaviour |
| `fills.slippage` | Order slippage noise (keyed by order id) |

Each stream is derived as `hash(careerSeed, streamName, date)`, so re-computing any day gives identical results.

## 12. Engine tasks

| ID | Phase | Task | Done when |
|---|---|---|---|
| EN-T01 | P1 | Treasury service with all operations + invariants | Property tests pass |
| EN-T02 | P1 | Clock + calendars (India, US, crypto) | Tests pass |
| EN-T03 | P2 | Factor processes + covariance + Cholesky | Stable over 50-year runs |
| EN-T04 | P2 | Regime model + correlation boost | Crisis correlation > calm |
| EN-T05 | P2 | Asset return model + loadings table + bands + OHLC | Realism checks pass |
| EN-T06 | P2 | Event system (profiles, chains, forced regimes) | Direction checks pass |
| EN-T07 | P3 | Special pricing (funds, bonds, FD, FX, gold, crypto, IPO) | Unit tests pass |
| EN-T08 | P3 | Liquidity/slippage/lower-circuit queue | Tests pass |
| EN-T09 | P3 | LMSR + bots + lifecycle | Math tests pass |
| EN-T10 | P3 | Custody model + freeze/unfreeze | Tests pass |
| EN-T11 | P4 | Alert engine | Trigger tests pass |
| EN-T12 | P5 | Branch system + pre-signals | Determinism tests pass |
| EN-T13 | P5–P7 | Calibration harness (1,000 runs/chapter report) | Targets met |
